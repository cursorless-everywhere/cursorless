import * as vscode from "vscode";
import { commands, Uri } from "vscode";

import {
  FEATURE_FLAG_ENABLED,
  FEATURE_FLAG_PERFORM_SCROLLING,
  readFlagFile,
} from "./featureFlags";
import * as fs from "fs";
import {
  CURSORLESS_ROOT_DIRECTORY,
  MAXIMUM_VISIBLE_EDITORS,
} from "./constants";
import * as path from "path";
import { isEqual, map } from "lodash";
import { focusEditor } from "../util/setSelectionsAndFocusEditor";

const columnFocusCommands = {
  [vscode.ViewColumn.One]: "workbench.action.focusFirstEditorGroup",
  [vscode.ViewColumn.Two]: "workbench.action.focusSecondEditorGroup",
  [vscode.ViewColumn.Three]: "workbench.action.focusThirdEditorGroup",
  [vscode.ViewColumn.Four]: "workbench.action.focusFourthEditorGroup",
  [vscode.ViewColumn.Five]: "workbench.action.focusFifthEditorGroup",
  [vscode.ViewColumn.Six]: "workbench.action.focusSixthEditorGroup",
  [vscode.ViewColumn.Seven]: "workbench.action.focusSeventhEditorGroup",
  [vscode.ViewColumn.Eight]: "workbench.action.focusEighthEditorGroup",
  [vscode.ViewColumn.Nine]: "workbench.action.focusNinthEditorGroup",
  [vscode.ViewColumn.Active]: "",
  [vscode.ViewColumn.Beside]: "",
};

async function focusViewColumnWithNumber(
  viewColumn: keyof typeof columnFocusCommands,
) {
  const cmd: any = columnFocusCommands[viewColumn] as string;
  if (!cmd) {
    vscode.window.showErrorMessage(`View column ${viewColumn} not supported`);
    return;
  }
  await commands.executeCommand(cmd);
}

// ================================================================================
// Applying the the primary/other editor's state
// ================================================================================

/**
 * Updates the state for a single editor to reflect the state object (from the exterior editor).
 */
async function updateEditorState(
  editorState: any,
  editor: vscode.TextEditor,
  isActive: boolean,
) {
  let destPath = editorState["path"];

  // TODO(pcohen): forward the language mode from the source editor, rather than just relying on the file extension
  // (see workbench.action.editor.changeLanguageMode, but also, there is a direct
  // API for this: vscode.languages.setLanguageId, and a voice command: "change language Python")

  // Prefer the temporary file if it's available
  if (editorState["temporaryFilePath"]) {
    destPath = editorState["temporaryFilePath"];
  }

  if (destPath !== editor?.document.uri.path) {
    throw new Error(
      `Expected editor to be at path ${destPath} but was at ${editor?.document.uri.path}`,
    );
  }

  // If we got into a state where the editor has local changes, always revert them. Otherwise all subsequent
  // commands will fail.
  //
  // Note that this shouldn't happen ideally. This can happen if chaining is attempted (need to find
  // a better synchronization solution).
  if (editor?.document.isDirty) {
    await commands.executeCommand("workbench.action.files.revert");
  }

  if (readFlagFile(FEATURE_FLAG_PERFORM_SCROLLING, true) && isActive) {
    commands.executeCommand("revealLine", {
      lineNumber: editorState["firstVisibleLine"] - 1,
      at: "top",
    });
  }

  if (editor) {
    if (editorState["selections"]) {
      editor.selections = editorState["selections"].map((selection: any) => {
        return new vscode.Selection(
          selection.anchor.line,
          selection.anchor.column,
          selection.active.line,
          selection.active.column,
        );
      });
    } else {
      // TODO(rntz): migrate to |editorState["selections"]|
      editor.selections = editorState["cursors"].map(
        (cursor: any) =>
          new vscode.Selection(
            cursor.line,
            cursor.column,
            cursor.line,
            cursor.column,
          ),
      );
    }
  }
}

async function reopenAll(state: any, andFocus: boolean = true) {
  // Close the other tabs that might have been opened.
  // TODO(pcohen): this seems to always leave one additional tab open.
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor?.document.isDirty) {
      await commands.executeCommand("workbench.action.files.revert");
    }
  }
  await commands.executeCommand("workbench.action.closeAllEditors");

  let index = 1;
  for (const editorState of state["editors"]) {
    await vscode.window.showTextDocument(
      Uri.file(editorState["temporaryFilePath"]),
      { viewColumn: index },
    );
    index += 1;
  }

  if (andFocus) {
    await focusActiveEditor(state);
  }
}

