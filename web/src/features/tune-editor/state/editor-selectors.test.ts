import { scaleShiftSpeeds, type TireSize, type TuneValues } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import { editorReducer, initialEditorState, type EditorState } from "./editor-reducer";
import {
  selectChangeSummary,
  selectChipSerialError,
  selectCurveTables,
  selectGenerateDisabledReason,
  selectIdleView,
  selectOverlapViews,
  selectSpeedometerFactor,
  selectTireDiameters,
} from "./editor-selectors";
import { createLoadedTune } from "./loaded-tune";

const T315_75R16: TireSize = { kind: "metric", widthMm: 315, aspectRatio: 75, rimDiameterIn: 16 };
const T35X12_50R17: TireSize = {
  kind: "flotation",
  diameterIn: 35,
  widthIn: 12.5,
  rimDiameterIn: 17,
};

function loadedState(): EditorState {
  const tune = createLoadedTune(buildTde1Image(), {
    kind: "upload",
    fileName: "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf",
    format: "hcf",
  });
  return editorReducer(initialEditorState, { type: "loadSucceeded", tune });
}

function withUpshiftsOnlyScaled(state: EditorState, factor: number): EditorState {
  const values = state.values as TuneValues;
  const scaled = scaleShiftSpeeds(values, factor);
  return {
    ...state,
    values: {
      ...values,
      shiftSpeedsRaw: {
        ...values.shiftSpeedsRaw,
        "up-1-2": scaled.shiftSpeedsRaw["up-1-2"],
        "up-2-3": scaled.shiftSpeedsRaw["up-2-3"],
        "up-3-4": scaled.shiftSpeedsRaw["up-3-4"],
      },
    },
  };
}

describe("selectSpeedometerFactor", () => {
  it("is 1 when the fitted tire is the calibration tire", () => {
    expect(selectSpeedometerFactor(initialEditorState)).toBe(1);
  });

  it("is fitted diameter / calibration diameter", () => {
    const state = editorReducer(initialEditorState, {
      type: "fittedTireChanged",
      tire: T315_75R16,
    });
    const diameter = (widthMm: number, aspect: number) => 16 + (2 * widthMm * aspect) / 100 / 25.4;
    expect(selectSpeedometerFactor(state)).toBeCloseTo(diameter(315, 75) / diameter(235, 85), 10);
  });
});

describe("selectSpeedometerFactor with a flotation size", () => {
  it("is the diameter the size names over the calibration diameter", () => {
    const state = editorReducer(initialEditorState, {
      type: "fittedTireChanged",
      tire: T35X12_50R17,
    });
    expect(selectSpeedometerFactor(state)).toBeCloseTo(35 / 31.7283, 4);
  });
});

