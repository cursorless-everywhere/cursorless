import type { Disposable, Hats, TokenHat } from "@cursorless/common";
import { ide } from "../singletons/ide.singleton";
import tokenGraphemeSplitter from "../singletons/tokenGraphemeSplitter.singleton";
import { allocateHats } from "../util/allocateHats";
import { IndividualHatMap } from "./IndividualHatMap";
import {rangeToPlainObject} from "@cursorless/common";
import fs from "fs";
import path from "path";
import os from "os";
import {sidecar} from "../singletons/sidecar.singleton";


interface Context {
  getActiveMap(): Promise<IndividualHatMap>;
}

export class HatAllocator {
  private timeoutHandle: NodeJS.Timeout | null = null;
  private disposables: Disposable[] = [];

  constructor(private hats: Hats, private context: Context) {
    ide().disposeOnExit(this);

    this.allocateHatsDebounced = this.allocateHatsDebounced.bind(this);

    this.disposables.push(
      this.hats.onDidChangeEnabledHatStyles(this.allocateHatsDebounced),
      this.hats.onDidChangeIsEnabled(this.allocateHatsDebounced),

      // An event that fires when a text document opens
      ide().onDidOpenTextDocument(this.allocateHatsDebounced),
      // An event that fires when a text document closes
      ide().onDidCloseTextDocument(this.allocateHatsDebounced),
      // An Event which fires when the active editor has changed. Note that the event also fires when the active editor changes to undefined.
      ide().onDidChangeActiveTextEditor(this.allocateHatsDebounced),
      // An Event which fires when the array of visible editors has changed.
      ide().onDidChangeVisibleTextEditors(this.allocateHatsDebounced),
      // An event that is emitted when a text document is changed. This usually happens when the contents changes but also when other things like the dirty-state changes.
      ide().onDidChangeTextDocument(this.allocateHatsDebounced),
      // An Event which fires when the selection in an editor has changed.
      ide().onDidChangeTextEditorSelection(this.allocateHatsDebounced),
      // An Event which fires when the visible ranges of an editor has changed.
      ide().onDidChangeTextEditorVisibleRanges(this.allocateHatsDebounced),
      // Re-draw hats on grapheme splitting algorithm change in case they
      // changed their token hat splitting setting.
      tokenGraphemeSplitter().registerAlgorithmChangeListener(
        this.allocateHatsDebounced,
      ),
    );
  }

  /**
   * Allocate hats to the visible tokens.
   *
   * @param oldTokenHats If supplied, pretend that this allocation was the
   * previous allocation when trying to maintain stable hats.  This parameter is
   * used for testing.
   */
  async allocateHats(oldTokenHats?: TokenHat[]) {
    const activeMap = await this.context.getActiveMap();

    const tokenHats = this.hats.isEnabled
      ? allocateHats(
          tokenGraphemeSplitter(),
          this.hats.enabledHatStyles,
          oldTokenHats ?? activeMap.tokenHats,
          ide().configuration.getOwnConfiguration("experimental.hatStability"),
          ide().activeTextEditor,
          ide().visibleTextEditors,
        )
      : [];

    activeMap.setTokenHats(tokenHats);

    await this.hats.setHatRanges(
      tokenHats.map(({ hatStyle, hatRange, token: { editor } }) => ({
        editor,
        range: hatRange,
        styleName: hatStyle,
      })),
    );

    // -- Sidecar fork start --

    // NOTE(pcohen): write out the hats now that we have changed them
    const serialized: any = {};

    tokenHats.forEach((hat: TokenHat) => {
      const result: any = {};

      const filename = ide().activeTextEditor?.document.uri.path;

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
    const directory = path.join(os.homedir(), ".cursorless-new");

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

    // -- Sidecar fork end --
  }

  allocateHatsDebounced() {
    if (this.timeoutHandle != null) {
      clearTimeout(this.timeoutHandle);
    }

    const decorationDebounceDelayMs = ide().configuration.getOwnConfiguration(
      "decorationDebounceDelayMs",
    );

    this.timeoutHandle = setTimeout(() => {
      this.allocateHats();
      this.timeoutHandle = null;
    }, decorationDebounceDelayMs);
  }

  dispose() {
    this.disposables.forEach(({ dispose }) => dispose());

    if (this.timeoutHandle != null) {
      clearTimeout(this.timeoutHandle);
    }
  }
}
