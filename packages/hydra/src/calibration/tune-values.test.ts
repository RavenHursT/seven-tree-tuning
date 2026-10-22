import { describe, expect, it } from "vitest";

import { CALIBRATION_IMAGE_SIZE } from "../image";
import { assertOnlyEditableChanges, changedOffsets, editableOffsets } from "./edit-guard";
import { closedThrottleIndex, readShiftCurves } from "./shift-curve";
import type { ShiftCurve } from "./shift-curve";
import { SHIFT_CURVE_IDS, TDE1 } from "./tde1";
import type { ShiftCurveId } from "./tde1";
import { buildTde1Image, DAILY_DRIVER_CURVES } from "./test-images";
import {
  diffTuneValues,
  readTuneValues,
  scaleShiftSpeeds,
  setShiftPointRaw,
  setWarmIdleRpm,
  writeTuneValues,
} from "./tune-values";
import type { TuneValues } from "./tune-values";
import { speedRawToMph } from "./units";

const base = buildTde1Image();
const values = readTuneValues(base);
const curves = readShiftCurves(base);

function curveById(id: ShiftCurveId): ShiftCurve {
  const curve = curves.find((candidate) => candidate.definition.id === id);
  if (!curve) throw new Error(`curve ${id} not read`);
  return curve;
}

function speedsOf(source: TuneValues, id: ShiftCurveId): readonly number[] {
  return source.shiftSpeedsRaw[id];
}

function wotAndClosedMph(source: TuneValues): number[][] {
  return SHIFT_CURVE_IDS.map((id) => {
    const speeds = speedsOf(source, id);
    const closed = closedThrottleIndex(curveById(id));
    return [speedRawToMph(speeds[0] ?? NaN), speedRawToMph(speeds[closed] ?? NaN)];
  });
}

describe("readTuneValues", () => {
  it("reads ten raw speed bytes per curve, padding included", () => {
    for (const id of SHIFT_CURVE_IDS) expect(speedsOf(values, id)).toHaveLength(10);
    expect(speedsOf(values, "up-1-2")).toEqual([54, 54, 42, 28, 18, 14, 14, 14, 14, 14]);
    expect(speedsOf(values, "down-4-3")).toEqual([126, 126, 112, 102, 72, 72, 72, 72, 72, 72]);
  });

  it("reads both warm idle copies as rpm x 4", () => {
    expect(values.warmIdleRaw).toEqual([2720, 2720]);
  });

  it("keeps the two idle copies apart when they differ", () => {
    const image = buildTde1Image({
      idle: [
        [32767, 680],
        [80, 700],
        [0, 1100],
        [-40, 1200],
        [-32768, 1200],
        [-32768, 1200],
      ],
    });
    expect(readTuneValues(image).warmIdleRaw).toEqual([2720, 2800]);
  });

  it("rejects an image that is not 256 KiB", () => {
    expect(() => readTuneValues(new Uint8Array(1024))).toThrow(RangeError);
  });
});

