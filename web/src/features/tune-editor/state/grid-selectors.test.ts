import { TDE1 } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./editor-reducer";
import { selectChangeSummary } from "./editor-selectors";
import {
  GRID_GROUP_IDS,
  selectGridChangeSummary,
  selectGridEditorView,
  selectGridTabs,
  summarizeGridGroup,
} from "./grid-selectors";
import { createLoadedTune } from "./loaded-tune";

function loadedState(): EditorState {
  const tune = createLoadedTune(buildTde1Image(), {
    kind: "upload",
    fileName: "TDE1_30N_DAILYDRIVER-REVD.hcf",
    format: "hcf",
  });
  return editorReducer(initialEditorState, { type: "loadSucceeded", tune });
}

function edited(...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, loadedState());
}

describe("GRID_GROUP_IDS", () => {
  it("lists the six grids of each module, in the order of the hydra definitions", () => {
    expect(GRID_GROUP_IDS["fuel-power"]).toEqual([
      "max-fuel",
      "base-pulse-width",
      "pulse-width-multiplier",
      "fuel-demand",
      "fuel-limit-sea-level",
      "fuel-limit-altitude",
    ]);
    expect(GRID_GROUP_IDS["timing-icp"]).toEqual([
      "base-timing-sea-level",
      "base-timing-altitude",
      "timing-time-adder",
      "timing-correction-eot",
      "desired-icp",
      "ipr-duty-feed-forward",
    ]);
  });

  it("covers every grid of the strategy once", () => {
    const all = [...GRID_GROUP_IDS["fuel-power"], ...GRID_GROUP_IDS["timing-icp"]];
    expect(all.toSorted()).toEqual(TDE1.grids.map((grid) => grid.id).toSorted());
  });
});

describe("selectGridEditorView", () => {
  it("is undefined before a tune is loaded", () => {
    expect(selectGridEditorView(initialEditorState, "max-fuel")).toBeUndefined();
  });

  it("gives the grid's label, cells, original cells and cell range", () => {
    const view = selectGridEditorView(loadedState(), "fuel-limit-sea-level");

    expect(view?.label).toBe("Fuel limit, sea level");
    expect(view?.cells).toHaveLength(110);
    expect(view?.originalCells).toEqual(view?.cells);
    expect([view?.minRaw, view?.maxRaw]).toEqual([0, 255]);
  });

  it("shows engine speed breakpoints in rpm: 500 to 3000 for the fuel limit grids", () => {
    const view = selectGridEditorView(loadedState(), "fuel-limit-sea-level");

    expect(view?.colAxis.name).toBe("Engine speed");
    expect(view?.colAxis.unit).toBe("rpm");
    expect(view?.colAxis.headers[0]).toEqual({ text: "500", reached: true });
    expect(view?.colAxis.headers[10]).toEqual({ text: "3000", reached: true });
  });

  it("shows breakpoints of an axis with no confirmed unit as stored, with no unit", () => {
    const view = selectGridEditorView(loadedState(), "fuel-limit-sea-level");

    expect(view?.rowAxis.name).toBe("Boost");
    expect(view?.rowAxis.unit).toBeUndefined();
    expect(view?.rowAxis.headers.every((header) => /^-?\d+(\.\d+)?$/.test(header.text))).toBe(true);
  });

  it("names the last two rows and columns of the base pulse width as not reached by the tune", () => {
    const view = selectGridEditorView(loadedState(), "base-pulse-width");

    expect(view?.cells).toHaveLength(169);
    expect(view?.rowAxis.headers.slice(11)).toEqual([
      { text: "index 11", reached: false },
      { text: "index 12", reached: false },
    ]);
    expect(view?.colAxis.headers.slice(11)).toEqual([
      { text: "index 11", reached: false },
      { text: "index 12", reached: false },
    ]);
    expect(view?.rowAxis.headers.slice(0, 11).every((header) => header.reached)).toBe(true);
  });

  it("shows the pulse width multiplier as a multiplier with four decimals", () => {
    const view = selectGridEditorView(loadedState(), "pulse-width-multiplier");

    expect(view?.value).toEqual({
      perRaw: 1 / 4096,
      unit: "×",
      unitName: "multiplier (×)",
      decimals: 4,
    });
  });

  it("shows base timing in crank degrees with two decimals", () => {
    const view = selectGridEditorView(loadedState(), "base-timing-sea-level");

    expect(view?.value).toEqual({
      perRaw: 1 / 64,
      unit: "°",
      unitName: "crank degrees (°)",
      decimals: 2,
    });
  });

  it("shows a grid with no confirmed unit in PCM units, as stored", () => {
    const view = selectGridEditorView(loadedState(), "desired-icp");

    expect(view?.value).toEqual({ perRaw: 1, unit: undefined, unitName: "PCM units", decimals: 0 });
  });

  it("follows an edit: the cell changes and the original stays", () => {
    const state = edited({
      type: "gridCellChanged",
      gridId: "desired-icp",
      row: 0,
      col: 1,
      raw: 4321,
    });
    const view = selectGridEditorView(state, "desired-icp");

    expect(view?.cells[1]).toBe(4321);
    expect(view?.originalCells[1]).not.toBe(4321);
  });
});