describe("selectCurveTables", () => {
  it("returns nothing before a tune is loaded", () => {
    expect(selectCurveTables(initialEditorState)).toEqual({ upshifts: [], downshifts: [] });
  });

  it("lists the three upshifts and three downshifts with their labels", () => {
    const tables = selectCurveTables(loadedState());
    expect(tables.upshifts.map((table) => [table.curveId, table.title, table.kind])).toEqual([
      ["up-1-2", "1→2", "upshift"],
      ["up-2-3", "2→3", "upshift"],
      ["up-3-4", "3→4 (overdrive)", "upshift"],
    ]);
    expect(tables.downshifts.map((table) => [table.curveId, table.title, table.kind])).toEqual([
      ["down-2-1", "2→1", "downshift"],
      ["down-3-2", "3→2", "downshift"],
      ["down-4-3", "4→3 (out of overdrive)", "downshift"],
    ]);
  });

  it("shows each real breakpoint down to closed throttle and hides the padding", () => {
    const [up12] = selectCurveTables(loadedState()).upshifts;
    expect(up12?.rows.map((row) => row.throttleRaw)).toEqual([255, 168, 168, 125, 75, 50, 0]);
    expect(up12?.rows.map((row) => row.isStep)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(up12?.rows.map((row) => row.shiftPointMph)).toEqual([27, 27, 21, 14, 9, 7, 7]);
    expect(up12?.rows.map((row) => row.shiftPointRaw)).toEqual([
      0x36, 0x36, 0x2a, 0x1c, 0x12, 0x0e, 0x0e,
    ]);
    expect(up12?.rows[0]?.throttlePercent).toBe(100);
    expect(up12?.rows[1]?.throttlePercent).toBeCloseTo(65.88, 2);
    expect(up12?.rows.map((row) => row.breakpointIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("shows speedometer mph for the fitted tires", () => {
    const state = editorReducer(loadedState(), { type: "fittedTireChanged", tire: T315_75R16 });
    const up34 = selectCurveTables(state).upshifts[2];
    const closed = up34?.rows.at(-1);
    expect(closed?.shiftPointMph).toBe(38);
    expect(closed?.speedoMph).toBeCloseTo(41.442, 3);
  });

  it("marks a changed row and keeps its original value", () => {
    const state = editorReducer(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-3-4",
      index: 5,
      mph: 35,
    });
    const closed = selectCurveTables(state).upshifts[2]?.rows.at(-1);
    expect(closed).toMatchObject({ shiftPointMph: 35, originalShiftPointMph: 38, changed: true });
    expect(selectCurveTables(state).upshifts[2]?.rows[0]?.changed).toBe(false);
  });
});

describe("selectOverlapViews", () => {
  it("finds no gear hunting in the Daily Driver tune", () => {
    expect(selectOverlapViews(loadedState())).toEqual([]);
  });

  it("describes each throttle range where a downshift is above its upshift", () => {
    const views = selectOverlapViews(withUpshiftsOnlyScaled(loadedState(), 0.9147));
    expect(views).toHaveLength(3);
    expect(views).toEqual(
      expect.arrayContaining([
        {
          id: "up-2-3:0-50",
          title: "3→2 downshift above 2→3 upshift",
          detail: "Throttle 0–20%: the downshift is up to 1.0 mph above the upshift.",
        },
        {
          // Throttle 81 has equal speeds, which is not hunting, so the range ends at 80.
          id: "up-3-4:0-80",
          title: "4→3 downshift above 3→4 upshift",
          detail: "Throttle 0–31%: the downshift is up to 1.0 mph above the upshift.",
        },
        {
          id: "up-3-4:192-255",
          title: "4→3 downshift above 3→4 upshift",
          detail: "Throttle 75–100%: the downshift is up to 4.0 mph above the upshift.",
        },
      ]),
    );
  });
});

describe("selectChangeSummary", () => {
  it("counts changed visible rows, not padding bytes", () => {
    let state = editorReducer(loadedState(), {
      type: "shiftPointChanged",
      curveId: "up-3-4",
      index: 5,
      mph: 35,
    });
    expect(selectChangeSummary(state)).toEqual({ changedShiftPoints: 1, idleChanged: false });

    state = editorReducer(state, { type: "warmIdleChanged", rpm: 700 });
    expect(selectChangeSummary(state)).toEqual({ changedShiftPoints: 1, idleChanged: true });
  });

  it("is empty before a tune is loaded", () => {
    expect(selectChangeSummary(initialEditorState)).toEqual({
      changedShiftPoints: 0,
      idleChanged: false,
    });
  });
});

describe("selectChipSerialError", () => {
  it("says nothing until something is typed, or when the serial is valid", () => {
    expect(selectChipSerialError("")).toBeUndefined();
    expect(selectChipSerialError("0A1B2C3D")).toBeUndefined();
  });

  it("asks for all 8 digits, and for hex digits only", () => {
    expect(selectChipSerialError("0A1B")).toBe("Enter all 8 hex digits.");
    expect(selectChipSerialError("0A1B2C3G")).toBe("Use only the digits 0–9 and letters A–F.");
  });
});

describe("selectGenerateDisabledReason", () => {
  it("asks for a tune, then a valid serial, then an output name", () => {
    expect(selectGenerateDisabledReason(initialEditorState)).toBe("Load a tune first.");

    let state = loadedState();
    expect(selectGenerateDisabledReason(state)).toBe("Enter the 8-digit chip serial.");

    state = editorReducer(state, { type: "chipSerialChanged", value: "0A1B2C3G" });
    expect(selectGenerateDisabledReason(state)).toBe("Enter the 8-digit chip serial.");

    state = editorReducer(state, { type: "chipSerialChanged", value: "0A1B2C3D" });
    state = editorReducer(state, { type: "outputFileNameChanged", value: "  " });
    expect(selectGenerateDisabledReason(state)).toBe("Enter an output file name.");

    state = editorReducer(state, { type: "outputFileNameChanged", value: "tune.hcf" });
    expect(selectGenerateDisabledReason(state)).toBeUndefined();
  });
});

describe("selectIdleView", () => {
  it("shows the warm idle, the original value and the idle curve", () => {
    const view = selectIdleView(loadedState());
    expect(view).toMatchObject({ rpm: 680, originalRpm: 680, warning: undefined });
    expect(view?.idleCurve.map((point) => point.rpm)).toEqual([680, 680, 1100, 1200, 1200, 1200]);
  });

  it("warns when the warm idle is above the next point on the idle curve", () => {
    const state = editorReducer(loadedState(), { type: "warmIdleChanged", rpm: 1150 });
    expect(selectIdleView(state)?.warning).toBe(
      "Higher than the next point on the idle curve (1,100 rpm).",
    );
  });

  it("is undefined before a tune is loaded", () => {
    expect(selectIdleView(initialEditorState)).toBeUndefined();
  });
});

describe("tire selectors", () => {
  it("gives both tire diameters in inches", () => {
    const state = editorReducer(initialEditorState, {
      type: "fittedTireChanged",
      tire: T315_75R16,
    });
    const diameters = selectTireDiameters(state);
    expect(diameters.fitted).toBeCloseTo(34.6024, 4);
    expect(diameters.calibration).toBeCloseTo(31.7283, 4);
  });

  it("gives the diameter a flotation size names, exactly", () => {
    const state = editorReducer(initialEditorState, {
      type: "fittedTireChanged",
      tire: T35X12_50R17,
    });
    expect(selectTireDiameters(state).fitted).toBe(35);
    expect(selectTireDiameters(state).calibration).toBeCloseTo(31.7283, 4);
  });
});
