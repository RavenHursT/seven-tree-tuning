import { evaluateShiftSpeedRaw, evaluateShiftSpeedRawJustBelow } from "./shift-curve";
import type { CurvePoint, ShiftCurve } from "./shift-curve";
import type { Gear, ShiftCurveId } from "./tde1";
import type { TuneValues } from "./tune-values";
import { speedRawToMph } from "./units";

const MAX_THROTTLE = 255;

/**
 * Two interpolated speeds that are equal in exact arithmetic can differ by about 1e-14 mph in
 * floating point. A difference below this is rounding, not a downshift above an upshift. Real
 * differences are at least 1 / (2 x 255 x 255) mph, about 8e-6, so this stays far below them.
 */
const SPEED_TIE_TOLERANCE_MPH = 1e-9;

/**
 * A throttle range where a downshift happens above the speed of the matching upshift, so the
 * transmission can shift up and straight back down (gear hunting). Equal speeds are not an
 * overlap: the upshift has to be passed before the downshift is reached.
 */
export interface ShiftOverlap {
  readonly upshift: ShiftCurveId;
  readonly downshift: ShiftCurveId;
  readonly lowerGear: Gear;
  readonly upperGear: Gear;
  /** First throttle byte of the range. */
  readonly throttleFromRaw: number;
  /** Last throttle byte of the range. */
  readonly throttleToRaw: number;
  /** Smallest (upshift - downshift) speed in the range, in mph. Below zero. */
  readonly worstMarginMph: number;
}

interface ThrottleRange {
  from: number;
  to: number;
  worst: number;
}

function pointsOf(curve: ShiftCurve, values: TuneValues): CurvePoint[] {
  const speeds = values.shiftSpeedsRaw[curve.definition.id];
  return curve.breakpoints.map((point) => {
    const speedRaw = speeds[point.index];
    if (speedRaw === undefined) {
      throw new RangeError(
        `no ${curve.definition.label} shift speed for breakpoint ${point.index}`,
      );
    }
    return { throttleRaw: point.throttleRaw, speedRaw };
  });
}

function stepThrottles(points: readonly CurvePoint[]): number[] {
  return points
    .filter(
      (point, index) =>
        point.throttleRaw !== 0 && points[index - 1]?.throttleRaw === point.throttleRaw,
    )
    .map((point) => point.throttleRaw);
}

/**
 * Upshift speed minus downshift speed at one throttle byte, in mph. At a step the lower of the
 * value at the step and the value just below it counts.
 */
function marginAt(
  up: readonly CurvePoint[],
  down: readonly CurvePoint[],
  steps: ReadonlySet<number>,
  throttle: number,
): number {
  const atThrottle = evaluateShiftSpeedRaw(up, throttle) - evaluateShiftSpeedRaw(down, throttle);
  if (!steps.has(throttle)) return speedRawToMph(atThrottle);
  const below =
    evaluateShiftSpeedRawJustBelow(up, throttle) - evaluateShiftSpeedRawJustBelow(down, throttle);
  return speedRawToMph(Math.min(atThrottle, below));
}

/** The downshift is above the upshift. Equal speeds are not an overlap. */
function isOverlap(marginMph: number): boolean {
  return marginMph < -SPEED_TIE_TOLERANCE_MPH;
}

function overlapRanges(margins: readonly number[]): ThrottleRange[] {
  const ranges: ThrottleRange[] = [];
  let open: ThrottleRange | undefined;
  margins.forEach((margin, throttle) => {
    if (!isOverlap(margin)) {
      open = undefined;
    } else if (open) {
      open.to = throttle;
      open.worst = Math.min(open.worst, margin);
    } else {
      open = { from: throttle, to: throttle, worst: margin };
      ranges.push(open);
    }
  });
  return ranges;
}

function pairOverlaps(up: ShiftCurve, down: ShiftCurve, values: TuneValues): ShiftOverlap[] {
  const upPoints = pointsOf(up, values);
  const downPoints = pointsOf(down, values);
  const steps = new Set([...stepThrottles(upPoints), ...stepThrottles(downPoints)]);
  const margins = Array.from({ length: MAX_THROTTLE + 1 }, (_unused, throttle) =>
    marginAt(upPoints, downPoints, steps, throttle),
  );
  return overlapRanges(margins).map((range) => ({
    upshift: up.definition.id,
    downshift: down.definition.id,
    lowerGear: up.definition.fromGear,
    upperGear: up.definition.toGear,
    throttleFromRaw: range.from,
    throttleToRaw: range.to,
    worstMarginMph: range.worst,
  }));
}

function matchingDownshift(curves: readonly ShiftCurve[], up: ShiftCurve): ShiftCurve | undefined {
  return curves.find(
    ({ definition }) =>
      definition.kind === "downshift" &&
      definition.fromGear === up.definition.toGear &&
      definition.toGear === up.definition.fromGear,
  );
}

/**
 * Finds where a downshift speed is above its upshift speed, for each upshift paired with the
 * downshift between the same two gears (1→2 with 2→1, 2→3 with 3→2, 3→4 with 4→3).
 * Each curve uses its own throttle axis from `curves` and the speeds in `values`. Every throttle
 * byte 0..255 is checked, and at a step (a repeated throttle value) the lower of the value at the
 * step and the value just below it counts. An overlap is a run of consecutive throttle bytes where
 * upshift minus downshift is below zero. Equal speeds are not an overlap: Power Hungry's library
 * tunes ship equal 1→2 and 2→1 speeds at light throttle, and the hunting confirmed on the truck
 * was a downshift above its upshift (4→3 at 36 mph against 3→4 at 35 mph). Results follow the
 * order of the upshift curves, then rise in throttle.
 */
export function findShiftOverlaps(
  curves: readonly ShiftCurve[],
  values: TuneValues,
): ShiftOverlap[] {
  return curves
    .filter((curve) => curve.definition.kind === "upshift")
    .flatMap((up) => {
      const down = matchingDownshift(curves, up);
      return down ? pairOverlaps(up, down, values) : [];
    });
}
