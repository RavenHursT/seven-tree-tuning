import { describe, expect, it } from "vitest";

import { readUint16Le } from "./bytes";
import { readEpcFunctions, readLockupFunctions } from "./byte-function";
import type { ByteFunction } from "./byte-function";
import { assertOnlyEditableChanges, changedOffsets } from "./edit-guard";
import { gridCellOffset, readGrid } from "./grid";
import type { GridDefinition } from "./grid";
import { TDE1 } from "./tde1";
import { EPC_FUNCTION_IDS, GRID_IDS, LOCKUP_FUNCTION_IDS } from "./tde1-items";
import type { EpcFunctionDefinition, LockupFunctionDefinition } from "./byte-function";
import {
  buildTde1Image,
  DAILY_DRIVER_EPC,
  DAILY_DRIVER_LOCKUP,
  patternedGridCells,
} from "./test-images";
import {
  diffCalibrationItems,
  readTuneValues,
  scaleShiftSpeeds,
  setFunctionPointRaw,
  setGridCellRaw,
  writeTuneValues,
} from "./tune-values";
import type { TuneValues } from "./tune-values";

const base = buildTde1Image();
const values = readTuneValues(base);
const lockups = readLockupFunctions(base);
const epcs = readEpcFunctions(base);

function lockup(id: string): ByteFunction<LockupFunctionDefinition> {
  const found = lockups.find((candidate) => candidate.definition.id === id);
  if (!found) throw new Error(`no lockup function ${id}`);
  return found;
}

function epc(id: string): ByteFunction<EpcFunctionDefinition> {
  const found = epcs.find((candidate) => candidate.definition.id === id);
  if (!found) throw new Error(`no line-pressure function ${id}`);
  return found;
}

