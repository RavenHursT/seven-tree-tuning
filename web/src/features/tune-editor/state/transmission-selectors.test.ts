import { parseTireSize } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./editor-reducer";
import { createLoadedTune } from "./loaded-tune";
import {
  selectFirmnessTables,
  selectLockupTables,
  selectLockupWarnings,
  selectTransmissionChanges,
} from "./transmission-selectors";

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

function lockupTable(state: EditorState, functionId: string) {
  const table = selectLockupTables(state).find((item) => item.functionId === functionId);
  if (!table) throw new Error(`no ${functionId} table`);
  return table;
}

describe("selectLockupTables", () => {
  it("is empty before a tune is loaded", () => {
    expect(selectLockupTables(initialEditorState)).toEqual([]);
  });

  it("lists a lock and an unlock curve for 2nd, 3rd and 4th gear, in that order", () => {
    const titles = selectLockupTables(loadedState()).map((table) => table.title);

    expect(titles).toEqual([
      "2nd gear lock",
      "2nd gear unlock",
      "3rd gear lock",
      "3rd gear unlock",
      "4th gear lock",
      "4th gear unlock",
    ]);
  });

  it("lists closed pedal first and wide open last, leaving out the padding", () => {
    const rows = lockupTable(loadedState(), "lock-4").rows;

    expect(rows.map((row) => row.pedalRaw)).toEqual([0, 179, 179, 255]);
    expect(rows.map((row) => row.speedMph)).toEqual([30, 30, 30, 30]);
    expect(rows.map((row) => row.pointIndex)).toEqual([3, 2, 1, 0]);
  });

  it("marks the second row of a repeated pedal value as a step", () => {
    const rows = lockupTable(loadedState(), "lock-2").rows;

    // Stored wide open first: 255, 154, 102, 102, 0. Listed closed first: 0, 102, 102, 154, 255.
    // The step is the second 102 in the stored order, as for a shift curve.
    expect(rows.map((row) => row.pedalRaw)).toEqual([0, 102, 102, 154, 255]);
    expect(rows.map((row) => row.isStep)).toEqual([false, true, false, false, false]);
  });

  it("shows 127 mph as never on a lock curve only", () => {
    const rows = lockupTable(loadedState(), "lock-2").rows;

    expect(rows.map((row) => row.never)).toEqual([true, true, false, false, false]);
    expect(rows[2]).toMatchObject({ speedMph: 20, speedRaw: 40 });
  });

  it("gives the speedometer speed for the tires on the truck and the original speed", () => {
    const base = apply(
      loadedState(),
      { type: "calibrationTireChanged", tire: parseTireSize("265/75R16")! },
      { type: "fittedTireChanged", tire: parseTireSize("315/75R16")! },
      { type: "lockupSpeedChanged", functionId: "lock-4", index: 0, mph: 40 },
    );

    const wideOpen = lockupTable(base, "lock-4").rows.at(-1);

    expect(wideOpen?.speedMph).toBe(40);
    expect(wideOpen?.speedoMph).toBeGreaterThan(40);
    expect(wideOpen).toMatchObject({ originalSpeedMph: 30, changed: true });
  });

  it("changes a visible row when the closed-pedal point is edited, not its padding", () => {
    const state = apply(loadedState(), {
      type: "lockupSpeedChanged",
      functionId: "lock-2",
      index: 4,
      mph: 12,
    });

    const changed = lockupTable(state, "lock-2").rows.filter((row) => row.changed);

    expect(changed).toHaveLength(1);
  });
});

describe("an unlock speed of 127 mph", () => {
  // Unlock 2nd gear at 127 mph at every pedal position. The lock curve is never up to 40% pedal
  // and a real speed above. The editor treats 127 as an ordinary unlock speed.
  function unlockedEverywhere(): EditorState {
    return apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "unlock-2", index: 0, mph: 127 },
      { type: "lockupSpeedChanged", functionId: "unlock-2", index: 1, mph: 127 },
    );
  }

  it("is a number, not never, and has no never flag", () => {
    const rows = lockupTable(unlockedEverywhere(), "unlock-2").rows;

    expect(rows.map((row) => row.speedMph)).toEqual([127, 127]);
    expect(rows.map((row) => row.never)).toEqual([false, false]);
  });

  it("puts no note on any row", () => {
    const rows = lockupTable(unlockedEverywhere(), "unlock-2").rows;

    expect(rows.every((row) => !("cannotStayLocked" in row))).toBe(true);
  });

  it("raises the cycling warning where the lock curve is a real speed", () => {
    const warnings = selectLockupWarnings(unlockedEverywhere());

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.title).toBe("2nd gear unlocks at or above its lock speed");
    expect(warnings[0]?.detail).toMatch(
      /^Pedal \d+–100%: the unlock speed is up to [\d.]+ mph above/,
    );
  });

  it("raises no warning at a pedal position where the lock speed is never", () => {
    const warnings = selectLockupWarnings(unlockedEverywhere());

    // The lock curve is never from closed pedal to 40%, so the warning starts above 40%.
    expect(warnings[0]?.id).toMatch(/^2:10\d-255$/);
  });

  it("raises no warning at 126.5 mph where the lock speed is higher", () => {
    const state = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "lock-2", index: 0, mph: 127 },
      { type: "lockupSpeedChanged", functionId: "lock-2", index: 1, mph: 127 },
      { type: "lockupSpeedChanged", functionId: "lock-2", index: 2, mph: 127 },
      { type: "lockupSpeedChanged", functionId: "unlock-2", index: 0, mph: 126.5 },
    );

    expect(selectLockupWarnings(state)).toEqual([]);
  });
});

