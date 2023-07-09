import { Sidecar } from "@cursorless/common";

/**
 * This is the `sidecar` singleton
 */
let sidecar_: Sidecar | undefined;

/**
 * Injects an {@link Sidecar} object that can be used to interact with the Sidecar.
 * This function should only be called from a select few places, eg extension
 * activation or when mocking a test.
 * @param sidecar The ide to inject
 */
export function injectSidecar(sidecar: Sidecar | undefined) {
  sidecar_ = sidecar;
}

/**
 * Gets the singleton used to interact with the Sidecar.
 * @throws Error if the Sidecar hasn't been injected yet.  Can avoid this by
 * constructing your objects lazily
 * @returns The Sidecar object
 */
export function sidecar(): Sidecar {
  if (sidecar_ == null) {
    throw Error("Tried to access sidecar before it was injected");
  }

  return sidecar_;
}
