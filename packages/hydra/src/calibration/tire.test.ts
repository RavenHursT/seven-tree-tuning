import { describe, expect, it } from "vitest";

import {
  formatTireSize,
  parseTireSize,
  shiftPointToSpeedoMph,
  speedoMphToShiftPointRaw,
  speedometerFactor,
  STOCK_TIRE,
  TIRE_SIZE_LIMITS,
  tireCompensationFactor,
  tireDiameterIn,
  tireSizeFromParts,
  tireSizeParts,
} from "./tire";
import type { FlotationTireSize, MetricTireSize, TireSize, TireSizeParts } from "./tire";
import { TIRE_CHART } from "./tire-chart";

const LT235_85R16: MetricTireSize = {
  kind: "metric",
  widthMm: 235,
  aspectRatio: 85,
  rimDiameterIn: 16,
};
const LT265_75R16: MetricTireSize = {
  kind: "metric",
  widthMm: 265,
  aspectRatio: 75,
  rimDiameterIn: 16,
};
const T315_75R16: MetricTireSize = {
  kind: "metric",
  widthMm: 315,
  aspectRatio: 75,
  rimDiameterIn: 16,
};
const T35X12_50R17: FlotationTireSize = {
  kind: "flotation",
  diameterIn: 35,
  widthIn: 12.5,
  rimDiameterIn: 17,
};

function flotation(diameterIn: number, widthIn: number, rimDiameterIn: number): FlotationTireSize {
  return { kind: "flotation", diameterIn, widthIn, rimDiameterIn };
}

describe("tireDiameterIn", () => {
  it("is rim + 2 x width x aspect / 100 / 25.4, in inches, for a metric size", () => {
    expect(tireDiameterIn(LT235_85R16).toFixed(4)).toBe("31.7283");
    expect(tireDiameterIn(LT265_75R16).toFixed(4)).toBe("31.6496");
    expect(tireDiameterIn(T315_75R16).toFixed(4)).toBe("34.6024");
  });

  it("is the diameter the size names for a flotation size", () => {
    expect(tireDiameterIn(T35X12_50R17)).toBe(35.0);
    expect(tireDiameterIn(flotation(38.5, 14.5, 17))).toBe(38.5);
  });
});

describe("parseTireSize for a metric size", () => {
  it.each([
    ["LT235/85R16", LT235_85R16],
    ["315/75R16", T315_75R16],
    ["P265/70R17", { kind: "metric", widthMm: 265, aspectRatio: 70, rimDiameterIn: 17 }],
    ["lt 235/85 r16", LT235_85R16],
    ["315/75R16 127/124Q", T315_75R16],
    ["315/75-16", T315_75R16],
    ["  LT235/85R16  ", LT235_85R16],
    ["LT265/75R16E", LT265_75R16],
    ["255/45ZR19", { kind: "metric", widthMm: 255, aspectRatio: 45, rimDiameterIn: 19 }],
    ["ST225/75R15", { kind: "metric", widthMm: 225, aspectRatio: 75, rimDiameterIn: 15 }],
    ["295/75R22.5", { kind: "metric", widthMm: 295, aspectRatio: 75, rimDiameterIn: 22.5 }],
  ])("accepts %s", (text, expected) => {
    expect(parseTireSize(text)).toEqual(expected);
  });

  it.each([
    "",
    "   ",
    "abc",
    "315/75",
    "315/75R",
    "315/75R1",
    "15/75R16",
    "315/7R16",
    "315/75R160",
    "315/75R16.55",
    "315/75R16/5",
    "0/0R0",
    "000/00R00",
    "099/75R16",
    "235/15R16",
    "235/85R05",
    "235/85R99",
    "501/75R16",
    "999/75R16",
    "235/85R41",
  ])("rejects %j", (text) => {
    expect(parseTireSize(text)).toBeUndefined();
  });
});

