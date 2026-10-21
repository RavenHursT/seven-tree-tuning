import { describe, expect, it } from "vitest";

import { assertCalibrationImage, CALIBRATION_IMAGE_SIZE } from "./image";

describe("calibration image size", () => {
  it("is 256 KiB, the size HydraFlash's FormatCalibration produces", () => {
    expect(CALIBRATION_IMAGE_SIZE).toBe(262_144);
  });

  it("accepts an image of exactly 256 KiB", () => {
    expect(() => assertCalibrationImage(new Uint8Array(262_144))).not.toThrow();
  });

  it("rejects an image of any other size and names both sizes", () => {
    expect(() => assertCalibrationImage(new Uint8Array(229_384))).toThrow(
      "expected a 262144-byte calibration image, got 229384 bytes",
    );
  });
});
