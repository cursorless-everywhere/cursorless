import isTesting from "../testUtil/isTesting";

import { workspace } from "vscode";
import * as vscode from "vscode";

/**
 * Returns whether we should run as the Cursorless everywhere sidecar.
 */
export function shouldBeSidecar(
  extensionContext: vscode.ExtensionContext
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

/**
 * Returns an optional prefix for the socket path and hats file for Cursorless everywhere;
 * this allows multiple instances to run at once.
 */
export function sidecarPrefix(): string {
  return process.env.CURSORLESS_PREFIX || "";
}
