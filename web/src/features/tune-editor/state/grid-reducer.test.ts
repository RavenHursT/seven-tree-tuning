import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import { editorReducer, initialEditorState, type EditorState } from "./editor-reducer";
import { createLoadedTune } from "./loaded-tune";

function loadedState(): EditorState {
  const tune = createLoadedTune(buildTde1Image(), {
    kind: "upload",
    fileName: "TDE1_30N_DAILYDRIVER-REVD.hcf",
    format: "hcf",
  });
  return editorReducer(initialEditorState, { type: "loadSucceeded", tune });
}

function cells(state: EditorState, id: "max-fuel" | "desired-icp" | "fuel-limit-sea-level") {
  return state.values?.gridsRaw[id] ?? [];
}

describe("grid actions", () => {
  it("sets one cell and keeps the loaded tune's own values", () => {
    const loaded = loadedState();
    const edited = editorReducer(loaded, {
      type: "gridCellChanged",
      gridId: "max-fuel",
      row: 1,
      col: 2,
      raw: 4000,
    });

    expect(cells(edited, "max-fuel")[1 * 16 + 2]).toBe(4000);
    expect(edited.tune?.originalValues.gridsRaw["max-fuel"][1 * 16 + 2]).not.toBe(4000);
  });

  it("scales every cell of one grid and no other grid", () => {
    const loaded = loadedState();
    const scaled = editorReducer(loaded, {
      type: "gridScaled",
      gridId: "fuel-limit-sea-level",
      factor: 0.5,
    });

    expect(cells(scaled, "fuel-limit-sea-level")).toEqual(
      cells(loaded, "fuel-limit-sea-level").map((cell) => Math.round(cell * 0.5)),
    );
    expect(cells(scaled, "desired-icp")).toBe(cells(loaded, "desired-icp"));
  });

  it("resets one grid and keeps the edits of the others", () => {
    const loaded = loadedState();
    const edited = [
      { type: "gridCellChanged", gridId: "max-fuel", row: 0, col: 0, raw: 1 },
      { type: "gridCellChanged", gridId: "desired-icp", row: 0, col: 0, raw: 2 },
    ] as const;
    const state = edited.reduce(editorReducer, loaded);

    const reset = editorReducer(state, { type: "gridReset", gridId: "max-fuel" });

    expect(cells(reset, "max-fuel")).toEqual(cells(loaded, "max-fuel"));
    expect(cells(reset, "desired-icp")[0]).toBe(2);
  });

  it("puts every grid back on Reset all changes", () => {
    const loaded = loadedState();
    const state = editorReducer(loaded, {
      type: "gridScaled",
      gridId: "desired-icp",
      factor: 1.2,
    });

    expect(editorReducer(state, { type: "allReset" }).values).toBe(loaded.values);
  });

  it("changes nothing before a tune is loaded", () => {
    const state = editorReducer(initialEditorState, {
      type: "gridCellChanged",
      gridId: "max-fuel",
      row: 0,
      col: 0,
      raw: 1,
    });
    expect(state).toBe(initialEditorState);
  });
});
