import { assertCalibrationImage } from "../image";
import { readByte } from "./bytes";
import type { LayoutIssue } from "./layout";
import { TDE1 } from "./tde1";
import type { StrategyDefinition } from "./tde1";
import type { EpcFunctionId, LockupFunctionId } from "./tde1-items";

/** The PCM function families that are stored as Ford 8-bit functions. */
export type ByteFunctionGroup = "lockup" | "line-pressure";

/**
 * The y byte of a lockup function that means "never": 127 mph, which no vehicle reaches. The PCM
 * then does not lock (or does not unlock) in that gear at that pedal position.
 */
export const LOCKUP_NEVER_SPEED_RAW = 0xfe;

/**
 * One Ford 8-bit function in the decrypted 256 KiB image: `pairCount` (x, y) byte pairs, 2 bytes
 * each, from `address`. x is the pedal byte (0..255), first 0xFF, then going down. The PCM stops at
 * the first pair whose x is 0; later pairs are padding. Pair i has its x byte at `address + 2 * i`
 * and its y byte at `address + 2 * i + 1`. The shift curves name the first y byte instead
 * (`speedOffset` = `address + 1`).
 */
export interface ByteFunctionDefinition<Id extends string = string> {
  readonly id: Id;
  readonly group: ByteFunctionGroup;
  readonly label: string;
  /** Image offset of the first x byte (0xFF). */
  readonly address: number;
  readonly pairCount: number;
  /** True when y is a signed byte (-128..127), false when it is unsigned (0..255). */
  readonly signedY: boolean;
}

export type LockupFunctionDefinition = ByteFunctionDefinition<LockupFunctionId> & {
  readonly group: "lockup";
};
export type EpcFunctionDefinition = ByteFunctionDefinition<EpcFunctionId> & {
  readonly group: "line-pressure";
};

/** One pair of a byte function, as stored. `yRaw` is signed when the definition says so. */
export interface ByteFunctionPoint {
  /** Position in the function, 0 is the first (wide-open pedal) pair. */
  readonly index: number;
  /** Pedal byte: 255 wide open, 0 closed. */
  readonly xRaw: number;
  readonly yRaw: number;
}

export interface ByteFunction<D extends ByteFunctionDefinition = ByteFunctionDefinition> {
  readonly definition: D;
  readonly points: readonly ByteFunctionPoint[];
}

/** Image offset of pair `index`'s x (pedal) byte. */
export function functionXOffset(definition: ByteFunctionDefinition, index: number): number {
  return definition.address + 2 * index;
}

/** Image offset of pair `index`'s y byte. */
export function functionYOffset(definition: ByteFunctionDefinition, index: number): number {
  return definition.address + 2 * index + 1;
}

/** The y value a stored byte stands for: itself, or its two's complement when y is signed. */
export function functionYFromByte(definition: ByteFunctionDefinition, byte: number): number {
  return definition.signedY && byte > 127 ? byte - 256 : byte;
}

/** The smallest and largest y value the definition can store. */
export function functionYRange(definition: ByteFunctionDefinition): readonly [number, number] {
  return definition.signedY ? [-128, 127] : [0, 255];
}

/** Reads one byte function from a 256 KiB image. Throws RangeError when the image is not 256 KiB. */
export function readByteFunction<D extends ByteFunctionDefinition>(
  image: Uint8Array,
  definition: D,
): ByteFunction<D> {
  assertCalibrationImage(image);
  const points = Array.from({ length: definition.pairCount }, (_unused, index) => ({
    index,
    xRaw: readByte(image, functionXOffset(definition, index)),
    yRaw: functionYFromByte(definition, readByte(image, functionYOffset(definition, index))),
  }));
  return { definition, points };
}

/** Reads all lockup functions of `strategy`, in the strategy's order. */
export function readLockupFunctions(
  image: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): readonly ByteFunction<LockupFunctionDefinition>[] {
  return strategy.lockupFunctions.map((definition) => readByteFunction(image, definition));
}

/** Reads all upshift line-pressure functions of `strategy`, in the strategy's order. */
export function readEpcFunctions(
  image: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): readonly ByteFunction<EpcFunctionDefinition>[] {
  return strategy.epcFunctions.map((definition) => readByteFunction(image, definition));
}

/**
 * Index of the first pair whose pedal byte is 0: the closed-pedal value. Pairs after it are padding
 * the PCM never reads. A function without a pedal-0 pair (an unsupported layout) gives the last
 * index.
 */
export function closedPedalIndex(fn: ByteFunction): number {
  const index = fn.points.findIndex((point) => point.xRaw === 0);
  return index === -1 ? fn.points.length - 1 : index;
}

function firstPedalIssue(xs: readonly number[]): string | undefined {
  return xs[0] === 0xff ? undefined : `the first pedal value is ${xs[0]}, not 255.`;
}

function risingPedalIssue(xs: readonly number[], end: number): string | undefined {
  for (let index = 1; index <= end; index++) {
    const before = xs[index - 1];
    const after = xs[index];
    if (before !== undefined && after !== undefined && after > before) {
      return `the pedal values go up from ${before} to ${after}. They can only stay the same or go down.`;
    }
  }
  return undefined;
}

function missingZeroIssue(xs: readonly number[]): string | undefined {
  return xs.includes(0) ? undefined : "no pedal value is 0, so the PCM never finds the end.";
}

function functionIssues(fn: ByteFunction): LayoutIssue[] {
  const xs = fn.points.map((point) => point.xRaw);
  const end = closedPedalIndex(fn);
  return [firstPedalIssue(xs), risingPedalIssue(xs, end), missingZeroIssue(xs)]
    .filter((text): text is string => text !== undefined)
    .map((text) => ({ message: `${fn.definition.label}: ${text}` }));
}

/**
 * Checks that every lockup and line-pressure function has the proven layout: first pedal value 255,
 * pedal values never rising, and a pedal value 0 inside the function. An image that is not 256 KiB
 * gives one issue and no further checks.
 */
export function findByteFunctionIssues(
  image: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): LayoutIssue[] {
  try {
    assertCalibrationImage(image);
  } catch (error) {
    return [{ message: (error as Error).message }];
  }
  return [...strategy.lockupFunctions, ...strategy.epcFunctions].flatMap((definition) =>
    functionIssues(readByteFunction(image, definition)),
  );
}
