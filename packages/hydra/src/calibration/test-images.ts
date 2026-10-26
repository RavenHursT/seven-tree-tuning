import { CALIBRATION_IMAGE_SIZE } from "../image";
import { gridValueRange, writeGridCells } from "./grid";
import type { GridDefinition } from "./grid";
import { TDE1 } from "./tde1";
import type { ShiftCurveDefinition, ShiftCurveId } from "./tde1";
import type { EpcFunctionId, GridId, LockupFunctionId } from "./tde1-items";

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

/**
 * Real bytes of the lockup functions of TDE1_30N_DAILYDRIVER-REVD, starting at each function's
 * address: ten (pedal, speed) pairs for 2nd and 3rd gear, four for 4th gear. The speed byte is
 * mph x 2: 4th gear locks at 30 mph and unlocks at 28 mph.
 */
export const DAILY_DRIVER_LOCKUP: Readonly<Record<LockupFunctionId, readonly number[]>> = {
  "lock-2": hexBytes("ff 40 9a 40 66 28 66 fe 00 fe 00 fe 00 fe 00 fe 00 fe 00 fe"),
  "lock-3": hexBytes("ff 3e b2 3e 80 36 33 36 00 36 00 36 00 36 00 36 00 36 00 36"),
  "lock-4": hexBytes("ff 3c b3 3c b3 3c 00 3c"),
  "unlock-2": hexBytes("ff 1e 00 1e 00 1e 00 1e 00 1e 00 1e 00 1e 00 1e 00 1e 00 1e"),
  "unlock-3": hexBytes("ff 22 00 22 00 22 00 22 00 22 00 22 00 22 00 22 00 22 00 22"),
  "unlock-4": hexBytes("ff 38 00 38 00 38 00 38"),
};

/** Real bytes of the three upshift line-pressure adders of TDE1_30N_DAILYDRIVER-REVD. */
export const DAILY_DRIVER_EPC: Readonly<Record<EpcFunctionId, readonly number[]>> = {
  "epc-1-2": hexBytes("ff 12 96 12 7d 0d 4b 0d 32 0a 00 0a 00 0a 00 0a 00 0a 00 0a"),
  "epc-2-3": hexBytes("ff 0e af 0a 19 0a 00 0a 00 0a 00 0a 00 0a 00 0a 00 0a 00 0a"),
  "epc-3-4": hexBytes("ff 26 bb 26 96 20 4b 20 1e 1c 00 1c 00 1c 00 1c 00 1c 00 1c"),
};

/**
 * Real bytes of the word functions that give the rows and columns of the grids, from
 * TDE1_30N_DAILYDRIVER-REVD: (image offset, bytes up to and including the last pair).
 */
const DAILY_DRIVER_AXIS_FUNCTIONS: ReadonlyArray<readonly [offset: number, bytes: number[]]> = [
  [
    0x120a0,
    hexBytes(
      "ff ff 00 0f 10 40 00 0f b8 3d 00 0e 08 39 00 0d c8 32 00 0c 50 2d 00 0b 20 1c 00 05 e0 15 00 04 a0 0f 00 03 80 0c 00 02 d0 07 00 00 00 00 00 00",
    ),
  ],
  [0x120e0, hexBytes("ff ff 00 02 60 09 00 02 f0 00 00 01 00 00 00 00")],
  [0x121dc, hexBytes("ff ff 00 0a 00 15 00 0a 00 05 00 02 00 04 00 01 66 03 00 00 00 00 00 00")],
  [
    0x121a8,
    hexBytes(
      "ff ff 00 0a 00 05 00 0a 60 04 00 08 20 03 00 06 e0 01 00 05 60 01 00 04 c0 00 00 03 80 00 00 02 20 00 00 01 00 00 00 00",
    ),
  ],
  [0x12244, hexBytes("ff ff 00 0a 00 15 00 0a 00 05 00 02 00 04 00 01 66 03 00 00 00 00 00 00")],
  [
    0x12164,
    hexBytes(
      "ff 7f 00 00 3c 02 00 00 10 02 00 01 d0 01 00 03 c0 01 00 04 1c 01 00 05 8c 00 00 06 58 00 00 07 0c 00 00 08 f4 ff 00 09 d6 ff 00 0a b4 ff 00 0b ac ff 00 0c a0 ff 00 0e 6e ff 00 0f 00 80 00 0f",
    ),
  ],
  [0x12210, hexBytes("ff ff 00 0a 00 15 00 0a 00 05 00 02 00 04 00 01 66 03 00 00 00 00 00 00")],
  [
    0x14f18,
    hexBytes("ff ff 00 0e ff 03 00 0e ff 03 00 08 b6 03 00 07 ee 02 00 06 96 00 00 02 00 00 00 00"),
  ],
  [
    0x12124,
    hexBytes(
      "ff ff 00 0f 10 40 00 0f f0 3c 00 0a e0 2e 00 08 a0 0f 00 04 b8 0b 00 03 60 09 00 02 40 06 00 01 00 00 00 00",
    ),
  ],
  [
    0x12278,
    hexBytes(
      "ff 7f 00 09 60 01 00 09 10 01 00 08 d4 00 00 07 34 00 00 03 18 00 00 02 f8 ff 00 00 00 80 00 00",
    ),
  ],
  [0x12050, hexBytes("ff ff 00 0a e0 2e 00 0a 20 1c 00 07 80 0c 00 02 d0 07 00 00 00 00 00 00")],
  [
    0x12074,
    hexBytes(
      "ff ff 00 09 60 04 00 09 c0 03 00 08 90 03 00 07 70 03 00 06 d0 02 00 05 50 02 00 04 40 01 00 02 f0 00 00 01 50 00 00 00 00 00 00 00",
    ),
  ],
  [
    0x120f4,
    hexBytes(
      "ff ff 00 0a 20 35 00 0a e0 2e 00 09 a0 28 00 08 e0 15 00 02 a0 0f 00 01 28 0a 00 00 00 00 00 00",
    ),
  ],
  [
    0x122cc,
    hexBytes(
      "ff 7f 00 06 40 01 00 06 f0 00 00 05 50 00 00 04 00 00 00 03 b0 ff 00 01 60 ff 00 00 00 80 00 00",
    ),
  ],
  [
    0x122ec,
    hexBytes("ff ff 00 06 80 3e 00 06 40 1f 00 05 a0 0f 00 04 d0 07 00 03 20 03 00 02 00 00 00 00"),
  ],
  [
    0x122a8,
    hexBytes(
      "ff ff 00 06 70 03 00 06 50 02 00 05 d0 01 00 04 f0 00 00 02 a0 00 00 01 60 00 00 00 00 00 00 00",
    ),
  ],
  [
    0x1317a,
    hexBytes(
      "ff ff 00 0a 40 38 00 0a e0 2e 00 08 a0 28 00 07 80 0c 00 02 28 0a 00 01 78 05 00 00 00 00 00 00",
    ),
  ],
  [0x1385c, hexBytes("ff ff 00 0a 00 05 00 0a 00 00 00 00")],
  [0x13888, hexBytes("ff ff 00 0a 00 17 00 0a 00 13 00 09 00 05 00 02 00 03 00 00 00 00 00 00")],
];

