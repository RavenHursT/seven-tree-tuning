import { assertCalibrationImage } from "../image";
import { readInt16Le, readUint16Le } from "./bytes";
import { TDE1 } from "./tde1";
import type { StrategyDefinition } from "./tde1";
import { idleRawToRpm } from "./units";

/** One point of the idle function. */
export interface IdlePoint {
  /** The function's input as stored: int16, little-endian. Its meaning is not confirmed. */
  readonly inputRaw: number;
  /** Idle rpm at that input. */
  readonly rpm: number;
}

/**
 * Reads the idle function: `pointCount` points of 4 bytes from `curveOffset`, each an int16 input
 * then a uint16 rpm x 4 (both little-endian). Throws RangeError when the image is not 256 KiB.
 */
export function readIdleCurve(
  image: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): readonly IdlePoint[] {
  assertCalibrationImage(image);
  return Array.from({ length: strategy.idle.pointCount }, (_unused, index) => {
    const offset = strategy.idle.curveOffset + 4 * index;
    return {
      inputRaw: readInt16Le(image, offset),
      rpm: idleRawToRpm(readUint16Le(image, offset + 2)),
    };
  });
}
