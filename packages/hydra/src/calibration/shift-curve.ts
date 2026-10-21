import { assertCalibrationImage } from "../image";
import { readByte } from "./bytes";
import { TDE1 } from "./tde1";
import type { ShiftCurveDefinition, StrategyDefinition } from "./tde1";

/** One breakpoint of a shift curve, as stored: throttle 0..255 and speed in mph x 2. */
export interface ShiftBreakpoint {
  /** Position in the curve, 0 is the first (wide-open) breakpoint. */
  readonly index: number;
  /** Throttle byte: 255 wide open, 0 closed. */
  readonly throttleRaw: number;
  /** Shift speed byte, mph x 2 (0.5 mph steps). */
  readonly speedRaw: number;
}

export interface ShiftCurve {
  readonly definition: ShiftCurveDefinition;
  readonly breakpoints: readonly ShiftBreakpoint[];
}

/** The two values the Ford lookup reads from a breakpoint. */
export interface CurvePoint {
  readonly throttleRaw: number;
  readonly speedRaw: number;
}

/** Image offset of breakpoint `index`'s throttle byte. */
export function throttleByteOffset(definition: ShiftCurveDefinition, index: number): number {
  return definition.speedOffset - 1 + 2 * index;
}

/** Image offset of breakpoint `index`'s shift-speed byte. */
export function speedByteOffset(definition: ShiftCurveDefinition, index: number): number {
  return definition.speedOffset + 2 * index;
}

/** Image offset of the byte that follows a curve of `breakpointCount` breakpoints (0xFF). */
export function terminatorByteOffset(
  definition: ShiftCurveDefinition,
  breakpointCount: number,
): number {
  return throttleByteOffset(definition, breakpointCount);
}

/**
 * Reads one shift curve from a 256 KiB image. `breakpointCount` defaults to the TDE1 value.
 * Throws RangeError when the image is not 256 KiB.
 */
export function readShiftCurve(
  image: Uint8Array,
  definition: ShiftCurveDefinition,
  breakpointCount: number = TDE1.breakpointsPerCurve,
): ShiftCurve {
  assertCalibrationImage(image);
  const breakpoints = Array.from({ length: breakpointCount }, (_unused, index) => ({
    index,
    throttleRaw: readByte(image, throttleByteOffset(definition, index)),
    speedRaw: readByte(image, speedByteOffset(definition, index)),
  }));
  return { definition, breakpoints };
}

/** Reads all shift curves of `strategy`, in the strategy's order. */
export function readShiftCurves(
  image: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): readonly ShiftCurve[] {
  return strategy.shiftCurves.map((definition) =>
    readShiftCurve(image, definition, strategy.breakpointsPerCurve),
  );
}

/**
 * Index of the first breakpoint whose throttle is 0: the closed-throttle speed. Breakpoints after
 * it are padding the PCM never reads. A curve without a throttle-0 breakpoint (an unsupported
 * layout) gives the last index.
 */
export function closedThrottleIndex(curve: ShiftCurve): number {
  const index = curve.breakpoints.findIndex((point) => point.throttleRaw === 0);
  return index === -1 ? curve.breakpoints.length - 1 : index;
}

function assertHasPoints(points: readonly CurvePoint[]): void {
  if (points.length === 0) throw new RangeError("a shift curve needs at least one breakpoint");
}

function pointAt(points: readonly CurvePoint[], index: number): CurvePoint {
  const point = points[index];
  if (!point) throw new RangeError(`a shift curve has no breakpoint ${index}`);
  return point;
}

function interpolate(points: readonly CurvePoint[], index: number, throttleRaw: number): number {
  if (index === 0) return pointAt(points, 0).speedRaw;
  if (index === -1) return pointAt(points, points.length - 1).speedRaw;
  const high = pointAt(points, index - 1);
  const low = pointAt(points, index);
  const span = high.throttleRaw - low.throttleRaw;
  return low.speedRaw + ((high.speedRaw - low.speedRaw) * (throttleRaw - low.throttleRaw)) / span;
}

/**
 * The Ford lookup: scan from the first breakpoint for the first one whose throttle is at or below
 * the input. The first breakpoint gives its own speed. Any other gives the straight-line value
 * between it and the breakpoint before it. Past the last breakpoint the last speed holds.
 * Returns shift speed in mph x 2; the result can be a fraction.
 */
export function evaluateShiftSpeedRaw(points: readonly CurvePoint[], throttleRaw: number): number {
  assertHasPoints(points);
  const index = points.findIndex((point) => point.throttleRaw <= throttleRaw);
  return interpolate(points, index, throttleRaw);
}

/**
 * The speed the lookup gives for an input just below `throttleRaw`, as that input gets closer to
 * `throttleRaw`. It differs from `evaluateShiftSpeedRaw` only at a step, where it gives the second
 * speed of the repeated throttle value. Returns mph x 2; can be a fraction.
 */
export function evaluateShiftSpeedRawJustBelow(
  points: readonly CurvePoint[],
  throttleRaw: number,
): number {
  assertHasPoints(points);
  const index = points.findIndex((point) => point.throttleRaw < throttleRaw);
  return interpolate(points, index, throttleRaw);
}
