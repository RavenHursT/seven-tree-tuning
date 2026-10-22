import { describe, expect, it } from "vitest";

import {
  assertOnlyEditableChanges,
  changedOffsets,
  editableOffsets,
  UnexpectedImageChangeError,
} from "./edit-guard";
import { TDE1 } from "./tde1";
import { buildTde1Image } from "./test-images";

describe("editableOffsets", () => {
  const editable = editableOffsets();

  it("holds 64 offsets: 60 shift-speed bytes and 4 warm-idle bytes", () => {
    expect(editable.size).toBe(64);
  });

  it("holds every shift-speed byte of every curve, padding included", () => {
    for (const definition of TDE1.shiftCurves) {
      for (let index = 0; index < TDE1.breakpointsPerCurve; index++) {
        expect(editable.has(definition.speedOffset + 2 * index)).toBe(true);
      }
    }
  });

  it("holds both bytes of both warm-idle values", () => {
    const [first, second] = TDE1.idle.warmIdleOffsets;
    expect([first, first + 1, second, second + 1].every((offset) => editable.has(offset))).toBe(
      true,
    );
  });

  it("leaves out throttle bytes, terminator bytes and idle inputs", () => {
    const first = TDE1.shiftCurves[0];
    if (!first) throw new Error("missing definition");
    expect(editable.has(first.speedOffset - 1)).toBe(false);
    expect(editable.has(first.speedOffset + 1)).toBe(false);
    expect(editable.has(first.speedOffset + 19)).toBe(false);
    expect(editable.has(TDE1.idle.curveOffset)).toBe(false);
    expect(editable.has(TDE1.idle.warmIdleOffsets[0] + 2)).toBe(false);
  });
});

describe("changedOffsets", () => {
  it("lists nothing for identical images", () => {
    expect(changedOffsets(buildTde1Image(), buildTde1Image())).toEqual([]);
  });

  it("lists every differing offset in ascending order", () => {
    const base = buildTde1Image();
    const edited = new Uint8Array(base);
    for (const offset of [300, 5, 262_143]) edited[offset] = (edited[offset] ?? 0) ^ 0xff;
    expect(changedOffsets(base, edited)).toEqual([5, 300, 262_143]);
  });

  it("rejects images of different sizes", () => {
    expect(() => changedOffsets(new Uint8Array(4), new Uint8Array(5))).toThrow(RangeError);
  });
});

describe("assertOnlyEditableChanges", () => {
  it("accepts an edit of every editable byte", () => {
    const base = buildTde1Image();
    const edited = new Uint8Array(base);
    for (const offset of editableOffsets()) edited[offset] = (edited[offset] ?? 0) ^ 0xff;
    expect(() => assertOnlyEditableChanges(base, edited)).not.toThrow();
  });

  it("accepts identical images", () => {
    expect(() => assertOnlyEditableChanges(buildTde1Image(), buildTde1Image())).not.toThrow();
  });

  it("throws UnexpectedImageChangeError listing the offset of any other changed byte", () => {
    const base = buildTde1Image();
    const edited = new Uint8Array(base);
    const throttleOffset = (TDE1.shiftCurves[0]?.speedOffset ?? 0) - 1;
    edited[throttleOffset] = (edited[throttleOffset] ?? 0) ^ 0x01;
    let caught: unknown;
    try {
      assertOnlyEditableChanges(base, edited);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnexpectedImageChangeError);
    const error = caught as UnexpectedImageChangeError;
    expect(error.name).toBe("UnexpectedImageChangeError");
    expect(error.offsets).toEqual([throttleOffset]);
    expect(error.message).toContain("0x14520");
  });

  it("lists only the changes outside the editable bytes", () => {
    const base = buildTde1Image();
    const edited = new Uint8Array(base);
    const speedOffset = TDE1.shiftCurves[0]?.speedOffset ?? 0;
    edited[speedOffset] = (edited[speedOffset] ?? 0) ^ 0xff;
    edited[10] = (edited[10] ?? 0) ^ 0xff;
    expect(() => assertOnlyEditableChanges(base, edited)).toThrowError(
      expect.objectContaining({ offsets: [10] }),
    );
  });

  it("names the first eight offsets and counts the rest", () => {
    const base = buildTde1Image();
    const edited = new Uint8Array(base);
    for (let offset = 0; offset < 11; offset++) edited[offset] = (edited[offset] ?? 0) ^ 0xff;
    let message = "";
    try {
      assertOnlyEditableChanges(base, edited);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("0x00007");
    expect(message).not.toContain("0x00008");
    expect(message).toContain("3 more");
  });
});
