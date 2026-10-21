import { evaluateShiftSpeedRaw, evaluateShiftSpeedRawJustBelow } from "./shift-curve";
import type { CurvePoint, ShiftCurve } from "./shift-curve";
import type { Gear, ShiftCurveId } from "./tde1";
import type { TuneValues } from "./tune-values";
import { speedRawToMph } from "./units";

const MAX_THROTTLE = 255;

/**
 * A throttle range where a downshift happens at or above the speed of the matching upshift, so
 * the transmission can shift up and straight back down (gear hunting).
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
  /** Smallest (upshift - downshift) speed in the range, in mph. Zero or below. */
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

function overlapRanges(margins: readonly number[]): ThrottleRange[] {
  const ranges: ThrottleRange[] = [];
  let open: ThrottleRange | undefined;
  margins.forEach((margin, throttle) => {
    if (margin > 0) {
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
 * Finds where a downshift speed reaches its upshift speed, for each upshift paired with the
 * downshift between the same two gears (1→2 with 2→1, 2→3 with 3→2, 3→4 with 4→3).
 * Each curve uses its own throttle axis from `curves` and the speeds in `values`. Every throttle
 * byte 0..255 is checked, and at a step (a repeated throttle value) the lower of the value at the
 * step and the value just below it counts. An overlap is a run of consecutive throttle bytes where
 * upshift minus downshift is zero or below. Results follow the order of the upshift curves, then
 * rise in throttle.
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
