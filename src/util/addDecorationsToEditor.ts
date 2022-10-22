import { concat, flatten, maxBy, min } from "lodash";
import isTesting from "../testUtil/isTesting";
import * as vscode from "vscode";
import { Range } from "vscode";
import { HatStyleName } from "../core/hatStyles";
import { getTokenMatcher } from "../core/tokenizer";
import Decorations from "../core/Decorations";
import { IndividualHatMap } from "../core/IndividualHatMap";
import { rangeToPlainObjectWithOffsets } from "../testUtil/toPlainObject";
import { TokenGraphemeSplitter } from "../core/TokenGraphemeSplitter";
import { Token } from "../typings/Types";
import { getDisplayLineMap } from "./getDisplayLineMap";
import { getTokenComparator } from "./getTokenComparator";
import { getTokensInRange } from "./getTokensInRange";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const CURSORLESS_ROOT = path.join(os.homedir(), ".cursorless");
// TODO(pcohen): move to reading the graph
const CURSORLESS_PREFIX = process.env.CURSORLESS_PREFIX || "";

try {
  // TODO(pcohen): move to extension initialization
  if (!fs.existsSync(CURSORLESS_ROOT)) {
    fs.mkdirSync(CURSORLESS_ROOT);
  }
} catch (e) {
  vscode.window.showErrorMessage(
    `Error creating ${CURSORLESS_ROOT} (nonfatal): ${e}`
  );
}

/**
 * Returns the visible ranges from the actual editor for Cursorless Everywhere
 * for the given editor path (which is the temporary filepath) so we can use them
 * instead of VS Code's active ranges.
 *
 * This way, the size of the sidecar is irrelevant.
 *
 * TODO(pcohen): move into the IDE abstraction
 */
function realVisibleRanges(fileName: string): vscode.Range[] {
  // TODO(pcohen): eliminate this duplication with the sidecar extension
  // -- make the extensions talk to each other
  const state = JSON.parse(
    fs.readFileSync(path.join(CURSORLESS_ROOT, `editor-state.json`), "utf-8")
  );

  let activeEditorState;

  if (state.editors) {
    activeEditorState = state.editors.find(
      (e: any) => e && e["temporaryFilePath"] === fileName
    );
  } else if (state["activeEditor"]) {
    // fallback to the old object definition of activeEditor
    activeEditorState = state["activeEditor"];
  }

  if (!activeEditorState) {
    vscode.window.showErrorMessage(
      `Unable to find an editor state for ${path.basename(fileName)}!`
    );
    return [];
  }

  // TODO(pcohen): add visibleRanges to the schema explicitly
  return [
    new Range(
      activeEditorState["firstVisibleLine"],
      0,
      activeEditorState["lastVisibleLine"],
      0
    ),
  ];
}

