import { parseTireSize, STOCK_TIRE, type ContainerFormat } from "@seven-tree/hydra";
import { buildTde1Image, DAILY_DRIVER_CURVES } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./editor-reducer";
import { createLoadedTune } from "./loaded-tune";
import {
  FORMAT_LABELS,
  summarizeBaseTune,
  summarizeIdle,
  summarizeShiftPoints,
  summarizeTires,
} from "./module-summaries";

const FILE_NAME = "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf";
const T315_75R16 = parseTireSize("315/75R16")!;

/** Wide-open and closed-throttle shift points of the Daily Driver tune, in mph. */
const DAILY_DRIVER_SHIFT_POINTS =
  "1→2 7–27 · 2→3 18–43 · 3→4 38–64.5 · 2→1 5.5–21 · 3→2 17.5–37 · 4→3 36–63";

function loadedState(
  options: { image?: Uint8Array; format?: ContainerFormat; fileName?: string } = {},
) {
  const { image = buildTde1Image(), format = "hcf", fileName = FILE_NAME } = options;
  const tune = createLoadedTune(image, { kind: "upload", fileName, format });
  return editorReducer(initialEditorState, { type: "loadSucceeded", tune });
}

function apply(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce((current, action) => editorReducer(current, action), state);
}

/** A tune whose 4→3 closed-throttle downshift (40 mph) is above its 3→4 upshift (38 mph). */
function huntingImage(): Uint8Array {
  const downshift = [...DAILY_DRIVER_CURVES["down-4-3"]];
  // Speed bytes of the closed-throttle point (position 11) and of the padding after it.
  for (const position of [11, 13, 15, 17, 19]) downshift[position] = 0x50;
  return buildTde1Image({ curves: { "down-4-3": downshift } });
}

describe("FORMAT_LABELS", () => {
  it("names each container format", () => {
    expect(FORMAT_LABELS).toEqual({
      hcf: "Hydra .hcf",
      efu: "PHP library .efu",
      bin: "decrypted .bin",
    });
  });
});

describe("summarizeBaseTune", () => {
  it("says no tune is loaded before one is", () => {
    expect(summarizeBaseTune(initialEditorState)).toBe("No tune loaded");
  });

  it("gives the file name and the file format", () => {
    expect(summarizeBaseTune(loadedState())).toBe(
      "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf · Hydra .hcf",
    );
  });

  it.each([
    ["efu", "TDE1_30N_DAILYDRIVER-REVD.efu", "TDE1_30N_DAILYDRIVER-REVD.efu · PHP library .efu"],
    ["bin", "dump.bin", "dump.bin · decrypted .bin"],
  ] as const)("names a .%s file by its format", (format, fileName, expected) => {
    expect(summarizeBaseTune(loadedState({ format, fileName }))).toBe(expected);
  });

  it("keeps naming the source file when the output file name changes", () => {
    const state = apply(loadedState(), { type: "outputFileNameChanged", value: "my-tune" });

    expect(summarizeBaseTune(state)).toBe(
      "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf · Hydra .hcf",
    );
  });
});

describe("summarizeBaseTune with a chip serial", () => {
  it("adds the chip serial after the tune", () => {
    const state = apply(loadedState(), { type: "chipSerialChanged", value: "0A1B2C3D" });

    expect(summarizeBaseTune(state)).toBe(
      "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf · Hydra .hcf · chip serial 0A1B2C3D",
    );
  });

  it("shows a serial entered before a tune is loaded", () => {
    const state = apply(initialEditorState, { type: "chipSerialChanged", value: "0A1B2C3D" });

    expect(summarizeBaseTune(state)).toBe("No tune loaded · chip serial 0A1B2C3D");
  });

  it("shows a serial that is only partly typed", () => {
    const state = apply(initialEditorState, { type: "chipSerialChanged", value: "0A1B" });

    expect(summarizeBaseTune(state)).toBe("No tune loaded · chip serial 0A1B");
  });

  it("shows the serial the way the editor keeps it, trimmed and in capitals", () => {
    const state = apply(initialEditorState, { type: "chipSerialChanged", value: " 0a1b2c3d " });

    expect(summarizeBaseTune(state)).toBe("No tune loaded · chip serial 0A1B2C3D");
  });

  it("leaves the serial out again when it is cleared", () => {
    const state = apply(
      loadedState(),
      { type: "chipSerialChanged", value: "0A1B2C3D" },
      { type: "chipSerialChanged", value: "" },
    );

    expect(summarizeBaseTune(state)).toBe(
      "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf · Hydra .hcf",
    );
  });
});

