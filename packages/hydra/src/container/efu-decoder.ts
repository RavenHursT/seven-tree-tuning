import { Blowfish } from "../crypto";
import { CALIBRATION_IMAGE_SIZE } from "../image";
import type { CalibrationDecoder } from "./codec";
import { UnrecognizedFileError } from "./errors";
import { EFU_FILE_SIZE, endsWithTrailer, requireByteLength, TRAILER_SIZE } from "./layout";

/**
 * The two fixed 5-byte keys of Power Hungry's .efu files, in the order they are tried. The
 * first opens the TDE1 library files; the second is documented for downloaded files.
 */
const EFU_KEYS: readonly Uint8Array[] = [
  Uint8Array.of(0xbd, 0xc3, 0x07, 0x27, 0x69),
  Uint8Array.of(0xbd, 0xc2, 0x05, 0x13, 0x86),
];

/**
 * Reads .efu files, the encrypted calibrations of Power Hungry's free public library. A .efu
 * file is 262,152 bytes: a flat 262,144-byte image (no bank reassembly) and an 8-byte trailer
 * of 0x08, encrypted with Blowfish in ECB mode under one of two fixed keys.
 */
export class EfuDecoder implements CalibrationDecoder {
  readonly format = "efu";
  private readonly ciphers = EFU_KEYS.map((key) => new Blowfish(key));

  /**
   * @param file A .efu file of exactly 262,152 bytes.
   * @returns A new 262,144-byte image.
   * @throws InvalidFileSizeError for any other length.
   * @throws UnrecognizedFileError when neither fixed key decrypts the trailer to 8 bytes of 0x08.
   */
  decode(file: Uint8Array): Uint8Array {
    requireByteLength(file, EFU_FILE_SIZE, ".efu file");
    const lastBlock = file.subarray(EFU_FILE_SIZE - TRAILER_SIZE);
    const cipher = this.ciphers.find((candidate) =>
      endsWithTrailer(candidate.decryptEcb(lastBlock)),
    );
    if (cipher === undefined) {
      throw new UnrecognizedFileError(
        "This file could not be decrypted with either known .efu key.",
      );
    }
    return cipher.decryptEcb(file).slice(0, CALIBRATION_IMAGE_SIZE);
  }
}
