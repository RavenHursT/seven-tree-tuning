import { assertCalibrationImage } from "../image";
import {
  closedPedalIndex,
  functionYOffset,
  functionYRange,
  readByteFunction,
} from "./byte-function";
import type {
  ByteFunction,
  ByteFunctionDefinition,
  EpcFunctionDefinition,
  LockupFunctionDefinition,
} from "./byte-function";
import { readByte, readUint16Le, writeUint16Le } from "./bytes";
import { assertOnlyEditableChanges } from "./edit-guard";
import { gridCellOffset, gridValueRange, readGridCells, writeGridCells } from "./grid";
import type { GridDefinition } from "./grid";
import { closedThrottleIndex, speedByteOffset } from "./shift-curve";
import type { ShiftCurve } from "./shift-curve";
import { SHIFT_CURVE_IDS, TDE1 } from "./tde1";
import type { ShiftCurveDefinition, ShiftCurveId, StrategyDefinition } from "./tde1";
import { EPC_FUNCTION_IDS, GRID_IDS, LOCKUP_FUNCTION_IDS } from "./tde1-items";
import type { EpcFunctionId, GridId, LockupFunctionId } from "./tde1-items";
import { rpmToIdleRaw } from "./units";

/** The values the editor can change, as stored in the image. */
export interface TuneValues {
  /** Ten shift-speed bytes (mph x 2) per curve, padding after the closed-throttle point included. */
  readonly shiftSpeedsRaw: Readonly<Record<ShiftCurveId, readonly number[]>>;
  /** Both warm-idle copies, uint16 rpm x 4. */
  readonly warmIdleRaw: readonly [number, number];
  /**
   * The speed byte (mph x 2) of every pair of each lockup function, padding after the closed-pedal
   * point included: ten bytes for 2nd and 3rd gear, four for 4th. 254 means never.
   */
  readonly lockupSpeedsRaw: Readonly<Record<LockupFunctionId, readonly number[]>>;
  /** The signed adder of every pair of each upshift line-pressure function, padding included. */
  readonly epcAddersRaw: Readonly<Record<EpcFunctionId, readonly number[]>>;
  /** The exposed cells of each grid, row by row, signed when the grid is. */
  readonly gridsRaw: Readonly<Record<GridId, readonly number[]>>;
}

/** What changed between two sets of values. See `diffTuneValues`. */
export interface TuneValuesDiff {
  readonly changedShiftPoints: number;
  readonly idleChanged: boolean;
}

/** What changed in the lockup, line-pressure and grid values. See `diffCalibrationItems`. */
export interface CalibrationItemsDiff {
  readonly changedLockupPoints: number;
  readonly changedEpcPoints: number;
  readonly changedGridCells: number;
}

function definitionFor(strategy: StrategyDefinition, id: ShiftCurveId): ShiftCurveDefinition {
  const definition = strategy.shiftCurves.find((candidate) => candidate.id === id);
  if (!definition) throw new RangeError(`strategy ${strategy.id} has no ${id} curve`);
  return definition;
}

function mapIds<Id extends string, T>(ids: readonly Id[], build: (id: Id) => T): Record<Id, T> {
  return Object.fromEntries(ids.map((id) => [id, build(id)])) as Record<Id, T>;
}

function mapCurves<T>(build: (id: ShiftCurveId) => T): Record<ShiftCurveId, T> {
  return mapIds(SHIFT_CURVE_IDS, build);
}

function itemFor<T extends { readonly id: string }>(
  strategy: StrategyDefinition,
  items: readonly T[],
  id: string,
): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new RangeError(`strategy ${strategy.id} has no ${id} item`);
  return item;
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

function readFunctionYs(image: Uint8Array, definition: ByteFunctionDefinition): number[] {
  return readByteFunction(image, definition).points.map((point) => point.yRaw);
}

/**
 * Reads the 60 shift-speed bytes, both warm-idle values, the y values of the lockup and
 * line-pressure functions, and the cells of the grids.
 */
