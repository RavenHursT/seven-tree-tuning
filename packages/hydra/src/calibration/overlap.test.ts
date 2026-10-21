import { describe, expect, it } from "vitest";

import { findShiftOverlaps } from "./overlap";
import { readShiftCurves } from "./shift-curve";
import type { ShiftCurve } from "./shift-curve";
import { TDE1 } from "./tde1";
import type { ShiftCurveId } from "./tde1";
import { buildTde1Image } from "./test-images";
import { readTuneValues, scaleShiftSpeeds } from "./tune-values";
import type { TuneValues } from "./tune-values";

const image = buildTde1Image();
const curves = readShiftCurves(image);
const base = readTuneValues(image);

/** Scales the three upshift curves only, the way the removed upshift-only tire-comp tunes did. */
function upshiftsOnlyScaled(factor: number): TuneValues {
  const scaled = scaleShiftSpeeds(base, factor).shiftSpeedsRaw;
  return {
    ...base,
    shiftSpeedsRaw: {
      ...scaled,
      "down-2-1": base.shiftSpeedsRaw["down-2-1"],
      "down-3-2": base.shiftSpeedsRaw["down-3-2"],
      "down-4-3": base.shiftSpeedsRaw["down-4-3"],
    },
  };
}

function makeCurve(id: ShiftCurveId, throttles: readonly number[]): ShiftCurve {
  const definition = TDE1.shiftCurves.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`no definition for ${id}`);
  const breakpoints = throttles.map((throttleRaw, index) => ({ index, throttleRaw, speedRaw: 0 }));
  return { definition, breakpoints };
}

function valuesWith(speeds: Partial<Record<ShiftCurveId, readonly number[]>>): TuneValues {
  return { ...base, shiftSpeedsRaw: { ...base.shiftSpeedsRaw, ...speeds } };
}

const FLAT_AXIS = [255, 0, 0, 0, 0, 0, 0, 0, 0, 0];

describe("findShiftOverlaps on the Daily Driver tune", () => {
  it("finds none in the tune as shipped", () => {
    expect(findShiftOverlaps(curves, base)).toEqual([]);
  });

  it("finds none when the upshifts and downshifts are scaled together by 0.9147", () => {
    expect(findShiftOverlaps(curves, scaleShiftSpeeds(base, 0.9147))).toEqual([]);
  });

  it("finds the overlaps that made the transmission hunt when only the upshifts are scaled", () => {
    expect(findShiftOverlaps(curves, upshiftsOnlyScaled(0.9147))).toEqual([
      {
        upshift: "up-2-3",
        downshift: "down-3-2",
        lowerGear: 2,
        upperGear: 3,
        throttleFromRaw: 0,
        throttleToRaw: 50,
        worstMarginMph: -1,
      },
      {
        upshift: "up-3-4",
        downshift: "down-4-3",
        lowerGear: 3,
        upperGear: 4,
        throttleFromRaw: 0,
        throttleToRaw: 81,
        worstMarginMph: -1,
      },
      {
        upshift: "up-3-4",
        downshift: "down-4-3",
        lowerGear: 3,
        upperGear: 4,
        throttleFromRaw: 192,
        throttleToRaw: 255,
        worstMarginMph: -4,
      },
    ]);
  });

  it("includes closed throttle and wide-open throttle in the 3→4 overlaps, worst margin -4 mph", () => {
    const found = findShiftOverlaps(curves, upshiftsOnlyScaled(0.9147)).filter(
      (overlap) => overlap.upshift === "up-3-4",
    );
    expect(found.some((overlap) => overlap.throttleFromRaw === 0)).toBe(true);
    expect(found.some((overlap) => overlap.throttleToRaw === 255)).toBe(true);
    expect(Math.min(...found.map((overlap) => overlap.worstMarginMph))).toBe(-4);
  });

  it("includes closed throttle in the 2→3 overlap", () => {
    const found = findShiftOverlaps(curves, upshiftsOnlyScaled(0.9147)).filter(
      (overlap) => overlap.upshift === "up-2-3",
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.throttleFromRaw).toBe(0);
  });

  it("takes the speeds from the values and only the throttle axes from the curves", () => {
    const withoutSpeeds = curves.map((curve) => ({
      ...curve,
      breakpoints: curve.breakpoints.map((point) => ({ ...point, speedRaw: 0 })),
    }));
    expect(findShiftOverlaps(withoutSpeeds, upshiftsOnlyScaled(0.9147))).toEqual(
      findShiftOverlaps(curves, upshiftsOnlyScaled(0.9147)),
    );
  });
});

describe("findShiftOverlaps on built curves", () => {
  it("counts a margin of exactly zero as an overlap", () => {
    const flat = Array(10).fill(40);
    const overlaps = findShiftOverlaps(
      [makeCurve("up-1-2", FLAT_AXIS), makeCurve("down-2-1", FLAT_AXIS)],
      valuesWith({ "up-1-2": flat, "down-2-1": flat }),
    );
    expect(overlaps).toEqual([
      {
        upshift: "up-1-2",
        downshift: "down-2-1",
        lowerGear: 1,
        upperGear: 2,
        throttleFromRaw: 0,
        throttleToRaw: 255,
        worstMarginMph: 0,
      },
    ]);
  });

  it("does not report a pair whose upshift stays above its downshift", () => {
    const overlaps = findShiftOverlaps(
      [makeCurve("up-1-2", FLAT_AXIS), makeCurve("down-2-1", FLAT_AXIS)],
      valuesWith({ "up-1-2": Array(10).fill(41), "down-2-1": Array(10).fill(40) }),
    );
    expect(overlaps).toEqual([]);
  });

  it("does not let a step hide an overlap that exists just below the step", () => {
    const stepAxis = [255, 100, 100, 99, 0, 0, 0, 0, 0, 0];
    const upSpeeds = [100, 100, 30, 100, 100, 100, 100, 100, 100, 100];
    const overlaps = findShiftOverlaps(
      [makeCurve("up-1-2", stepAxis), makeCurve("down-2-1", FLAT_AXIS)],
      valuesWith({ "up-1-2": upSpeeds, "down-2-1": Array(10).fill(50) }),
    );
    expect(overlaps).toEqual([
      {
        upshift: "up-1-2",
        downshift: "down-2-1",
        lowerGear: 1,
        upperGear: 2,
        throttleFromRaw: 100,
        throttleToRaw: 100,
        worstMarginMph: -10,
      },
    ]);
  });

  it("skips an upshift whose downshift is not in the list of curves", () => {
    const flat = Array(10).fill(40);
    const overlaps = findShiftOverlaps(
      [makeCurve("up-1-2", FLAT_AXIS)],
      valuesWith({ "up-1-2": flat, "down-2-1": flat }),
    );
    expect(overlaps).toEqual([]);
  });

  it("reads each curve on its own throttle axis", () => {
    const upAxis = [255, 100, 0, 0, 0, 0, 0, 0, 0, 0];
    const overlaps = findShiftOverlaps(
      [makeCurve("up-1-2", upAxis), makeCurve("down-2-1", FLAT_AXIS)],
      valuesWith({
        "up-1-2": [60, 20, 20, 20, 20, 20, 20, 20, 20, 20],
        "down-2-1": Array(10).fill(40),
      }),
    );
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.throttleFromRaw).toBe(0);
    expect(overlaps[0]?.throttleToRaw).toBe(177);
    expect(overlaps[0]?.worstMarginMph).toBe(-10);
  });
});
