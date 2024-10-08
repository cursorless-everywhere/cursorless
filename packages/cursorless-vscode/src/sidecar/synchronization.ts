import * as vscode from "vscode";
import { commands, Uri } from "vscode";

import {
  FEATURE_FLAG_ENABLED,
  FEATURE_FLAG_PERFORM_SCROLLING,
  readFlagFile,
} from "./featureFlags";
import * as fs from "fs";
import * as path from "path";

// ================================================================================
// Applying the the primary/other editor's state
// ================================================================================

/**
 * Reads the state of the primary ("superior") editor and makes VS Code mimic it
 * (current file, selections, scroll area, etc.)
 */
export async function applyPrimaryEditorState(rootDirectory: string) {
  if (!readFlagFile(FEATURE_FLAG_ENABLED, true)) {
    console.log(
      `applyPrimaryEditorState: ${FEATURE_FLAG_ENABLED} set to false; not synchronizing`,
    );
    return;
  }

  // TODO(pcohen): diff the state against the previous state
  const state = JSON.parse(
    fs.readFileSync(path.join(rootDirectory, "editor-state.json"), "utf8"),
  );
  const activeEditorState = state["activeEditor"];

  // eslint-disable-next-line no-restricted-properties
  const editor = vscode.window.activeTextEditor;

  // If we got into a state where the editor has local changes, always revert them. Otherwise all subsequent
  // commands will fail.
  //
  // Note that this shouldn't happen ideally. This can happen if chaining is attempted (need to find
  // a better synchronization solution).
  if (editor?.document.isDirty) {
    await commands.executeCommand("workbench.action.files.revert");
  }

  let destPath = activeEditorState["path"];

  // TODO(pcohen): forward the language mode from the source editor, rather than just relying on the file extension
  // (see workbench.action.editor.changeLanguageMode, but also, there is a direct
  // API for this: vscode.languages.setLanguageId, and a voice command: "change language Python")

  // Prefer the temporary file if it's available
  if (activeEditorState["temporaryFilePath"]) {
    destPath = activeEditorState["temporaryFilePath"];
  }

  if (destPath !== editor?.document.uri.path) {
    // vscode.window.showInformationMessage("Changing paths to " + state["currentPath"]);

    // TODO(pcohen): we need to make this blocking; I believe the commands below
    // run too early when the currently opened file is changed.
    await commands.executeCommand("vscode.open", Uri.file(destPath));

    // Close the other tabs that might have been opened.
    // TODO(pcohen): this seems to always leave one additional tab open.
    await commands.executeCommand("workbench.action.closeOtherEditors");
  }

  if (readFlagFile(FEATURE_FLAG_PERFORM_SCROLLING, true)) {
    commands.executeCommand("revealLine", {
      lineNumber: activeEditorState["firstVisibleLine"] - 1,
      at: "top",
    });
  }

  if (editor) {
    if (activeEditorState["selections"]) {
      editor.selections = activeEditorState["selections"].map(
        (selection: any) => {
          return new vscode.Selection(
            selection.anchor.line,
            selection.anchor.column,
            selection.active.line,
            selection.active.column,
          );
        },
      );
    } else {
      // TODO(rntz): migrate to |activeEditorState["selections"]|
      editor.selections = activeEditorState["cursors"].map(
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

/**
 * Registers file watchers so that when the exterior editor changes it state, we update VS Code.
 */
export function registerFileWatchers(rootDirectory: string) {
  const watcher = vscode.workspace.createFileSystemWatcher(
    // NOTE(pcohen): we only want to watch editor-state.json but for some reason the watcher doesn't take a exact path
    new vscode.RelativePattern(rootDirectory, "*-state.json"),
  );

  watcher.onDidChange((_) => applyPrimaryEditorState(rootDirectory));
  watcher.onDidCreate((_) => applyPrimaryEditorState(rootDirectory));

  applyPrimaryEditorState(rootDirectory);
}
