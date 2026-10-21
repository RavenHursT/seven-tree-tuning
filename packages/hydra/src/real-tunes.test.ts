import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { expectSameBytes } from "./container/test-support";
import {
  changedOffsets,
  closedThrottleIndex,
  editableOffsets,
  findShiftOverlaps,
  HcfCodec,
  idleRawToRpm,
  readShiftCurves,
  readTuneValues,
  scaleShiftSpeeds,
  speedRawToMph,
  writeTuneValues,
  type ShiftCurveId,
} from "./index";

// Checks the proven results recorded in README.md and docs/tunes.md against the real tunes in
// tunes/. Runs only when HYDRA_CHIP_SERIAL holds the serial of the chip those tunes are for.
const chipSerial = process.env.HYDRA_CHIP_SERIAL;
const tunesFolder = fileURLToPath(new URL("../../../tunes/", import.meta.url));

type Schedule = Readonly<Record<ShiftCurveId, readonly [wotMph: number, closedMph: number]>>;

function schedule(
  up12: readonly [number, number],
  up23: readonly [number, number],
  up34: readonly [number, number],
  down21: readonly [number, number],
  down32: readonly [number, number],
  down43: readonly [number, number],
): Schedule {
  return {
    "up-1-2": up12,
    "up-2-3": up23,
    "up-3-4": up34,
    "down-2-1": down21,
    "down-3-2": down32,
    "down-4-3": down43,
  };
}

/** docs/tunes.md, "Shift schedules": WOT and closed-throttle mph of each curve. */
const DOCUMENTED_SCHEDULES: Readonly<Record<string, Schedule>> = {
  "DAILYDRIVER-REVB": schedule([27, 7], [43, 18], [64.5, 35], [21, 5.5], [37, 17.5], [59.5, 31.5]),
  "DAILYDRIVER-REVC": schedule([27, 7], [43, 18], [64.5, 38], [21, 5.5], [37, 17.5], [59.5, 31.5]),
  "DAILYDRIVER-REVD": schedule([27, 7], [43, 18], [64.5, 38], [21, 5.5], [37, 17.5], [59.5, 31.5]),
  "DAILYDRIVER-REVD-DOWNSHIFTCHG": schedule(
    [27, 7],
    [43, 18],
    [64.5, 38],
    [21, 5.5],
    [37, 17.5],
    [63, 36],
  ),
  "DAILYDRIVER-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN": schedule(
    [24.5, 6.5],
    [39.5, 16.5],
    [59, 35],
    [19, 5],
    [34, 16],
    [57.5, 33],
  ),
  "DAILYDRIVER-REVE": schedule([27, 7], [43, 18], [64.5, 38], [21, 5.5], [37, 17.5], [59.5, 31.5]),
  "HOTSTREET-REVD-DOWNSHIFTCHG": schedule(
    [25, 7.5],
    [41, 19],
    [64.5, 38.5],
    [21, 5.5],
    [37, 17.5],
    [62.5, 35.5],
  ),
  "HOTSTREET-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN": schedule(
    [23, 7],
    [37.5, 17.5],
    [59, 35],
    [19, 5],
    [34, 16],
    [57, 32.5],
  ),
  "EXTREMESTREET-REVD-DOWNSHIFTCHG": schedule(
    [25, 7.5],
    [41, 19],
    [64.5, 39],
    [21, 5.5],
    [37, 17.5],
    [62.5, 36],
  ),
  "EXTREMESTREET-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN": schedule(
    [23, 7],
    [37.5, 17.5],
    [59, 35.5],
    [19, 5],
    [34, 16],
    [57, 33],
  ),
  "STRENUOUSTOW-REVD-DOWNSHIFTCHG": schedule(
    [27, 10],
    [43, 22],
    [65, 39],
    [21, 9],
    [37, 17.5],
    [62.5, 37],
  ),
  "STRENUOUSTOW-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN": schedule(
    [24.5, 9],
    [39.5, 20],
    [59.5, 35.5],
    [19, 8],
    [34, 16],
    [57, 34],
  ),
  "TOWPERFORMANCE-REVD-DOWNSHIFTCHG": schedule(
    [27, 10],
    [43, 22],
    [64, 39],
    [21, 9],
    [37, 17.5],
    [62.5, 37],
  ),
  "TOWPERFORMANCE-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN": schedule(
    [24.5, 9],
    [39.5, 20],
    [58.5, 35.5],
    [19, 8],
    [34, 16],
    [57, 34],
  ),
};

