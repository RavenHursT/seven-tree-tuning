import { describe, expect, it } from "vitest";

import { readByte, readInt16Le, readUint16Le, writeUint16Le } from "./bytes";

describe("byte access", () => {
  const bytes = Uint8Array.from([0x10, 0x20, 0xff, 0xff, 0x00, 0x80]);

  it("reads one byte", () => {
    expect(readByte(bytes, 0)).toBe(0x10);
    expect(readByte(bytes, 5)).toBe(0x80);
  });

  it("rejects an offset outside the array or one that is not a whole number", () => {
    expect(() => readByte(bytes, -1)).toThrow(RangeError);
    expect(() => readByte(bytes, 6)).toThrow(RangeError);
    expect(() => readByte(bytes, 1.5)).toThrow(RangeError);
  });

  it("reads little-endian unsigned and signed 16-bit values", () => {
    expect(readUint16Le(bytes, 0)).toBe(0x2010);
    expect(readUint16Le(bytes, 2)).toBe(0xffff);
    expect(readInt16Le(bytes, 2)).toBe(-1);
    expect(readInt16Le(bytes, 4)).toBe(-32768);
  });

  it("rejects a 16-bit read that runs past the end", () => {
    expect(() => readUint16Le(bytes, 5)).toThrow(RangeError);
  });

  it("writes a little-endian unsigned 16-bit value", () => {
    const target = new Uint8Array(4);
    writeUint16Le(target, 1, 0x1130);
    expect(Array.from(target)).toEqual([0, 0x30, 0x11, 0]);
  });

  it("rejects a 16-bit write of a value that is not 0..65535 or is not a whole number", () => {
    const target = new Uint8Array(4);
    expect(() => writeUint16Le(target, 0, 65_536)).toThrow(RangeError);
    expect(() => writeUint16Le(target, 0, -1)).toThrow(RangeError);
    expect(() => writeUint16Le(target, 0, 1.5)).toThrow(RangeError);
    expect(() => writeUint16Le(target, 3, 1)).toThrow(RangeError);
  });
});
