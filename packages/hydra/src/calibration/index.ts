// Public API of the calibration module. Each module owns its own barrel.
export { TDE1 } from "./tde1";
export type {
  Gear,
  IdleDefinition,
  ShiftCurveDefinition,
  ShiftCurveId,
  ShiftKind,
  StrategyDefinition,
} from "./tde1";

export {
  closedThrottleIndex,
  evaluateShiftSpeedRaw,
  readShiftCurve,
  readShiftCurves,
} from "./shift-curve";
export type { ShiftBreakpoint, ShiftCurve } from "./shift-curve";

export { assertSupportedLayout, findLayoutIssues, UnsupportedCalibrationError } from "./layout";
export type { LayoutIssue } from "./layout";

export {
  diffTuneValues,
  readTuneValues,
  scaleShiftSpeeds,
  setShiftPointRaw,
  setWarmIdleRpm,
  writeTuneValues,
} from "./tune-values";
export type { TuneValues, TuneValuesDiff } from "./tune-values";

export {
  assertOnlyEditableChanges,
  changedOffsets,
  editableOffsets,
  UnexpectedImageChangeError,
} from "./edit-guard";

export {
  idleRawToRpm,
  mphToSpeedRaw,
  rpmToIdleRaw,
  speedRawToMph,
  throttleRawToPercent,
} from "./units";

export {
  formatTireSize,
  parseTireSize,
  shiftPointToSpeedoMph,
  speedometerFactor,
  speedoMphToShiftPointRaw,
  STOCK_TIRE,
  TIRE_PRESETS,
  tireCompensationFactor,
  tireDiameterIn,
} from "./tire";
export type { TirePreset, TireSize } from "./tire";

export { readIdleCurve } from "./idle";
export type { IdlePoint } from "./idle";

export { findShiftOverlaps } from "./overlap";
export type { ShiftOverlap } from "./overlap";