export function readTuneValues(image: Uint8Array, strategy: StrategyDefinition = TDE1): TuneValues {
  assertCalibrationImage(image);
  const [first, second] = strategy.idle.warmIdleOffsets;
  return {
    shiftSpeedsRaw: mapCurves((id) =>
      readSpeeds(image, definitionFor(strategy, id), strategy.breakpointsPerCurve),
    ),
    warmIdleRaw: [readUint16Le(image, first), readUint16Le(image, second)],
    lockupSpeedsRaw: mapIds(LOCKUP_FUNCTION_IDS, (id) =>
      readFunctionYs(image, itemFor(strategy, strategy.lockupFunctions, id)),
    ),
    epcAddersRaw: mapIds(EPC_FUNCTION_IDS, (id) =>
      readFunctionYs(image, itemFor(strategy, strategy.epcFunctions, id)),
    ),
    gridsRaw: mapIds(GRID_IDS, (id) => readGridCells(image, itemFor(strategy, strategy.grids, id))),
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

function writeFunctionYs(
  image: Uint8Array,
  definition: ByteFunctionDefinition,
  ys: readonly number[],
): void {
  if (ys.length !== definition.pairCount) {
    throw new RangeError(
      `${definition.label} needs ${definition.pairCount} values, got ${ys.length}`,
    );
  }
  const [min, max] = functionYRange(definition);
  ys.forEach((y, index) => {
    if (!Number.isInteger(y) || y < min || y > max) {
      throw new RangeError(`${definition.label} value ${y} is not a whole number ${min}..${max}`);
    }
    image[functionYOffset(definition, index)] = y & 0xff;
  });
}

function writeItems(image: Uint8Array, values: TuneValues, strategy: StrategyDefinition): void {
  for (const definition of strategy.lockupFunctions) {
    writeFunctionYs(image, definition, values.lockupSpeedsRaw[definition.id]);
  }
  for (const definition of strategy.epcFunctions) {
    writeFunctionYs(image, definition, values.epcAddersRaw[definition.id]);
  }
  for (const definition of strategy.grids) {
    writeGridCells(image, definition, values.gridsRaw[definition.id]);
  }
}

/**
 * Returns a copy of `baseImage` with the values written: the 60 shift-speed bytes, the 4 warm-idle
 * bytes, the y byte of every lockup and line-pressure pair, and the bytes of every exposed grid
 * cell. Changes nothing else, and checks that before returning.
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
  writeItems(image, values, strategy);
  assertOnlyEditableChanges(baseImage, image, strategy);
  return image;
}

function clampToRange(value: number, [min, max]: readonly [number, number], what: string): number {
  if (Number.isNaN(value)) throw new RangeError(`${what} must be a number`);
  return Math.min(max, Math.max(min, Math.round(value)));
}

type FunctionDefinition = LockupFunctionDefinition | EpcFunctionDefinition;

function functionValues(values: TuneValues, definition: FunctionDefinition): readonly number[] {
  return definition.group === "lockup"
    ? values.lockupSpeedsRaw[definition.id]
    : values.epcAddersRaw[definition.id];
}

function withFunctionValues(
  values: TuneValues,
  definition: FunctionDefinition,
  ys: readonly number[],
): TuneValues {
  if (definition.group === "lockup") {
    return { ...values, lockupSpeedsRaw: { ...values.lockupSpeedsRaw, [definition.id]: ys } };
  }
  return { ...values, epcAddersRaw: { ...values.epcAddersRaw, [definition.id]: ys } };
}

/**
 * Sets one y value of a lockup or line-pressure function, rounded and clamped to the range of the
 * byte (0..255 for a lockup speed in mph x 2, -128..127 for an adder). Setting the closed-pedal
 * point also sets every padding pair after it, which the PCM never reads. Returns new values.
 */
export function setFunctionPointRaw(
  values: TuneValues,
  fn: ByteFunction<FunctionDefinition>,
  index: number,
  yRaw: number,
): TuneValues {
  const definition = fn.definition;
  const current = functionValues(values, definition);
  if (!Number.isInteger(index) || index < 0 || index >= current.length) {
    throw new RangeError(`pair ${index} is outside the ${current.length} pairs`);
  }
  const next = clampToRange(yRaw, functionYRange(definition), `${definition.label} value`);
  const closed = closedPedalIndex(fn);
  const isChanged = (position: number) =>
    position === index || (index === closed && position > closed);
  const updated = current.map((old, position) => (isChanged(position) ? next : old));
  return withFunctionValues(values, definition, updated);
}

/**
 * Sets one grid cell, rounded and clamped to the range of the cell size. Returns new values.
 * Throws RangeError for a cell outside the exposed rows and columns, or a value that is not a number.
 */
export function setGridCellRaw(
  values: TuneValues,
  definition: GridDefinition,
  row: number,
  col: number,
  value: number,
): TuneValues {
  gridCellOffset(definition, row, col);
  const next = clampToRange(value, gridValueRange(definition), `${definition.label} cell`);
  const position = row * definition.cols + col;
  const cells = values.gridsRaw[definition.id].map((old, at) => (at === position ? next : old));
  return { ...values, gridsRaw: { ...values.gridsRaw, [definition.id]: cells } };
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

function countChanged(before: readonly number[], after: readonly number[]): number {
  let changed = 0;
  for (let index = 0; index < Math.max(before.length, after.length); index++) {
    if (before[index] !== after[index]) changed++;
  }
  return changed;
}

function countChangedIn<Id extends string>(
  ids: readonly Id[],
  before: Readonly<Record<Id, readonly number[]>>,
  after: Readonly<Record<Id, readonly number[]>>,
): number {
  return ids.reduce((total, id) => total + countChanged(before[id], after[id]), 0);
}

/**
 * Compares the lockup, line-pressure and grid values of two sets of values. Each count is every
 * changed value, padding included, so editing a closed-pedal point also counts the padding values
 * written with it.
 */
export function diffCalibrationItems(
  original: TuneValues,
  edited: TuneValues,
): CalibrationItemsDiff {
  return {
    changedLockupPoints: countChangedIn(
      LOCKUP_FUNCTION_IDS,
      original.lockupSpeedsRaw,
      edited.lockupSpeedsRaw,
    ),
    changedEpcPoints: countChangedIn(EPC_FUNCTION_IDS, original.epcAddersRaw, edited.epcAddersRaw),
    changedGridCells: countChangedIn(GRID_IDS, original.gridsRaw, edited.gridsRaw),
  };
}
