import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./editor-reducer";
import { createLoadedTune } from "./loaded-tune";
import { summarizeConverterLockup, summarizeShiftFirmness } from "./transmission-summaries";

function loadedState(): EditorState {
  const tune = createLoadedTune(buildTde1Image(), {
    kind: "upload",
    fileName: "tune.hcf",
    format: "hcf",
  });
  return editorReducer(initialEditorState, { type: "loadSucceeded", tune });
}

function apply(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce((current, action) => editorReducer(current, action), state);
}

describe("summarizeConverterLockup", () => {
  it("says no tune is loaded before one is", () => {
    expect(summarizeConverterLockup(initialEditorState)).toBe("No tune loaded");
  });

  it("gives closed-to-wide-open lock and unlock speeds of each gear, 4th first", () => {
    expect(summarizeConverterLockup(loadedState())).toBe(
      "4th 30/28 · 3rd 27–31/17 · 2nd never–32/15",
    );
  });

  it("counts changed points and flags a cycling warning", () => {
    const state = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 0, mph: 35 },
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 1, mph: 35 },
    );

    expect(summarizeConverterLockup(state)).toBe(
      "4th 30/35 · 3rd 27–31/17 · 2nd never–32/15 · 2 changed · converter cycling warning",
    );
  });
});

describe("summarizeShiftFirmness", () => {
  it("says no tune is loaded before one is", () => {
    expect(summarizeShiftFirmness(initialEditorState)).toBe("No tune loaded");
  });

  it("gives the closed-to-wide-open adder of each upshift", () => {
    expect(summarizeShiftFirmness(loadedState())).toBe("1→2 10–18 · 2→3 10–14 · 3→4 28–38");
  });

  it("counts changed values", () => {
    const state = apply(loadedState(), {
      type: "epcValueChanged",
      functionId: "epc-3-4",
      index: 0,
      value: 40,
    });

    expect(summarizeShiftFirmness(state)).toBe("1→2 10–18 · 2→3 10–14 · 3→4 28–40 · 1 changed");
  });
});
