import { describe, expect, it } from "vitest";

import {
  idleRawToRpm,
  mphToSpeedRaw,
  rpmToIdleRaw,
  speedRawToMph,
  throttleRawToPercent,
} from "./units";

describe("shift speed units", () => {
  it("stores shift speeds in half-mph steps", () => {
    expect(speedRawToMph(54)).toBe(27);
    expect(speedRawToMph(129)).toBe(64.5);
    expect(speedRawToMph(0)).toBe(0);
  });

  it("converts mph to the nearest half-mph step", () => {
    expect(mphToSpeedRaw(27)).toBe(54);
    expect(mphToSpeedRaw(24.5)).toBe(49);
    expect(mphToSpeedRaw(24.2)).toBe(48);
    expect(mphToSpeedRaw(24.3)).toBe(49);
  });

  it("clamps the byte to 0..255, so the largest speed is 127.5 mph", () => {
    expect(mphToSpeedRaw(-5)).toBe(0);
    expect(mphToSpeedRaw(200)).toBe(255);
    expect(speedRawToMph(255)).toBe(127.5);
  });

  it("never returns negative zero", () => {
    expect(Object.is(mphToSpeedRaw(-0.1), 0)).toBe(true);
  });
});

describe("idle rpm units", () => {
  it("stores idle rpm times 4", () => {
    expect(idleRawToRpm(2720)).toBe(680);
    expect(idleRawToRpm(4400)).toBe(1100);
    expect(rpmToIdleRaw(1100)).toBe(4400);
    expect(rpmToIdleRaw(680)).toBe(2720);
  });

  it("rounds to the nearest quarter rpm", () => {
    expect(rpmToIdleRaw(700.1)).toBe(2800);
    expect(rpmToIdleRaw(700.2)).toBe(2801);
  });

  it("clamps to the unsigned 16-bit range", () => {
    expect(rpmToIdleRaw(-10)).toBe(0);
    expect(rpmToIdleRaw(100_000)).toBe(65_535);
    expect(idleRawToRpm(65_535)).toBe(16_383.75);
  });
});

describe("throttle units", () => {
  it("maps the byte 0..255 onto 0..100 percent", () => {
    expect(throttleRawToPercent(0)).toBe(0);
    expect(throttleRawToPercent(255)).toBe(100);
    expect(throttleRawToPercent(51)).toBeCloseTo(20, 10);
  });
});
