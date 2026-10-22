import { describe, expect, it } from "vitest";

import { CALIBRATION_IMAGE_SIZE } from "../image";
import { SHIFT_CURVE_IDS, TDE1 } from "./tde1";

describe("SHIFT_CURVE_IDS", () => {
  it("lists the six curve ids in the same order as the TDE1 definition", () => {
    expect(SHIFT_CURVE_IDS).toEqual(TDE1.shiftCurves.map((curve) => curve.id));
  });
});

describe("TDE1 strategy definition", () => {
  it("names the strategy and says ten breakpoints per curve", () => {
    expect(TDE1.id).toBe("TDE1");
    expect(TDE1.breakpointsPerCurve).toBe(10);
    expect(TDE1.description.length).toBeGreaterThan(0);
  });

  it("lists the six shift curves in order: three upshifts, then three downshifts", () => {
    expect(TDE1.shiftCurves.map((curve) => curve.id)).toEqual([
      "up-1-2",
      "up-2-3",
      "up-3-4",
      "down-2-1",
      "down-3-2",
      "down-4-3",
    ]);
  });

  it("puts each curve's first shift-speed byte at the offset decoded from the real tunes", () => {
    const offsets = TDE1.shiftCurves.map((curve) => curve.speedOffset);
    expect(offsets).toEqual([0x14521, 0x14579, 0x145d1, 0x145f9, 0x14621, 0x14649]);
  });

  it("labels each curve the way the README names the shifts", () => {
    expect(TDE1.shiftCurves.map((curve) => curve.label)).toEqual([
      "1→2",
      "2→3",
      "3→4 (overdrive)",
      "2→1",
      "3→2",
      "4→3 (out of overdrive)",
    ]);
  });

  it("records the gear each curve shifts from and to", () => {
    expect(TDE1.shiftCurves.map((curve) => [curve.kind, curve.fromGear, curve.toGear])).toEqual([
      ["upshift", 1, 2],
      ["upshift", 2, 3],
      ["upshift", 3, 4],
      ["downshift", 2, 1],
      ["downshift", 3, 2],
      ["downshift", 4, 3],
    ]);
  });

  it("keeps the curves apart: each curve and its terminator byte fit before the next curve", () => {
    const sorted = [...TDE1.shiftCurves].sort((a, b) => a.speedOffset - b.speedOffset);
    const bytesPerCurve = 2 * TDE1.breakpointsPerCurve + 1;
    sorted.forEach((curve, index) => {
      const next = sorted[index + 1];
      const lastByte = curve.speedOffset - 1 + bytesPerCurve - 1;
      if (next) expect(lastByte).toBeLessThan(next.speedOffset - 1);
      expect(lastByte).toBeLessThan(CALIBRATION_IMAGE_SIZE);
    });
  });

  it("defines the idle curve at 0x124a4 with warm idle in the first two points", () => {
    expect(TDE1.idle.curveOffset).toBe(0x124a4);
    expect(TDE1.idle.pointCount).toBe(6);
    expect(TDE1.idle.warmIdleOffsets).toEqual([0x124a6, 0x124aa]);
    expect(TDE1.idle.warmIdleOffsets).toEqual([
      TDE1.idle.curveOffset + 2,
      TDE1.idle.curveOffset + 4 + 2,
    ]);
  });
});
