import { describe, expect, it } from "vitest";

import { hcfKey, parseChipSerial } from "./chip-serial";
import { InvalidChipSerialError } from "./errors";

describe("parseChipSerial", () => {
  it("returns 8 upper-case hexadecimal digits unchanged", () => {
    expect(parseChipSerial("0A1B2C3D")).toBe("0A1B2C3D");
  });

  it("trims surrounding white space and converts to upper case", () => {
    expect(parseChipSerial(" 0a1b2c3d ")).toBe("0A1B2C3D");
    expect(parseChipSerial("\t0a1B2c3D\n")).toBe("0A1B2C3D");
  });

  it.each([
    ["an empty string", ""],
    ["white space only", "   "],
    ["7 digits", "0A1B2C3"],
    ["9 digits", "0A1B2C3D4"],
    ["a letter outside A-F", "0A1B2C3G"],
    ["white space inside", "0A1B 2C3"],
    ["a 0x prefix", "0x1B2C3D"],
    ["full-width digits", "０Ａ１Ｂ２Ｃ３Ｄ"],
    ["characters that only become hexadecimal digits in upper case", "ﬀﬀﬀﬀ"],
  ])("rejects %s with an InvalidChipSerialError", (_description, input) => {
    expect(() => parseChipSerial(input)).toThrow(InvalidChipSerialError);
  });
});

describe("hcfKey", () => {
  it("is the 4 fixed bytes 46 75 63 6B, the 4 serial bytes, then 44 50 2D 54", () => {
    expect(hcfKey("0A1B2C3D")).toEqual(
      Uint8Array.of(0x46, 0x75, 0x63, 0x6b, 0x0a, 0x1b, 0x2c, 0x3d, 0x44, 0x50, 0x2d, 0x54),
    );
  });

  it("decodes every serial byte, including 00 and FF", () => {
    expect(hcfKey("00FF80A5").slice(4, 8)).toEqual(Uint8Array.of(0x00, 0xff, 0x80, 0xa5));
  });

  it("gives the same key for lower case and for surrounding spaces", () => {
    expect(hcfKey(" 0a1b2c3d ")).toEqual(hcfKey("0A1B2C3D"));
  });

  it("rejects a serial that is not 8 hexadecimal digits", () => {
    expect(() => hcfKey("0A1B2C3")).toThrow(InvalidChipSerialError);
  });

  it("returns a new array on every call", () => {
    const first = hcfKey("0A1B2C3D");
    first.fill(0);

    expect(hcfKey("0A1B2C3D")[0]).toBe(0x46);
  });
});