describe("parseTireSize for a flotation size", () => {
  it.each([
    ["35x12.50R17", T35X12_50R17],
    ["35X12.5R17", T35X12_50R17],
    ["35x12.50-17", T35X12_50R17],
    ["35x12.50R17LT", T35X12_50R17],
    ["35x12.50R17 LT", T35X12_50R17],
    ["LT35x12.50R17", T35X12_50R17],
    ["  35 x 12.50 r 17  ", T35X12_50R17],
    ["31x11R15", flotation(31, 11, 15)],
    ["31x10.50R15", flotation(31, 10.5, 15)],
    ["38.5x14.50R17", flotation(38.5, 14.5, 17)],
    ["33x12.50R16.5", flotation(33, 12.5, 16.5)],
    ["35x12.25R17", flotation(35, 12.25, 17)],
  ])("accepts %s", (text, expected) => {
    expect(parseTireSize(text)).toEqual(expected);
  });

  it.each([
    "35x12.50",
    "35x12.50R",
    "35x12.50R1",
    "35x12.50R170",
    "35x12.50R17.55",
    "35x12.50R17.",
    "35x12.50R17/5",
    "35x12.50 17",
    "5x12.50R17",
    "350x12.50R17",
    "35x125R17",
    "35x12.555R17",
    "x12.50R17",
    "35x",
    "LTX35x12.50R17",
    "19x12.50R17",
    "61x12.50R17",
    "35x2R17",
    "35x26R17",
    "35x0R17",
    "35x12.50R07",
    "35x12.50R41",
    "00x00R00",
  ])("rejects %j", (text) => {
    expect(parseTireSize(text)).toBeUndefined();
  });

  it("does not read the inch conversion of a metric size as a flotation size", () => {
    expect(parseTireSize("315/75R16 = 34.6x12.4R16")).toEqual(T315_75R16);
  });
});

