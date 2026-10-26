import {
  readEpcFunctions,
  readLockupFunctions,
  type ByteFunction,
  type EpcFunctionDefinition,
  type LockupFunctionDefinition,
} from "@seven-tree/hydra";

import type { LoadedTune } from "./loaded-tune";

interface TuneFunctions {
  readonly lockup: readonly ByteFunction<LockupFunctionDefinition>[];
  readonly epc: readonly ByteFunction<EpcFunctionDefinition>[];
}

/** Read once per loaded tune: the pedal axes are not editable, so they never change. */
const FUNCTIONS = new WeakMap<LoadedTune, TuneFunctions>();

function functionsOf(tune: LoadedTune): TuneFunctions {
  let found = FUNCTIONS.get(tune);
  if (!found) {
    found = { lockup: readLockupFunctions(tune.image), epc: readEpcFunctions(tune.image) };
    FUNCTIONS.set(tune, found);
  }
  return found;
}

/** The six lockup functions as the loaded tune stores them (pedal axes and original speeds). */
export function lockupFunctionsOf(
  tune: LoadedTune,
): readonly ByteFunction<LockupFunctionDefinition>[] {
  return functionsOf(tune).lockup;
}

/** The three upshift line-pressure functions as the loaded tune stores them. */
export function epcFunctionsOf(tune: LoadedTune): readonly ByteFunction<EpcFunctionDefinition>[] {
  return functionsOf(tune).epc;
}
