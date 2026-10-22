import { STOCK_TIRE, type TireSize } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import { editorReducer, initialEditorState, type EditorState } from "./editor-reducer";
import { createLoadedTune, type TuneSource } from "./loaded-tune";

const LT265_75R16: TireSize = { kind: "metric", widthMm: 265, aspectRatio: 75, rimDiameterIn: 16 };
const T315_75R16: TireSize = { kind: "metric", widthMm: 315, aspectRatio: 75, rimDiameterIn: 16 };
const T35X12_50R17: TireSize = {
  kind: "flotation",
  diameterIn: 35,
  widthIn: 12.5,
  rimDiameterIn: 17,
};
const UPLOAD: TuneSource = {
  kind: "upload",
  fileName: "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf",
  format: "hcf",
};

function loadedState(source: TuneSource = UPLOAD): EditorState {
  const tune = createLoadedTune(buildTde1Image(), source);
  return editorReducer(initialEditorState, { type: "loadSucceeded", tune });
}

function speeds(state: EditorState, curveId: "up-1-2" | "up-3-4" | "down-4-3") {
  return state.values?.shiftSpeedsRaw[curveId];
}

describe("initial state", () => {
  it("starts with no tune, no serial and the 1996 F-350 factory tire for both tire sizes", () => {
    expect(initialEditorState).toMatchObject({
      chipSerial: "",
      fittedTire: STOCK_TIRE,
      calibrationTire: STOCK_TIRE,
      tune: null,
      values: null,
      outputFileName: "",
      loading: null,
      loadError: null,
      pendingFile: null,
    });
    expect(STOCK_TIRE).toEqual({
      kind: "metric",
      widthMm: 235,
      aspectRatio: 85,
      rimDiameterIn: 16,
    });
  });
});

describe("chip serial", () => {
  it("stores the serial trimmed and in uppercase", () => {
    const state = editorReducer(initialEditorState, {
      type: "chipSerialChanged",
      value: " 0a1b2c3d ",
    });
    expect(state.chipSerial).toBe("0A1B2C3D");
  });
});

describe("loading a tune", () => {
  it("marks the load as in progress and clears an earlier error", () => {
    const failed = editorReducer(initialEditorState, { type: "loadFailed", message: "Nope." });
    const state = editorReducer(failed, {
      type: "loadStarted",
      kind: "library",
      fileName: "VCAB0_02_40DD.efu",
    });
    expect(state.loading).toEqual({ kind: "library", fileName: "VCAB0_02_40DD.efu" });
    expect(state.loadError).toBeNull();
  });

  it("starts editing from the tune's own values and suggests an output name without the extension", () => {
    const state = loadedState();
    expect(state.values).toBe(state.tune?.originalValues);
    expect(state.outputFileName).toBe("TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG-CUSTOM");
    expect(state.loading).toBeNull();
    expect(state.loadError).toBeNull();
  });

  it("names the output after a library tune too", () => {
    const state = loadedState({ kind: "library", fileName: "VCAB0_02_40DD.efu", format: "efu" });
    expect(state.outputFileName).toBe("VCAB0_02_40DD-CUSTOM");
  });

  it("keeps the loaded tune when a later load fails", () => {
    const loaded = loadedState();
    const state = editorReducer(loaded, {
      type: "loadFailed",
      message: "The chip serial does not match this file.",
    });
    expect(state.tune).toBe(loaded.tune);
    expect(state.loadError).toBe("The chip serial does not match this file.");
    expect(state.loading).toBeNull();
  });

  it("drops a held .hcf when another load starts", () => {
    const held = editorReducer(initialEditorState, {
      type: "pendingFileHeld",
      file: { fileName: "a.hcf", bytes: new Uint8Array([1]) },
    });
    const state = editorReducer(held, { type: "loadStarted", kind: "library", fileName: "b.efu" });
    expect(state.pendingFile).toBeNull();
  });

  it("is no longer loading once a .hcf is held for its serial", () => {
    const started = editorReducer(initialEditorState, {
      type: "loadStarted",
      kind: "upload",
      fileName: "a.hcf",
    });
    const held = editorReducer(started, {
      type: "pendingFileHeld",
      file: { fileName: "a.hcf", bytes: new Uint8Array([1]) },
    });
    expect(held.loading).toBeNull();
  });

  it("holds a .hcf file picked before the serial was entered, until a tune loads", () => {
    const pendingFile = { fileName: "a.hcf", bytes: new Uint8Array([1, 2, 3]) };
    const held = editorReducer(initialEditorState, { type: "pendingFileHeld", file: pendingFile });
    expect(held.pendingFile).toBe(pendingFile);

    const tune = createLoadedTune(buildTde1Image(), UPLOAD);
    expect(editorReducer(held, { type: "loadSucceeded", tune }).pendingFile).toBeNull();
  });
});

