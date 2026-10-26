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

export { EPC_FUNCTION_IDS, GRID_IDS, LOCKUP_FUNCTION_IDS } from "./tde1-items";
export type { EpcFunctionId, GridId, LockupFunctionId } from "./tde1-items";

export {
  closedPedalIndex,
  findByteFunctionIssues,
  functionYRange,
  LOCKUP_NEVER_SPEED_RAW,
  readByteFunction,
  readEpcFunctions,
  readLockupFunctions,
} from "./byte-function";
export type {
  ByteFunction,
  ByteFunctionDefinition,
  ByteFunctionGroup,
  ByteFunctionPoint,
  EpcFunctionDefinition,
  LockupFunctionDefinition,
} from "./byte-function";

export { findGridAxisIssues, gridValueRange, readGrid, readGrids, readGridAxes } from "./grid";
export type {
  DisplayUnit,
  Grid,
  GridAxes,
  GridAxisDefinition,
  GridDefinition,
  GridGroup,
} from "./grid";

export {
  closedThrottleIndex,
  evaluateShiftSpeedRaw,
  readShiftCurve,
  readShiftCurves,
} from "./shift-curve";
export type { ShiftBreakpoint, ShiftCurve } from "./shift-curve";

export {
  assertSupportedLayout,
  findCalibrationIssues,
  findLayoutIssues,
  UnsupportedCalibrationError,
} from "./layout";
export type { LayoutIssue } from "./layout";

export {
  diffCalibrationItems,
  diffTuneValues,
  readTuneValues,
  scaleShiftSpeeds,
  setFunctionPointRaw,
  setGridCellRaw,
  setShiftPointRaw,
  setWarmIdleRpm,
  writeTuneValues,
} from "./tune-values";
export type { CalibrationItemsDiff, TuneValues, TuneValuesDiff } from "./tune-values";

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
  TIRE_SIZE_LIMITS,
  tireCompensationFactor,
  tireDiameterIn,
  tireSizeFromParts,
  tireSizeParts,
} from "./tire";
export type {
  FlotationTireSize,
  MetricTireSize,
  TireChartEntry,
  TireSize,
  TireSizeParts,
} from "./tire";
export { TIRE_CHART } from "./tire-chart";

export { readIdleCurve } from "./idle";
export type { IdlePoint } from "./idle";

export { findShiftOverlaps } from "./overlap";
export type { ShiftOverlap } from "./overlap";