describe("TIRE_SIZE_LIMITS", () => {
  it("holds the smallest and largest value of each part of a plausible size, for each kind", () => {
    expect(TIRE_SIZE_LIMITS).toEqual({
      metric: { widthMm: [100, 500], aspectRatio: [20, 100], rimDiameterIn: [8, 40] },
      flotation: { diameterIn: [20, 60], widthIn: [3, 25], rimDiameterIn: [8, 40] },
    });
  });

  it("holds a smallest value that is below its largest value", () => {
    for (const limits of Object.values(TIRE_SIZE_LIMITS)) {
      for (const [smallest, largest] of Object.values(limits)) {
        expect(smallest).toBeLessThan(largest);
      }
    }
  });

  describe("for a metric size", () => {
    it("lets parseTireSize accept a width at either limit and reject one just outside", () => {
      const [smallest, largest] = TIRE_SIZE_LIMITS.metric.widthMm;
      expect(parseTireSize(`${smallest}/75R16`)).toMatchObject({ widthMm: smallest });
      expect(parseTireSize(`${largest}/75R16`)).toMatchObject({ widthMm: largest });
      expect(parseTireSize(`${smallest - 1}/75R16`)).toBeUndefined();
      expect(parseTireSize(`${largest + 1}/75R16`)).toBeUndefined();
    });

    it("lets parseTireSize accept an aspect ratio at the lower limit and reject one just below", () => {
      const [smallest, largest] = TIRE_SIZE_LIMITS.metric.aspectRatio;
      expect(parseTireSize(`235/${smallest}R16`)).toMatchObject({ aspectRatio: smallest });
      expect(parseTireSize(`235/${smallest - 1}R16`)).toBeUndefined();
      // The pattern reads two digits, so 99 is the largest aspect ratio it can see, under the limit.
      expect(largest).toBeGreaterThanOrEqual(99);
      expect(parseTireSize("235/99R16")).toMatchObject({ aspectRatio: 99 });
    });

    it("lets parseTireSize accept a rim at either limit and reject one just outside", () => {
      const [smallest, largest] = TIRE_SIZE_LIMITS.metric.rimDiameterIn;
      const rim = (inches: number) => `235/85R${String(inches).padStart(2, "0")}`;
      expect(parseTireSize(rim(smallest))).toMatchObject({ rimDiameterIn: smallest });
      expect(parseTireSize(rim(largest))).toMatchObject({ rimDiameterIn: largest });
      expect(parseTireSize(rim(smallest - 1))).toBeUndefined();
      expect(parseTireSize(rim(largest + 1))).toBeUndefined();
      expect(parseTireSize(`${rim(smallest)}.5`)).toMatchObject({ rimDiameterIn: smallest + 0.5 });
      expect(parseTireSize(`${rim(largest)}.5`)).toBeUndefined();
    });
  });

  describe("for a flotation size", () => {
    it("lets parseTireSize accept a diameter at either limit and reject one just outside", () => {
      const [smallest, largest] = TIRE_SIZE_LIMITS.flotation.diameterIn;
      expect(parseTireSize(`${smallest}x12.50R17`)).toMatchObject({ diameterIn: smallest });
      expect(parseTireSize(`${largest}x12.50R17`)).toMatchObject({ diameterIn: largest });
      expect(parseTireSize(`${smallest - 1}x12.50R17`)).toBeUndefined();
      expect(parseTireSize(`${largest + 1}x12.50R17`)).toBeUndefined();
      expect(parseTireSize(`${largest}.5x12.50R17`)).toBeUndefined();
    });

    it("lets parseTireSize accept a width at either limit and reject one just outside", () => {
      const [smallest, largest] = TIRE_SIZE_LIMITS.flotation.widthIn;
      expect(parseTireSize(`35x${smallest}R17`)).toMatchObject({ widthIn: smallest });
      expect(parseTireSize(`35x${largest}R17`)).toMatchObject({ widthIn: largest });
      expect(parseTireSize(`35x${smallest - 1}R17`)).toBeUndefined();
      expect(parseTireSize(`35x${largest + 1}R17`)).toBeUndefined();
      expect(parseTireSize(`35x${largest}.5R17`)).toBeUndefined();
    });

    it("lets parseTireSize accept a rim at either limit and reject one just outside", () => {
      const [smallest, largest] = TIRE_SIZE_LIMITS.flotation.rimDiameterIn;
      const rim = (inches: number) => `35x12.50R${String(inches).padStart(2, "0")}`;
      expect(parseTireSize(rim(smallest))).toMatchObject({ rimDiameterIn: smallest });
      expect(parseTireSize(rim(largest))).toMatchObject({ rimDiameterIn: largest });
      expect(parseTireSize(rim(smallest - 1))).toBeUndefined();
      expect(parseTireSize(rim(largest + 1))).toBeUndefined();
      expect(parseTireSize(`${rim(smallest)}.5`)).toMatchObject({ rimDiameterIn: smallest + 0.5 });
      expect(parseTireSize(`${rim(largest)}.5`)).toBeUndefined();
    });
  });
});

describe("formatTireSize", () => {
  it("writes width/aspect R rim for a metric size, without a type prefix", () => {
    expect(formatTireSize(LT235_85R16)).toBe("235/85R16");
    expect(formatTireSize(T315_75R16)).toBe("315/75R16");
    expect(
      formatTireSize({ kind: "metric", widthMm: 295, aspectRatio: 75, rimDiameterIn: 22.5 }),
    ).toBe("295/75R22.5");
  });

  it("writes diameter x width R rim for a flotation size, with two decimals for a fractional width", () => {
    expect(formatTireSize(T35X12_50R17)).toBe("35x12.50R17");
    expect(formatTireSize(flotation(31, 10.5, 15))).toBe("31x10.50R15");
    expect(formatTireSize(flotation(33, 9.5, 16.5))).toBe("33x9.50R16.5");
    expect(formatTireSize(flotation(35, 12.25, 17))).toBe("35x12.25R17");
  });

  it("writes a whole width as an integer, and the diameter as it is", () => {
    expect(formatTireSize(flotation(31, 11, 15))).toBe("31x11R15");
    expect(formatTireSize(flotation(38.5, 14.5, 17))).toBe("38.5x14.50R17");
    expect(formatTireSize(flotation(37, 13, 20))).toBe("37x13R20");
  });

  it("round-trips through parseTireSize for both kinds", () => {
    const sizes: readonly TireSize[] = [
      LT235_85R16,
      LT265_75R16,
      T315_75R16,
      { kind: "metric", widthMm: 295, aspectRatio: 75, rimDiameterIn: 22.5 },
      T35X12_50R17,
      flotation(31, 11, 15),
      flotation(38.5, 14.5, 17),
      flotation(33, 9.5, 16.5),
    ];
    for (const tire of sizes) {
      expect(parseTireSize(formatTireSize(tire))).toEqual(tire);
    }
  });

  it("round-trips the text a person types back to the same text", () => {
    for (const text of ["315/75R16", "35x12.50R17", "31x11R15", "38.5x14.50R17"]) {
      expect(formatTireSize(parseTireSize(text) as TireSize)).toBe(text);
    }
  });
});

