import { describe, expect, it } from "vitest";

import { readIdleCurve } from "./idle";
import { TDE1 } from "./tde1";
import { buildTde1Image, DAILY_DRIVER_IDLE, STOCK_IDLE } from "./test-images";

describe("readIdleCurve", () => {
  it("reads the six Daily Driver points: input and rpm", () => {
    expect(readIdleCurve(buildTde1Image())).toEqual([
      { inputRaw: 32767, rpm: 680 },
      { inputRaw: 80, rpm: 680 },
      { inputRaw: 0, rpm: 1100 },
      { inputRaw: -40, rpm: 1200 },
      { inputRaw: -32768, rpm: 1200 },
      { inputRaw: -32768, rpm: 1200 },
    ]);
  });

  it("reads the six points of Power Hungry's stock 0S position", () => {
    const points = readIdleCurve(buildTde1Image({ idle: STOCK_IDLE }));
    expect(points.map((point) => [point.inputRaw, point.rpm])).toEqual(STOCK_IDLE);
  });

  it("reads rpm in quarter-rpm steps", () => {
    const image = buildTde1Image({ idle: [[0, 680.25], ...DAILY_DRIVER_IDLE.slice(1)] });
    expect(readIdleCurve(image)[0]).toEqual({ inputRaw: 0, rpm: 680.25 });
  });

  it("returns as many points as the strategy defines", () => {
    expect(readIdleCurve(buildTde1Image())).toHaveLength(TDE1.idle.pointCount);
    expect(
      readIdleCurve(buildTde1Image(), { ...TDE1, idle: { ...TDE1.idle, pointCount: 2 } }),
    ).toHaveLength(2);
  });

  it("rejects an image that is not 256 KiB", () => {
    expect(() => readIdleCurve(new Uint8Array(100))).toThrow(RangeError);
  });
});
