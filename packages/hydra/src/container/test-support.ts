// Helpers shared by the container tests. Not part of the public API.
import { expect } from "vitest";

export const IMAGE_SIZE = 262_144;
export const BANK_SIZE = 57_344;
export const TRAILER_SIZE = 8;

/** Where each of the four banks sits in the 256 KiB image, in the order the .hcf stores them. */
export const BANK_IMAGE_OFFSETS = [0x22000, 0x12000, 0x02000, 0x32000] as const;

/** The four 8 KiB gaps of an image that no bank covers. */
export const GAP_OFFSETS = [0x00000, 0x10000, 0x20000, 0x30000] as const;
export const GAP_SIZE = 0x2000;

/** Deterministic pseudo-random bytes (mulberry32), so a failing test can be repeated exactly. */
export function seededBytes(length: number, seed: number): Uint8Array {
  let state = seed >>> 0;
  return Uint8Array.from({ length }, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (mixed ^ (mixed >>> 14)) >>> 24;
  });
}

/** A 256 KiB image with 0xFF in the four gaps and different pseudo-random bytes in every bank. */
export function makeSyntheticImage(seed = 1): Uint8Array {
  const image = new Uint8Array(IMAGE_SIZE).fill(0xff);
  BANK_IMAGE_OFFSETS.forEach((offset, bank) => {
    image.set(seededBytes(BANK_SIZE, seed * 16 + bank), offset);
  });
  return image;
}

/** Positions of the 8-byte blocks that differ between two equally long arrays. */
export function differingBlockOffsets(first: Uint8Array, second: Uint8Array): number[] {
  const offsets: number[] = [];
  for (let offset = 0; offset < first.length; offset += 8) {
    if (
      !first.subarray(offset, offset + 8).every((byte, index) => byte === second[offset + index])
    ) {
      offsets.push(offset);
    }
  }
  return offsets;
}

/**
 * Compares two byte arrays. A failure names the first position that differs instead of
 * printing both arrays, because Vitest's own diff of two large unequal arrays takes minutes.
 */
export function expectSameBytes(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length, "length").toBe(expected.length);
  const position = actual.findIndex((byte, index) => byte !== expected[index]);
  expect(position, `byte ${position} is ${actual[position]}, expected ${expected[position]}`).toBe(
    -1,
  );
}
