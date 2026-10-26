import { describe, expect, it } from "vitest";

import {
  assertOnlyEditableChanges,
  changedOffsets,
  editableOffsets,
  UnexpectedImageChangeError,
} from "./edit-guard";
import { gridCellOffset } from "./grid";
import { TDE1 } from "./tde1";
import { buildTde1Image } from "./test-images";

describe("editableOffsets", () => {
  const editable = editableOffsets();

  it("holds 2818 offsets: 60 shift-speed, 4 warm-idle, 48 lockup, 30 line-pressure and 2676 grid bytes", () => {
    expect(editable.size).toBe(60 + 4 + 48 + 30 + 2676);
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

describe("editableOffsets: lockup, line-pressure and grid bytes", () => {
  const editable = editableOffsets();

  it("holds the y byte of every pair of every lockup and line-pressure function, padding included", () => {
    for (const definition of [...TDE1.lockupFunctions, ...TDE1.epcFunctions]) {
      for (let index = 0; index < definition.pairCount; index++) {
        expect(editable.has(definition.address + 2 * index + 1)).toBe(true);
      }
    }
  });

  it("leaves out every pedal byte, the lock adjust functions and the unused zero functions", () => {
    for (const definition of [...TDE1.lockupFunctions, ...TDE1.epcFunctions]) {
      for (let index = 0; index < definition.pairCount; index++) {
        expect(editable.has(definition.address + 2 * index)).toBe(false);
      }
    }
    for (const unused of [0x146bc, 0x146d0, 0x146e4, 0x1471c, 0x14820, 0x1483c, 0x14858]) {
      expect(editable.has(unused)).toBe(false);
      expect(editable.has(unused + 1)).toBe(false);
    }
  });

  it("holds every byte of every exposed grid cell", () => {
    for (const definition of TDE1.grids) {
      for (let row = 0; row < definition.rows; row++) {
        for (let col = 0; col < definition.cols; col++) {
          const start = gridCellOffset(definition, row, col);
          for (let byte = 0; byte < definition.cellBytes; byte++) {
            expect(editable.has(start + byte)).toBe(true);
          }
        }
      }
    }
  });

  it("leaves out the stored rows and columns of the base pulse width that the PCM does not read", () => {
    const definition = TDE1.grids[1];
    if (!definition) throw new Error("missing definition");
    expect(editable.has(definition.address + 2 * 11)).toBe(false);
    expect(editable.has(definition.address + 2 * 12 * 13)).toBe(false);
  });

  it("stops at the last byte of the IPR duty grid, 0x13a65", () => {
    expect(editable.has(0x13a65)).toBe(true);
    expect(editable.has(0x13a66)).toBe(false);
    expect(editable.has(0x13a5e)).toBe(true);
  });

  it("leaves out the axis functions that give the grids their rows and columns", () => {
    for (const definition of TDE1.grids) {
      for (const axis of [definition.rowAxis, definition.colAxis]) {
        for (let offset = axis.functionOffset; offset < axis.functionOffset + 8; offset++) {
          expect(editable.has(offset)).toBe(false);
        }
      }
    }
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

  it("refuses a changed pedal byte of a lockup function, naming its offset", () => {
    const base = buildTde1Image();
    const edited = new Uint8Array(base);
    const pedalOffset = TDE1.lockupFunctions[0]?.address ?? 0;
    edited[pedalOffset] = (edited[pedalOffset] ?? 0) ^ 0x01;
    expect(() => assertOnlyEditableChanges(base, edited)).toThrowError(
      expect.objectContaining({ offsets: [pedalOffset] }),
    );
  });

  it("refuses a changed byte of an unused zero function, a lock adjust function or an axis function", () => {
    const base = buildTde1Image();
    for (const offset of [0x14820, 0x146bc, 0x120a0]) {
      const edited = new Uint8Array(base);
      edited[offset] = (edited[offset] ?? 0) ^ 0x01;
      expect(() => assertOnlyEditableChanges(base, edited)).toThrowError(
        expect.objectContaining({ offsets: [offset] }),
      );
    }
  });

  it("refuses a changed byte just outside a grid", () => {
    const base = buildTde1Image();
    for (const offset of [0x125cc - 1, 0x13a66, 0x1262c + 2 * 11]) {
      const edited = new Uint8Array(base);
      edited[offset] = (edited[offset] ?? 0) ^ 0x01;
      expect(() => assertOnlyEditableChanges(base, edited)).toThrowError(
        expect.objectContaining({ offsets: [offset] }),
      );
    }
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