/** Warm idle of each application, decoded from the tunes (Hot and Extreme Street idle higher). */
const WARM_IDLE_RPM: Readonly<Record<string, number>> = {
  DAILYDRIVER: 680,
  EXTREMESTREET: 700,
  HOTSTREET: 700,
  STRENUOUSTOW: 680,
  TOWPERFORMANCE: 680,
};

const APPLICATIONS = Object.keys(WARM_IDLE_RPM);
const TUNE_NAMES = Object.keys(DOCUMENTED_SCHEDULES);

/** The shipped -TIRECOMP-UPDOWN tunes used this rounded factor (31.6496 in / 34.6024 in). */
const SHIPPED_TIRE_FACTOR = 0.9147;

function readTune(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`${tunesFolder}TDE1_30N_${name}.hcf`));
}

describe.skipIf(!chipSerial)("the tunes in tunes/ (set HYDRA_CHIP_SERIAL to run)", () => {
  const codec = new HcfCodec(chipSerial ?? "00000000");
  const decode = (name: string): Uint8Array => codec.decode(readTune(name));

  it.each(TUNE_NAMES)("%s has the shift schedule docs/tunes.md documents", (name) => {
    const image = decode(name);
    const values = readTuneValues(image);
    const decoded = Object.fromEntries(
      readShiftCurves(image).map((curve) => {
        const speeds = values.shiftSpeedsRaw[curve.definition.id];
        const wot = speedRawToMph(speeds[0] ?? -1);
        const closed = speedRawToMph(speeds[closedThrottleIndex(curve)] ?? -1);
        return [curve.definition.id, [wot, closed]];
      }),
    );
    expect(decoded).toEqual(DOCUMENTED_SCHEDULES[name]);
  });

  it.each(TUNE_NAMES)("%s has no throttle range where a downshift reaches its upshift", (name) => {
    const image = decode(name);
    expect(findShiftOverlaps(readShiftCurves(image), readTuneValues(image))).toEqual([]);
  });

  it.each(TUNE_NAMES)("%s keeps the warm idle of its application", (name) => {
    const application = name.split("-")[0] ?? "";
    const { warmIdleRaw } = readTuneValues(decode(name));
    expect(warmIdleRaw.map(idleRawToRpm)).toEqual([
      WARM_IDLE_RPM[application],
      WARM_IDLE_RPM[application],
    ]);
  });

  it.each(APPLICATIONS)(
    "scaling %s REVD-DOWNSHIFTCHG by 0.9147 rebuilds its committed -TIRECOMP-UPDOWN file byte for byte",
    (application) => {
      const base = decode(`${application}-REVD-DOWNSHIFTCHG`);
      const edited = writeTuneValues(
        base,
        scaleShiftSpeeds(readTuneValues(base), SHIPPED_TIRE_FACTOR),
      );
      expectSameBytes(
        codec.encode(edited),
        readTune(`${application}-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN`),
      );
    },
  );

  it.each(APPLICATIONS)(
    "%s -TIRECOMP-UPDOWN differs from its base in exactly the 60 shift-speed bytes",
    (application) => {
      const offsets = changedOffsets(
        decode(`${application}-REVD-DOWNSHIFTCHG`),
        decode(`${application}-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN`),
      );
      const editable = editableOffsets();
      expect(offsets).toHaveLength(60);
      expect(offsets.every((offset) => editable.has(offset))).toBe(true);
    },
  );
});