describe("writeTuneValues", () => {
  it("gives a byte-identical new image when nothing changed", () => {
    const written = writeTuneValues(base, values);
    expect(written).not.toBe(base);
    expect(written.length).toBe(CALIBRATION_IMAGE_SIZE);
    expect(changedOffsets(base, written)).toEqual([]);
  });

  it("does not change the base image", () => {
    const copy = new Uint8Array(base);
    writeTuneValues(base, scaleShiftSpeeds(values, 0.9147));
    expect(changedOffsets(base, copy)).toEqual([]);
  });

  it("changes only even shift-speed bytes inside the six curves when the speeds are scaled", () => {
    const written = writeTuneValues(base, scaleShiftSpeeds(values, 0.9147));
    const changed = changedOffsets(base, written);
    expect(changed.length).toBeGreaterThan(0);
    for (const offset of changed) {
      const owner = TDE1.shiftCurves.find(
        (curve) => offset >= curve.speedOffset && offset <= curve.speedOffset + 18,
      );
      expect(owner).toBeDefined();
      expect((offset - (owner?.speedOffset ?? 0)) % 2).toBe(0);
    }
  });

  it("leaves every byte outside the 64 editable offsets alone, whatever the edit", () => {
    const edited = setWarmIdleRpm(scaleShiftSpeeds(values, 0.5), 1100);
    const written = writeTuneValues(base, edited);
    expect(() => assertOnlyEditableChanges(base, written)).not.toThrow();
    const editable = editableOffsets();
    expect(changedOffsets(base, written).every((offset) => editable.has(offset))).toBe(true);
  });

  it("reproduces the shipped TIRECOMP-UPDOWN speeds from the Daily Driver tune at 0.9147", () => {
    const written = writeTuneValues(base, scaleShiftSpeeds(values, 0.9147));
    const rebuilt = readTuneValues(written);
    expect(wotAndClosedMph(rebuilt)).toEqual([
      [24.5, 6.5],
      [39.5, 16.5],
      [59, 35],
      [19, 5],
      [34, 16],
      [57.5, 33],
    ]);
    expect(changedOffsets(base, written)).toHaveLength(60);
  });

  it("keeps the throttle axes unchanged", () => {
    const written = writeTuneValues(base, scaleShiftSpeeds(values, 0.9147));
    const axes = (image: Uint8Array) =>
      readShiftCurves(image).map((curve) => curve.breakpoints.map((point) => point.throttleRaw));
    expect(axes(written)).toEqual(axes(base));
  });

  it("rejects a speed that is not a whole number from 0 to 255", () => {
    const bad = (speed: number): TuneValues => ({
      ...values,
      shiftSpeedsRaw: {
        ...values.shiftSpeedsRaw,
        "up-1-2": [speed, 54, 42, 28, 18, 14, 14, 14, 14, 14],
      },
    });
    expect(() => writeTuneValues(base, bad(256))).toThrow(RangeError);
    expect(() => writeTuneValues(base, bad(-1))).toThrow(RangeError);
    expect(() => writeTuneValues(base, bad(1.5))).toThrow(RangeError);
    expect(() => writeTuneValues(base, bad(Number.NaN))).toThrow(RangeError);
  });

  it("rejects a curve with the wrong number of speeds", () => {
    const short: TuneValues = {
      ...values,
      shiftSpeedsRaw: { ...values.shiftSpeedsRaw, "down-2-1": [42, 42] },
    };
    expect(() => writeTuneValues(base, short)).toThrow(RangeError);
  });

  it("rejects an idle value outside 0..65535", () => {
    expect(() => writeTuneValues(base, { ...values, warmIdleRaw: [70_000, 2720] })).toThrow(
      RangeError,
    );
  });

  it("rejects a base image that is not 256 KiB", () => {
    expect(() => writeTuneValues(new Uint8Array(10), values)).toThrow(RangeError);
  });
});

describe("scaleShiftSpeeds", () => {
  it("applies round(raw x factor), clamped to 0..255, to all 60 speed bytes", () => {
    const factor = 0.9147;
    const scaled = scaleShiftSpeeds(values, factor);
    for (const id of SHIFT_CURVE_IDS) {
      const expected = DAILY_DRIVER_CURVES[id]
        .filter((_byte, position) => position % 2 === 1)
        .map((raw) => Math.min(255, Math.max(0, Math.round(raw * factor))));
      expect(speedsOf(scaled, id)).toEqual(expected);
    }
  });

  it("clamps at 255", () => {
    const scaled = scaleShiftSpeeds(values, 3);
    expect(speedsOf(scaled, "up-3-4")[0]).toBe(255);
    expect(speedsOf(scaled, "up-1-2")[5]).toBe(42);
  });

  it("leaves the speeds and the idle values alone at factor 1", () => {
    expect(scaleShiftSpeeds(values, 1)).toEqual(values);
  });

  it("does not change the original values", () => {
    const before = structuredClone(values);
    scaleShiftSpeeds(values, 0.5);
    expect(values).toEqual(before);
  });

  it("rejects a factor that is not a finite number above zero", () => {
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => scaleShiftSpeeds(values, factor)).toThrow(RangeError);
    }
  });
});