describe("selectGridChangeSummary", () => {
  it("counts nothing before a tune is loaded and in an unedited tune", () => {
    const none = { changedCells: 0, changedGrids: 0 };
    expect(selectGridChangeSummary(initialEditorState)).toEqual(none);
    expect(selectGridChangeSummary(loadedState())).toEqual(none);
  });

  it("counts the changed cells and the grids they are in", () => {
    const state = edited(
      { type: "gridCellChanged", gridId: "max-fuel", row: 0, col: 0, raw: 1 },
      { type: "gridCellChanged", gridId: "max-fuel", row: 0, col: 1, raw: 1 },
      { type: "gridCellChanged", gridId: "desired-icp", row: 2, col: 2, raw: 1 },
    );

    expect(selectGridChangeSummary(state)).toEqual({ changedCells: 3, changedGrids: 2 });
  });

  it("does not count a cell that was put back to its original value", () => {
    const original = selectGridEditorView(loadedState(), "max-fuel")?.cells[0] ?? 0;
    const state = edited(
      { type: "gridCellChanged", gridId: "max-fuel", row: 0, col: 0, raw: original + 1 },
      { type: "gridCellChanged", gridId: "max-fuel", row: 0, col: 0, raw: original },
    );

    expect(selectGridChangeSummary(state).changedCells).toBe(0);
  });

  it("feeds the change summary of the Generate bar", () => {
    const state = edited({ type: "gridCellChanged", gridId: "max-fuel", row: 0, col: 0, raw: 1 });

    expect(selectChangeSummary(state).changedGridCells).toBe(1);
    expect(selectChangeSummary(loadedState()).changedGridCells).toBe(0);
  });
});

describe("selectGridTabs", () => {
  it("lists the grids of a module with the cells changed in each", () => {
    const state = edited({
      type: "gridCellChanged",
      gridId: "base-pulse-width",
      row: 12,
      col: 12,
      raw: 1,
    });
    const tabs = selectGridTabs(state, "fuel-power");

    expect(tabs.map((tab) => tab.label)).toEqual([
      "Maximum fuel",
      "Base injector pulse width",
      "Pulse width multiplier",
      "Fuel demand",
      "Fuel limit, sea level",
      "Fuel limit, altitude",
    ]);
    expect(tabs.map((tab) => tab.changedCells)).toEqual([0, 1, 0, 0, 0, 0]);
  });
});

describe("summarizeGridGroup", () => {
  it("says no tune is loaded before one is", () => {
    expect(summarizeGridGroup(initialEditorState, "fuel-power")).toBe("No tune loaded");
  });

  it("says No changes for an unedited tune", () => {
    expect(summarizeGridGroup(loadedState(), "timing-icp")).toBe("No changes");
  });

  it("counts the cells and grids of its own module only", () => {
    const state = edited(
      { type: "gridCellChanged", gridId: "max-fuel", row: 0, col: 0, raw: 1 },
      { type: "gridCellChanged", gridId: "fuel-demand", row: 0, col: 0, raw: 1 },
      { type: "gridCellChanged", gridId: "fuel-demand", row: 0, col: 1, raw: 1 },
    );

    expect(summarizeGridGroup(state, "fuel-power")).toBe("3 cells changed in 2 grids");
    expect(summarizeGridGroup(state, "timing-icp")).toBe("No changes");
  });

  it("says 1 cell changed in 1 grid in the singular", () => {
    const state = edited({
      type: "gridCellChanged",
      gridId: "desired-icp",
      row: 0,
      col: 0,
      raw: 1,
    });

    expect(summarizeGridGroup(state, "timing-icp")).toBe("1 cell changed in 1 grid");
  });
});
