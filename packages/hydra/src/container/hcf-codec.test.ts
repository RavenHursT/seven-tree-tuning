import { describe, expect, it } from "vitest";

import { Blowfish } from "../crypto";
import { InvalidChipSerialError, InvalidFileSizeError, WrongChipSerialError } from "./errors";
import { HcfCodec } from "./hcf-codec";
import {
  BANK_IMAGE_OFFSETS,
  BANK_SIZE,
  differingBlockOffsets,
  expectSameBytes,
  GAP_OFFSETS,
  IMAGE_SIZE,
  makeSyntheticImage,
  TRAILER_SIZE,
} from "./test-support";

const SERIAL = "0A1B2C3D";
const HCF_SIZE = 229_384;
const KEY = Uint8Array.of(0x46, 0x75, 0x63, 0x6b, 0x0a, 0x1b, 0x2c, 0x3d, 0x44, 0x50, 0x2d, 0x54);

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("HcfCodec", () => {
  it("is the hcf format with the .hcf file extension", () => {
    const codec = new HcfCodec(SERIAL);

    expect(codec.format).toBe("hcf");
    expect(codec.fileExtension).toBe(".hcf");
  });

  it("encodes an image to a file of 229,384 bytes", () => {
    expect(new HcfCodec(SERIAL).encode(makeSyntheticImage()).length).toBe(HCF_SIZE);
  });

  it("encodes the four banks and the trailer with Blowfish under the 12-byte key", () => {
    const image = makeSyntheticImage(2);
    const plain = new Uint8Array(HCF_SIZE);
    BANK_IMAGE_OFFSETS.forEach((offset, bank) => {
      plain.set(image.subarray(offset, offset + BANK_SIZE), bank * BANK_SIZE);
    });
    plain.fill(0x08, HCF_SIZE - TRAILER_SIZE);

    expectSameBytes(new HcfCodec(SERIAL).encode(image), new Blowfish(KEY).encryptEcb(plain));
  });

  it("decodes the file it encoded back to the same 262,144-byte image", () => {
    const codec = new HcfCodec(SERIAL);
    const image = makeSyntheticImage(3);

    const decoded = codec.decode(codec.encode(image));

    expect(decoded.length).toBe(IMAGE_SIZE);
    expectSameBytes(decoded, image);
  });

  it("encodes the same file again from the decoded image", () => {
    const codec = new HcfCodec(SERIAL);
    const file = codec.encode(makeSyntheticImage(4));

    expectSameBytes(codec.encode(codec.decode(file)), file);
  });

  it("accepts the serial in lower case with white space around it", () => {
    const file = new HcfCodec(SERIAL).encode(makeSyntheticImage(5));

    expectSameBytes(new HcfCodec(" 0a1b2c3d ").decode(file), makeSyntheticImage(5));
  });

  it("throws WrongChipSerialError when the serial is not the one the file was made with", () => {
    const file = new HcfCodec(SERIAL).encode(makeSyntheticImage());

    expect(() => new HcfCodec("0A1B2C3E").decode(file)).toThrow(WrongChipSerialError);
    expect(() => new HcfCodec("0A1B2C3E").decode(file)).toThrow(
      "The chip serial does not match this file.",
    );
  });

  it("throws WrongChipSerialError when the last block of the file is damaged", () => {
    const codec = new HcfCodec(SERIAL);
    const file = codec.encode(makeSyntheticImage());
    file[HCF_SIZE - 1] = file[HCF_SIZE - 1]! ^ 0x01;

    expect(() => codec.decode(file)).toThrow(WrongChipSerialError);
  });

  it("throws InvalidChipSerialError when built with a serial that is not 8 hex digits", () => {
    expect(() => new HcfCodec("0A1B2C3")).toThrow(InvalidChipSerialError);
  });

  it.each([0, 1_024, HCF_SIZE - 8, HCF_SIZE + 8, 262_152])(
    "throws InvalidFileSizeError when asked to decode %i bytes",
    (length) => {
      const decode = () => new HcfCodec(SERIAL).decode(new Uint8Array(length));

      expect(decode).toThrow(InvalidFileSizeError);
      expect(decode).toThrow(
        `A .hcf file must be 229,384 bytes; this file is ${length.toLocaleString("en-US")} bytes.`,
      );
    },
  );

  it("reports the expected and actual size of a file of the wrong size", () => {
    const error = thrownBy(() => new HcfCodec(SERIAL).decode(new Uint8Array(1_024)));

    expect(error).toBeInstanceOf(InvalidFileSizeError);
    expect(error).toMatchObject({ expected: HCF_SIZE, actual: 1_024 });
  });

  it.each([0, 229_384, 262_143, 262_145])(
    "throws InvalidFileSizeError when asked to encode %i bytes",
    (length) => {
      const encode = () => new HcfCodec(SERIAL).encode(new Uint8Array(length));

      expect(encode).toThrow(InvalidFileSizeError);
      expect(encode).toThrow(
        "A calibration image must be 262,144 bytes; " +
          `this image is ${length.toLocaleString("en-US")} bytes.`,
      );
    },
  );

  it("leaves the file it decodes and the image it encodes unchanged", () => {
    const codec = new HcfCodec(SERIAL);
    const image = makeSyntheticImage(6);
    const imageCopy = image.slice();
    const file = codec.encode(image);
    const fileCopy = file.slice();

    codec.decode(file);

    expectSameBytes(image, imageCopy);
    expectSameBytes(file, fileCopy);
  });
});

describe("HcfCodec and ECB mode", () => {
  const codec = new HcfCodec(SERIAL);
  const image = makeSyntheticImage(8);
  const file = codec.encode(image);

  function fileWithImageByteChanged(imageOffset: number): Uint8Array {
    const changed = image.slice();
    changed[imageOffset] = changed[imageOffset]! ^ 0x5a;
    return codec.encode(changed);
  }

  it("changes exactly one 8-byte block of the file when one image byte changes", () => {
    // 0x14521 is the first byte of the TDE1 1->2 upshift curve: image bank 1, bank offset 0x2521.
    const bankOffset = 0x14521 - 0x12000;
    const fileOffset = BANK_SIZE + bankOffset;

    const differing = differingBlockOffsets(file, fileWithImageByteChanged(0x14521));

    expect(differing).toEqual([fileOffset - (fileOffset % 8)]);
  });

  it.each(BANK_IMAGE_OFFSETS.map((offset, bank) => ({ bank, offset })))(
    "changes exactly one block for a byte at the start of bank $bank",
    ({ bank, offset }) => {
      const differing = differingBlockOffsets(file, fileWithImageByteChanged(offset));

      expect(differing).toEqual([bank * BANK_SIZE]);
    },
  );

  it.each(GAP_OFFSETS.map((offset) => ({ offset })))(
    "changes nothing in the file when a byte at image offset $offset in a gap changes",
    ({ offset }) => {
      expectSameBytes(fileWithImageByteChanged(offset + 100), file);
    },
  );
});