describe("editing shift points", () => {
  it("writes the closed-throttle point and the padding entries after it", () => {
    const state = loadedState();
    const next = editorReducer(state, {
      type: "shiftPointChanged",
      curveId: "up-3-4",
      index: 5,
      mph: 35,
    });
    expect(speeds(next, "up-3-4")).toEqual([0x81, 0x81, 0x78, 0x71, 0x4f, 70, 70, 70, 70, 70]);
    expect(speeds(state, "up-3-4")).toEqual(state.tune?.originalValues.shiftSpeedsRaw["up-3-4"]);
  });

  it("rounds a typed shift point to the tune's 0.5 mph steps", () => {
    const next = editorReducer(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-1-2",
      index: 0,
      mph: 38.3,
    });
    expect(speeds(next, "up-1-2")?.[0]).toBe(77);
  });

  it("converts a speedometer value back through the tire sizes", () => {
    const state = editorReducer(loadedState(), { type: "fittedTireChanged", tire: T315_75R16 });
    const next = editorReducer(state, {
      type: "speedometerChanged",
      curveId: "up-3-4",
      index: 5,
      mph: 41.5,
    });
    // 41.5 mph on 34.6024 in tires = 38.05 mph on 31.7283 in tires -> 76 raw (38.0 mph).
    expect(speeds(next, "up-3-4")?.slice(5)).toEqual([76, 76, 76, 76, 76]);
  });

  it("converts a speedometer value back through a flotation size, which names its diameter", () => {
    const state = editorReducer(loadedState(), { type: "fittedTireChanged", tire: T35X12_50R17 });
    const next = editorReducer(state, {
      type: "speedometerChanged",
      curveId: "up-3-4",
      index: 5,
      mph: 44,
    });
    // 44 mph on 35.0 in tires = 39.89 mph on 31.7283 in tires -> 80 raw (40.0 mph).
    expect(speeds(next, "up-3-4")?.slice(5)).toEqual([80, 80, 80, 80, 80]);
  });

  it("resets one curve without touching the others", () => {
    let state = editorReducer(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-1-2",
      index: 0,
      mph: 30,
    });
    state = editorReducer(state, {
      type: "shiftPointChanged",
      curveId: "up-3-4",
      index: 0,
      mph: 60,
    });
    state = editorReducer(state, { type: "curveReset", curveId: "up-1-2" });

    expect(speeds(state, "up-1-2")).toEqual(state.tune?.originalValues.shiftSpeedsRaw["up-1-2"]);
    expect(speeds(state, "up-3-4")?.[0]).toBe(120);
  });

  it("resets every change, idle included", () => {
    let state = editorReducer(loadedState(), { type: "warmIdleChanged", rpm: 750 });
    state = editorReducer(state, {
      type: "shiftPointChanged",
      curveId: "up-1-2",
      index: 0,
      mph: 30,
    });
    state = editorReducer(state, { type: "allReset" });
    expect(state.values).toEqual(state.tune?.originalValues);
  });

  it("ignores edits while no tune is loaded", () => {
    const state = editorReducer(initialEditorState, {
      type: "shiftPointChanged",
      curveId: "up-1-2",
      index: 0,
      mph: 30,
    });
    expect(state).toBe(initialEditorState);
  });
});

describe("tire compensation", () => {
  it("scales the original shift points by calibration / fitted diameter and keeps the idle edit", () => {
    let state = loadedState();
    state = editorReducer(state, { type: "calibrationTireChanged", tire: LT265_75R16 });
    state = editorReducer(state, { type: "fittedTireChanged", tire: T315_75R16 });
    state = editorReducer(state, { type: "warmIdleChanged", rpm: 700 });
    state = editorReducer(state, {
      type: "shiftPointChanged",
      curveId: "up-1-2",
      index: 0,
      mph: 30,
    });

    state = editorReducer(state, { type: "tireCompensationApplied" });

    // 31.6496 / 34.6024 = 0.91466, the factor of the shipped -TIRECOMP-UPDOWN tunes.
    expect(speeds(state, "up-3-4")).toEqual([118, 118, 110, 103, 72, 70, 70, 70, 70, 70]);
    expect(speeds(state, "down-4-3")).toEqual([115, 115, 102, 93, 66, 66, 66, 66, 66, 66]);
    expect(speeds(state, "up-1-2")?.[0]).toBe(49);
    expect(state.values?.warmIdleRaw).toEqual([2800, 2800]);
  });
});

describe("tire compensation with a flotation size", () => {
  it("scales the original shift points by calibration / fitted diameter, 31.6496 / 35.0", () => {
    let state = loadedState();
    state = editorReducer(state, { type: "calibrationTireChanged", tire: LT265_75R16 });
    state = editorReducer(state, { type: "fittedTireChanged", tire: T35X12_50R17 });

    state = editorReducer(state, { type: "tireCompensationApplied" });

    // 31.6496 / 35.0 = 0.90428. The 3->4 closed throttle 76 raw (38.0 mph) becomes 68.7, so 69.
    expect(speeds(state, "up-3-4")?.slice(5)).toEqual([69, 69, 69, 69, 69]);
    expect(speeds(state, "up-3-4")?.[0]).toBe(117);
  });
});

describe("idle, tires and output name", () => {
  it("sets both warm-idle copies", () => {
    const state = editorReducer(loadedState(), { type: "warmIdleChanged", rpm: 700 });
    expect(state.values?.warmIdleRaw).toEqual([2800, 2800]);
  });

  it("changes the tire sizes without changing any tune value", () => {
    const loaded = loadedState();
    let state = editorReducer(loaded, { type: "fittedTireChanged", tire: T315_75R16 });
    state = editorReducer(state, { type: "calibrationTireChanged", tire: LT265_75R16 });
    expect(state.fittedTire).toEqual(T315_75R16);
    expect(state.calibrationTire).toEqual(LT265_75R16);
    expect(state.values).toBe(loaded.values);
  });

  it("takes a flotation size for either tire", () => {
    let state = editorReducer(loadedState(), { type: "fittedTireChanged", tire: T35X12_50R17 });
    state = editorReducer(state, { type: "calibrationTireChanged", tire: T35X12_50R17 });
    expect(state.fittedTire).toEqual(T35X12_50R17);
    expect(state.calibrationTire).toEqual(T35X12_50R17);
  });

  it("stores the output file name as typed", () => {
    const state = editorReducer(loadedState(), {
      type: "outputFileNameChanged",
      value: "my tune.hcf",
    });
    expect(state.outputFileName).toBe("my tune.hcf");
  });
});
