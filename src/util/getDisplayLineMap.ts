import { concat, flatten, flow, range, uniq } from "lodash";
import * as vscode from "vscode";

/**
 * Returns a map from line numbers in the file to display lines, which skip
 * folded sections etc.  Note that if the cursor is currently offscreen, it
 * will add a line for the cursor before or after the screen lines depending
 * whether cursor is above or below last visible line.
 *
 * @param editor A visible editor
 * // TODO(pcohen): ^ move the above to the IDE abstraction
 * @param visibleRanges the editor's visible ranges
 */
export function getDisplayLineMap(
  editor: vscode.TextEditor,
  visibleRanges: vscode.Range[]
) {
  return new Map(
    flow(
      flatten,
      uniq
    )(
      concat(
        [[editor.selection.start.line]],
        visibleRanges.map((visibleRange) =>
          range(visibleRange.start.line, visibleRange.end.line + 1)
        )
      )
    )
      .sort((a, b) => a - b)
      .map((value, index) => [value, index])
  );
}