describe("summarizeTires", () => {
  it("says no tune is loaded before one is, whatever tires are set", () => {
    expect(summarizeTires(initialEditorState)).toBe("No tune loaded");
    expect(
      summarizeTires(apply(initialEditorState, { type: "fittedTireChanged", tire: T315_75R16 })),
    ).toBe("No tune loaded");
  });

  it("describes the factory tires on a speedometer calibrated for them", () => {
    expect(summarizeTires(loadedState())).toBe(
      "235/85R16 · 31.73 in · calibrated for 235/85R16 · speedometer × 1.0000",
    );
  });

  it("gives the fitted size, its diameter, the calibration size and the speedometer factor", () => {
    const state = apply(loadedState(), { type: "fittedTireChanged", tire: T315_75R16 });

    expect(summarizeTires(state)).toBe(
      "315/75R16 · 34.60 in · calibrated for 235/85R16 · speedometer × 1.0906",
    );
  });

  it("names the calibration size when the speedometer was recalibrated", () => {
    const state = apply(
      loadedState(),
      { type: "fittedTireChanged", tire: T315_75R16 },
      { type: "calibrationTireChanged", tire: T315_75R16 },
    );

    expect(summarizeTires(state)).toBe(
      "315/75R16 · 34.60 in · calibrated for 315/75R16 · speedometer × 1.0000",
    );
  });

  it("gives a factor below 1 when the fitted tires are smaller than the calibration tires", () => {
    const state = apply(
      loadedState(),
      { type: "fittedTireChanged", tire: STOCK_TIRE },
      { type: "calibrationTireChanged", tire: T315_75R16 },
    );

    expect(summarizeTires(state)).toBe(
      "235/85R16 · 31.73 in · calibrated for 315/75R16 · speedometer × 0.9169",
    );
  });
});

