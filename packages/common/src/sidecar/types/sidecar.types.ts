import * as console from "console";
import {TokenHat} from "../../types/HatTokenMap";
import {rangeToPlainObject} from "../../testUtil/toPlainObject";
import path from "path";
import os from "os";
import fs from "fs";
import {IDE} from "../../ide/types/ide.types";

export class Sidecar {
  readonly enabled: boolean;
  readonly prefix: string;
  readonly rootDirectory: string;

  constructor(enabled: boolean, prefix: string, rootDirectory: string) {
    this.enabled = enabled;
    this.prefix = prefix;
    this.rootDirectory = rootDirectory;
  }

  visibleRanges() {
    console.log("hello world");
  }

  serializeHats(ide: IDE, tokenHats: TokenHat[]) {
    // NOTE(pcohen): write out the hats now that we have changed them
    const serialized: any = {};

    tokenHats.forEach((hat: TokenHat) => {
      const result: any = {};

      const filename = ide.activeTextEditor?.document.uri.path;

      if (!filename) {
        return;
      }

      if (!result[hat.hatStyle]) {
        result[hat.hatStyle] = [];
      }

      result[hat.hatStyle].push(rangeToPlainObject(hat.hatRange));
      serialized[filename] = result;
    });
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