export function addDecorationsToEditors(
  hatTokenMap: IndividualHatMap,
  decorations: Decorations,
  tokenGraphemeSplitter: TokenGraphemeSplitter,
  useSideCar: boolean
) {
  hatTokenMap.clear();

  let editors: readonly vscode.TextEditor[];

  if (vscode.window.activeTextEditor == null) {
    editors = vscode.window.visibleTextEditors;
  } else {
    editors = [
      vscode.window.activeTextEditor,
      ...vscode.window.visibleTextEditors.filter(
        (editor) => editor !== vscode.window.activeTextEditor
      ),
    ];
  }

  const tokens = concat(
    [],
    ...editors.map((editor) => {
      const visibleRanges = useSideCar
        ? realVisibleRanges(editor.document?.fileName)
        : editor.visibleRanges;
      const displayLineMap = getDisplayLineMap(editor, visibleRanges);
      const languageId = editor.document.languageId;
      const tokens: Token[] = flatten(
        visibleRanges.map((range) =>
          getTokensInRange(editor, range).map((partialToken) => ({
            ...partialToken,
            displayLine: displayLineMap.get(partialToken.range.start.line)!,
            editor,
            expansionBehavior: {
              start: {
                type: "regex",
                regex: getTokenMatcher(languageId),
              },
              end: { type: "regex", regex: getTokenMatcher(languageId) },
            },
          }))
        )
      );

      tokens.sort(
        getTokenComparator(
          displayLineMap.get(editor.selection.active.line)!,
          editor.selection.active.character
        )
      );

      return tokens;
    })
  );

  /**
   * Maps each grapheme to a list of the indices of the tokens in which the given
   * grapheme appears.
   */
  const graphemeTokenIndices: {
    [key: string]: number[];
  } = {};

  tokens.forEach((token, tokenIdx) => {
    tokenGraphemeSplitter
      .getTokenGraphemes(token.text)
      .forEach(({ text: graphemeText }) => {
        let tokenIndicesForGrapheme: number[];

        if (graphemeText in graphemeTokenIndices) {
          tokenIndicesForGrapheme = graphemeTokenIndices[graphemeText];
        } else {
          tokenIndicesForGrapheme = [];
          graphemeTokenIndices[graphemeText] = tokenIndicesForGrapheme;
        }

        tokenIndicesForGrapheme.push(tokenIdx);
      });
  });

  const graphemeDecorationIndices: { [grapheme: string]: number } = {};

  const decorationRanges: Map<
    vscode.TextEditor,
    {
      [decorationName in HatStyleName]?: vscode.Range[];
    }
  > = new Map(
    editors.map((editor) => [
      editor,
      Object.fromEntries(
        decorations.decorations.map((decoration) => [decoration.name, []])
      ),
    ])
  );

  // Picks the character with minimum color such that the next token that contains
  // that character is as far away as possible.
  // TODO: Could be improved by ignoring subsequent tokens that also contain
  // another character that can be used with lower color. To compute that, look
  // at all the other characters in the given subsequent token, look at their
  // current color, and add the number of times it appears in between the
  // current token and the given subsequent token.
  //
  // Here is an example where the existing algorithm false down:
  // "ab ax b"
  tokens.forEach((token, tokenIdx) => {
    const tokenGraphemes = tokenGraphemeSplitter
      .getTokenGraphemes(token.text)
      .map((grapheme) => ({
        ...grapheme,
        decorationIndex:
          grapheme.text in graphemeDecorationIndices
            ? graphemeDecorationIndices[grapheme.text]
            : 0,
      }));

    const minDecorationIndex = min(
      tokenGraphemes.map(({ decorationIndex }) => decorationIndex)
    )!;

    if (minDecorationIndex >= decorations.decorations.length) {
      return;
    }

    const bestGrapheme = maxBy(
      tokenGraphemes.filter(
        ({ decorationIndex }) => decorationIndex === minDecorationIndex
      ),
      ({ text }) =>
        min(
          graphemeTokenIndices[text].filter(
            (laterTokenIdx) => laterTokenIdx > tokenIdx
          )
        ) ?? Infinity
    )!;

    const currentDecorationIndex = bestGrapheme.decorationIndex;

    const hatStyleName = decorations.decorations[currentDecorationIndex].name;

    decorationRanges
      .get(token.editor)!
      [hatStyleName]!.push(
        new vscode.Range(
          token.range.start.translate(undefined, bestGrapheme.tokenStartOffset),
          token.range.start.translate(undefined, bestGrapheme.tokenEndOffset)
        )
      );

    hatTokenMap.addToken(hatStyleName, bestGrapheme.text, token);

    graphemeDecorationIndices[bestGrapheme.text] = currentDecorationIndex + 1;
  });

  // NOTE(pcohen): write out the hats now that we have changed them
  const serialized: any = {};

  decorationRanges.forEach((ranges, editor) => {
    const result: any = {};
    decorations.hatStyleNames.forEach((hatStyleName) => {
      result[hatStyleName] = ranges[hatStyleName]!.map((r) =>
        rangeToPlainObjectWithOffsets(r, editor)
      );
    });
    serialized[editor.document.uri.path] = result;
  });

  const hatsFileName = `${CURSORLESS_PREFIX}vscode-hats.json`;
  const hatsFilePath = path.join(CURSORLESS_ROOT, hatsFileName);
  const tempHatsFilePath = path.join(CURSORLESS_ROOT, `.${hatsFileName}`);

  try {
    // write to a hidden file first so eager file watchers don't get partial files.
    // then perform a move to the proper location. this *should* be atomic?
    // TODO: should we be deleting both of these files on cursorless startup?
    fs.writeFileSync(tempHatsFilePath, JSON.stringify(serialized));
    fs.rename(tempHatsFilePath, hatsFilePath, (err: any) => {
      if (err) {
        throw err;
      }
    });
  } catch (e) {
    vscode.window.showErrorMessage(
      `Error writing ${hatsFilePath} (nonfatal): ${e}`
    );
  }

  decorationRanges.forEach((ranges, editor) => {
    decorations.hatStyleNames.forEach((hatStyleName) => {
      editor.setDecorations(
        decorations.decorationMap[hatStyleName]!,
        ranges[hatStyleName]!
      );
    });
  });
}
