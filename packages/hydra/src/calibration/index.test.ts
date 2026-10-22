import { describe, expect, it } from "vitest";

import * as calibration from "./index";
import type {
  FlotationTireSize,
  Gear,
  IdleDefinition,
  IdlePoint,
  LayoutIssue,
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
  FlotationTireSize,
  Gear,
  IdleDefinition,
  IdlePoint,
  LayoutIssue,
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
  "STOCK_TIRE",
  "TDE1",
  "TIRE_CHART",
  "TIRE_SIZE_LIMITS",
  "UnexpectedImageChangeError",
  "UnsupportedCalibrationError",
  "assertOnlyEditableChanges",
  "assertSupportedLayout",
  "changedOffsets",
  "closedThrottleIndex",
  "diffTuneValues",
  "editableOffsets",
  "evaluateShiftSpeedRaw",
  "findLayoutIssues",
  "findShiftOverlaps",
  "formatTireSize",
  "idleRawToRpm",
  "mphToSpeedRaw",
  "parseTireSize",
  "readIdleCurve",
  "readShiftCurve",
  "readShiftCurves",
  "readTuneValues",
  "rpmToIdleRaw",
  "scaleShiftSpeeds",
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

  it("exports working values, not placeholders", () => {
    expect(calibration.TDE1.id).toBe("TDE1");
    expect(calibration.speedRawToMph(54)).toBe(27);
    expect(calibration.formatTireSize(calibration.STOCK_TIRE)).toBe("235/85R16");
    expect(calibration.TIRE_CHART[0]?.label).toBe("LT235/85R16");
    expect(calibration.TIRE_CHART[0]?.tire).toBe(calibration.STOCK_TIRE);
  });
});
