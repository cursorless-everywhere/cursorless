import * as vscode from "vscode";

import { applyPrimaryEditorState } from "./synchronization";
import { FEATURE_FLAG_ENABLED, readFlagFile } from "./featureFlags";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import { vsCodeState } from "./serialization";
import { workspace } from "vscode";
import {CURSORLESS_ROOT_DIRECTORY} from "./constants";

function evalRequest(requestObj: any) {
  // NOTE(pcohen): disable eval by default for security
  const evalEnabled = workspace
    .getConfiguration("cursorless")
    .get<boolean>("sidecarEval")!;
  if (!evalEnabled) {
    return {
      error: "eval is disabled",
      help: "set cursorless.sidecarEval to true in your Visual Studio Code settings to use it",
    };
  }
  let result;
  try {
    result = eval(requestObj.code);
  } catch (e) {
    return { error: String(e), _note: "error during execution" };
  }
  try {
    const _un = JSON.stringify(result);
    return { result: result };
  } catch (e) {
    return {
      result: `${result}`,
      _note: "Result was not JSON-serializable, so we converted to string",
    };
  }
}

/**
 * Handles a request from the control socket in returns the response.
 *
 * One useful way to test this is with `socat`:
 *     echo '{ "command": "state" }' | socat - ~/.cursorless/vscode-socket | jq .
 */
async function handleRequest(requestObj: any) {
  /** Runs a VS Code command with arguments */
  async function runVSCodeCommand(requestObj: any) {
    const args = requestObj.commandArgs || [];
    const result = await vscode.commands.executeCommand(
      requestObj.commandId,
      ...args,
    );
    return { result: result };
  }

  try {
    switch (requestObj.command) {
      case "ping":
        return { response: "pong" };
      case "state":
        return vsCodeState();
      case "eval":
        return evalRequest(requestObj);
      case "stateWithContents":
        return vsCodeState(true);
      case "applyPrimaryEditorState":
        // TODO(pcohen): this may change the editor state,
        // but it doesn't actually block on Cursorless applying those changes
        // TODO(pcohen): look up the actual prefix
        applyPrimaryEditorState(CURSORLESS_ROOT_DIRECTORY);
        return { response: "OK" };
      case "command":
        return { result: await runVSCodeCommand(requestObj) };
      case "cursorless": {
        // NOTE(pcohen): this need not be Cursorless specific; perhaps a better command name might be
        // along the lines of "execute command and serialize state"

        // NOTE(pcohen): this is wrapped as JSON mostly to simplify stuff on the Kotlin side
        const cursorlessArgs = JSON.parse(requestObj.cursorlessArgs);

        const oldState = vsCodeState();

        try {
          if (!readFlagFile(FEATURE_FLAG_ENABLED, true)) {
            throw Error(
              `Sidecar is disabled (${FEATURE_FLAG_ENABLED}); not running commands`,
            );
          }

          const commandResult = await vscode.commands.executeCommand(
            "cursorless.command",
            ...cursorlessArgs,
          );
          const newState = vsCodeState(true);
          return {
            oldState: oldState,
            commandResult: JSON.stringify(commandResult),
            newState: newState,
          };
        } catch (e) {
          return {
            commandException: `${e}`,
          };
        }
      }
      case "pid":
        return `${process.pid}`;
      default:
        return { error: `invalid command: ${requestObj.command}` };
    }
  } catch (e) {
    vscode.window.showInformationMessage(
      `Error during evaluation of command "${requestObj.command}": ${e}`,
    );
    return { error: `exception during execution: ${e}` };
  }
}

export function startCommandServer(sidecarDirectory: string) {
  try {
    const socketPath = path.join(sidecarDirectory, `vscode-socket`);

    try {
      // make sure the file is deleted first.

      if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
      }
    } catch (e) {
      console.log("unable to delete socket file", e);
      vscode.window.showErrorMessage(
        `Unable to delete socket file at ${socketPath}: ${e}`,
      );
    }

    const unixSocketServer = net.createServer();
    unixSocketServer.listen(socketPath, () => {
      console.log("Control socket is now listening");
    });

    unixSocketServer.on("connection", (s: any) => {
      s.on("data", async (msg: any) => {
        // TODO(pcohen): build up a string buffer until we get to a new line, then try to parse it
        // since we can't guarantee that the entire message will be received in one chunk
        const inputString = msg.toString();
        const request = JSON.parse(inputString);
        const response = await handleRequest(request);
        s.write(JSON.stringify(response));
        s.end();
      });
      // s.end();
    });
  } catch (e) {
    vscode.window.showInformationMessage(
      `Error setting up control socket: ${e}`,
    );
  }
}
