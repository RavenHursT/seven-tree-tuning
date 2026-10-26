import { parseTireSize, speedometerFactor } from "@seven-tree/hydra";
import { buildTde1Image, DAILY_DRIVER_EPC, DAILY_DRIVER_LOCKUP } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./editor-reducer";
import { createLoadedTune } from "./loaded-tune";

const T315_75R16 = parseTireSize("315/75R16")!;
const T265_75R16 = parseTireSize("265/75R16")!;

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

/** The y bytes of one function, as stored: every second byte of the real Daily Driver bytes. */
function yBytes(bytes: readonly number[]): number[] {
  return bytes.filter((_byte, position) => position % 2 === 1);
}

describe("lockup speed edits", () => {
  it("stores a typed tune speed as mph x 2 and leaves every other value alone", () => {
    const state = apply(loadedState(), {
      type: "lockupSpeedChanged",
      functionId: "lock-4",
      index: 0,
      mph: 33,
    });

    expect(state.values?.lockupSpeedsRaw["lock-4"]).toEqual([66, 0x3c, 0x3c, 0x3c]);
    expect(state.values?.lockupSpeedsRaw["unlock-4"]).toEqual(
      yBytes(DAILY_DRIVER_LOCKUP["unlock-4"]),
    );
  });

  it("converts a speedometer speed with the factor of the fitted and calibration tires", () => {
    const base = apply(
      loadedState(),
      { type: "calibrationTireChanged", tire: T265_75R16 },
      { type: "fittedTireChanged", tire: T315_75R16 },
    );
    const factor = speedometerFactor(T315_75R16, T265_75R16);
    const state = apply(base, {
      type: "lockupSpeedometerChanged",
      functionId: "lock-4",
      index: 0,
      mph: 40,
    });

    expect(state.values?.lockupSpeedsRaw["lock-4"][0]).toBe(Math.round((40 / factor) * 2));
  });

  it("sets 127 mph (0xFE) for never", () => {
    const state = apply(loadedState(), { type: "lockupNeverSet", functionId: "lock-3", index: 0 });

    expect(state.values?.lockupSpeedsRaw["lock-3"][0]).toBe(0xfe);
  });

  it("writes the padding after the closed-pedal point together with it", () => {
    // lock-4 has its closed-pedal point at the last visible row (index 3 of 4 pairs); lock-2 has
    // it at index 4 of 10, so edit that and check the five padding pairs follow.
    const state = apply(loadedState(), {
      type: "lockupSpeedChanged",
      functionId: "lock-2",
      index: 4,
      mph: 12,
    });

    expect(state.values?.lockupSpeedsRaw["lock-2"].slice(4)).toEqual(Array(6).fill(24));
  });

  it("ignores a speed that is not a number", () => {
    const before = loadedState();

    const after = apply(before, {
      type: "lockupSpeedChanged",
      functionId: "lock-4",
      index: 0,
      mph: Number.NaN,
    });

    expect(after).toBe(before);
  });

  it("changes nothing before a tune is loaded", () => {
    const state = apply(initialEditorState, {
      type: "lockupSpeedChanged",
      functionId: "lock-4",
      index: 0,
      mph: 33,
    });

    expect(state).toBe(initialEditorState);
  });
});

describe("shift firmness edits", () => {
  it("stores the signed value", () => {
    const state = apply(loadedState(), {
      type: "epcValueChanged",
      functionId: "epc-2-3",
      index: 0,
      value: -5,
    });

    expect(state.values?.epcAddersRaw["epc-2-3"][0]).toBe(-5);
    expect(state.values?.epcAddersRaw["epc-1-2"]).toEqual(yBytes(DAILY_DRIVER_EPC["epc-1-2"]));
  });

  it("clamps to the range of a signed byte and rounds to a whole number", () => {
    const high = apply(loadedState(), {
      type: "epcValueChanged",
      functionId: "epc-3-4",
      index: 0,
      value: 400,
    });
    const fraction = apply(loadedState(), {
      type: "epcValueChanged",
      functionId: "epc-3-4",
      index: 0,
      value: 12.6,
    });

    expect(high.values?.epcAddersRaw["epc-3-4"][0]).toBe(127);
    expect(fraction.values?.epcAddersRaw["epc-3-4"][0]).toBe(13);
  });
});

describe("resetting a function", () => {
  it("puts back one lockup function and leaves the others edited", () => {
    const edited = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "lock-4", index: 0, mph: 33 },
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 0, mph: 20 },
    );

    const state = apply(edited, { type: "functionReset", functionId: "lock-4" });

    expect(state.values?.lockupSpeedsRaw["lock-4"]).toEqual(yBytes(DAILY_DRIVER_LOCKUP["lock-4"]));
    expect(state.values?.lockupSpeedsRaw["unlock-4"][0]).toBe(40);
  });

  it("puts back one firmness function", () => {
    const edited = apply(loadedState(), {
      type: "epcValueChanged",
      functionId: "epc-1-2",
      index: 0,
      value: 30,
    });

    const state = apply(edited, { type: "functionReset", functionId: "epc-1-2" });

    expect(state.values?.epcAddersRaw["epc-1-2"]).toEqual(yBytes(DAILY_DRIVER_EPC["epc-1-2"]));
  });

  it("is put back too by Reset all changes", () => {
    const edited = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "lock-4", index: 0, mph: 33 },
      { type: "epcValueChanged", functionId: "epc-3-4", index: 0, value: 5 },
      { type: "allReset" },
    );

    expect(edited.values).toBe(edited.tune?.originalValues);
  });
});

describe("tire compensation", () => {
  it("scales only the shift speeds and keeps the current lockup and line-pressure values", () => {
    const edited = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "lock-4", index: 0, mph: 33 },
      { type: "epcValueChanged", functionId: "epc-3-4", index: 0, value: 5 },
      { type: "warmIdleChanged", rpm: 700 },
      { type: "calibrationTireChanged", tire: T265_75R16 },
      { type: "fittedTireChanged", tire: T315_75R16 },
    );

    const state = apply(edited, { type: "tireCompensationApplied" });

    expect(state.values?.lockupSpeedsRaw["lock-4"][0]).toBe(66);
    expect(state.values?.epcAddersRaw["epc-3-4"][0]).toBe(5);
    expect(state.values?.warmIdleRaw).toEqual([2800, 2800]);
    expect(state.values?.gridsRaw).toBe(edited.values?.gridsRaw);
    expect(state.values?.shiftSpeedsRaw["up-3-4"]).not.toEqual(
      edited.values?.shiftSpeedsRaw["up-3-4"],
    );
  });
});