describe("a lockup speed above 127 mph", () => {
  it("is stored as 254 (never) when the speedometer value is 200", () => {
    const state = apply(loadedState(), {
      type: "lockupSpeedometerChanged",
      functionId: "lock-2",
      index: 0,
      mph: 200,
    });

    const wideOpen = lockupTable(state, "lock-2").rows.at(-1);

    expect(wideOpen).toMatchObject({ speedRaw: 254, speedMph: 127, never: true });
  });

  it("is stored as 254 when the stored-speed field is 200 on an unlock curve", () => {
    const state = apply(loadedState(), {
      type: "lockupSpeedChanged",
      functionId: "unlock-3",
      index: 0,
      mph: 200,
    });

    const wideOpen = lockupTable(state, "unlock-3").rows.at(-1);

    expect(wideOpen).toMatchObject({ speedRaw: 254, speedMph: 127, never: false });
  });

  it("is never stored as 255 by any route", () => {
    const state = apply(
      loadedState(),
      { type: "lockupSpeedometerChanged", functionId: "lock-4", index: 0, mph: 127.4 },
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 0, mph: 127.4 },
    );

    expect(lockupTable(state, "lock-4").rows.at(-1)?.speedRaw).toBe(254);
    expect(lockupTable(state, "unlock-4").rows.at(-1)?.speedRaw).toBe(254);
  });

  it("limits the speedometer field to the value that stores 254, for the tires on the truck", () => {
    const base = loadedState();
    const fitted = apply(
      base,
      { type: "calibrationTireChanged", tire: parseTireSize("265/75R16")! },
      { type: "fittedTireChanged", tire: parseTireSize("315/75R16")! },
    );

    expect(lockupTable(base, "lock-2").speedometerMaxMph).toBe(127);
    expect(lockupTable(fitted, "lock-2").speedometerMaxMph).toBeGreaterThan(127);
    const wideOpen = apply(fitted, {
      type: "lockupSpeedometerChanged",
      functionId: "lock-2",
      index: 0,
      mph: lockupTable(fitted, "lock-2").speedometerMaxMph,
    });
    expect(lockupTable(wideOpen, "lock-2").rows.at(-1)?.speedRaw).toBe(254);
  });
});

describe("selectFirmnessTables", () => {
  it("lists the three upshifts, closed pedal first", () => {
    const tables = selectFirmnessTables(loadedState());

    expect(tables.map((table) => table.title)).toEqual([
      "1→2 line pressure",
      "2→3 line pressure",
      "3→4 line pressure",
    ]);
    expect(tables[0]?.rows.map((row) => row.value)).toEqual([10, 10, 13, 13, 18, 18]);
    expect(tables[0]).toMatchObject({ min: -128, max: 127 });
  });

  it("marks an edited value as changed and keeps the original", () => {
    const state = apply(loadedState(), {
      type: "epcValueChanged",
      functionId: "epc-1-2",
      index: 0,
      value: 20,
    });

    const row = selectFirmnessTables(state)[0]?.rows.at(-1);

    expect(row).toMatchObject({ value: 20, originalValue: 18, changed: true });
  });
});

describe("selectLockupWarnings", () => {
  it("has none for the Daily Driver tune", () => {
    expect(selectLockupWarnings(loadedState())).toEqual([]);
  });

  it("warns when an unlock speed is above the lock speed at the same pedal", () => {
    // Unlock 4th gear at 35 mph at every pedal position, above the 30 mph lock speed.
    const state = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 0, mph: 35 },
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 1, mph: 35 },
    );

    const warnings = selectLockupWarnings(state);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.title).toBe("4th gear unlocks at or above its lock speed");
    expect(warnings[0]?.detail).toMatch(/^Pedal 0–100%: the unlock speed is up to 5\.0 mph above/);
  });

  it("warns when the two speeds are equal", () => {
    const state = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 0, mph: 30 },
      { type: "lockupSpeedChanged", functionId: "unlock-4", index: 1, mph: 30 },
    );

    expect(selectLockupWarnings(state)[0]?.detail).toBe(
      "Pedal 0–100%: the unlock speed is equal to the lock speed.",
    );
  });

  it("does not warn where the converter never locks", () => {
    // Unlock 2nd gear at 50 mph everywhere. The lock speed is never below 40% pedal, so only
    // 40% pedal and above can cycle.
    const state = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "unlock-2", index: 0, mph: 50 },
      { type: "lockupSpeedChanged", functionId: "unlock-2", index: 1, mph: 50 },
    );

    const detail = selectLockupWarnings(state)[0]?.detail ?? "";

    expect(detail).toMatch(/^Pedal 40–100%/);
  });
});

describe("selectTransmissionChanges", () => {
  it("counts visible rows, not padding", () => {
    const state = apply(
      loadedState(),
      { type: "lockupSpeedChanged", functionId: "lock-2", index: 4, mph: 12 },
      { type: "lockupSpeedChanged", functionId: "lock-4", index: 0, mph: 33 },
      { type: "epcValueChanged", functionId: "epc-3-4", index: 0, value: 5 },
    );

    expect(selectTransmissionChanges(state)).toEqual({
      changedLockupPoints: 2,
      changedFirmnessPoints: 1,
    });
  });

  it("is zero before a tune is loaded", () => {
    expect(selectTransmissionChanges(initialEditorState)).toEqual({
      changedLockupPoints: 0,
      changedFirmnessPoints: 0,
    });
  });
});
