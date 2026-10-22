import { CALIBRATION_IMAGE_SIZE } from "../image";
import type { CalibrationDecoder, CalibrationEncoder } from "./codec";
import { requireByteLength } from "./layout";

/**
 * Reads and writes plain .bin files: the 262,144-byte (256 KiB) calibration image itself,
 * without encryption. HydraFlash accepts these.
 */
export class BinCodec implements CalibrationDecoder, CalibrationEncoder {
  readonly format = "bin";
  readonly fileExtension = ".bin";

  /**
   * @param file A .bin file of exactly 262,144 bytes.
   * @returns A new array with the same bytes.
   * @throws InvalidFileSizeError for any other length.
   */
  decode(file: Uint8Array): Uint8Array {
    requireByteLength(file, CALIBRATION_IMAGE_SIZE, ".bin file");
    return new Uint8Array(file);
  }

  /**
   * @param image A 262,144-byte image.
   * @returns A new array with the same bytes.
   * @throws InvalidFileSizeError for any other length.
   */
  encode(image: Uint8Array): Uint8Array {
    requireByteLength(image, CALIBRATION_IMAGE_SIZE, "calibration image");
    return new Uint8Array(image);
  }
}
