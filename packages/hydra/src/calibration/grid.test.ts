import { describe, expect, it } from "vitest";

import { CALIBRATION_IMAGE_SIZE } from "../image";
import {
  findGridAxisIssues,
  gridCellOffset,
  gridCellOffsets,
  gridValueRange,
  readGrid,
  readGridAxes,
  readGrids,
  readGridAxis,
  readWordFunction,
  writeGridCells,
} from "./grid";
import type { GridAxisDefinition, GridDefinition } from "./grid";
import { TDE1_GRIDS } from "./tde1-items";
import { buildTde1Image } from "./test-images";

function grid(id: string): GridDefinition {
  const found = TDE1_GRIDS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no grid ${id}`);
  return found;
}

function blankImage(): Uint8Array {
  return new Uint8Array(CALIBRATION_IMAGE_SIZE);
}

/** Writes (x, y) word pairs of 4 bytes, little-endian, at `offset`. x may be negative. */
function putWordFunction(
  image: Uint8Array,
  offset: number,
  pairs: ReadonlyArray<readonly [x: number, y: number]>,
): void {
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
  pairs.forEach(([x, y], index) => {
    view.setInt16(offset + 4 * index, x, true);
    view.setUint16(offset + 4 * index + 2, y, true);
  });
}

const baseWidth = grid("base-pulse-width");
const maxFuel = grid("max-fuel");
const timing = grid("base-timing-sea-level");
const fuelLimit = grid("fuel-limit-sea-level");

describe("gridCellOffset", () => {
  it("finds a cell row by row, with the stored row length", () => {
    expect(gridCellOffset(maxFuel, 0, 0)).toBe(0x125cc);
    expect(gridCellOffset(maxFuel, 1, 2)).toBe(0x125cc + (16 + 2) * 2);
    expect(gridCellOffset(baseWidth, 1, 2)).toBe(0x1262c + (13 + 2) * 2);
    expect(gridCellOffset(fuelLimit, 2, 3)).toBe(0x12c3e + 2 * 11 + 3);
  });

  it("rejects a cell outside the exposed rows and columns", () => {
    expect(() => gridCellOffset(baseWidth, 13, 0)).toThrow(RangeError);
    expect(() => gridCellOffset(baseWidth, 0, 13)).toThrow(RangeError);
    expect(() => gridCellOffset(baseWidth, -1, 0)).toThrow(RangeError);
    expect(() => gridCellOffset(baseWidth, 0.5, 0)).toThrow(RangeError);
  });
});

describe("gridCellOffsets", () => {
  it("lists every byte of every exposed cell and no other byte", () => {
    const offsets = gridCellOffsets(baseWidth);
    expect(offsets).toHaveLength(13 * 13 * 2);
    expect(offsets).toContain(0x1262c + 2 * 12 * 13 + 2 * 12 + 1);
    expect(offsets).not.toContain(0x1262c + 2 * 13 * 13);
  });

  it("lists one byte for each cell of a byte grid", () => {
    expect(gridCellOffsets(fuelLimit)).toHaveLength(110);
  });
});

describe("gridValueRange", () => {
  it("gives the range of the cell size and signedness", () => {
    expect(gridValueRange(maxFuel)).toEqual([0, 65535]);
    expect(gridValueRange(timing)).toEqual([-32768, 32767]);
    expect(gridValueRange(fuelLimit)).toEqual([0, 255]);
  });
});

describe("readGrid", () => {
  it("reads unsigned 16-bit cells little-endian, row by row", () => {
    const image = blankImage();
    image.set([0x34, 0x12, 0xff, 0xff], 0x125cc);
    image.set([0x01, 0x00], 0x125cc + 16 * 2);
    const { cells } = readGrid(image, maxFuel);
    expect(cells).toHaveLength(48);
    expect(cells.slice(0, 2)).toEqual([0x1234, 0xffff]);
    expect(cells[16]).toBe(1);
  });

  it("reads signed 16-bit cells as two's complement", () => {
    const image = blankImage();
    image.set([0x00, 0x80, 0xc0, 0xff, 0x40, 0x00], 0x12d1a);
    expect(readGrid(image, timing).cells.slice(0, 3)).toEqual([-32768, -64, 64]);
  });

  it("reads byte cells as unsigned", () => {
    const image = blankImage();
    image.set([0xff, 0x64, 0x00], 0x12c3e);
    expect(readGrid(image, fuelLimit).cells.slice(0, 3)).toEqual([255, 100, 0]);
  });

  it("reads all 13 x 13 cells of the base pulse width, rows and columns 11 and 12 included", () => {
    const image = blankImage();
    image.set([0x07, 0x00], 0x1262c + 2 * 13);
    image.set([0x09, 0x00], 0x1262c + 2 * (12 * 13 + 12));
    const { cells, definition } = readGrid(image, baseWidth);
    expect(definition).toBe(baseWidth);
    expect(cells).toHaveLength(169);
    expect(cells[13]).toBe(7);
    expect(cells[168]).toBe(9);
  });

  it("rejects an image that is not 256 KiB", () => {
    expect(() => readGrid(new Uint8Array(100), maxFuel)).toThrow(RangeError);
  });
});

describe("readGrids", () => {
  it("reads every grid of the strategy, in its order, as rows x columns cells", () => {
    const grids = readGrids(blankImage());
    expect(grids.map((read) => read.definition)).toEqual(TDE1_GRIDS);
    expect(grids.map((read) => read.cells.length)).toEqual(
      TDE1_GRIDS.map((definition) => definition.rows * definition.cols),
    );
  });
});

describe("writeGridCells", () => {
  it("writes cells little-endian into the stored positions and nothing else", () => {
    const image = blankImage();
    const cells = Array.from({ length: 169 }, (_unused, index) => index + 1);
    writeGridCells(image, baseWidth, cells);
    expect(image.slice(0x1262c, 0x1262c + 4)).toEqual(Uint8Array.of(1, 0, 2, 0));
    expect(image.slice(0x1262c + 2 * 13, 0x1262c + 2 * 13 + 2)).toEqual(Uint8Array.of(14, 0));
    expect(image[0x1262c + 2 * 169]).toBe(0);
    expect(readGrid(image, baseWidth).cells).toEqual(cells);
  });

  it("writes negative values of a signed grid as two's complement", () => {
    const image = blankImage();
    writeGridCells(
      image,
      timing,
      Array.from({ length: 110 }, () => -1),
    );
    expect(image.slice(0x12d1a, 0x12d1a + 2)).toEqual(Uint8Array.of(0xff, 0xff));
  });

  it("rejects a value outside the range of the cell", () => {
    const fill = (value: number) => Array.from({ length: 110 }, () => value);
    expect(() => writeGridCells(blankImage(), fuelLimit, fill(256))).toThrow(RangeError);
    expect(() => writeGridCells(blankImage(), fuelLimit, fill(-1))).toThrow(RangeError);
    expect(() => writeGridCells(blankImage(), timing, fill(32768))).toThrow(RangeError);
    expect(() => writeGridCells(blankImage(), timing, fill(1.5))).toThrow(RangeError);
    expect(() => writeGridCells(blankImage(), timing, fill(Number.NaN))).toThrow(RangeError);
  });

  it("rejects the wrong number of cells", () => {
    expect(() => writeGridCells(blankImage(), maxFuel, [1, 2, 3])).toThrow(RangeError);
  });
});

describe("readWordFunction", () => {
  it("reads (x, y) pairs up to and including the first x of 0", () => {
    const image = blankImage();
    putWordFunction(image, 0x120a0, [
      [-1, 0x0f00],
      [16400, 0x0f00],
      [2000, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(readWordFunction(image, 0x120a0, false)).toEqual([
      { xRaw: 65535, yRaw: 0x0f00 },
      { xRaw: 16400, yRaw: 0x0f00 },
      { xRaw: 2000, yRaw: 0 },
      { xRaw: 0, yRaw: 0 },
    ]);
  });

  it("reads signed x values and stops at -32768", () => {
    const image = blankImage();
    putWordFunction(image, 0x12164, [
      [32767, 0],
      [-96, 0x0e00],
      [-32768, 0x0f00],
      [5, 5],
    ]);
    expect(readWordFunction(image, 0x12164, true)).toEqual([
      { xRaw: 32767, yRaw: 0 },
      { xRaw: -96, yRaw: 0x0e00 },
      { xRaw: -32768, yRaw: 0x0f00 },
    ]);
  });

  it("stops after 32 pairs when no end is found", () => {
    const image = blankImage().fill(0x11);
    expect(readWordFunction(image, 0x120a0, false)).toHaveLength(32);
  });
});

const RPM_PAIRS = [
  [-1, 15 * 256],
  [16400, 15 * 256],
  [15600, 10 * 256],
  [12000, 8 * 256],
  [4000, 4 * 256],
  [3000, 3 * 256],
  [2400, 2 * 256],
  [1600, 1 * 256],
  [0, 0],
] as const;

const EOT_PAIRS = [
  [32767, 0],
  [572, 0],
  [528, 1 * 256],
  [464, 3 * 256],
  [-96, 14 * 256],
  [-146, 15 * 256],
  [-32768, 15 * 256],
] as const;

function axisAt(functionOffset: number, breakpointsSigned: boolean): GridAxisDefinition {
  return { name: "test", ramAddress: 0, functionOffset, breakpointsSigned };
}

describe("readGridAxis", () => {
  it("gives the stored x of each index that has a pair of its own", () => {
    const image = blankImage();
    putWordFunction(image, 0x120a0, RPM_PAIRS);
    const breakpoints = readGridAxis(image, axisAt(0x120a0, false), 16);
    expect(breakpoints[15]).toBe(16400);
    expect(breakpoints[10]).toBe(15600);
    expect(breakpoints[4]).toBe(4000);
    expect(breakpoints[1]).toBe(1600);
  });

  it("gives index 0 the x of a pair at the end of the function", () => {
    const image = blankImage();
    putWordFunction(image, 0x120a0, RPM_PAIRS);
    expect(readGridAxis(image, axisAt(0x120a0, false), 16)[0]).toBe(0);
  });

  it("interpolates an index that has no pair, in a function that rises with x", () => {
    const image = blankImage();
    putWordFunction(image, 0x120a0, RPM_PAIRS);
    const breakpoints = readGridAxis(image, axisAt(0x120a0, false), 16);
    expect(breakpoints[9]).toBe(13800);
    expect(breakpoints[5]).toBe(6000);
    expect(breakpoints[11]).toBe(15760);
  });

  it("reads a signed function that falls with x, and skips the 0x7FFF and -32768 end pairs", () => {
    const image = blankImage();
    putWordFunction(image, 0x12164, EOT_PAIRS);
    const breakpoints = readGridAxis(image, axisAt(0x12164, true), 16);
    expect(breakpoints[0]).toBe(572);
    expect(breakpoints[1]).toBe(528);
    expect(breakpoints[2]).toBe(496);
    expect(breakpoints[15]).toBe(-146);
  });

  it("gives undefined for an index the function never reaches", () => {
    const image = blankImage();
    putWordFunction(image, 0x120a0, RPM_PAIRS);
    const breakpoints = readGridAxis(image, axisAt(0x120a0, false), 18);
    expect(breakpoints).toHaveLength(18);
    expect(breakpoints[16]).toBeUndefined();
    expect(breakpoints[17]).toBeUndefined();
  });

  it("never throws on bytes that are not a function", () => {
    const image = blankImage().fill(0xa5);
    expect(readGridAxis(image, axisAt(0x120a0, false), 11)).toHaveLength(11);
  });
});

describe("readGridAxes", () => {
  it("reads the row and column breakpoints of a grid, one per row and column", () => {
    const image = blankImage();
    putWordFunction(image, 0x120a0, RPM_PAIRS);
    putWordFunction(image, 0x120e0, [
      [-1, 2 * 256],
      [2400, 2 * 256],
      [240, 256],
      [0, 0],
    ]);
    const axes = readGridAxes(image, maxFuel);
    expect(axes.colBreakpointsRaw).toHaveLength(16);
    expect(axes.rowBreakpointsRaw).toEqual([0, 240, 2400]);
    expect(axes.colBreakpointsRaw[15]).toBe(16400);
  });

  it("rejects an image that is not 256 KiB", () => {
    expect(() => readGridAxes(new Uint8Array(8), maxFuel)).toThrow(RangeError);
  });
});

describe("findGridAxisIssues", () => {
  const rpmOffset = maxFuel.colAxis.functionOffset;
  const eotOffset = grid("pulse-width-multiplier").colAxis.functionOffset;

  it("finds nothing in an image with well-formed axis functions", () => {
    expect(findGridAxisIssues(buildTde1Image())).toEqual([]);
  });

  it("reports an unsigned axis that does not start at 0xFFFF", () => {
    const image = buildTde1Image();
    image[rpmOffset] = 0xfe;
    const messages = findGridAxisIssues(image).map((issue) => issue.message);
    expect(messages).toContain(
      "Maximum fuel, columns (Engine speed): the first value is 65534, not 65535.",
    );
  });

  it("reports a signed axis that does not start at 0x7FFF", () => {
    const image = buildTde1Image();
    image[eotOffset + 1] = 0x70;
    const messages = findGridAxisIssues(image).map((issue) => issue.message);
    expect(messages).toContain(
      `Pulse width multiplier, columns (${grid("pulse-width-multiplier").colAxis.name}): the first value is 28927, not 32767.`,
    );
  });

  it("reports x values that go up", () => {
    const image = buildTde1Image();
    // The third pair of the rpm function: 0x3db8 -> 0x50b8, above the 0x4010 before it.
    image[rpmOffset + 8 + 1] = 0x50;
    const messages = findGridAxisIssues(image).map((issue) => issue.message);
    expect(messages).toContain(
      "Maximum fuel, columns (Engine speed): the values go up from 16400 to 20664. They can only stay the same or go down.",
    );
  });

  it("compares the x values of a signed axis as signed numbers", () => {
    const image = buildTde1Image();
    putWordFunction(image, eotOffset, [
      [0x7fff, 0],
      [100, 256],
      [-100, 512],
      [-32768, 15 * 256],
    ]);
    expect(
      findGridAxisIssues(image).filter((issue) => issue.message.includes("multiplier, columns")),
    ).toEqual([]);
  });

  it("reports an axis function that never ends", () => {
    const image = buildTde1Image();
    const pairs: Array<[number, number]> = Array.from({ length: 40 }, (_unused, index) => [
      index === 0 ? 0xffff : 4000 - index,
      256,
    ]);
    putWordFunction(image, rpmOffset, pairs);
    const messages = findGridAxisIssues(image).map((issue) => issue.message);
    expect(messages).toContain(
      "Maximum fuel, columns (Engine speed): no end value is found. An unsigned axis ends with 0.",
    );
  });

  it("reports a position past the last row or column", () => {
    const image = buildTde1Image();
    // The max fuel row axis has 3 rows: the last position is 2.
    const rowOffset = maxFuel.rowAxis.functionOffset;
    image[rowOffset + 3] = 0x03;
    const messages = findGridAxisIssues(image).map((issue) => issue.message);
    expect(messages).toContain(
      "Maximum fuel, rows (Unidentified value): a position is 3, but the last row is 2.",
    );
  });

  it("gives one issue for an image that is not 256 KiB", () => {
    const issues = findGridAxisIssues(new Uint8Array(1000));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("262144");
  });
});
