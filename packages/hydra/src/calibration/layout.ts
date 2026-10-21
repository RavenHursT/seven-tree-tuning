import { CALIBRATION_IMAGE_SIZE } from "../image";
import { readByte } from "./bytes";
import { readShiftCurve, terminatorByteOffset } from "./shift-curve";
import { TDE1 } from "./tde1";
import type { ShiftCurveDefinition, ShiftCurveId, StrategyDefinition } from "./tde1";

const WIDE_OPEN_THROTTLE = 0xff;
const TERMINATOR = 0xff;

/** One reason a file does not have the expected layout. `curveId` is absent for whole-file issues. */
export interface LayoutIssue {
  readonly curveId?: ShiftCurveId;
  readonly message: string;
}

function hex(byte: number): string {
  return `0x${byte.toString(16).padStart(2, "0").toUpperCase()}`;
}

function firstThrottleIssue(throttles: readonly number[]): string | undefined {
  const first = throttles[0];
  if (first === WIDE_OPEN_THROTTLE) return undefined;
  return `the first throttle value is ${first}, not ${WIDE_OPEN_THROTTLE}.`;
}

function risingThrottleIssue(throttles: readonly number[]): string | undefined {
  for (let index = 1; index < throttles.length; index++) {
    const before = throttles[index - 1];
    const after = throttles[index];
    if (before !== undefined && after !== undefined && after > before) {
      return `the throttle values go up from ${before} to ${after}. They can only stay the same or go down.`;
    }
  }
  return undefined;
}

function lastThrottleIssue(throttles: readonly number[]): string | undefined {
  const last = throttles[throttles.length - 1];
  return last === 0 ? undefined : `the last throttle value is ${last}, not 0.`;
}

function terminatorIssue(byte: number): string | undefined {
  if (byte === TERMINATOR) return undefined;
  return `the byte after the curve is ${hex(byte)}, not ${hex(TERMINATOR)}.`;
}

function curveIssues(
  image: Uint8Array,
  definition: ShiftCurveDefinition,
  breakpointCount: number,
): LayoutIssue[] {
  const curve = readShiftCurve(image, definition, breakpointCount);
  const throttles = curve.breakpoints.map((point) => point.throttleRaw);
  const terminator = readByte(image, terminatorByteOffset(definition, breakpointCount));
  return [
    firstThrottleIssue(throttles),
    risingThrottleIssue(throttles),
    lastThrottleIssue(throttles),
    terminatorIssue(terminator),
  ]
    .filter((text): text is string => text !== undefined)
    .map((text) => ({ curveId: definition.id, message: `${definition.label} shift: ${text}` }));
}

/**
 * Checks that every shift curve has the proven layout: first throttle 255, throttle never rising,
 * last throttle 0, and a 0xFF byte after the curve. An image that is not 256 KiB gives one issue
 * and no further checks.
 */
export function findLayoutIssues(
  image: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): LayoutIssue[] {
  if (image.length !== CALIBRATION_IMAGE_SIZE) {
    const message = `Expected a ${CALIBRATION_IMAGE_SIZE}-byte calibration image, got ${image.length} bytes.`;
    return [{ message }];
  }
  return strategy.shiftCurves.flatMap((definition) =>
    curveIssues(image, definition, strategy.breakpointsPerCurve),
  );
}

/** Thrown when a file does not have the shift-curve layout the editor works on. */
export class UnsupportedCalibrationError extends Error {
  readonly issues: readonly LayoutIssue[];

  constructor(issues: readonly LayoutIssue[], strategyId: string = TDE1.id) {
    super(`This file does not have the ${strategyId} shift-curve layout.`);
    this.name = "UnsupportedCalibrationError";
    this.issues = issues;
  }
}

/** Throws UnsupportedCalibrationError, carrying the issues, unless the layout is supported. */
export function assertSupportedLayout(
  image: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): void {
  const issues = findLayoutIssues(image, strategy);
  if (issues.length > 0) throw new UnsupportedCalibrationError(issues, strategy.id);
}
