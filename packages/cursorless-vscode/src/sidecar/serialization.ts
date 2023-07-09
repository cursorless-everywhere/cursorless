import * as vscode from "vscode";
import * as fs from "fs";

/**
 * Serializes the state of VS Code, returning as an object.
 *
 * @param includeEditorContents if true, the contents of the active editor will be written to a temporary file,
 * and the path included in the result
 */
export function vsCodeState(includeEditorContents: boolean = false) {
  // eslint-disable-next-line no-restricted-properties
  const editor = vscode.window.activeTextEditor;

  const result = {
    path: editor?.document.uri.path,
    contentsPath: null as string | null,
    cursors: editor?.selections.map((s) => {
      return {
        anchor: {
          line: s.anchor.line,
          character: s.anchor.character,
        },
        active: {
          line: s.active.line,
          character: s.active.character,
        },
        // NOTE(pcohen): these are included just for ease of implementation;
        // obviously the receiving end could which of the anchor/active is the start/end
        start: {
          line: s.start.line,
          character: s.start.character,
        },
        end: {
          line: s.end.line,
          character: s.end.character,
        },
      };
    }),
  };

  if (includeEditorContents) {
    // For simplicity will just write to the active path + ".out",
    // assuming the active path is a temporary file.
    const contentsPath = `${result.path}.out`;
    const contents = editor?.document.getText();
    if (contents) {
      fs.writeFileSync(contentsPath, contents);
      result["contentsPath"] = contentsPath;
    }
  }

  return result;
}
