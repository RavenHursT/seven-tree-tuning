import {
  scaleShiftSpeeds,
  setShiftPointRaw,
  setWarmIdleRpm,
  speedometerFactor,
  speedoMphToShiftPointRaw,
  STOCK_TIRE,
  tireCompensationFactor,
  type ShiftCurveId,
  type TireSize,
  type TuneValues,
} from "@seven-tree/hydra";

import type { LoadedTune, TuneSource, TuneSourceKind } from "./loaded-tune";

/** A .hcf file picked before a valid chip serial was entered. */
export interface PendingFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface EditorState {
  /** As typed, trimmed and uppercased. Validated by selectors. */
  readonly chipSerial: string;
  /** Tires on the truck. */
  readonly fittedTire: TireSize;
  /** Tires the PCM computes speed for: the factory size unless the speedometer was recalibrated. */
  readonly calibrationTire: TireSize;
  readonly tune: LoadedTune | null;
  /** The edited values; equal to tune.originalValues until something changes. */
  readonly values: TuneValues | null;
  readonly outputFileName: string;
  readonly loading: { readonly kind: TuneSourceKind; readonly fileName: string } | null;
  readonly loadError: string | null;
  readonly pendingFile: PendingFile | null;
}

type EditAction =
  | { type: "shiftPointChanged"; curveId: ShiftCurveId; index: number; mph: number }
  | { type: "speedometerChanged"; curveId: ShiftCurveId; index: number; mph: number }
  | { type: "warmIdleChanged"; rpm: number }
  | { type: "curveReset"; curveId: ShiftCurveId }
  | { type: "allReset" }
  | { type: "tireCompensationApplied" };

export type EditorAction =
  | EditAction
  | { type: "chipSerialChanged"; value: string }
  | { type: "fittedTireChanged"; tire: TireSize }
  | { type: "calibrationTireChanged"; tire: TireSize }
  | { type: "loadStarted"; kind: TuneSourceKind; fileName: string }
  | { type: "loadSucceeded"; tune: LoadedTune }
  | { type: "loadFailed"; message: string }
  | { type: "pendingFileHeld"; file: PendingFile }
  | { type: "outputFileNameChanged"; value: string };

export const initialEditorState: EditorState = {
  chipSerial: "",
  fittedTire: STOCK_TIRE,
  calibrationTire: STOCK_TIRE,
  tune: null,
  values: null,
  outputFileName: "",
  loading: null,
  loadError: null,
  pendingFile: null,
};

/** "TDE1_30N_DAILYDRIVER-REVD.hcf" -> "TDE1_30N_DAILYDRIVER-REVD-CUSTOM" (".hcf" is added on save). */
export function defaultOutputFileName(source: TuneSource): string {
  return `${source.fileName.replace(/\.[^.]*$/, "")}-CUSTOM`;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "chipSerialChanged":
      return { ...state, chipSerial: action.value.trim().toUpperCase() };
    case "fittedTireChanged":
      return { ...state, fittedTire: action.tire };
    case "calibrationTireChanged":
      return { ...state, calibrationTire: action.tire };
    case "loadStarted":
      return {
        ...state,
        loading: { kind: action.kind, fileName: action.fileName },
        loadError: null,
        pendingFile: null,
      };
    case "loadSucceeded":
      return {
        ...state,
        tune: action.tune,
        values: action.tune.originalValues,
        outputFileName: defaultOutputFileName(action.tune.source),
        loading: null,
        loadError: null,
        pendingFile: null,
      };
    case "loadFailed":
      return { ...state, loading: null, loadError: action.message };
    case "pendingFileHeld":
      return { ...state, pendingFile: action.file, loading: null, loadError: null };
    case "outputFileNameChanged":
      return { ...state, outputFileName: action.value };
    default:
      return editValues(state, action);
  }
}

function editValues(state: EditorState, action: EditAction): EditorState {
  const { tune, values } = state;
  if (!tune || !values) return state;

  switch (action.type) {
    case "shiftPointChanged":
      // A shift point is a speedometer value on the calibration tire: factor 1.
      return withShiftPoint(state, tune, values, action.curveId, action.index, action.mph, 1);
    case "speedometerChanged":
      return withShiftPoint(
        state,
        tune,
        values,
        action.curveId,
        action.index,
        action.mph,
        speedometerFactor(state.fittedTire, state.calibrationTire),
      );
    case "warmIdleChanged":
      if (!Number.isFinite(action.rpm)) return state;
      return { ...state, values: setWarmIdleRpm(values, action.rpm) };
    case "curveReset":
      return {
        ...state,
        values: {
          ...values,
          shiftSpeedsRaw: {
            ...values.shiftSpeedsRaw,
            [action.curveId]: tune.originalValues.shiftSpeedsRaw[action.curveId],
          },
        },
      };
    case "allReset":
      return { ...state, values: tune.originalValues };
    case "tireCompensationApplied": {
      const factor = tireCompensationFactor(state.fittedTire, state.calibrationTire);
      const scaled = scaleShiftSpeeds(tune.originalValues, factor);
      return { ...state, values: { ...scaled, warmIdleRaw: values.warmIdleRaw } };
    }
  }
}

function withShiftPoint(
  state: EditorState,
  tune: LoadedTune,
  values: TuneValues,
  curveId: ShiftCurveId,
  index: number,
  mph: number,
  speedometerFactorForMph: number,
): EditorState {
  const curve = tune.curves.find((candidate) => candidate.definition.id === curveId);
  if (!curve || !Number.isFinite(mph)) return state;
  const speedRaw = speedoMphToShiftPointRaw(mph, speedometerFactorForMph);
  return { ...state, values: setShiftPointRaw(values, curve, index, speedRaw) };
}