function grid(id: string): GridDefinition {
  const found = TDE1.grids.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no grid ${id}`);
  return found;
}

function yBytes(bytes: readonly number[]): number[] {
  return bytes.filter((_byte, position) => position % 2 === 1);
}

describe("readTuneValues: lockup speeds, line-pressure adders and grids", () => {
  it("reads the speed byte of every pair of every lockup function, padding included", () => {
    for (const id of LOCKUP_FUNCTION_IDS) {
      expect(values.lockupSpeedsRaw[id]).toEqual(yBytes(DAILY_DRIVER_LOCKUP[id]));
    }
    expect(values.lockupSpeedsRaw["lock-2"]).toEqual([
      64, 64, 40, 254, 254, 254, 254, 254, 254, 254,
    ]);
    expect(values.lockupSpeedsRaw["lock-4"]).toEqual([60, 60, 60, 60]);
    expect(values.lockupSpeedsRaw["unlock-4"]).toEqual([56, 56, 56, 56]);
  });

  it("reads the adder of every pair of every line-pressure function", () => {
    for (const id of EPC_FUNCTION_IDS) {
      expect(values.epcAddersRaw[id]).toEqual(yBytes(DAILY_DRIVER_EPC[id]));
    }
    expect(values.epcAddersRaw["epc-3-4"]).toEqual([38, 38, 32, 32, 28, 28, 28, 28, 28, 28]);
  });

  it("reads line-pressure adders as signed bytes", () => {
    const image = buildTde1Image({
      epc: {
        "epc-3-4": [
          0xff, 0xe7, 0x80, 0xfb, 0x00, 0x80, 0, 0x80, 0, 0x80, 0, 0x80, 0, 0x80, 0, 0x80, 0, 0x80,
          0, 0x80,
        ],
      },
    });
    expect(readTuneValues(image).epcAddersRaw["epc-3-4"].slice(0, 3)).toEqual([-25, -5, -128]);
  });

  it("reads every grid as its exposed cells, row by row", () => {
    for (const id of GRID_IDS) {
      const definition = grid(id);
      expect(values.gridsRaw[id]).toEqual(readGrid(base, definition).cells);
      expect(values.gridsRaw[id]).toHaveLength(definition.rows * definition.cols);
    }
  });
});

describe("writeTuneValues: the new items", () => {
  it("gives a byte-identical image when nothing changed", () => {
    expect(changedOffsets(base, writeTuneValues(base, values))).toEqual([]);
  });

  it("writes a lockup speed into the y byte and leaves the pedal byte alone", () => {
    const edited: TuneValues = {
      ...values,
      lockupSpeedsRaw: { ...values.lockupSpeedsRaw, "lock-4": [70, 60, 60, 60] },
    };
    const written = writeTuneValues(base, edited);
    const address = lockup("lock-4").definition.address;
    expect(changedOffsets(base, written)).toEqual([address + 1]);
    expect(written[address + 1]).toBe(70);
    expect(written[address]).toBe(0xff);
  });

  it("writes a negative line-pressure adder as a two's complement byte", () => {
    const edited: TuneValues = {
      ...values,
      epcAddersRaw: {
        ...values.epcAddersRaw,
        "epc-1-2": [-10, ...values.epcAddersRaw["epc-1-2"].slice(1)],
      },
    };
    const written = writeTuneValues(base, edited);
    expect(written[epc("epc-1-2").definition.address + 1]).toBe(0xf6);
    expect(readTuneValues(written).epcAddersRaw["epc-1-2"][0]).toBe(-10);
  });

  it("writes grid cells little-endian, signed or not, and a byte grid in one byte", () => {
    const edit = (id: string, cell: number): TuneValues =>
      setGridCellRaw(values, grid(id), 1, 2, cell);
    const unsigned = writeTuneValues(base, edit("max-fuel", 0x1234));
    const offset16 = gridCellOffset(grid("max-fuel"), 1, 2);
    expect([unsigned[offset16], unsigned[offset16 + 1]]).toEqual([0x34, 0x12]);
    const signed = writeTuneValues(base, edit("base-timing-sea-level", -64));
    const offsetSigned = gridCellOffset(grid("base-timing-sea-level"), 1, 2);
    expect([signed[offsetSigned], signed[offsetSigned + 1]]).toEqual([0xc0, 0xff]);
    const bytes = writeTuneValues(base, edit("fuel-limit-altitude", 99));
    expect(bytes[gridCellOffset(grid("fuel-limit-altitude"), 1, 2)]).toBe(99);
  });

  it("changes no byte outside the editable offsets, whatever is edited", () => {
    let edited = scaleShiftSpeeds(values, 0.5);
    for (const definition of TDE1.grids) {
      edited = setGridCellRaw(edited, definition, 0, 0, edited.gridsRaw[definition.id][0]! + 1);
    }
    edited = setFunctionPointRaw(edited, lockup("lock-3"), 0, 99);
    edited = setFunctionPointRaw(edited, epc("epc-2-3"), 0, -7);
    const written = writeTuneValues(base, edited);
    expect(() => assertOnlyEditableChanges(base, written)).not.toThrow();
  });

  it("writes the last two rows and columns of the base pulse width, which a few tunes use", () => {
    const definition = grid("base-pulse-width");
    const cells = patternedGridCells(definition).map((cell) => (cell + 1) % 65536);
    const written = writeTuneValues(base, {
      ...values,
      gridsRaw: { ...values.gridsRaw, "base-pulse-width": cells },
    });
    for (const [row, col] of [
      [0, 11],
      [0, 12],
      [12, 0],
      [12, 12],
    ] as const) {
      const offset = gridCellOffset(definition, row, col);
      expect(readUint16Le(written, offset)).toBe(cells[row * 13 + col]);
    }
    expect(readGrid(written, definition).cells).toEqual(cells);
  });

  it("rejects a lockup speed that is not a whole number from 0 to 255", () => {
    const bad = (speed: number): TuneValues => ({
      ...values,
      lockupSpeedsRaw: { ...values.lockupSpeedsRaw, "lock-4": [speed, 60, 60, 60] },
    });
    for (const speed of [256, -1, 1.5, Number.NaN]) {
      expect(() => writeTuneValues(base, bad(speed))).toThrow(RangeError);
    }
  });

  it("rejects a line-pressure adder that is not a whole number from -128 to 127", () => {
    const bad = (adder: number): TuneValues => ({
      ...values,
      epcAddersRaw: {
        ...values.epcAddersRaw,
        "epc-1-2": [adder, ...values.epcAddersRaw["epc-1-2"].slice(1)],
      },
    });
    for (const adder of [128, -129, 0.5, Number.NaN]) {
      expect(() => writeTuneValues(base, bad(adder))).toThrow(RangeError);
    }
  });

  it("rejects a function with the wrong number of values", () => {
    const short: TuneValues = {
      ...values,
      lockupSpeedsRaw: { ...values.lockupSpeedsRaw, "lock-2": [64, 64] },
    };
    expect(() => writeTuneValues(base, short)).toThrow(RangeError);
  });

  it("rejects a grid with the wrong number of cells or a cell out of range", () => {
    const short: TuneValues = { ...values, gridsRaw: { ...values.gridsRaw, "max-fuel": [1, 2] } };
    expect(() => writeTuneValues(base, short)).toThrow(RangeError);
    const high: TuneValues = {
      ...values,
      gridsRaw: { ...values.gridsRaw, "fuel-limit-sea-level": new Array(110).fill(256) },
    };
    expect(() => writeTuneValues(base, high)).toThrow(RangeError);
  });

  it("leaves the base image alone when a value is rejected", () => {
    const copy = new Uint8Array(base);
    const bad: TuneValues = {
      ...values,
      gridsRaw: { ...values.gridsRaw, "max-fuel": new Array(48).fill(70_000) },
    };
    expect(() => writeTuneValues(base, bad)).toThrow(RangeError);
    expect(changedOffsets(base, copy)).toEqual([]);
  });
});

describe("scaleShiftSpeeds leaves the new items alone", () => {
  const scaled = scaleShiftSpeeds(values, 0.9147);

  it("keeps the lockup speeds, the line-pressure adders and every grid", () => {
    expect(scaled.lockupSpeedsRaw).toEqual(values.lockupSpeedsRaw);
    expect(scaled.epcAddersRaw).toEqual(values.epcAddersRaw);
    expect(scaled.gridsRaw).toEqual(values.gridsRaw);
  });

  it("writes exactly the 60 shift-speed bytes that change", () => {
    expect(changedOffsets(base, writeTuneValues(base, scaled))).toHaveLength(60);
  });
});

describe("setFunctionPointRaw", () => {
  it("sets one point and returns new values", () => {
    const next = setFunctionPointRaw(values, lockup("lock-2"), 1, 70);
    expect(next.lockupSpeedsRaw["lock-2"]).toEqual([64, 70, 40, 254, 254, 254, 254, 254, 254, 254]);
    expect(values.lockupSpeedsRaw["lock-2"][1]).toBe(64);
    expect(next.epcAddersRaw).toBe(values.epcAddersRaw);
  });

  it("sets the padding too when the closed-pedal point changes", () => {
    const fn = lockup("lock-3");
    const next = setFunctionPointRaw(values, fn, 4, 50);
    expect(next.lockupSpeedsRaw["lock-3"]).toEqual([62, 62, 54, 54, 50, 50, 50, 50, 50, 50]);
  });

  it("does not set the points after a point that is not the closed-pedal point", () => {
    const next = setFunctionPointRaw(values, lockup("lock-3"), 3, 40);
    expect(next.lockupSpeedsRaw["lock-3"]).toEqual([62, 62, 54, 40, 54, 54, 54, 54, 54, 54]);
  });

  it("rounds and clamps a lockup speed to 0..255", () => {
    expect(
      setFunctionPointRaw(values, lockup("lock-4"), 0, 300.4).lockupSpeedsRaw["lock-4"][0],
    ).toBe(255);
    expect(setFunctionPointRaw(values, lockup("lock-4"), 0, -5).lockupSpeedsRaw["lock-4"][0]).toBe(
      0,
    );
    expect(
      setFunctionPointRaw(values, lockup("lock-4"), 0, 61.6).lockupSpeedsRaw["lock-4"][0],
    ).toBe(62);
  });

  it("sets a line-pressure adder, rounded and clamped to -128..127", () => {
    const fn = epc("epc-3-4");
    expect(setFunctionPointRaw(values, fn, 0, -3.4).epcAddersRaw["epc-3-4"][0]).toBe(-3);
    expect(setFunctionPointRaw(values, fn, 0, 500).epcAddersRaw["epc-3-4"][0]).toBe(127);
    expect(setFunctionPointRaw(values, fn, 0, -500).epcAddersRaw["epc-3-4"][0]).toBe(-128);
    expect(setFunctionPointRaw(values, fn, 0, 5).lockupSpeedsRaw).toBe(values.lockupSpeedsRaw);
  });

  it("writes the padding bytes too when the closed-pedal adder changes", () => {
    const next = setFunctionPointRaw(values, epc("epc-3-4"), 5, 10);
    expect(next.epcAddersRaw["epc-3-4"]).toEqual([38, 38, 32, 32, 28, 10, 10, 10, 10, 10]);
    expect(changedOffsets(base, writeTuneValues(base, next))).toHaveLength(5);
  });

  it("rejects a point outside the function and a value that is not a number", () => {
    const fn = lockup("lock-4");
    expect(() => setFunctionPointRaw(values, fn, 4, 10)).toThrow(RangeError);
    expect(() => setFunctionPointRaw(values, fn, -1, 10)).toThrow(RangeError);
    expect(() => setFunctionPointRaw(values, fn, 0.5, 10)).toThrow(RangeError);
    expect(() => setFunctionPointRaw(values, fn, 0, Number.NaN)).toThrow(RangeError);
  });
});

describe("setGridCellRaw", () => {
  it("sets one cell and returns new values", () => {
    const definition = grid("max-fuel");
    const next = setGridCellRaw(values, definition, 2, 5, 1234);
    expect(next.gridsRaw["max-fuel"][2 * 16 + 5]).toBe(1234);
    expect(values.gridsRaw["max-fuel"][2 * 16 + 5]).not.toBe(1234);
    expect(changedCells(values.gridsRaw["max-fuel"], next.gridsRaw["max-fuel"])).toBe(1);
    expect(next.gridsRaw["desired-icp"]).toBe(values.gridsRaw["desired-icp"]);
  });

  it("rounds, and clamps to the range of the cell", () => {
    const byteGrid = grid("fuel-limit-sea-level");
    const wordGrid = grid("base-timing-sea-level");
    const get = (next: TuneValues, id: "fuel-limit-sea-level" | "base-timing-sea-level") =>
      next.gridsRaw[id][0];
    expect(get(setGridCellRaw(values, byteGrid, 0, 0, 300), "fuel-limit-sea-level")).toBe(255);
    expect(get(setGridCellRaw(values, byteGrid, 0, 0, -3), "fuel-limit-sea-level")).toBe(0);
    expect(get(setGridCellRaw(values, byteGrid, 0, 0, 90.5), "fuel-limit-sea-level")).toBe(91);
    expect(get(setGridCellRaw(values, wordGrid, 0, 0, -40_000), "base-timing-sea-level")).toBe(
      -32768,
    );
    expect(get(setGridCellRaw(values, wordGrid, 0, 0, 40_000), "base-timing-sea-level")).toBe(
      32767,
    );
  });

  it("rejects a cell outside the exposed rows and columns, and a value that is not a number", () => {
    const definition = grid("base-pulse-width");
    expect(() => setGridCellRaw(values, definition, 13, 0, 5)).toThrow(RangeError);
    expect(() => setGridCellRaw(values, definition, 0, 13, 5)).toThrow(RangeError);
    expect(() => setGridCellRaw(values, definition, 0, 0, Number.NaN)).toThrow(RangeError);
  });
});

function changedCells(before: readonly number[], after: readonly number[]): number {
  return after.filter((cell, position) => cell !== before[position]).length;
}

describe("diffCalibrationItems", () => {
  it("counts nothing for identical values", () => {
    expect(diffCalibrationItems(values, values)).toEqual({
      changedLockupPoints: 0,
      changedEpcPoints: 0,
      changedGridCells: 0,
    });
  });

  it("counts every changed lockup byte, padding included, line-pressure byte and grid cell", () => {
    let edited = setFunctionPointRaw(values, lockup("lock-3"), 4, 50);
    edited = setFunctionPointRaw(edited, epc("epc-1-2"), 0, 99);
    edited = setGridCellRaw(edited, grid("max-fuel"), 0, 0, 5);
    edited = setGridCellRaw(edited, grid("desired-icp"), 3, 3, 5);
    expect(diffCalibrationItems(values, edited)).toEqual({
      changedLockupPoints: 6,
      changedEpcPoints: 1,
      changedGridCells: 2,
    });
  });

  it("does not count the shift speeds or the idle", () => {
    expect(diffCalibrationItems(values, scaleShiftSpeeds(values, 0.5))).toEqual({
      changedLockupPoints: 0,
      changedEpcPoints: 0,
      changedGridCells: 0,
    });
  });
});
