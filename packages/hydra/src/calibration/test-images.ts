import { CALIBRATION_IMAGE_SIZE } from "../image";
import { TDE1 } from "./tde1";
import type { ShiftCurveDefinition, ShiftCurveId } from "./tde1";

/** Parses "ff 36 a8" into [255, 54, 168]. */
export function hexBytes(text: string): number[] {
  return text
    .trim()
    .split(/\s+/)
    .map((pair) => Number.parseInt(pair, 16));
}

/**
 * Real curve bytes of TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG, 20 bytes per curve starting one
 * byte before `speedOffset`: ten (throttle, speed) pairs. The 0xFF terminator is added by
 * `buildTde1Image`.
 */
export const DAILY_DRIVER_CURVES: Readonly<Record<ShiftCurveId, readonly number[]>> = {
  "up-1-2": hexBytes("ff 36 a8 36 a8 2a 7d 1c 4b 12 32 0e 00 0e 00 0e 00 0e 00 0e"),
  "up-2-3": hexBytes("ff 56 a8 54 98 4c 7c 41 53 30 2b 24 00 24 00 24 00 24 00 24"),
  "up-3-4": hexBytes("ff 81 c8 81 96 78 90 71 51 4f 00 4c 00 4c 00 4c 00 4c 00 4c"),
  "down-2-1": hexBytes("ff 2a af 2a af 1c 96 18 7d 11 64 0f 4b 0b 00 0b 00 0b 00 0b"),
  "down-3-2": hexBytes("ff 4a c8 4a 96 3e 4b 25 32 23 00 23 00 23 00 23 00 23 00 23"),
  "down-4-3": hexBytes("ff 7e e1 7e af 70 90 66 64 48 00 48 00 48 00 48 00 48 00 48"),
};

/** One idle point: (input, rpm). */
export type IdleFixturePoint = readonly [input: number, rpm: number];

/** Idle points of the Daily Driver tune. */
export const DAILY_DRIVER_IDLE: readonly IdleFixturePoint[] = [
  [32767, 680],
  [80, 680],
  [0, 1100],
  [-40, 1200],
  [-32768, 1200],
  [-32768, 1200],
];

/** Idle points of Power Hungry's stock "0S" position. */
export const STOCK_IDLE: readonly IdleFixturePoint[] = [
  [32767, 650],
  [0, 650],
  [-80, 1100],
  [-120, 1200],
  [-32768, 1200],
  [-32768, 1200],
];

export interface TestImageOptions {
  readonly curves?: Partial<Record<ShiftCurveId, readonly number[]>>;
  readonly idle?: readonly IdleFixturePoint[];
}

/** Every byte differs from its neighbours, so a stray write always shows up in a comparison. */
function fillBackground(image: Uint8Array): void {
  for (let offset = 0; offset < image.length; offset++) {
    image[offset] = (offset * 37 + 11) & 0xff;
  }
}

function writeCurve(image: Uint8Array, definition: ShiftCurveDefinition, bytes: readonly number[]) {
  const start = definition.speedOffset - 1;
  image.set(bytes, start);
  image[start + bytes.length] = 0xff;
}

function writeIdle(image: Uint8Array, points: readonly IdleFixturePoint[]): void {
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
  points.forEach(([input, rpm], index) => {
    const offset = TDE1.idle.curveOffset + 4 * index;
    view.setInt16(offset, input, true);
    view.setUint16(offset + 2, rpm * 4, true);
  });
}

/** A 256 KiB image holding the Daily Driver curves and idle points unless overridden. */
export function buildTde1Image(options: TestImageOptions = {}): Uint8Array {
  const image = new Uint8Array(CALIBRATION_IMAGE_SIZE);
  fillBackground(image);
  for (const definition of TDE1.shiftCurves) {
    const bytes = options.curves?.[definition.id] ?? DAILY_DRIVER_CURVES[definition.id];
    writeCurve(image, definition, bytes);
  }
  writeIdle(image, options.idle ?? DAILY_DRIVER_IDLE);
  return image;
}
