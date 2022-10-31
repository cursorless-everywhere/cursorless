import isTesting from "../testUtil/isTesting";

import { workspace } from "vscode";
import * as vscode from "vscode";
import * as fs from "fs";
import { CURSORLESS_ROOT_DIRECTORY } from "./constants";
import { registerFileWatchers } from "./synchronization";
import { startCommandServer } from "./commandServer";
import { Graph } from "../typings/Types";
import * as path from "path";

/**
 * Returns whether we should run as the Cursorless everywhere sidecar.
 */
export function shouldBeSidecar(
  extensionContext: vscode.ExtensionContext,
): boolean {
  // NOTE(pcohen): sidecar mode can be enabled with three ways:
  // (1) the `CURSORLESS_SIDECAR` environment variable is enabled
  // (2) the `cursorless.useSidecar` setting is enabled -- this allows you to permanently turn a VS Code installation into a sidecar
  // (3) we are running in debug mode (presuming that if you're debugging this extension, you want to test the sidecar functionality)

  const CURSORLESS_ENABLED_ENVIRONMENT =
    (process.env.CURSORLESS_SIDECAR || "").toLowerCase() in ["1", "true"];

  const settingEnabled = workspace
    .getConfiguration("cursorless")
    .get<boolean>("useSidecar")!;

  return (
    !isTesting() &&
    (CURSORLESS_ENABLED_ENVIRONMENT ||
      settingEnabled ||
      extensionContext.extensionMode === vscode.ExtensionMode.Development)
  );
}

export function sidecarSetup(graph: Graph) {
  if (graph.sidecarPrefix && !graph.sidecarPrefix.match(/^[\w-]+$/)) {
    throw new Error(
      `Sidecar prefix cannot contain special characters: (${graph.sidecarPrefix})`,
    );
  }

  const rootDirectory = graph.sidecarDirectory;
  vscode.window.showInformationMessage(
    `Cursorless sidecar started (v10)! ${rootDirectory}`,
  );
  try {
    if (!fs.existsSync(rootDirectory)) {
      fs.mkdirSync(rootDirectory, { recursive: true });
    }
  } catch (e) {
    vscode.window.showErrorMessage(
      `Error creating ${rootDirectory} (nonfatal): ${e}`,
    );
  }

  registerFileWatchers();
  startCommandServer(graph);

  vscode.window.showInformationMessage(
    `Cursorless has successfully started in sidecar mode!${
      graph.sidecarPrefix ? ` (prefix: ${graph.sidecarPrefix}/)` : ""
    }`,
  );
}

export function sidecarTeardown(graph: Graph) {
  if (graph.sidecarPrefix) {
    const directory = graph.sidecarDirectory;
    console.log(`Deleting sidecar directory: ${directory}`);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export function sidecarDirectory(prefix: string) {
  return path.join(CURSORLESS_ROOT_DIRECTORY, prefix);
}

/**
 * Returns an optional prefix for the socket path and hats file for Cursorless everywhere;
 * this allows multiple instances to run at once.
 */
export function sidecarPrefix(
  extensionContext: vscode.ExtensionContext,
): string {
  const env = process.env.CURSORLESS_SIDECAR_PREFIX;
  if (env) {
    return env;
  }

  // if not passed by environment, default to "debug" if running inside of the extension host
  if (extensionContext.extensionMode === vscode.ExtensionMode.Development) {
    return "debug";
  }

  return "";
}