/**
 * Patterned cell values of a grid, row by row, each within the range of the cell. The values vary
 * from cell to cell and signed grids hold negative values, so a misplaced cell shows in a test.
 */
export function patternedGridCells(definition: GridDefinition): number[] {
  const [min, max] = gridValueRange(definition);
  const span = max - min + 1;
  const seed = TDE1.grids.indexOf(definition) * 131 + 7;
  return Array.from(
    { length: definition.rows * definition.cols },
    (_unused, position) => min + ((position * 977 + seed) % span),
  );
}

export interface TestImageOptions {
  readonly curves?: Partial<Record<ShiftCurveId, readonly number[]>>;
  readonly idle?: readonly IdleFixturePoint[];
  /** Bytes of lockup functions from the function's address, `2 * pairCount` each. */
  readonly lockup?: Partial<Record<LockupFunctionId, readonly number[]>>;
  /** Bytes of line-pressure adders from the function's address, 20 each. */
  readonly epc?: Partial<Record<EpcFunctionId, readonly number[]>>;
  /** Exposed cells of grids, row by row. */
  readonly grids?: Partial<Record<GridId, readonly number[]>>;
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

function writeFunctions(image: Uint8Array, options: TestImageOptions): void {
  for (const definition of TDE1.lockupFunctions) {
    image.set(
      options.lockup?.[definition.id] ?? DAILY_DRIVER_LOCKUP[definition.id],
      definition.address,
    );
  }
  for (const definition of TDE1.epcFunctions) {
    image.set(options.epc?.[definition.id] ?? DAILY_DRIVER_EPC[definition.id], definition.address);
  }
  for (const [offset, bytes] of DAILY_DRIVER_AXIS_FUNCTIONS) image.set(bytes, offset);
}

function writeGrids(image: Uint8Array, options: TestImageOptions): void {
  for (const definition of TDE1.grids) {
    writeGridCells(
      image,
      definition,
      options.grids?.[definition.id] ?? patternedGridCells(definition),
    );
  }
}

/**
 * A 256 KiB image holding the Daily Driver curves, idle points, lockup and line-pressure functions
 * and axis functions, and patterned grid cells, unless overridden.
 */
export function buildTde1Image(options: TestImageOptions = {}): Uint8Array {
  const image = new Uint8Array(CALIBRATION_IMAGE_SIZE);
  fillBackground(image);
  for (const definition of TDE1.shiftCurves) {
    const bytes = options.curves?.[definition.id] ?? DAILY_DRIVER_CURVES[definition.id];
    writeCurve(image, definition, bytes);
  }
  writeIdle(image, options.idle ?? DAILY_DRIVER_IDLE);
  writeFunctions(image, options);
  writeGrids(image, options);
  return image;
}