describe("summarizeShiftPoints", () => {
  it("says no tune is loaded before one is", () => {
    expect(summarizeShiftPoints(initialEditorState)).toBe("No tune loaded");
  });

  it("gives the closed-throttle and wide-open shift point of each curve, in curve order", () => {
    expect(summarizeShiftPoints(loadedState())).toBe(DAILY_DRIVER_SHIFT_POINTS);
  });

  it("shows the tune's mph, not the speedometer's, when other tires are fitted", () => {
    const state = apply(loadedState(), { type: "fittedTireChanged", tire: T315_75R16 });

    expect(summarizeShiftPoints(state)).toBe(DAILY_DRIVER_SHIFT_POINTS);
  });

  it("shows an edited closed-throttle point and counts the change", () => {
    const state = apply(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-3-4",
      index: 5,
      mph: 40,
    });

    expect(summarizeShiftPoints(state)).toBe(
      "1→2 7–27 · 2→3 18–43 · 3→4 40–64.5 · 2→1 5.5–21 · 3→2 17.5–37 · 4→3 36–63 · 1 changed",
    );
  });

  it("shows an edited wide-open point", () => {
    const state = apply(loadedState(), {
      type: "shiftPointChanged",
      curveId: "down-2-1",
      index: 0,
      mph: 22.5,
    });

    expect(summarizeShiftPoints(state)).toBe(
      "1→2 7–27 · 2→3 18–43 · 3→4 38–64.5 · 2→1 5.5–22.5 · 3→2 17.5–37 · 4→3 36–63 · 1 changed",
    );
  });

  it("counts a change between the two ends without changing the ends", () => {
    const state = apply(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-1-2",
      index: 3,
      mph: 15,
    });

    expect(summarizeShiftPoints(state)).toBe(`${DAILY_DRIVER_SHIFT_POINTS} · 1 changed`);
  });

  it("counts every changed shift point", () => {
    const state = apply(
      loadedState(),
      { type: "shiftPointChanged", curveId: "up-1-2", index: 3, mph: 15 },
      { type: "shiftPointChanged", curveId: "up-2-3", index: 4, mph: 26 },
    );

    expect(summarizeShiftPoints(state)).toBe(`${DAILY_DRIVER_SHIFT_POINTS} · 2 changed`);
  });

  it("counts a changed closed-throttle point once, not once per padding byte", () => {
    const state = apply(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-1-2",
      index: 6,
      mph: 8,
    });

    expect(summarizeShiftPoints(state)).toBe(
      "1→2 8–27 · 2→3 18–43 · 3→4 38–64.5 · 2→1 5.5–21 · 3→2 17.5–37 · 4→3 36–63 · 1 changed",
    );
  });

  it("shows no count again after everything is reset", () => {
    const state = apply(
      loadedState(),
      { type: "shiftPointChanged", curveId: "up-1-2", index: 3, mph: 15 },
      { type: "allReset" },
    );

    expect(summarizeShiftPoints(state)).toBe(DAILY_DRIVER_SHIFT_POINTS);
  });

  it("adds a gear hunting warning after the count when a downshift is above its upshift", () => {
    const state = apply(loadedState(), {
      type: "shiftPointChanged",
      curveId: "down-4-3",
      index: 5,
      mph: 40,
    });

    expect(summarizeShiftPoints(state)).toBe(
      "1→2 7–27 · 2→3 18–43 · 3→4 38–64.5 · 2→1 5.5–21 · 3→2 17.5–37 · 4→3 40–63 · 1 changed · gear hunting warning",
    );
  });

  it("adds the warning when an upshift is lowered below its downshift", () => {
    // The 3→4 upshift at 35 mph is below the 4→3 downshift at 36 mph.
    const state = apply(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-3-4",
      index: 5,
      mph: 35,
    });

    expect(summarizeShiftPoints(state)).toBe(
      "1→2 7–27 · 2→3 18–43 · 3→4 35–64.5 · 2→1 5.5–21 · 3→2 17.5–37 · 4→3 36–63 · 1 changed · gear hunting warning",
    );
  });

  it("adds the warning with no count when the loaded tune already hunts", () => {
    const state = loadedState({ image: huntingImage() });

    expect(summarizeShiftPoints(state)).toBe(
      "1→2 7–27 · 2→3 18–43 · 3→4 38–64.5 · 2→1 5.5–21 · 3→2 17.5–37 · 4→3 40–63 · gear hunting warning",
    );
  });

  it("drops the warning when the edit that caused it is reset", () => {
    const state = apply(
      loadedState(),
      { type: "shiftPointChanged", curveId: "down-4-3", index: 5, mph: 40 },
      { type: "curveReset", curveId: "down-4-3" },
    );

    expect(summarizeShiftPoints(state)).toBe(DAILY_DRIVER_SHIFT_POINTS);
  });
});

describe("summarizeIdle", () => {
  it("says no tune is loaded before one is", () => {
    expect(summarizeIdle(initialEditorState)).toBe("No tune loaded");
  });

  it("gives the warm idle in rpm", () => {
    expect(summarizeIdle(loadedState())).toBe("680 rpm");
  });

  it("gives an edited warm idle", () => {
    const state = apply(loadedState(), { type: "warmIdleChanged", rpm: 700 });

    expect(summarizeIdle(state)).toBe("700 rpm");
  });

  it.each([
    [687.5, "687.5 rpm"],
    [680.25, "680.25 rpm"],
    [700.75, "700.75 rpm"],
  ])("writes %s rpm with up to two decimals and no trailing zero", (rpm, expected) => {
    const state = apply(loadedState(), { type: "warmIdleChanged", rpm });

    expect(summarizeIdle(state)).toBe(expected);
  });
});