describe("tireSizeParts", () => {
  it("gives a metric size as its width in mm, its aspect ratio as the height, and its rim", () => {
    expect(tireSizeParts(T315_75R16)).toEqual({ width: "315", height: "75", rim: "16" });
  });

  it("gives a flotation size as its width in inches, its overall diameter as the height, and its rim", () => {
    expect(tireSizeParts(T35X12_50R17)).toEqual({ width: "12.50", height: "35", rim: "17" });
  });

  it("writes the width the way formatTireSize does, and keeps half inches", () => {
    expect(tireSizeParts(flotation(31, 11, 15))).toEqual({ width: "11", height: "31", rim: "15" });
    expect(tireSizeParts(flotation(38.5, 14.5, 16.5))).toEqual({
      width: "14.50",
      height: "38.5",
      rim: "16.5",
    });
  });
});

describe("tireSizeFromParts", () => {
  it("reads a width of 100 or more as millimetres, so the size is metric", () => {
    expect(tireSizeFromParts({ width: "315", height: "75", rim: "16" })).toEqual(T315_75R16);
  });

  it("reads a smaller width as inches, so the size is flotation and the height is its diameter", () => {
    expect(tireSizeFromParts({ width: "12.50", height: "35", rim: "17" })).toEqual(T35X12_50R17);
  });

  it("accepts spaces around a part, a width without its last zero, and a trailing point", () => {
    expect(tireSizeFromParts({ width: " 12.5 ", height: "35.", rim: "17 " })).toEqual(T35X12_50R17);
  });

  it.each<[string, TireSizeParts]>([
    ["an empty part", { width: "", height: "75", rim: "16" }],
    ["a part that is not a number", { width: "315", height: "7a", rim: "16" }],
    ["a negative part", { width: "315", height: "-75", rim: "16" }],
    ["a number in exponent form", { width: "1e3", height: "75", rim: "16" }],
    ["a metric aspect ratio above the largest", { width: "315", height: "175", rim: "16" }],
    ["a flotation diameter below the smallest", { width: "12.50", height: "15", rim: "17" }],
    [
      "a width too wide for inches and too narrow for millimetres",
      { width: "50", height: "75", rim: "16" },
    ],
    ["a rim above the largest", { width: "315", height: "75", rim: "60" }],
  ])("returns undefined for %s", (_case, parts) => {
    expect(tireSizeFromParts(parts)).toBeUndefined();
  });

  it("reads every size in the tire chart back from its parts", () => {
    for (const entry of TIRE_CHART) {
      expect(tireSizeFromParts(tireSizeParts(entry.tire)), entry.label).toEqual(entry.tire);
    }
  });
});

describe("STOCK_TIRE", () => {
  it("is LT235/85R16, the 1996 F-350 factory size, as a metric size", () => {
    expect(STOCK_TIRE).toEqual(LT235_85R16);
    expect(STOCK_TIRE.kind).toBe("metric");
  });
});

