import { assertCalibrationImage } from "../image";
import { readByte, readInt16Le, readUint16Le } from "./bytes";
import { TDE1 } from "./tde1";
import type { StrategyDefinition } from "./tde1";
import type { GridId } from "./tde1-items";

/** The two groups the editor shows the grids in. */
export type GridGroup = "fuel-power" | "timing-icp";

/** How a raw value shows for the user: `raw * perRaw`, followed by `label`. */
export interface DisplayUnit {
  readonly label: string;
  readonly perRaw: number;
}

/**
 * One input of a grid: the word function that turns a PCM value into a position along the grid.
 * The function is `(x: int16 or uint16 LE, y: uint16 LE)` pairs of 4 bytes from `functionOffset`.
 * x is the PCM value (first 0xFFFF or 0x7FFF, then going down or staying equal), y is the
 * index.fraction position in 8.8 fixed point, so 0x0100 is the second row or column. The function
 * ends at the first pair whose x is 0 (unsigned) or -32768 (signed).
 */
export interface GridAxisDefinition {
  /** What the PCM value is, as far as the reverse-engineering of the code shows. */
  readonly name: string;
  /** PCM RAM address of the 16-bit value the function reads. */
  readonly ramAddress: number;
  /** Image offset of the first x byte of the word function. */
  readonly functionOffset: number;
  /** True when the x values of the function are signed. */
  readonly breakpointsSigned: boolean;
  /** How a raw x value shows for the user. Absent when the unit is not confirmed. */
  readonly unit?: DisplayUnit;
}

/**
 * One two-dimensional grid of the TDE1 calibration. Cell (row, col) is at
 * `address + (row * rowStride + col) * cellBytes`, little-endian. The PCM reads the row from
 * `rowAxis` and the column from `colAxis`. `rows` and `cols` are the cells the editor exposes;
 * `rowStride` is the number of cells in a stored row. All twelve grids expose every stored cell,
 * so `rowStride` equals `cols`. A tune whose axis functions stop early never reaches the last
 * rows or columns; `readGridAxes` reports those as undefined.
 */
export interface GridDefinition {
  readonly id: GridId;
  readonly label: string;
  readonly group: GridGroup;
  /** What the PCM does with the grid, from the reverse-engineering notes. */
  readonly description: string;
  /** Image offset of cell (0, 0). */
  readonly address: number;
  readonly rows: number;
  readonly cols: number;
  readonly rowStride: number;
  readonly cellBytes: 1 | 2;
  readonly signed: boolean;
  readonly order: "row-major";
  readonly rowAxis: GridAxisDefinition;
  readonly colAxis: GridAxisDefinition;
  /** How a raw cell shows for the user. Absent when the unit is not confirmed. */
  readonly valueUnit?: DisplayUnit;
}

/** One grid read from an image: `definition.rows * definition.cols` cells, row by row. */
export interface Grid {
  readonly definition: GridDefinition;
  /** Raw cell values, signed when the definition says so. */
  readonly cells: readonly number[];
}

/** Image offset of the first byte of cell (`row`, `col`). Throws RangeError outside the exposed cells. */
export function gridCellOffset(definition: GridDefinition, row: number, col: number): number {
  const rowOk = Number.isInteger(row) && row >= 0 && row < definition.rows;
  const colOk = Number.isInteger(col) && col >= 0 && col < definition.cols;
  if (!rowOk || !colOk) {
    throw new RangeError(`${definition.label} has no cell at row ${row}, column ${col}`);
  }
  return definition.address + (row * definition.rowStride + col) * definition.cellBytes;
}

/** Image offsets of every byte of every exposed cell: the bytes an edit of the grid may change. */
export function gridCellOffsets(definition: GridDefinition): number[] {
  const offsets: number[] = [];
  for (let row = 0; row < definition.rows; row++) {
    for (let col = 0; col < definition.cols; col++) {
      const start = gridCellOffset(definition, row, col);
      for (let byte = 0; byte < definition.cellBytes; byte++) offsets.push(start + byte);
    }
  }
  return offsets;
}

/** The smallest and largest value one cell of the grid can hold. */
export function gridValueRange(definition: GridDefinition): readonly [number, number] {
  const bits = 8 * definition.cellBytes;
  return definition.signed ? [-(2 ** (bits - 1)), 2 ** (bits - 1) - 1] : [0, 2 ** bits - 1];
}

function readCell(image: Uint8Array, offset: number, definition: GridDefinition): number {
  if (definition.cellBytes === 2) {
    return definition.signed ? readInt16Le(image, offset) : readUint16Le(image, offset);
  }
  const byte = readByte(image, offset);
  return definition.signed && byte > 127 ? byte - 256 : byte;
}

/** Reads the exposed cells of a grid, row by row. Throws RangeError when the image is not 256 KiB. */
export function readGridCells(image: Uint8Array, definition: GridDefinition): number[] {
  assertCalibrationImage(image);
  const cells: number[] = [];
  for (let row = 0; row < definition.rows; row++) {
    for (let col = 0; col < definition.cols; col++) {
      cells.push(readCell(image, gridCellOffset(definition, row, col), definition));
    }
  }
  return cells;
}

