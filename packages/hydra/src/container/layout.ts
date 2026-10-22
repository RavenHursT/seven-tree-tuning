import { InvalidFileSizeError } from "./errors";

/** Size of one calibration bank: 0xE000 bytes. */
export const BANK_SIZE = 57_344;

/** Size of the 4 banks of a calibration together: 229,376 bytes. */
export const BANKS_SIZE = 229_376;

/** Size of the padding block that ends every encrypted container: 8 bytes, each of value 0x08. */
export const TRAILER_SIZE = 8;

/** Value of every byte of the padding block. */
export const TRAILER_VALUE = 0x08;

/** Size of a .hcf file: 4 banks of 57,344 bytes plus the 8-byte trailer. */
export const HCF_FILE_SIZE = 229_384;

/** Size of a .efu file: a 262,144-byte image plus the 8-byte trailer. */
export const EFU_FILE_SIZE = 262_152;

/** True when the last 8 bytes of decrypted data are all 0x08, which only the right key gives. */
export function endsWithTrailer(decrypted: Uint8Array): boolean {
  if (decrypted.length < TRAILER_SIZE) {
    return false;
  }
  return decrypted
    .subarray(decrypted.length - TRAILER_SIZE)
    .every((byte) => byte === TRAILER_VALUE);
}

/**
 * @param subject A noun phrase for the message, such as ".hcf file"; see InvalidFileSizeError.
 * @throws InvalidFileSizeError unless `bytes` is exactly `expected` bytes long.
 */
export function requireByteLength(bytes: Uint8Array, expected: number, subject: string): void {
  if (bytes.length !== expected) {
    throw new InvalidFileSizeError(subject, expected, bytes.length);
  }
}
