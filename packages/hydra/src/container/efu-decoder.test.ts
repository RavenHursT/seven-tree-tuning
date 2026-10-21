import { describe, expect, it } from "vitest";

import { Blowfish } from "../crypto";
import { EfuDecoder } from "./efu-decoder";
import { InvalidFileSizeError, UnrecognizedFileError } from "./errors";
import { expectSameBytes, IMAGE_SIZE, makeSyntheticImage, seededBytes } from "./test-support";

const EFU_SIZE = 262_152;
const FIRST_KEY = Uint8Array.of(0xbd, 0xc3, 0x07, 0x27, 0x69);
const SECOND_KEY = Uint8Array.of(0xbd, 0xc2, 0x05, 0x13, 0x86);
const OTHER_KEY = Uint8Array.of(0xbd, 0xc3, 0x07, 0x27, 0x6a);

function makeEfu(image: Uint8Array, key: Uint8Array): Uint8Array {
  const plain = new Uint8Array(EFU_SIZE);
  plain.set(image);
  plain.fill(0x08, IMAGE_SIZE);
  return new Blowfish(key).encryptEcb(plain);
}

describe("EfuDecoder", () => {
  it("is the efu format", () => {
    expect(new EfuDecoder().format).toBe("efu");
  });

  it.each([
    ["BD C3 07 27 69", FIRST_KEY],
    ["BD C2 05 13 86", SECOND_KEY],
  ])("decodes a file encrypted with the fixed key %s", (_name, key) => {
    const image = makeSyntheticImage(11);

    expectSameBytes(new EfuDecoder().decode(makeEfu(image, key)), image);
  });

  it("keeps a flat image: the bytes are not moved between banks", () => {
    const image = seededBytes(IMAGE_SIZE, 21);

    expectSameBytes(new EfuDecoder().decode(makeEfu(image, FIRST_KEY)), image);
  });

  it("returns a new array of exactly 262,144 bytes that does not hold the trailer", () => {
    const decoded = new EfuDecoder().decode(makeEfu(makeSyntheticImage(12), FIRST_KEY));

    expect(decoded.length).toBe(IMAGE_SIZE);
    expect(decoded.buffer.byteLength).toBe(IMAGE_SIZE);
  });

  it("leaves the file unchanged", () => {
    const file = makeEfu(makeSyntheticImage(13), SECOND_KEY);
    const copy = file.slice();

    new EfuDecoder().decode(file);

    expectSameBytes(file, copy);
  });

  it("throws UnrecognizedFileError for random bytes of the right size", () => {
    const decode = () => new EfuDecoder().decode(seededBytes(EFU_SIZE, 5));

    expect(decode).toThrow(UnrecognizedFileError);
    expect(decode).toThrow("This file could not be decrypted with either known .efu key.");
  });

  it("throws UnrecognizedFileError for a file encrypted with some other key", () => {
    const file = makeEfu(makeSyntheticImage(14), OTHER_KEY);

    expect(() => new EfuDecoder().decode(file)).toThrow(UnrecognizedFileError);
  });

  it.each([0, 1_024, IMAGE_SIZE, 229_384, EFU_SIZE + 8])(
    "throws InvalidFileSizeError for %i bytes",
    (length) => {
      const decode = () => new EfuDecoder().decode(new Uint8Array(length));

      expect(decode).toThrow(InvalidFileSizeError);
      expect(decode).toThrow(
        `A .efu file must be 262,152 bytes; this file is ${length.toLocaleString("en-US")} bytes.`,
      );
    },
  );
});
