import {
  LOCKUP_NEVER_SPEED_RAW,
  setFunctionPointRaw,
  speedometerFactor,
  speedoMphToShiftPointRaw,
  type EpcFunctionId,
  type LockupFunctionId,
  type TuneValues,
} from "@seven-tree/hydra";

import type { EditorState } from "./editor-reducer";
import type { LoadedTune } from "./loaded-tune";
import { epcFunctionsOf, lockupFunctionsOf } from "./transmission-functions";

/** Edits of the converter lockup speeds and the upshift line-pressure adders. */
export type TransmissionAction =
  | { type: "lockupSpeedChanged"; functionId: LockupFunctionId; index: number; mph: number }
  | { type: "lockupSpeedometerChanged"; functionId: LockupFunctionId; index: number; mph: number }
  | { type: "lockupNeverSet"; functionId: LockupFunctionId; index: number }
  | { type: "epcValueChanged"; functionId: EpcFunctionId; index: number; value: number }
  | { type: "functionReset"; functionId: LockupFunctionId | EpcFunctionId };

function isEpcId(id: LockupFunctionId | EpcFunctionId): id is EpcFunctionId {
  return id.startsWith("epc-");
}

function withLockupSpeed(
  tune: LoadedTune,
  values: TuneValues,
  functionId: LockupFunctionId,
  index: number,
  speedRaw: number,
): TuneValues {
  const fn = lockupFunctionsOf(tune).find((item) => item.definition.id === functionId);
  if (!fn || !Number.isFinite(speedRaw)) return values;
  return setFunctionPointRaw(values, fn, index, speedRaw);
}

function resetFunction(
  tune: LoadedTune,
  values: TuneValues,
  functionId: LockupFunctionId | EpcFunctionId,
): TuneValues {
  const original = tune.originalValues;
  if (isEpcId(functionId)) {
    return {
      ...values,
      epcAddersRaw: { ...values.epcAddersRaw, [functionId]: original.epcAddersRaw[functionId] },
    };
  }
  return {
    ...values,
    lockupSpeedsRaw: {
      ...values.lockupSpeedsRaw,
      [functionId]: original.lockupSpeedsRaw[functionId],
    },
  };
}

function withEpcValue(
  tune: LoadedTune,
  values: TuneValues,
  functionId: EpcFunctionId,
  index: number,
  value: number,
): TuneValues {
  const fn = epcFunctionsOf(tune).find((item) => item.definition.id === functionId);
  if (!fn || !Number.isFinite(value)) return values;
  return setFunctionPointRaw(values, fn, index, value);
}

function nextValues(
  state: EditorState,
  tune: LoadedTune,
  values: TuneValues,
  action: TransmissionAction,
): TuneValues {
  switch (action.type) {
    case "lockupSpeedChanged": {
      // A lockup speed is a speedometer value on the calibration tire: factor 1.
      const raw = speedoMphToShiftPointRaw(action.mph, 1);
      return withLockupSpeed(tune, values, action.functionId, action.index, raw);
    }
    case "lockupSpeedometerChanged": {
      const factor = speedometerFactor(state.fittedTire, state.calibrationTire);
      const raw = speedoMphToShiftPointRaw(action.mph, factor);
      return withLockupSpeed(tune, values, action.functionId, action.index, raw);
    }
    case "lockupNeverSet":
      return withLockupSpeed(tune, values, action.functionId, action.index, LOCKUP_NEVER_SPEED_RAW);
    case "epcValueChanged":
      return withEpcValue(tune, values, action.functionId, action.index, action.value);
    case "functionReset":
      return resetFunction(tune, values, action.functionId);
  }
}

/** Applies one lockup or line-pressure edit. Returns the same state when nothing changes. */
export function editTransmission(
  state: EditorState,
  tune: LoadedTune,
  values: TuneValues,
  action: TransmissionAction,
): EditorState {
  const next = nextValues(state, tune, values, action);
  return next === values ? state : { ...state, values: next };
}
