import { describe, expect, it } from "vitest";

import {
  formatTireSize,
  parseTireSize,
  shiftPointToSpeedoMph,
  speedoMphToShiftPointRaw,
  speedometerFactor,
  STOCK_TIRE,
  TIRE_PRESETS,
  tireCompensationFactor,
  tireDiameterIn,
} from "./tire";
import type { TireSize } from "./tire";

const LT235_85R16: TireSize = { widthMm: 235, aspectRatio: 85, rimDiameterIn: 16 };
const LT265_75R16: TireSize = { widthMm: 265, aspectRatio: 75, rimDiameterIn: 16 };
const T315_75R16: TireSize = { widthMm: 315, aspectRatio: 75, rimDiameterIn: 16 };

describe("tireDiameterIn", () => {
  it("is rim + 2 x width x aspect / 100 / 25.4, in inches", () => {
    expect(tireDiameterIn(LT235_85R16).toFixed(4)).toBe("31.7283");
    expect(tireDiameterIn(LT265_75R16).toFixed(4)).toBe("31.6496");
    expect(tireDiameterIn(T315_75R16).toFixed(4)).toBe("34.6024");
  });
});

describe("parseTireSize", () => {
  it.each([
    ["LT235/85R16", LT235_85R16],
    ["315/75R16", T315_75R16],
    ["P265/70R17", { widthMm: 265, aspectRatio: 70, rimDiameterIn: 17 }],
    ["lt 235/85 r16", LT235_85R16],
    ["315/75R16 127/124Q", T315_75R16],
    ["315/75-16", T315_75R16],
    ["  LT235/85R16  ", LT235_85R16],
    ["LT265/75R16E", LT265_75R16],
    ["255/45ZR19", { widthMm: 255, aspectRatio: 45, rimDiameterIn: 19 }],
    ["ST225/75R15", { widthMm: 225, aspectRatio: 75, rimDiameterIn: 15 }],
    ["295/75R22.5", { widthMm: 295, aspectRatio: 75, rimDiameterIn: 22.5 }],
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
    "35x12.50R17",
    "0/0R0",
    "000/00R00",
    "099/75R16",
    "235/15R16",
    "235/85R05",
    "235/85R99",
  ])("rejects %j", (text) => {
    expect(parseTireSize(text)).toBeUndefined();
  });
});

describe("formatTireSize", () => {
  it("writes width/aspect R rim without a type prefix", () => {
    expect(formatTireSize(LT235_85R16)).toBe("235/85R16");
    expect(formatTireSize({ widthMm: 295, aspectRatio: 75, rimDiameterIn: 22.5 })).toBe(
      "295/75R22.5",
    );
  });

  it("round-trips through parseTireSize", () => {
    for (const tire of [LT235_85R16, LT265_75R16, T315_75R16]) {
      expect(parseTireSize(formatTireSize(tire))).toEqual(tire);
    }
  });
});

describe("tire presets", () => {
  it("uses LT235/85R16, the 1996 F-350 factory size, as the stock tire", () => {
    expect(STOCK_TIRE).toEqual(LT235_85R16);
  });

  it("lists the four sizes the editor offers, stock first", () => {
    expect(TIRE_PRESETS.map((preset) => preset.label)).toEqual([
      "LT235/85R16",
      "LT265/75R16",
      "285/75R16",
      "315/75R16",
    ]);
    expect(TIRE_PRESETS[0]?.tire).toEqual(STOCK_TIRE);
  });

  it("gives each preset a unique id and the same tire its label names", () => {
    expect(new Set(TIRE_PRESETS.map((preset) => preset.id)).size).toBe(TIRE_PRESETS.length);
    for (const preset of TIRE_PRESETS) expect(parseTireSize(preset.label)).toEqual(preset.tire);
  });

  it("explains the presets that need it", () => {
    expect(TIRE_PRESETS.map((preset) => preset.note)).toEqual([
      "1996 F-350 factory size",
      "reference size the shipped -TIRECOMP-UPDOWN tunes used",
      undefined,
      "34.6 in, this truck",
    ]);
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
  });

  it("makes the two factors reciprocals", () => {
    const product =
      speedometerFactor(T315_75R16, LT235_85R16) * tireCompensationFactor(T315_75R16, LT235_85R16);
    expect(product).toBeCloseTo(1, 12);
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
    for (const fitted of [LT235_85R16, LT265_75R16, T315_75R16]) {
      const ratio = speedometerFactor(fitted, LT235_85R16);
      for (let raw = 0; raw <= 255; raw++) {
        expect(speedoMphToShiftPointRaw(shiftPointToSpeedoMph(raw, ratio), ratio)).toBe(raw);
      }
    }
  });
});
