import { describe, expect, it } from "vitest";

import { CALIBRATION_IMAGE_SIZE } from "../image";
import {
  assertSupportedLayout,
  findCalibrationIssues,
  findLayoutIssues,
  UnsupportedCalibrationError,
  type LayoutIssue,
} from "./layout";
import { TDE1 } from "./tde1";
import type { ShiftCurveId } from "./tde1";
import { buildTde1Image } from "./test-images";

function definitionOf(id: ShiftCurveId) {
  const definition = TDE1.shiftCurves.find((curve) => curve.id === id);
  if (!definition) throw new Error(`no definition for ${id}`);
  return definition;
}

/** Throttle byte of breakpoint `index` of curve `id`. */
function throttleOffset(id: ShiftCurveId, index: number): number {
  return definitionOf(id).speedOffset - 1 + 2 * index;
}

function terminatorOffset(id: ShiftCurveId): number {
  return definitionOf(id).speedOffset + 19;
}

function issuesFor(issues: readonly LayoutIssue[], id: ShiftCurveId): LayoutIssue[] {
  return issues.filter((issue) => issue.curveId === id);
}

describe("findLayoutIssues", () => {
  it("finds nothing in an image with the TDE1 shift-curve layout", () => {
    expect(findLayoutIssues(buildTde1Image())).toEqual([]);
  });

  it("reports a wrong image size once, with both sizes, and checks nothing else", () => {
    const issues = findLayoutIssues(new Uint8Array(229_384));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.curveId).toBeUndefined();
    expect(issues[0]?.message).toContain(String(CALIBRATION_IMAGE_SIZE));
    expect(issues[0]?.message).toContain("229384");
  });

  it("reports a first throttle that is not 255", () => {
    const image = buildTde1Image();
    image[throttleOffset("up-1-2", 0)] = 0xfe;
    const issues = findLayoutIssues(image);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.curveId).toBe("up-1-2");
    expect(issues[0]?.message).toContain("first throttle");
    expect(issues[0]?.message).toContain("254");
  });

  it("reports a throttle axis that increases", () => {
    const image = buildTde1Image();
    image[throttleOffset("up-2-3", 2)] = 200;
    const issues = findLayoutIssues(image);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.curveId).toBe("up-2-3");
    expect(issues[0]?.message).toContain("go up");
    expect(issues[0]?.message).toContain("168");
    expect(issues[0]?.message).toContain("200");
  });

  it("accepts a repeated throttle value, which is a step", () => {
    const issues = findLayoutIssues(buildTde1Image());
    expect(issuesFor(issues, "up-1-2")).toEqual([]);
  });

  it("reports a last throttle that is not 0", () => {
    const image = buildTde1Image();
    [45, 40, 30, 20, 10].forEach((value, offset) => {
      image[throttleOffset("down-3-2", 5 + offset)] = value;
    });
    const issues = findLayoutIssues(image);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.curveId).toBe("down-3-2");
    expect(issues[0]?.message).toContain("last throttle");
    expect(issues[0]?.message).toContain("10");
  });

  it("reports a terminator byte that is not 0xFF", () => {
    const image = buildTde1Image();
    image[terminatorOffset("up-3-4")] = 0x00;
    const issues = findLayoutIssues(image);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.curveId).toBe("up-3-4");
    expect(issues[0]?.message).toContain("0xFF");
    expect(issues[0]?.message).toContain("0x00");
  });

  it("reports each broken curve separately", () => {
    const image = buildTde1Image();
    image[terminatorOffset("up-1-2")] = 0x12;
    image[terminatorOffset("down-4-3")] = 0x34;
    const issues = findLayoutIssues(image);
    expect(issues.map((issue) => issue.curveId)).toEqual(["up-1-2", "down-4-3"]);
  });

  it("reports an all-zero image: a bad first throttle and a bad terminator on every curve", () => {
    const issues = findLayoutIssues(new Uint8Array(CALIBRATION_IMAGE_SIZE));
    expect(issues).toHaveLength(12);
    for (const definition of TDE1.shiftCurves) {
      const own = issuesFor(issues, definition.id);
      expect(own).toHaveLength(2);
      expect(own.some((issue) => issue.message.includes("first throttle"))).toBe(true);
      expect(own.some((issue) => issue.message.includes("0xFF"))).toBe(true);
    }
  });

  it("starts each curve message with the shift it is about", () => {
    const image = buildTde1Image();
    image[terminatorOffset("up-3-4")] = 0x00;
    expect(findLayoutIssues(image)[0]?.message.startsWith("3→4 (overdrive)")).toBe(true);
  });
});

