import * as vscode from "vscode";
import CommandRunner from "./core/commandRunner/CommandRunner";
import { ThatMark } from "./core/ThatMark";
import { tokenizerConfiguration } from "./core/tokenizerConfiguration";
import isTesting from "./testUtil/isTesting";
import { Graph } from "./typings/Types";
import { getCommandServerApi, getParseTreeApi } from "./util/getExtensionApi";
import graphFactories from "./util/graphFactories";
import makeGraph, { FactoryMap } from "./util/makeGraph";
import {
  shouldBeSidecar,
  sidecarDirectory,
  sidecarPrefix,
  sidecarSetup,
  sidecarTeardown,
} from "./sidecar/environment";

// NOTE(pcohen): just for teardown
let _graph: Graph;

/**
 * Extension entrypoint called by VSCode on Cursorless startup.
 * - Creates a dependency container {@link Graph} with the components that
 * implement Cursorless.
 * - Creates test case recorder {@link TestCaseRecorder} for contributors to
 * use to record test cases.
 * - Creates an entrypoint for running commands {@link CommandRunner}.
 */
export async function activate(context: vscode.ExtensionContext) {
  const { getNodeAtLocation } = await getParseTreeApi();
  const commandServerApi = await getCommandServerApi();

  const useSidecar = shouldBeSidecar(context);
  const prefix: string = useSidecar ? sidecarPrefix(context) : "";

  const graph = makeGraph(
    {
      ...graphFactories,
      extensionContext: () => context,
      commandServerApi: () => commandServerApi,
      getNodeAtLocation: () => getNodeAtLocation,
      useSidecar: () => useSidecar,
      sidecarPrefix: () => prefix,
      sidecarDirectory: () => sidecarDirectory(prefix),
    } as FactoryMap<Graph>,
    ["ide"],
  );

  if (graph.useSidecar) {
    try {
      sidecarSetup(graph);
    } catch (e) {
      vscode.window.showErrorMessage(`${e}`);
    }
  }
  graph.debug.init();
  graph.snippets.init();
  await graph.decorations.init();
  graph.hatTokenMap.init();
  graph.testCaseRecorder.init();
  graph.cheatsheet.init();
  graph.statusBarItem.init();

  const thatMark = new ThatMark();
  const sourceMark = new ThatMark();

  // TODO: Do this using the graph once we migrate its dependencies onto the graph
  new CommandRunner(graph, thatMark, sourceMark);

  // TODO: Remove this once tokenizer has access to graph
  if (isTesting()) {
    tokenizerConfiguration.mockWordSeparators();
  }

  _graph = graph;

  return {
    thatMark,
    sourceMark,
    graph: isTesting() ? graph : undefined,
    experimental: {
      registerThirdPartySnippets: graph.snippets.registerThirdPartySnippets,
    },
  };
}

// this method is called when your extension is deactivated
export function deactivate() {
  console.log("Cursorless deactivating...");

  try {
    sidecarTeardown(_graph);
  } catch (e) {
    console.log(`Error tearing down sidecar: ${e}`);
  }

  console.log("Cursorless deactivated!!");
}
