import { describe, expect, it } from "vitest";

import { TDE1 } from "./tde1";
import type { ShiftCurveId } from "./tde1";
import {
  closedThrottleIndex,
  evaluateShiftSpeedRaw,
  evaluateShiftSpeedRawJustBelow,
  readShiftCurve,
  readShiftCurves,
} from "./shift-curve";
import { buildTde1Image } from "./test-images";
import { speedRawToMph } from "./units";

const image = buildTde1Image();
const curves = readShiftCurves(image);

function curveById(id: ShiftCurveId) {
  const curve = curves.find((candidate) => candidate.definition.id === id);
  if (!curve) throw new Error(`curve ${id} not read`);
  return curve;
}

describe("readShiftCurves on the Daily Driver fixture", () => {
  it("returns the six curves in strategy order, ten breakpoints each", () => {
    expect(curves.map((curve) => curve.definition.id)).toEqual(
      TDE1.shiftCurves.map((definition) => definition.id),
    );
    for (const curve of curves) {
      expect(curve.breakpoints.map((point) => point.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it("reads the throttle axis of every curve", () => {
    const axes = Object.fromEntries(
      curves.map((curve) => [curve.definition.id, curve.breakpoints.map((p) => p.throttleRaw)]),
    );
    expect(axes).toEqual({
      "up-1-2": [255, 168, 168, 125, 75, 50, 0, 0, 0, 0],
      "up-2-3": [255, 168, 152, 124, 83, 43, 0, 0, 0, 0],
      "up-3-4": [255, 200, 150, 144, 81, 0, 0, 0, 0, 0],
      "down-2-1": [255, 175, 175, 150, 125, 100, 75, 0, 0, 0],
      "down-3-2": [255, 200, 150, 75, 50, 0, 0, 0, 0, 0],
      "down-4-3": [255, 225, 175, 144, 100, 0, 0, 0, 0, 0],
    });
  });

  it("reads the raw speed bytes, padding included", () => {
    const up12 = curveById("up-1-2").breakpoints.map((point) => point.speedRaw);
    expect(up12).toEqual([54, 54, 42, 28, 18, 14, 14, 14, 14, 14]);
  });

  it("matches the wide-open and closed-throttle mph in docs/tunes.md", () => {
    const wotAndClosed = curves.map((curve) => {
      const closed = curve.breakpoints[closedThrottleIndex(curve)];
      const wot = curve.breakpoints[0];
      return [speedRawToMph(wot?.speedRaw ?? NaN), speedRawToMph(closed?.speedRaw ?? NaN)];
    });
    expect(wotAndClosed).toEqual([
      [27, 7],
      [43, 18],
      [64.5, 38],
      [21, 5.5],
      [37, 17.5],
      [63, 36],
    ]);
  });

  it("keeps the definition on each curve", () => {
    expect(curveById("down-4-3").definition).toBe(TDE1.shiftCurves[5]);
  });
});

describe("readShiftCurve", () => {
  it("reads one curve and equals the matching entry of readShiftCurves", () => {
    const definition = TDE1.shiftCurves[2];
    if (!definition) throw new Error("missing definition");
    expect(readShiftCurve(image, definition)).toEqual(curveById("up-3-4"));
  });

  it("rejects an image that is not 256 KiB", () => {
    const definition = TDE1.shiftCurves[0];
    if (!definition) throw new Error("missing definition");
    expect(() => readShiftCurve(new Uint8Array(1024), definition)).toThrow(RangeError);
  });

  it("reads only the breakpoints the strategy says a curve has", () => {
    const short = readShiftCurves(image, { ...TDE1, breakpointsPerCurve: 3 });
    expect(short.map((curve) => curve.breakpoints.length)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(short[0]?.breakpoints.map((point) => point.throttleRaw)).toEqual([255, 168, 168]);
  });
});

describe("closedThrottleIndex", () => {
  it("is the first breakpoint whose throttle is 0", () => {
    expect(curves.map(closedThrottleIndex)).toEqual([6, 6, 5, 7, 5, 5]);
  });

  it("falls back to the last breakpoint when a curve has no throttle-0 point", () => {
    const curve = {
      definition: curveById("up-1-2").definition,
      breakpoints: [
        { index: 0, throttleRaw: 255, speedRaw: 10 },
        { index: 1, throttleRaw: 40, speedRaw: 20 },
      ],
    };
    expect(closedThrottleIndex(curve)).toBe(1);
  });
});

describe("evaluateShiftSpeedRaw (the Ford lookup)", () => {
  const up12 = curveById("up-1-2").breakpoints;

  it("returns the first speed at and above the first throttle", () => {
    expect(evaluateShiftSpeedRaw(up12, 255)).toBe(54);
    expect(evaluateShiftSpeedRaw(up12, 256)).toBe(54);
    expect(evaluateShiftSpeedRaw(up12, 200)).toBe(54);
  });

  it("returns the closed-throttle speed at throttle 0 and just above it", () => {
    expect(evaluateShiftSpeedRaw(up12, 0)).toBe(14);
    expect(evaluateShiftSpeedRaw(up12, 1)).toBe(14);
  });

  it("returns the exact speed at a breakpoint throttle", () => {
    expect(evaluateShiftSpeedRaw(up12, 125)).toBe(28);
    expect(evaluateShiftSpeedRaw(up12, 75)).toBe(18);
  });

  it("interpolates linearly between two breakpoints", () => {
    expect(evaluateShiftSpeedRaw(up12, 100)).toBe(23);
  });

  it("takes the first speed at a step and interpolates below it from the second", () => {
    expect(evaluateShiftSpeedRaw(up12, 168)).toBe(54);
    expect(evaluateShiftSpeedRaw(up12, 167)).toBeCloseTo(28 + (14 * 42) / 43, 10);
  });

  it("holds the last speed when no breakpoint has a throttle at or below the input", () => {
    const points = [
      { throttleRaw: 255, speedRaw: 10 },
      { throttleRaw: 40, speedRaw: 20 },
    ];
    expect(evaluateShiftSpeedRaw(points, 10)).toBe(20);
  });

  it("rejects a curve with no breakpoints", () => {
    expect(() => evaluateShiftSpeedRaw([], 100)).toThrow(RangeError);
  });
});

describe("evaluateShiftSpeedRawJustBelow (the value approached from lower throttle)", () => {
  const up12 = curveById("up-1-2").breakpoints;
  const down21 = curveById("down-2-1").breakpoints;

  it("gives the second speed of a step, where evaluateShiftSpeedRaw gives the first", () => {
    expect(evaluateShiftSpeedRaw(up12, 168)).toBe(54);
    expect(evaluateShiftSpeedRawJustBelow(up12, 168)).toBe(42);
    expect(evaluateShiftSpeedRaw(down21, 175)).toBe(42);
    expect(evaluateShiftSpeedRawJustBelow(down21, 175)).toBe(28);
  });

  it("equals evaluateShiftSpeedRaw where the curve has no step", () => {
    for (const throttle of [255, 200, 125, 100, 75, 50, 10]) {
      expect(evaluateShiftSpeedRawJustBelow(up12, throttle)).toBeCloseTo(
        evaluateShiftSpeedRaw(up12, throttle),
        10,
      );
    }
  });

  it("holds the last speed at throttle 0, where nothing lies below", () => {
    expect(evaluateShiftSpeedRawJustBelow(up12, 0)).toBe(14);
  });

  it("rejects a curve with no breakpoints", () => {
    expect(() => evaluateShiftSpeedRawJustBelow([], 100)).toThrow(RangeError);
  });
});
