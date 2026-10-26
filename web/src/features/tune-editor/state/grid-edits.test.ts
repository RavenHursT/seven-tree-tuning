import { readTuneValues, TDE1, type GridId, type TuneValues } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import { findGrid, resetGrid, scaleGrid, setGridCell } from "./grid-edits";

const original = readTuneValues(buildTde1Image());

function cellsOf(values: TuneValues, id: GridId): readonly number[] {
  return values.gridsRaw[id];
}

describe("findGrid", () => {
  it("finds a grid definition by id", () => {
    expect(findGrid("desired-icp").label).toBe("Desired ICP");
  });
});

describe("setGridCell", () => {
  it("stores one cell and leaves every other cell and grid as it was", () => {
    const edited = setGridCell(original, "fuel-demand", 2, 3, 1234);

    expect(cellsOf(edited, "fuel-demand")[2 * 16 + 3]).toBe(1234);
    const before = cellsOf(original, "fuel-demand");
    const changed = cellsOf(edited, "fuel-demand").filter((cell, at) => cell !== before[at]);
    expect(changed).toEqual([1234]);
    expect(cellsOf(edited, "max-fuel")).toBe(cellsOf(original, "max-fuel"));
  });

  it("rounds and clamps to the range of the cell", () => {
    expect(
      cellsOf(
        setGridCell(original, "fuel-limit-sea-level", 0, 0, 300.4),
        "fuel-limit-sea-level",
      )[0],
    ).toBe(255);
    expect(
      cellsOf(setGridCell(original, "fuel-limit-sea-level", 0, 0, -3), "fuel-limit-sea-level")[0],
    ).toBe(0);
    expect(cellsOf(setGridCell(original, "desired-icp", 0, 0, 10.6), "desired-icp")[0]).toBe(11);
  });

  it("ignores a cell outside the grid and a value that is not a number", () => {
    expect(setGridCell(original, "max-fuel", 3, 0, 5)).toBe(original);
    expect(setGridCell(original, "max-fuel", 0, 16, 5)).toBe(original);
    expect(setGridCell(original, "max-fuel", 0.5, 0, 5)).toBe(original);
    expect(setGridCell(original, "max-fuel", 0, 0, Number.NaN)).toBe(original);
  });

  it("reaches the last two rows and columns of the base pulse width", () => {
    const edited = setGridCell(original, "base-pulse-width", 12, 12, 4321);
    expect(cellsOf(edited, "base-pulse-width")[168]).toBe(4321);
  });
});

describe("scaleGrid", () => {
  it("multiplies every cell, rounds, and clamps to the range of the cell", () => {
    const scaled = scaleGrid(original, "fuel-limit-sea-level", 1.5);
    const before = cellsOf(original, "fuel-limit-sea-level");

    expect(cellsOf(scaled, "fuel-limit-sea-level")).toEqual(
      before.map((cell) => Math.min(255, Math.round(cell * 1.5))),
    );
  });

  it("scales negative cells of a signed grid", () => {
    const signed = setGridCell(original, "base-timing-sea-level", 0, 0, -100);
    expect(
      cellsOf(scaleGrid(signed, "base-timing-sea-level", 0.5), "base-timing-sea-level")[0],
    ).toBe(-50);
  });

  it("changes only the named grid", () => {
    const scaled = scaleGrid(original, "desired-icp", 2);
    expect(cellsOf(scaled, "max-fuel")).toBe(cellsOf(original, "max-fuel"));
  });

  it("ignores a factor that is not a finite number above zero", () => {
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(scaleGrid(original, "desired-icp", factor)).toBe(original);
    }
  });
});

describe("resetGrid", () => {
  it("puts the cells of one grid back and keeps the edits of the others", () => {
    const edited = setGridCell(setGridCell(original, "max-fuel", 0, 0, 7), "desired-icp", 0, 0, 9);
    const reset = resetGrid(edited, original, "max-fuel");

    expect(cellsOf(reset, "max-fuel")).toBe(cellsOf(original, "max-fuel"));
    expect(cellsOf(reset, "desired-icp")[0]).toBe(9);
  });

  it("covers every grid the strategy defines", () => {
    for (const definition of TDE1.grids) {
      expect(findGrid(definition.id)).toBe(definition);
    }
  });
});