describe("assertSupportedLayout", () => {
  it("accepts an image with the TDE1 shift-curve layout", () => {
    expect(() => assertSupportedLayout(buildTde1Image())).not.toThrow();
  });

  it("throws UnsupportedCalibrationError with the issues for any other file", () => {
    const image = new Uint8Array(CALIBRATION_IMAGE_SIZE);
    let caught: unknown;
    try {
      assertSupportedLayout(image);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnsupportedCalibrationError);
    expect(caught).toBeInstanceOf(Error);
    const error = caught as UnsupportedCalibrationError;
    expect(error.name).toBe("UnsupportedCalibrationError");
    expect(error.message).toMatch(
      /^This file does not have the TDE1 layout the editor works on\. 1→2 shift: /,
    );
    expect(error.issues).toEqual(findCalibrationIssues(image));
  });

  it("throws UnsupportedCalibrationError, not RangeError, for a wrong image size", () => {
    expect(() => assertSupportedLayout(new Uint8Array(10))).toThrow(UnsupportedCalibrationError);
  });
});

describe("findCalibrationIssues", () => {
  it("finds nothing in a well-formed image", () => {
    expect(findCalibrationIssues(buildTde1Image())).toEqual([]);
  });

  it("reports a broken shift curve, as findLayoutIssues does", () => {
    const image = buildTde1Image();
    image[terminatorOffset("up-3-4")] = 0x00;
    expect(findCalibrationIssues(image)).toEqual(findLayoutIssues(image));
  });

  it("reports a broken lockup function", () => {
    const image = buildTde1Image();
    image[0x1468c] = 0xfe;
    expect(findCalibrationIssues(image).map((issue) => issue.message)).toEqual([
      "2nd gear lock: the first pedal value is 254, not 255.",
    ]);
  });

  it("reports a broken line-pressure function", () => {
    const image = buildTde1Image();
    image[0x14828] = 0x00;
    expect(findCalibrationIssues(image).map((issue) => issue.message)).toEqual([
      "1→2 line pressure: the first pedal value is 0, not 255.",
    ]);
  });

  it("reports a broken grid axis function", () => {
    const image = buildTde1Image();
    image[0x120a0] = 0x00;
    expect(findCalibrationIssues(image).map((issue) => issue.message)).toEqual([
      "Maximum fuel, columns (Engine speed): the first value is 65280, not 65535.",
    ]);
  });

  it("gives one issue for an image that is not 256 KiB", () => {
    expect(findCalibrationIssues(new Uint8Array(10))).toHaveLength(1);
  });
});

describe("assertSupportedLayout with other parts of the calibration", () => {
  it("refuses an image whose lockup function is broken, with a plain message", () => {
    const image = buildTde1Image();
    image[0x1468c] = 0xfe;
    expect(() => assertSupportedLayout(image)).toThrow(
      "This file does not have the TDE1 layout the editor works on. 2nd gear lock: the first pedal value is 254, not 255.",
    );
  });

  it("names the first problem and counts the others", () => {
    const image = buildTde1Image();
    image[0x120a0] = 0x00;
    image[0x1468c] = 0xfe;
    expect(() => assertSupportedLayout(image)).toThrow(
      "This file does not have the TDE1 layout the editor works on. 2nd gear lock: the first pedal value is 254, not 255. There is 1 more problem.",
    );
  });
});
