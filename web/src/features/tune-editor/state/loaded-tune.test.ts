import { UnsupportedCalibrationError } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import { createLoadedTune } from "./loaded-tune";

const source = {
  kind: "upload",
  fileName: "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf",
  format: "hcf",
} as const;

describe("createLoadedTune", () => {
  it("reads the six curves, the editable values and the idle curve from a TDE1 image", () => {
    const tune = createLoadedTune(buildTde1Image(), source);

    expect(tune.source).toEqual(source);
    expect(tune.curves.map((curve) => curve.definition.id)).toEqual([
      "up-1-2",
      "up-2-3",
      "up-3-4",
      "down-2-1",
      "down-3-2",
      "down-4-3",
    ]);
    expect(tune.originalValues.shiftSpeedsRaw["up-3-4"]).toEqual([
      0x81, 0x81, 0x78, 0x71, 0x4f, 0x4c, 0x4c, 0x4c, 0x4c, 0x4c,
    ]);
    expect(tune.originalValues.warmIdleRaw).toEqual([2720, 2720]);
    expect(tune.idleCurve[0]).toEqual({ inputRaw: 32767, rpm: 680 });
  });

  it("keeps its own copy of the image, so later changes to the input cannot leak in", () => {
    const image = buildTde1Image();
    const tune = createLoadedTune(image, source);

    image[0x14521] = 0;

    expect(tune.image[0x14521]).toBe(0x36);
  });

  it("refuses an image with a broken lockup function, in words the user can read", () => {
    const image = buildTde1Image();
    image[0x1468c] = 0xfe;

    expect(() => createLoadedTune(image, source)).toThrow(UnsupportedCalibrationError);
    expect(() => createLoadedTune(image, source)).toThrow(
      "This file does not have the TDE1 layout the editor works on. 2nd gear lock: the first pedal value is 254, not 255.",
    );
  });

  it("refuses an image with a broken line-pressure function", () => {
    const image = buildTde1Image();
    image[0x14844] = 0x10;

    expect(() => createLoadedTune(image, source)).toThrow(
      /^This file does not have the TDE1 layout the editor works on\. 2→3 line pressure: the first pedal value is 16, not 255\./,
    );
  });

  it("refuses an image with a broken grid axis function", () => {
    const image = buildTde1Image();
    image[0x120a0] = 0x00;

    expect(() => createLoadedTune(image, source)).toThrow(UnsupportedCalibrationError);
    expect(() => createLoadedTune(image, source)).toThrow(
      "This file does not have the TDE1 layout the editor works on. Maximum fuel, columns (Engine speed): the first value is 65280, not 65535.",
    );
  });

  it("rejects an image without the TDE1 shift-curve layout", () => {
    expect(() => createLoadedTune(new Uint8Array(262_144), source)).toThrow(
      UnsupportedCalibrationError,
    );
  });
});
