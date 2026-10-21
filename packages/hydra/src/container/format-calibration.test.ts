import { describe, expect, it } from "vitest";

import { formatCalibration, unformatCalibration } from "./format-calibration";
import {
  BANK_IMAGE_OFFSETS,
  BANK_SIZE,
  expectSameBytes,
  GAP_OFFSETS,
  GAP_SIZE,
  IMAGE_SIZE,
  makeSyntheticImage,
  seededBytes,
  TRAILER_SIZE,
} from "./test-support";

const BANKS_SIZE = 4 * BANK_SIZE;
const BANK_STARTS = [0, BANK_SIZE, 2 * BANK_SIZE, 3 * BANK_SIZE];

function banksWithMarkers(totalSize: number): Uint8Array {
  const banks = new Uint8Array(totalSize);
  BANK_STARTS.forEach((start, bank) => {
    banks[start] = 0xa1 + bank;
    banks[start + BANK_SIZE - 1] = 0xb1 + bank;
  });
  return banks;
}

describe("formatCalibration", () => {
  it("returns an image of 262,144 bytes", () => {
    expect(formatCalibration(new Uint8Array(BANKS_SIZE)).length).toBe(IMAGE_SIZE);
  });

  it("puts the first and last byte of each bank at the documented image offsets", () => {
    const image = formatCalibration(banksWithMarkers(BANKS_SIZE));

    BANK_IMAGE_OFFSETS.forEach((offset, bank) => {
      expect(image[offset]).toBe(0xa1 + bank);
      expect(image[offset + BANK_SIZE - 1]).toBe(0xb1 + bank);
    });
  });

  it("copies every byte of every bank to its place in the image", () => {
    const banks = seededBytes(BANKS_SIZE, 7);
    const image = formatCalibration(banks);

    BANK_IMAGE_OFFSETS.forEach((offset, bank) => {
      const start = BANK_STARTS[bank]!;
      expectSameBytes(
        image.slice(offset, offset + BANK_SIZE),
        banks.slice(start, start + BANK_SIZE),
      );
    });
  });

  it("fills the four 8 KiB gaps with 0xFF", () => {
    const image = formatCalibration(new Uint8Array(BANKS_SIZE));

    for (const offset of GAP_OFFSETS) {
      expectSameBytes(image.slice(offset, offset + GAP_SIZE), new Uint8Array(GAP_SIZE).fill(0xff));
    }
  });

  it("accepts banks with or without the 8-byte trailer and ignores the trailer", () => {
    const banks = seededBytes(BANKS_SIZE, 3);
    const withTrailer = new Uint8Array(BANKS_SIZE + TRAILER_SIZE);
    withTrailer.set(banks);
    withTrailer.fill(0x08, BANKS_SIZE);

    expectSameBytes(formatCalibration(withTrailer), formatCalibration(banks));
  });

  it.each([0, 1, BANKS_SIZE - 1, BANKS_SIZE + 1, BANKS_SIZE + TRAILER_SIZE + 1, IMAGE_SIZE])(
    "rejects %i bytes with a RangeError",
    (length) => {
      expect(() => formatCalibration(new Uint8Array(length))).toThrow(RangeError);
    },
  );

  it("names the accepted sizes in the error message", () => {
    expect(() => formatCalibration(new Uint8Array(10))).toThrow(
      "expected 229376 or 229384 bytes of calibration banks, got 10 bytes",
    );
  });

  it("returns a new array that does not share memory with the input", () => {
    const banks = new Uint8Array(BANKS_SIZE);
    const image = formatCalibration(banks);

    expect(image.buffer).not.toBe(banks.buffer);
  });
});

describe("unformatCalibration", () => {
  it("returns 229,384 bytes: 4 banks of 57,344 bytes and an 8-byte trailer of 0x08", () => {
    const data = unformatCalibration(makeSyntheticImage());

    expect(data.length).toBe(BANKS_SIZE + TRAILER_SIZE);
    expect(data.slice(BANKS_SIZE)).toEqual(new Uint8Array(TRAILER_SIZE).fill(0x08));
  });

  it("takes each bank from the documented image offset", () => {
    const image = new Uint8Array(IMAGE_SIZE).fill(0xff);
    BANK_IMAGE_OFFSETS.forEach((offset, bank) => {
      image[offset] = 0xa1 + bank;
      image[offset + BANK_SIZE - 1] = 0xb1 + bank;
    });

    const data = unformatCalibration(image);

    BANK_STARTS.forEach((start, bank) => {
      expect(data[start]).toBe(0xa1 + bank);
      expect(data[start + BANK_SIZE - 1]).toBe(0xb1 + bank);
    });
  });

  it("does not store the bytes of the gaps", () => {
    const image = makeSyntheticImage();
    const noisy = image.slice();
    for (const offset of GAP_OFFSETS) {
      noisy.set(seededBytes(GAP_SIZE, offset), offset);
    }

    expectSameBytes(unformatCalibration(noisy), unformatCalibration(image));
  });

  it.each([0, BANKS_SIZE, BANKS_SIZE + TRAILER_SIZE, IMAGE_SIZE + 1])(
    "rejects an image of %i bytes with a RangeError",
    (length) => {
      expect(() => unformatCalibration(new Uint8Array(length))).toThrow(RangeError);
    },
  );
});

describe("formatCalibration and unformatCalibration together", () => {
  it("give back the same banks and trailer after an image round trip", () => {
    const data = unformatCalibration(makeSyntheticImage(5));

    expectSameBytes(unformatCalibration(formatCalibration(data)), data);
  });

  it("give back the same image after a data round trip when the gaps are 0xFF", () => {
    const image = makeSyntheticImage(9);

    expectSameBytes(formatCalibration(unformatCalibration(image)), image);
  });
});