describe("tire factors", () => {
  it("compensation factor for 315/75R16 against LT265/75R16 is the 0.9147 the tunes use", () => {
    const factor = tireCompensationFactor(T315_75R16, LT265_75R16);
    expect(factor.toFixed(4)).toBe("0.9147");
    expect(factor).toBeCloseTo(0.914666, 6);
  });

  it("speedometer factor for 315/75R16 against LT235/85R16 is about 1.0906", () => {
    expect(speedometerFactor(T315_75R16, LT235_85R16)).toBeCloseTo(1.0906, 4);
  });

  it("is the larger tire's diameter over the smaller one's for the speedometer", () => {
    expect(speedometerFactor(T315_75R16, LT235_85R16)).toBe(
      tireDiameterIn(T315_75R16) / tireDiameterIn(LT235_85R16),
    );
    expect(tireCompensationFactor(T315_75R16, LT235_85R16)).toBe(
      tireDiameterIn(LT235_85R16) / tireDiameterIn(T315_75R16),
    );
  });

  it("is 1 when the fitted and calibration tires are the same", () => {
    expect(speedometerFactor(LT235_85R16, LT235_85R16)).toBe(1);
    expect(tireCompensationFactor(T315_75R16, T315_75R16)).toBe(1);
    expect(speedometerFactor(T35X12_50R17, T35X12_50R17)).toBe(1);
  });

  it("makes the two factors reciprocals", () => {
    const product =
      speedometerFactor(T315_75R16, LT235_85R16) * tireCompensationFactor(T315_75R16, LT235_85R16);
    expect(product).toBeCloseTo(1, 12);
  });

  it("compares a flotation size with a metric size by their overall diameters", () => {
    expect(speedometerFactor(T35X12_50R17, LT235_85R16)).toBeCloseTo(35 / 31.7283, 4);
    expect(speedometerFactor(T35X12_50R17, LT235_85R16)).toBe(35 / tireDiameterIn(LT235_85R16));
    expect(tireCompensationFactor(T35X12_50R17, LT235_85R16)).toBe(
      tireDiameterIn(LT235_85R16) / 35,
    );
    expect(speedometerFactor(LT235_85R16, T35X12_50R17)).toBeCloseTo(31.7283 / 35, 4);
  });

  it("compares two flotation sizes by the diameters they name", () => {
    expect(speedometerFactor(flotation(37, 12.5, 17), T35X12_50R17)).toBe(37 / 35);
  });
});

describe("shift point and speedometer mph", () => {
  const factor = speedometerFactor(T315_75R16, LT235_85R16);

  it("shows a stored shift speed as the speedometer mph on the fitted tires", () => {
    expect(shiftPointToSpeedoMph(129, 1)).toBe(64.5);
    expect(shiftPointToSpeedoMph(129, factor)).toBeCloseTo(64.5 * factor, 10);
    expect(shiftPointToSpeedoMph(129, factor)).toBeCloseTo(70.34, 2);
  });

  it("stores a wanted speedometer mph as the nearest shift speed byte", () => {
    expect(speedoMphToShiftPointRaw(70.34, factor)).toBe(129);
    expect(speedoMphToShiftPointRaw(64.5, 1)).toBe(129);
  });

  it("clamps the stored byte to 0..255", () => {
    expect(speedoMphToShiftPointRaw(500, factor)).toBe(255);
    expect(speedoMphToShiftPointRaw(-3, factor)).toBe(0);
  });

  it("returns the same byte after converting to speedometer mph and back, for every byte", () => {
    for (const fitted of [LT235_85R16, LT265_75R16, T315_75R16, T35X12_50R17]) {
      const ratio = speedometerFactor(fitted, LT235_85R16);
      for (let raw = 0; raw <= 255; raw++) {
        expect(speedoMphToShiftPointRaw(shiftPointToSpeedoMph(raw, ratio), ratio)).toBe(raw);
      }
    }
  });
});
