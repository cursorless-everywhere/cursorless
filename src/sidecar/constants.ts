import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

/**
 * The directory where we store everything for Cursorless Everywhere related things.
 */
export const CURSORLESS_ROOT_DIRECTORY = path.join(os.homedir(), ".cursorless");

// TODO(pcohen): move to reading the graph
export const CURSORLESS_PREFIX = process.env.CURSORLESS_PREFIX || "";
