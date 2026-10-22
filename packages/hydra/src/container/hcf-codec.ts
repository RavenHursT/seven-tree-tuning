import { Blowfish } from "../crypto";
import { CALIBRATION_IMAGE_SIZE } from "../image";
import { hcfKey } from "./chip-serial";
import type { CalibrationDecoder, CalibrationEncoder } from "./codec";
import { WrongChipSerialError } from "./errors";
import { formatCalibration, unformatCalibration } from "./format-calibration";
import { endsWithTrailer, HCF_FILE_SIZE, requireByteLength } from "./layout";

/**
 * Reads and writes .hcf files for one chip serial. A .hcf file is 229,384 bytes: four
 * 57,344-byte banks and an 8-byte trailer of 0x08, encrypted with Blowfish in ECB mode under
 * the 12-byte key `hcfKey(chipSerial)`.
 */
export class HcfCodec implements CalibrationDecoder, CalibrationEncoder {
  readonly format = "hcf";
  readonly fileExtension = ".hcf";
  private readonly blowfish: Blowfish;

  /** @throws InvalidChipSerialError unless `chipSerial` is 8 hexadecimal digits. */
  constructor(chipSerial: string) {
    this.blowfish = new Blowfish(hcfKey(chipSerial));
  }

  /**
   * @param file A .hcf file of exactly 229,384 bytes.
   * @returns A new 262,144-byte image.
   * @throws InvalidFileSizeError for any other length.
   * @throws WrongChipSerialError when the decrypted trailer is not 8 bytes of 0x08.
   */
  decode(file: Uint8Array): Uint8Array {
    requireByteLength(file, HCF_FILE_SIZE, ".hcf file");
    const decrypted = this.blowfish.decryptEcb(file);
    if (!endsWithTrailer(decrypted)) {
      throw new WrongChipSerialError();
    }
    return formatCalibration(decrypted);
  }

  /**
   * @param image A 262,144-byte image. Bytes outside the four banks are not stored.
   * @returns A new 229,384-byte .hcf file.
   * @throws InvalidFileSizeError unless the image is 262,144 bytes.
   */
  encode(image: Uint8Array): Uint8Array {
    requireByteLength(image, CALIBRATION_IMAGE_SIZE, "calibration image");
    return this.blowfish.encryptEcb(unformatCalibration(image));
  }
}