export function readGrid(image: Uint8Array, definition: GridDefinition): Grid {
  return { definition, cells: readGridCells(image, definition) };
}

/** Reads all grids of `strategy`, in the strategy's order. */
export function readGrids(image: Uint8Array, strategy: StrategyDefinition = TDE1): readonly Grid[] {
  return strategy.grids.map((definition) => readGrid(image, definition));
}

function assertCellValue(definition: GridDefinition, value: number): void {
  const [min, max] = gridValueRange(definition);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${definition.label} cell ${value} is not a whole number ${min}..${max}`);
  }
}

/**
 * Writes the exposed cells of a grid into `image`, row by row, little-endian. Changes no other
 * byte. Throws RangeError for the wrong number of cells or a cell outside the range of the cell
 * size. Nothing is written in that case.
 */
export function writeGridCells(
  image: Uint8Array,
  definition: GridDefinition,
  cells: readonly number[],
): void {
  const count = definition.rows * definition.cols;
  if (cells.length !== count) {
    throw new RangeError(`${definition.label} needs ${count} cells, got ${cells.length}`);
  }
  cells.forEach((value) => assertCellValue(definition, value));
  cells.forEach((value, position) => {
    const offset = gridCellOffset(
      definition,
      Math.floor(position / definition.cols),
      position % definition.cols,
    );
    image[offset] = value & 0xff;
    if (definition.cellBytes === 2) image[offset + 1] = (value >> 8) & 0xff;
  });
}

/** One pair of a word function: x as stored (signed when asked), y as uint16 8.8 fixed point. */
export interface WordFunctionPoint {
  readonly xRaw: number;
  readonly yRaw: number;
}

/** A word function that does not end by itself is read this far and no further. */
const MAX_WORD_FUNCTION_PAIRS = 32;

/**
 * Reads the (x, y) word pairs at `offset` up to and including the first pair whose x is 0 (or
 * -32768 when `signedX`). Stops after 32 pairs when no such pair comes.
 */
export function readWordFunction(
  image: Uint8Array,
  offset: number,
  signedX: boolean,
): WordFunctionPoint[] {
  const last = signedX ? -32768 : 0;
  const points: WordFunctionPoint[] = [];
  for (let index = 0; index < MAX_WORD_FUNCTION_PAIRS; index++) {
    const at = offset + 4 * index;
    if (at + 4 > image.length) break;
    const xRaw = signedX ? readInt16Le(image, at) : readUint16Le(image, at);
    points.push({ xRaw, yRaw: readUint16Le(image, at + 2) });
    if (xRaw === last) break;
  }
  return points;
}

function interpolateBreakpoint(
  points: readonly WordFunctionPoint[],
  target: number,
): number | undefined {
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) continue;
    const between =
      (from.yRaw < target && target < to.yRaw) || (to.yRaw < target && target < from.yRaw);
    if (between) {
      const share = (target - from.yRaw) / (to.yRaw - from.yRaw);
      return Math.round(from.xRaw + share * (to.xRaw - from.xRaw));
    }
  }
  return undefined;
}

/**
 * The PCM value at which the axis function reaches position `index`: the x of the first pair with
 * that position, else the straight-line value between the two pairs around it. The leading pair
 * (0xFFFF or 0x7FFF) is a stop value, not a breakpoint, and is skipped.
 */
function breakpointAt(
  points: readonly WordFunctionPoint[],
  index: number,
  signedX: boolean,
): number | undefined {
  const stop = signedX ? 0x7fff : 0xffff;
  const inner = points[0]?.xRaw === stop ? points.slice(1) : points;
  const target = index * 256;
  return inner.find((point) => point.yRaw === target)?.xRaw ?? interpolateBreakpoint(inner, target);
}

/**
 * Reads `count` breakpoints of a grid axis, in PCM input units as stored (engine speed is rpm x 4).
 * An entry is undefined when the axis function never reaches that index. Throws RangeError when the
 * image is not 256 KiB.
 */
export function readGridAxis(
  image: Uint8Array,
  axis: GridAxisDefinition,
  count: number,
): readonly (number | undefined)[] {
  assertCalibrationImage(image);
  const points = readWordFunction(image, axis.functionOffset, axis.breakpointsSigned);
  return Array.from({ length: count }, (_unused, index) =>
    breakpointAt(points, index, axis.breakpointsSigned),
  );
}

/** The breakpoints of both axes of a grid. */
export interface GridAxes {
  /** One entry per row. */
  readonly rowBreakpointsRaw: readonly (number | undefined)[];
  /** One entry per column. */
  readonly colBreakpointsRaw: readonly (number | undefined)[];
}

export function readGridAxes(image: Uint8Array, definition: GridDefinition): GridAxes {
  return {
    rowBreakpointsRaw: readGridAxis(image, definition.rowAxis, definition.rows),
    colBreakpointsRaw: readGridAxis(image, definition.colAxis, definition.cols),
  };
}
