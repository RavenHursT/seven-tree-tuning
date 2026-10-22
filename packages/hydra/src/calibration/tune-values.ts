import { assertCalibrationImage } from "../image";
import { readByte, readUint16Le, writeUint16Le } from "./bytes";
import { assertOnlyEditableChanges } from "./edit-guard";
import { closedThrottleIndex, speedByteOffset } from "./shift-curve";
import type { ShiftCurve } from "./shift-curve";
import { SHIFT_CURVE_IDS, TDE1 } from "./tde1";
import type { ShiftCurveDefinition, ShiftCurveId, StrategyDefinition } from "./tde1";
import { rpmToIdleRaw } from "./units";

/** The values the editor can change, as stored in the image. */
export interface TuneValues {
  /** Ten shift-speed bytes (mph x 2) per curve, padding after the closed-throttle point included. */
  readonly shiftSpeedsRaw: Readonly<Record<ShiftCurveId, readonly number[]>>;
  /** Both warm-idle copies, uint16 rpm x 4. */
  readonly warmIdleRaw: readonly [number, number];
}

/** What changed between two sets of values. See `diffTuneValues`. */
export interface TuneValuesDiff {
  readonly changedShiftPoints: number;
  readonly idleChanged: boolean;
}

function definitionFor(strategy: StrategyDefinition, id: ShiftCurveId): ShiftCurveDefinition {
  const definition = strategy.shiftCurves.find((candidate) => candidate.id === id);
  if (!definition) throw new RangeError(`strategy ${strategy.id} has no ${id} curve`);
  return definition;
}

function mapCurves<T>(build: (id: ShiftCurveId) => T): Record<ShiftCurveId, T> {
  return Object.fromEntries(SHIFT_CURVE_IDS.map((id) => [id, build(id)])) as Record<
    ShiftCurveId,
    T
  >;
}

function toByte(value: number): number {
  if (Number.isNaN(value)) throw new RangeError("a shift speed must be a number");
  return Math.min(255, Math.max(0, Math.round(value)));
}

function readSpeeds(image: Uint8Array, definition: ShiftCurveDefinition, count: number): number[] {
  return Array.from({ length: count }, (_unused, index) =>
    readByte(image, speedByteOffset(definition, index)),
  );
}

/** Reads the 60 shift-speed bytes and both warm-idle values. */
export function readTuneValues(image: Uint8Array, strategy: StrategyDefinition = TDE1): TuneValues {
  assertCalibrationImage(image);
  const [first, second] = strategy.idle.warmIdleOffsets;
  return {
    shiftSpeedsRaw: mapCurves((id) =>
      readSpeeds(image, definitionFor(strategy, id), strategy.breakpointsPerCurve),
    ),
    warmIdleRaw: [readUint16Le(image, first), readUint16Le(image, second)],
  };
}

function withCurveSpeeds(
  values: TuneValues,
  id: ShiftCurveId,
  speeds: readonly number[],
): TuneValues {
  return { ...values, shiftSpeedsRaw: { ...values.shiftSpeedsRaw, [id]: speeds } };
}

/**
 * Sets one shift speed (mph x 2), rounded and clamped to 0..255. Setting the closed-throttle point
 * also sets every padding breakpoint after it, which the PCM never reads. Returns new values.
 */
export function setShiftPointRaw(
  values: TuneValues,
  curve: ShiftCurve,
  index: number,
  speedRaw: number,
): TuneValues {
  const id = curve.definition.id;
  const current = values.shiftSpeedsRaw[id];
  if (!Number.isInteger(index) || index < 0 || index >= current.length) {
    throw new RangeError(`breakpoint ${index} is outside the ${current.length} breakpoints`);
  }
  const next = toByte(speedRaw);
  const closed = closedThrottleIndex(curve);
  const isChanged = (position: number) =>
    position === index || (index === closed && position > closed);
  return withCurveSpeeds(
    values,
    id,
    current.map((old, position) => (isChanged(position) ? next : old)),
  );
}

/** Sets both warm-idle copies to `rpm`, rounded to a quarter rpm and clamped to 0..16383.75. */
export function setWarmIdleRpm(values: TuneValues, rpm: number): TuneValues {
  if (Number.isNaN(rpm)) throw new RangeError("idle rpm must be a number");
  const raw = rpmToIdleRaw(rpm);
  return { ...values, warmIdleRaw: [raw, raw] };
}

/**
 * Multiplies all 60 shift-speed bytes by `factor`: round(raw x factor), clamped to 0..255. The
 * tire-size compensation of tools/tirecomp.ts. Throttle axes and idle are untouched.
 * Throws RangeError unless `factor` is a finite number above zero.
 */
export function scaleShiftSpeeds(values: TuneValues, factor: number): TuneValues {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new RangeError(`the scale factor must be a finite number above zero, got ${factor}`);
  }
  return {
    ...values,
    shiftSpeedsRaw: mapCurves((id) => values.shiftSpeedsRaw[id].map((raw) => toByte(raw * factor))),
  };
}

function writeSpeeds(
  image: Uint8Array,
  definition: ShiftCurveDefinition,
  speeds: readonly number[],
  count: number,
): void {
  if (speeds.length !== count) {
    throw new RangeError(`${definition.label} needs ${count} shift speeds, got ${speeds.length}`);
  }
  speeds.forEach((speed, index) => {
    if (!Number.isInteger(speed) || speed < 0 || speed > 255) {
      throw new RangeError(`${definition.label} shift speed ${speed} is not a whole number 0..255`);
    }
    image[speedByteOffset(definition, index)] = speed;
  });
}

/**
 * Returns a copy of `baseImage` with the values written: the 60 shift-speed bytes and the 4
 * warm-idle bytes. Changes nothing else, and checks that before returning.
 * Throws RangeError for a value that does not fit its byte or word.
 */
export function writeTuneValues(
  baseImage: Uint8Array,
  values: TuneValues,
  strategy: StrategyDefinition = TDE1,
): Uint8Array {
  assertCalibrationImage(baseImage);
  const image = new Uint8Array(baseImage);
  for (const definition of strategy.shiftCurves) {
    const speeds = values.shiftSpeedsRaw[definition.id];
    writeSpeeds(image, definition, speeds, strategy.breakpointsPerCurve);
  }
  const [firstOffset, secondOffset] = strategy.idle.warmIdleOffsets;
  writeUint16Le(image, firstOffset, values.warmIdleRaw[0]);
  writeUint16Le(image, secondOffset, values.warmIdleRaw[1]);
  assertOnlyEditableChanges(baseImage, image, strategy);
  return image;
}

function countChangedSpeeds(original: TuneValues, edited: TuneValues): number {
  let changed = 0;
  for (const id of SHIFT_CURVE_IDS) {
    const before = original.shiftSpeedsRaw[id];
    const after = edited.shiftSpeedsRaw[id];
    for (let index = 0; index < Math.max(before.length, after.length); index++) {
      if (before[index] !== after[index]) changed++;
    }
  }
  return changed;
}

/**
 * Compares two sets of values. `changedShiftPoints` counts every changed speed byte of the 60,
 * padding included, so editing a closed-throttle point also counts the padding bytes written
 * with it. `idleChanged` is true when either warm-idle copy differs.
 */
export function diffTuneValues(original: TuneValues, edited: TuneValues): TuneValuesDiff {
  const idleChanged =
    original.warmIdleRaw[0] !== edited.warmIdleRaw[0] ||
    original.warmIdleRaw[1] !== edited.warmIdleRaw[1];
  return { changedShiftPoints: countChangedSpeeds(original, edited), idleChanged };
}
