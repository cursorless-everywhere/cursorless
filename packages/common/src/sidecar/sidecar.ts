import * as console from "console";
import { TokenHat } from "../types/HatTokenMap";
import { rangeToPlainObject } from "../testUtil/toPlainObject";
import path from "path";
import fs from "fs";
import { IDE } from "../ide/types/ide.types";
import { Range } from "../types/Range";

export class Sidecar {
  readonly enabled: boolean;
  readonly prefix: string;
  readonly rootDirectory: string;

  constructor(enabled: boolean, prefix: string, rootDirectory: string) {
    this.enabled = enabled;
    this.prefix = prefix;
    this.rootDirectory = rootDirectory;
  }

  editorState() {
    // TODO(pcohen): type definition
    return JSON.parse(
      fs.readFileSync(
        path.join(this.rootDirectory, `editor-state.json`),
        "utf-8",
      ),
    );
  }

  stateForEditor(fileName: string) {
    const state = this.editorState();

    let activeEditorState;

    if (state.editors) {
      activeEditorState = state.editors.find(
        (e: any) => e && e["temporaryFilePath"] === fileName,
      );
    } else if (state["activeEditor"]) {
      // fallback to the old object definition of activeEditor
      activeEditorState = state["activeEditor"];
    }

    if (!activeEditorState) {
      throw Error(
        `Unable to find an editor state for ${path.basename(fileName)}!`,
      );
    }

    return activeEditorState;
  }

  visibleRanges(fileName: string): Range[] {
    const activeEditorState = this.stateForEditor(fileName);

    // TODO(pcohen): add visibleRanges to the schema explicitly
    return [
      new Range(
        activeEditorState["firstVisibleLine"],
        0,
        activeEditorState["lastVisibleLine"],
        0,
      ),
    ];
  }

  serializeHats(ide: IDE, tokenHats: TokenHat[]) {
    // NOTE(pcohen): write out the hats now that we have changed them
    const serialized: any = {};

    const result: any = {};
    const filename = ide.activeTextEditor?.document.uri.path;

    tokenHats.forEach((hat: TokenHat) => {
      if (!filename) {
        return;
      }

      if (!result[hat.hatStyle]) {
        result[hat.hatStyle] = [];
      }

      result[hat.hatStyle].push(rangeToPlainObject(hat.hatRange));
    });
    serialized[filename] = result;

    const hatsFileName = `vscode-hats.json`;
    const directory = this.rootDirectory;

    const hatsFilePath = path.join(directory, hatsFileName);
    const tempHatsFilePath = path.join(directory, `.${hatsFileName}`);

    try {
      // write to a hidden file first so eager file watchers don't get partial files.
      // then perform a move to the proper location. this *should* be atomic?
      // TODO: should we be deleting both of these files on cursorless startup?
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      fs.writeFileSync(tempHatsFilePath, JSON.stringify(serialized));
      fs.rename(tempHatsFilePath, hatsFilePath, (err: any) => {
        if (err) {
          throw err;
        }
      });
    } catch (e) {
      // NOTE(pcohen): how to throw an error?
      console.error(`Error writing ${hatsFilePath}: ${e}`);
      throw new Error(`Error writing ${hatsFilePath}: ${e}`);
      // vscode.window.showErrorMessage(
      //   `Error writing ${hatsFilePath} (nonfatal): ${e}`,
      // );
    }
  }
}