async function focusActiveEditor(state: any) {
  const editors = state["editors"];
  // eslint-disable-next-line no-restricted-properties
  const activeEditor = vscode.window.activeTextEditor;

  const activeStateEditor = editors.find((e: any) => e["active"]);

  if (!activeStateEditor) {
    vscode.window.showErrorMessage("No active editor");
    return;
  }

  const baseName = path.basename(activeStateEditor["path"]);
  if (
    activeEditor &&
    activeEditor.document.uri.path === activeStateEditor["temporaryFilePath"]
  ) {
    // vscode.window.showInformationMessage(
    //   `${baseName} is properly active; nothing to do`,
    // );
    return;
  }

  const desiredEditor = vscode.window.visibleTextEditors.find(
    (e) => e.document.uri.path === activeStateEditor["temporaryFilePath"],
  );

  if (!desiredEditor) {
    return;
  }
  // await focusEditor(desiredEditor);

  const desiredEditorIndex =
    vscode.window.visibleTextEditors.indexOf(desiredEditor) + 1;
  if (desiredEditor) {
    const message =
      `${Date.now()}: Focusing ${baseName} (#${desiredEditorIndex})` +
      (activeEditor
        ? ` instead  ${path.basename(activeEditor.document.uri.path)}`
        : ``);

    // vscode.window.showInformationMessage(message);
    // await reopenAll(state);

    await focusEditor(desiredEditor);

    // await focusViewColumnWithNumber(desiredEditorIndex);
    // eslint-disable-next-line no-restricted-properties
    const newActiveEditor = vscode.window.activeTextEditor;

    if (newActiveEditor === activeEditor && newActiveEditor) {
      const newActiveEditorIndex =
        vscode.window.visibleTextEditors.indexOf(newActiveEditor) + 1;
      const newActiveEditorBaseName = path.basename(
        newActiveEditor.document.uri.path,
      );
      vscode.window.showErrorMessage(
        `Failed to focus ${baseName} (#${desiredEditorIndex}); got #${newActiveEditorIndex} (${newActiveEditorBaseName}) instead`,
      );
      // await commands.executeCommand("workbench.action.closeAllEditors");
      // await focusViewColumnWithNumber(1);
      // await focusViewColumnWithNumber(2);
      // await focusViewColumnWithNumber(desiredEditorIndex);
      // await reopenAll(state, false);
    } else {
      vscode.window.showInformationMessage(
        `Focused ${baseName} (#${desiredEditorIndex})!`,
      );
    }
  } else {
    vscode.window.showErrorMessage(
      `Could not find ${baseName} (#${desiredEditorIndex})`,
    );
  }
}

export async function applyPrimaryEditorState() {
  if (!readFlagFile(FEATURE_FLAG_ENABLED, true)) {
    console.log(
      `applyPrimaryEditorState: ${FEATURE_FLAG_ENABLED} set to false; not synchronizing`,
    );
    return;
  }

  const state = JSON.parse(
    fs.readFileSync(
      path.join(CURSORLESS_ROOT_DIRECTORY, "editor-state.json"),
      "utf8",
    ),
  );
  const editors = state["editors"];

  if (editors.length >= MAXIMUM_VISIBLE_EDITORS) {
    vscode.window.showInformationMessage(
      `Too many editors (${editors.length}); only showing the first ${MAXIMUM_VISIBLE_EDITORS}`,
    );
    editors.slice(0, MAXIMUM_VISIBLE_EDITORS);
  }

  const visibleEditors = vscode.window.visibleTextEditors;
  const desiredTemporaryFilePaths: string[] = state["editors"].map(
    (e: any) => e["temporaryFilePath"],
  );
  const visibleFilePaths = map(
    visibleEditors,
    (editor) => editor.document.uri.path,
  );

  // Readjust the visible split panes if needed.
  if (!isEqual(desiredTemporaryFilePaths, visibleFilePaths)) {
    vscode.window.showInformationMessage(
      "Different visible windows; readjusting",
    );
    await reopenAll(state);
  }

  // Focus the active editor.
  await focusActiveEditor(state);

  // Update the states in all of the editors.
  for (const editor of vscode.window.visibleTextEditors) {
    const editorState = editors.find(
      (e: any) => e["temporaryFilePath"] === editor.document.uri.path,
    );
    if (!editorState) {
      vscode.window.showInformationMessage(
        `No state for ${editor.document.uri.path}`,
      );
      continue;
    }

    // eslint-disable-next-line no-restricted-properties
    const isActive = editor === vscode.window.activeTextEditor;
    if (isActive) {
      vscode.window.showInformationMessage(`Active: ${editorState["path"]}`);
    }
    await updateEditorState(editorState, editor, isActive);
  }
}

/**
 * Registers file watchers so that when the exterior editor changes it state, we update VS Code.
 */
export function registerFileWatchers() {
  const watcher = vscode.workspace.createFileSystemWatcher(
    // NOTE(pcohen): we only want to watch editor-state.json but for some reason the watcher doesn't take a exact path
    new vscode.RelativePattern(CURSORLESS_ROOT_DIRECTORY, "*-state.json"),
  );

  watcher.onDidChange((_) => applyPrimaryEditorState());
  watcher.onDidCreate((_) => applyPrimaryEditorState());

  applyPrimaryEditorState();
}
