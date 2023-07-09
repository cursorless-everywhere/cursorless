import { CURSORLESS_ROOT_DIRECTORY } from "./constants";
import * as path from "path";
import * as fs from "fs";

// Allowed disabling the sidecar with a flag, so you can actually use other parts of VS Code
// when needed.
export const FEATURE_FLAG_ENABLED = path.join(
  CURSORLESS_ROOT_DIRECTORY,
  "sidecar-enabled",
);

// Allowed disabling the scrolling of the sidecar. Recent versions of Cursorless Everywhere
// use visible ranges passed directly from the exterior editor, so scrolling is not necessary,
// but it can be enabled for ease of debugging.
export const FEATURE_FLAG_PERFORM_SCROLLING = path.join(
  CURSORLESS_ROOT_DIRECTORY,
  "sidecar-scrolling",
);

/**
 * Supports reading a "feature flag", which is just a local file with boolean value.
 */
export function readFlagFile(path: string, defaultValue: boolean): boolean {
  // TODO(pcohen): don't read these from disk every time; use a file watcher
  if (!fs.existsSync(path)) {
    return defaultValue;
  }

  try {
    const contents = fs.readFileSync(path, "utf8").trim().toLowerCase();
    switch (contents) {
      case "true":
        return true;
      case "false":
        return false;
      default:
        return defaultValue;
    }
  } catch (e) {
    return defaultValue;
  }
}
