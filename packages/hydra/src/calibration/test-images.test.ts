import { describe, expect, it } from "vitest";

import { findByteFunctionIssues, readByteFunction } from "./byte-function";
import { gridCellOffset, gridValueRange, readGrid, readGridAxes } from "./grid";
import { findLayoutIssues } from "./layout";
import { TDE1 } from "./tde1";
import {
  buildTde1Image,
  DAILY_DRIVER_EPC,
  DAILY_DRIVER_LOCKUP,
  patternedGridCells,
} from "./test-images";

describe("buildTde1Image: lockup and line-pressure functions", () => {
  const image = buildTde1Image();

  it("carries the real Daily Driver REVD bytes of the nine functions", () => {
    for (const definition of TDE1.lockupFunctions) {
      const start = definition.address;
      const bytes = Array.from(image.slice(start, start + 2 * definition.pairCount));
      expect(bytes).toEqual(DAILY_DRIVER_LOCKUP[definition.id]);
    }
    for (const definition of TDE1.epcFunctions) {
      const start = definition.address;
      const bytes = Array.from(image.slice(start, start + 2 * definition.pairCount));
      expect(bytes).toEqual(DAILY_DRIVER_EPC[definition.id]);
    }
  });

  it("has the proven layout in every function", () => {
    expect(findByteFunctionIssues(image)).toEqual([]);
    expect(findLayoutIssues(image)).toEqual([]);
  });

  it("holds the Daily Driver lock speeds: 4th gear locks at 30 mph and unlocks at 28 mph", () => {
    const [lock4, unlock4] = ["lock-4", "unlock-4"].map((id) => {
      const definition = TDE1.lockupFunctions.find((candidate) => candidate.id === id);
      if (!definition) throw new Error(`no ${id}`);
      return readByteFunction(image, definition);
    });
    expect(lock4?.points[0]?.yRaw).toBe(60);
    expect(unlock4?.points[0]?.yRaw).toBe(56);
  });

  it("replaces the bytes of a function named in the options", () => {
    const bytes = [0xff, 0x50, 0x00, 0x50, 0x00, 0x50, 0x00, 0x50];
    const custom = buildTde1Image({ lockup: { "lock-4": bytes } });
    const start = TDE1.lockupFunctions[2]?.address ?? 0;
    expect(Array.from(custom.slice(start, start + 8))).toEqual(bytes);
    expect(findByteFunctionIssues(custom)).toEqual([]);
  });
});

describe("buildTde1Image: grids", () => {
  const image = buildTde1Image();

  it("fills every exposed cell with the pattern, within the range of the cell", () => {
    for (const definition of TDE1.grids) {
      const { cells } = readGrid(image, definition);
      expect(cells).toEqual(patternedGridCells(definition));
      const [min, max] = gridValueRange(definition);
      expect(cells.every((cell) => cell >= min && cell <= max)).toBe(true);
    }
  });

  it("gives two cells of one grid different values, and signed grids negative values", () => {
    for (const definition of TDE1.grids) {
      expect(new Set(patternedGridCells(definition)).size).toBeGreaterThan(10);
    }
    const signed = TDE1.grids.find((definition) => definition.signed);
    expect(patternedGridCells(signed ?? TDE1.grids[0]!).some((cell) => cell < 0)).toBe(true);
  });

  it("leaves the stored columns the PCM does not read as background", () => {
    const base = buildTde1Image({ grids: { "base-pulse-width": new Array(121).fill(0) } });
    const grid = TDE1.grids[1];
    if (!grid) throw new Error("no grid");
    const hidden = grid.address + 2 * 11;
    expect(base[hidden]).toBe(image[hidden]);
    expect(base[gridCellOffset(grid, 0, 0)]).toBe(0);
  });

  it("replaces the cells of a grid named in the options", () => {
    const cells = new Array(21).fill(7);
    expect(() => buildTde1Image({ grids: { "max-fuel": cells } })).toThrow(RangeError);
    const custom = buildTde1Image({ grids: { "max-fuel": new Array(48).fill(7) } });
    expect(readGrid(custom, TDE1.grids[0]!).cells).toEqual(new Array(48).fill(7));
  });

  it("carries the Daily Driver axis functions: every row and column of every grid has a breakpoint", () => {
    for (const definition of TDE1.grids) {
      const axes = readGridAxes(image, definition);
      expect(axes.rowBreakpointsRaw).toHaveLength(definition.rows);
      expect(axes.colBreakpointsRaw).toHaveLength(definition.cols);
      expect(axes.rowBreakpointsRaw.every((value) => value !== undefined)).toBe(true);
      expect(axes.colBreakpointsRaw.every((value) => value !== undefined)).toBe(true);
    }
  });

  it("holds the engine speed axis of the fuel limit grids: 500 rpm to 3000 rpm", () => {
    const grid = TDE1.grids[4];
    if (!grid) throw new Error("no grid");
    const { colBreakpointsRaw } = readGridAxes(image, grid);
    expect(colBreakpointsRaw[0]).toBe(2000);
    expect(colBreakpointsRaw[10]).toBe(12000);
  });
});
