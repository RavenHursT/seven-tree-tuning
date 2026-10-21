import { describe, expect, it } from "vitest";

import { BinCodec } from "./bin-codec";
import { InvalidFileSizeError } from "./errors";
import { expectSameBytes, IMAGE_SIZE, makeSyntheticImage } from "./test-support";

describe("BinCodec", () => {
  it("is the bin format with the .bin file extension", () => {
    const codec = new BinCodec();

    expect(codec.format).toBe("bin");
    expect(codec.fileExtension).toBe(".bin");
  });

  it("decodes a 262,144-byte file to an equal copy", () => {
    const file = makeSyntheticImage(1);

    const decoded = new BinCodec().decode(file);

    expectSameBytes(decoded, file);
    expect(decoded.buffer).not.toBe(file.buffer);
  });

  it("encodes a 262,144-byte image to an equal copy", () => {
    const image = makeSyntheticImage(2);

    const encoded = new BinCodec().encode(image);

    expectSameBytes(encoded, image);
    expect(encoded.buffer).not.toBe(image.buffer);
  });

  it("copies only the viewed part of a larger buffer", () => {
    const backing = new Uint8Array(IMAGE_SIZE + 16).fill(0xee);
    backing.set(makeSyntheticImage(3), 8);

    const decoded = new BinCodec().decode(backing.subarray(8, 8 + IMAGE_SIZE));

    expectSameBytes(decoded, makeSyntheticImage(3));
    expect(decoded.buffer.byteLength).toBe(IMAGE_SIZE);
  });

  it.each([0, 1_024, 229_384, IMAGE_SIZE + 8])(
    "throws InvalidFileSizeError when asked to decode %i bytes",
    (length) => {
      const decode = () => new BinCodec().decode(new Uint8Array(length));

      expect(decode).toThrow(InvalidFileSizeError);
      expect(decode).toThrow(
        `A .bin file must be 262,144 bytes; this file is ${length.toLocaleString("en-US")} bytes.`,
      );
    },
  );

  it.each([0, 1_024, 229_384, IMAGE_SIZE + 8])(
    "throws InvalidFileSizeError when asked to encode %i bytes",
    (length) => {
      const encode = () => new BinCodec().encode(new Uint8Array(length));

      expect(encode).toThrow(InvalidFileSizeError);
      expect(encode).toThrow(
        "A calibration image must be 262,144 bytes; " +
          `this image is ${length.toLocaleString("en-US")} bytes.`,
      );
    },
  );
});