describe("setShiftPointRaw", () => {
  const up12 = curveById("up-1-2");

  it("changes exactly one byte of the written image for an ordinary point", () => {
    const edited = setShiftPointRaw(values, up12, 3, 30);
    const written = writeTuneValues(base, edited);
    expect(changedOffsets(base, written)).toEqual([TDE1.shiftCurves[0]!.speedOffset + 6]);
    expect(speedsOf(edited, "up-1-2")).toEqual([54, 54, 42, 30, 18, 14, 14, 14, 14, 14]);
  });

  it("writes the new value into the padding after the closed-throttle point", () => {
    const closed = closedThrottleIndex(up12);
    expect(closed).toBe(6);
    const edited = setShiftPointRaw(values, up12, closed, 20);
    expect(speedsOf(edited, "up-1-2")).toEqual([54, 54, 42, 28, 18, 14, 20, 20, 20, 20]);
    const written = writeTuneValues(base, edited);
    expect(changedOffsets(base, written)).toHaveLength(4);
  });

  it("does not touch the padding when the point before the closed-throttle point changes", () => {
    const edited = setShiftPointRaw(values, up12, closedThrottleIndex(up12) - 1, 16);
    expect(speedsOf(edited, "up-1-2")).toEqual([54, 54, 42, 28, 18, 16, 14, 14, 14, 14]);
  });

  it("changes only the one curve it was given", () => {
    const edited = setShiftPointRaw(values, up12, 0, 60);
    for (const id of SHIFT_CURVE_IDS.filter((other) => other !== "up-1-2")) {
      expect(speedsOf(edited, id)).toEqual(speedsOf(values, id));
    }
    expect(edited.warmIdleRaw).toEqual(values.warmIdleRaw);
  });

  it("returns new values and leaves the original alone", () => {
    const before = structuredClone(values);
    const edited = setShiftPointRaw(values, up12, 0, 60);
    expect(edited).not.toBe(values);
    expect(values).toEqual(before);
  });

  it("rounds to the nearest whole byte and clamps to 0..255", () => {
    const edited = (speed: number) =>
      speedsOf(setShiftPointRaw(values, up12, 0, speed), "up-1-2")[0];
    expect(edited(300)).toBe(255);
    expect(edited(-5)).toBe(0);
    expect(edited(12.4)).toBe(12);
    expect(edited(12.5)).toBe(13);
    expect(edited(Number.POSITIVE_INFINITY)).toBe(255);
  });

  it("rejects a value that is not a number", () => {
    expect(() => setShiftPointRaw(values, up12, 0, Number.NaN)).toThrow(RangeError);
  });

  it("rejects an index outside the curve", () => {
    for (const index of [-1, 10, 1.5]) {
      expect(() => setShiftPointRaw(values, up12, index, 20)).toThrow(RangeError);
    }
  });
});

describe("setWarmIdleRpm", () => {
  it("sets both copies to rpm x 4 and changes exactly four bytes of the image", () => {
    const edited = setWarmIdleRpm(values, 1100);
    expect(edited.warmIdleRaw).toEqual([4400, 4400]);
    const written = writeTuneValues(base, edited);
    const [first, second] = TDE1.idle.warmIdleOffsets;
    expect(changedOffsets(base, written)).toEqual([first, first + 1, second, second + 1]);
    expect([written[first], written[first + 1], written[second], written[second + 1]]).toEqual([
      0x30, 0x11, 0x30, 0x11,
    ]);
  });

  it("makes the copies equal even when they differed", () => {
    const image = buildTde1Image({
      idle: [
        [32767, 680],
        [80, 700],
        [0, 1100],
        [-40, 1200],
        [-32768, 1200],
        [-32768, 1200],
      ],
    });
    expect(setWarmIdleRpm(readTuneValues(image), 900).warmIdleRaw).toEqual([3600, 3600]);
  });

  it("clamps to the uint16 range and rejects a value that is not a number", () => {
    expect(setWarmIdleRpm(values, 100_000).warmIdleRaw).toEqual([65_535, 65_535]);
    expect(setWarmIdleRpm(values, -5).warmIdleRaw).toEqual([0, 0]);
    expect(() => setWarmIdleRpm(values, Number.NaN)).toThrow(RangeError);
  });

  it("leaves the original values and the speeds alone", () => {
    const edited = setWarmIdleRpm(values, 1100);
    expect(values.warmIdleRaw).toEqual([2720, 2720]);
    expect(edited.shiftSpeedsRaw).toEqual(values.shiftSpeedsRaw);
  });
});

describe("diffTuneValues", () => {
  it("reports nothing for identical values", () => {
    expect(diffTuneValues(values, values)).toEqual({ changedShiftPoints: 0, idleChanged: false });
  });

  it("counts each changed speed byte", () => {
    const edited = setShiftPointRaw(values, curveById("up-3-4"), 2, 100);
    expect(diffTuneValues(values, edited)).toEqual({ changedShiftPoints: 1, idleChanged: false });
  });

  it("counts the padding bytes a closed-throttle edit also writes", () => {
    const up12 = curveById("up-1-2");
    const edited = setShiftPointRaw(values, up12, closedThrottleIndex(up12), 20);
    expect(diffTuneValues(values, edited).changedShiftPoints).toBe(4);
  });

  it("counts all 60 speed bytes when every speed changes", () => {
    expect(diffTuneValues(values, scaleShiftSpeeds(values, 0.9147))).toEqual({
      changedShiftPoints: 60,
      idleChanged: false,
    });
  });

  it("reports an idle change on either copy", () => {
    expect(diffTuneValues(values, setWarmIdleRpm(values, 1100))).toEqual({
      changedShiftPoints: 0,
      idleChanged: true,
    });
    expect(diffTuneValues(values, { ...values, warmIdleRaw: [2720, 2800] }).idleChanged).toBe(true);
  });
});
