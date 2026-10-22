import { InvalidChipSerialError } from "./errors";

const CHIP_SERIAL_PATTERN = /^[0-9a-fA-F]{8}$/;
const SERIAL_BYTES = 4;
/** ASCII text 46 75 63 6B: the fixed first 4 bytes of every .hcf key. */
const KEY_PREFIX = Uint8Array.of(0x46, 0x75, 0x63, 0x6b);
/** ASCII text "DP-T": the fixed last 4 bytes of every .hcf key. */
const KEY_SUFFIX = Uint8Array.of(0x44, 0x50, 0x2d, 0x54);

/**
 * Puts a chip serial typed by a person in its standard form: surrounding white space removed and
 * letters in upper case. It checks nothing, so text that is not a chip serial comes back changed
 * in the same way. Use `isChipSerial` to check it.
 */
export function normalizeChipSerial(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * True when `input`, ignoring surrounding white space, is exactly 8 hexadecimal digits in either
 * letter case. The text is checked as typed: a character that only becomes a hexadecimal digit
 * when changed to upper case (the ligature "ﬀ" becomes "FF") is rejected.
 */
export function isChipSerial(input: string): boolean {
  return CHIP_SERIAL_PATTERN.test(input.trim());
}

/**
 * Checks a chip serial typed by a person: the first 8 characters of the chip's USB serial
 * number, which are 8 hexadecimal digits.
 * @returns The 8 digits in upper case, without surrounding white space.
 * @throws InvalidChipSerialError unless the trimmed input is exactly 8 hexadecimal digits.
 */
export function parseChipSerial(input: string): string {
  if (!isChipSerial(input)) {
    throw new InvalidChipSerialError();
  }
  return normalizeChipSerial(input);
}

/**
 * Builds the Blowfish key of a .hcf file: 4 fixed bytes (46 75 63 6B), the 4 bytes the chip
 * serial's 8 hexadecimal digits stand for, and 4 fixed bytes (ASCII "DP-T").
 * @returns A new 12-byte array.
 * @throws InvalidChipSerialError when `chipSerial` is not 8 hexadecimal digits.
 */
export function hcfKey(chipSerial: string): Uint8Array {
  const serial = parseChipSerial(chipSerial);
  const key = new Uint8Array(KEY_PREFIX.length + SERIAL_BYTES + KEY_SUFFIX.length);
  key.set(KEY_PREFIX, 0);
  for (let index = 0; index < SERIAL_BYTES; index++) {
    key[KEY_PREFIX.length + index] = parseInt(serial.slice(index * 2, index * 2 + 2), 16);
  }
  key.set(KEY_SUFFIX, KEY_PREFIX.length + SERIAL_BYTES);
  return key;
}
