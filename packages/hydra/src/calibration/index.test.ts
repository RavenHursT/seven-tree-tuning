import { describe, expect, it } from "vitest";

import * as calibration from "./index";
import type {
  ByteFunction,
  ByteFunctionDefinition,
  ByteFunctionGroup,
  ByteFunctionPoint,
  CalibrationItemsDiff,
  DisplayUnit,
  EpcFunctionDefinition,
  EpcFunctionId,
  FlotationTireSize,
  Gear,
  Grid,
  GridAxes,
  GridAxisDefinition,
  GridDefinition,
  GridGroup,
  GridId,
  IdleDefinition,
  IdlePoint,
  LayoutIssue,
  LockupFunctionDefinition,
  LockupFunctionId,
  MetricTireSize,
  ShiftBreakpoint,
  ShiftCurve,
  ShiftCurveDefinition,
  ShiftCurveId,
  ShiftKind,
  ShiftOverlap,
  StrategyDefinition,
  TireChartEntry,
  TireSize,
  TuneValues,
  TuneValuesDiff,
} from "./index";

/** Compile-time check: every type the web app imports is exported. */
type ExportedTypes = [
  ByteFunction,
  ByteFunctionDefinition,
  ByteFunctionGroup,
  ByteFunctionPoint,
  CalibrationItemsDiff,
  DisplayUnit,
  EpcFunctionDefinition,
  EpcFunctionId,
  FlotationTireSize,
  Gear,
  Grid,
  GridAxes,
  GridAxisDefinition,
  GridDefinition,
  GridGroup,
  GridId,
  IdleDefinition,
  IdlePoint,
  LayoutIssue,
  LockupFunctionDefinition,
  LockupFunctionId,
  MetricTireSize,
  ShiftBreakpoint,
  ShiftCurve,
  ShiftCurveDefinition,
  ShiftCurveId,
  ShiftKind,
  ShiftOverlap,
  StrategyDefinition,
  TireChartEntry,
  TireSize,
  TuneValues,
  TuneValuesDiff,
];
const exportedTypes: ExportedTypes | undefined = undefined;

const PUBLIC_VALUES = [
  "EPC_FUNCTION_IDS",
  "GRID_IDS",
  "LOCKUP_FUNCTION_IDS",
  "LOCKUP_NEVER_SPEED_RAW",
  "STOCK_TIRE",
  "TDE1",
  "TIRE_CHART",
  "TIRE_SIZE_LIMITS",
  "UnexpectedImageChangeError",
  "UnsupportedCalibrationError",
  "assertOnlyEditableChanges",
  "assertSupportedLayout",
  "changedOffsets",
  "closedPedalIndex",
  "closedThrottleIndex",
  "diffCalibrationItems",
  "diffTuneValues",
  "editableOffsets",
  "evaluateShiftSpeedRaw",
  "findByteFunctionIssues",
  "findLayoutIssues",
  "findShiftOverlaps",
  "formatTireSize",
  "functionYRange",
  "gridValueRange",
  "idleRawToRpm",
  "mphToSpeedRaw",
  "parseTireSize",
  "readByteFunction",
  "readEpcFunctions",
  "readGrid",
  "readGridAxes",
  "readGrids",
  "readIdleCurve",
  "readLockupFunctions",
  "readShiftCurve",
  "readShiftCurves",
  "readTuneValues",
  "rpmToIdleRaw",
  "scaleShiftSpeeds",
  "setFunctionPointRaw",
  "setGridCellRaw",
  "setShiftPointRaw",
  "setWarmIdleRpm",
  "shiftPointToSpeedoMph",
  "speedRawToMph",
  "speedoMphToShiftPointRaw",
  "speedometerFactor",
  "throttleRawToPercent",
  "tireCompensationFactor",
  "tireDiameterIn",
  "tireSizeFromParts",
  "tireSizeParts",
  "writeTuneValues",
];

describe("calibration public API", () => {
  it("exports exactly the names the web app and tools use, and no internal helper", () => {
    expect(Object.keys(calibration).sort()).toEqual(PUBLIC_VALUES);
    expect(exportedTypes).toBeUndefined();
  });

  it("exports the lists of lockup, line-pressure and grid ids in the order of the TDE1 definition", () => {
    expect(calibration.LOCKUP_FUNCTION_IDS).toEqual(
      calibration.TDE1.lockupFunctions.map((definition) => definition.id),
    );
    expect(calibration.EPC_FUNCTION_IDS).toEqual(
      calibration.TDE1.epcFunctions.map((definition) => definition.id),
    );
    expect(calibration.GRID_IDS).toEqual(calibration.TDE1.grids.map((grid) => grid.id));
  });

  it("exports working values, not placeholders", () => {
    expect(calibration.TDE1.id).toBe("TDE1");
    expect(calibration.speedRawToMph(54)).toBe(27);
    expect(calibration.formatTireSize(calibration.STOCK_TIRE)).toBe("235/85R16");
    expect(calibration.TIRE_CHART[0]?.label).toBe("LT235/85R16");
    expect(calibration.TIRE_CHART[0]?.tire).toBe(calibration.STOCK_TIRE);
  });
});
