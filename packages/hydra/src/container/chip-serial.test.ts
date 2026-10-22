import { describe, expect, it } from "vitest";

import { hcfKey, isChipSerial, normalizeChipSerial, parseChipSerial } from "./chip-serial";
import { InvalidChipSerialError } from "./errors";

const NOT_CHIP_SERIALS: ReadonlyArray<readonly [description: string, input: string]> = [
  ["an empty string", ""],
  ["white space only", "   "],
  ["7 digits", "0A1B2C3"],
  ["9 digits", "0A1B2C3D4"],
  ["a letter outside A-F", "0A1B2C3G"],
  ["white space inside", "0A1B 2C3"],
  ["a 0x prefix", "0x1B2C3D"],
  ["full-width digits", "０Ａ１Ｂ２Ｃ３Ｄ"],
  ["characters that only become hexadecimal digits in upper case", "ﬀﬀﬀﬀ"],
];

describe("normalizeChipSerial", () => {
  it("trims surrounding white space and converts to upper case", () => {
    expect(normalizeChipSerial(" 0a1b2c3d ")).toBe("0A1B2C3D");
    expect(normalizeChipSerial("\t0a1B2c3D\n")).toBe("0A1B2C3D");
  });

  it("leaves upper-case digits as they are", () => {
    expect(normalizeChipSerial("0A1B2C3D")).toBe("0A1B2C3D");
  });

  it("checks nothing, so text that is not a chip serial comes back trimmed and in upper case", () => {
    expect(normalizeChipSerial("  xyz 12 ")).toBe("XYZ 12");
    expect(normalizeChipSerial("0a1b2c3")).toBe("0A1B2C3");
    expect(normalizeChipSerial("   ")).toBe("");
    expect(normalizeChipSerial("")).toBe("");
  });
});

describe("isChipSerial", () => {
  it.each([
    ["8 upper-case digits", "0A1B2C3D"],
    ["8 lower-case digits", "0a1b2c3d"],
    ["mixed letter case", "0a1B2c3D"],
    ["digits only", "12345678"],
    ["surrounding white space", " \t0a1b2c3d\n"],
    ["a serial with 00 and FF bytes", "00FF80A5"],
  ])("is true for %s", (_description, input) => {
    expect(isChipSerial(input)).toBe(true);
  });

  it.each(NOT_CHIP_SERIALS)("is false for %s", (_description, input) => {
    expect(isChipSerial(input)).toBe(false);
  });

  it("is true for a serial that has been through normalizeChipSerial", () => {
    expect(isChipSerial(normalizeChipSerial(" 0a1b2c3d "))).toBe(true);
  });

  it("gives the same answer as parseChipSerial for every input", () => {
    const inputs = [" 0a1b2c3d ", "0A1B2C3D", ...NOT_CHIP_SERIALS.map(([, input]) => input)];
    for (const input of inputs) {
      let parses = true;
      try {
        parseChipSerial(input);
      } catch {
        parses = false;
      }
      expect(isChipSerial(input), JSON.stringify(input)).toBe(parses);
    }
  });
});

describe("parseChipSerial", () => {
  it("returns 8 upper-case hexadecimal digits unchanged", () => {
    expect(parseChipSerial("0A1B2C3D")).toBe("0A1B2C3D");
  });

  it("trims surrounding white space and converts to upper case", () => {
    expect(parseChipSerial(" 0a1b2c3d ")).toBe("0A1B2C3D");
    expect(parseChipSerial("\t0a1B2c3D\n")).toBe("0A1B2C3D");
  });

  it("returns what normalizeChipSerial returns for every valid input", () => {
    for (const input of ["0A1B2C3D", " 0a1b2c3d ", "12345678"]) {
      expect(parseChipSerial(input)).toBe(normalizeChipSerial(input));
    }
  });

  it.each(NOT_CHIP_SERIALS)("rejects %s with an InvalidChipSerialError", (_description, input) => {
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
