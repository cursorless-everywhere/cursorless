import { env, Uri, window } from "vscode";
import { Target } from "../typings/target.types";
import { Graph } from "../typings/Types";
import { getLinkForTarget } from "../util/getLinks";
import { createThatMark, ensureSingleTarget } from "../util/targetUtils";
import { Action, ActionReturnValue } from "./actions.types";

export default class FollowLink implements Action {
  constructor(private graph: Graph) {
    this.run = this.run.bind(this);
  }

  async run([targets]: [Target[]]): Promise<ActionReturnValue> {
    const target = ensureSingleTarget(targets);

    await this.graph.editStyles.displayPendingEditDecorations(
      targets,
      this.graph.editStyles.referenced
    );

    // NOTE(pcohen): this is where we would call out to JetBrains
    // all "editor actions" need to operate purely on ranges,
    // not targets.

    // NOTE(pcohen): this is for stuff like links in the
    // https://microsoft.com
    const link = await getLinkForTarget(target);
    if (link) {
      await this.openUri(link.target!);
    } else {
      await this.graph.actions.executeCommand.run(
        [targets],
        "editor.action.revealDefinition",
        { restoreSelection: false }
      );
    }

    return {
      thatSelections: createThatMark(targets),
    };
  }

  private async openUri(uri: Uri) {
    switch (uri.scheme) {
      case "http":
      case "https":
        await env.openExternal(uri);
        break;
      case "file":
        await window.showTextDocument(uri);
        break;
      default:
        throw Error(`Unknown uri scheme '${uri.scheme}'`);
    }
  }
}
