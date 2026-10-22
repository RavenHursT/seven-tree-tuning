/**
 * The file types a calibration comes in: "hcf" is an encrypted Hydra Custom File, "efu" is an
 * encrypted file from Power Hungry's public library, "bin" is a plain 256 KiB image.
 */
export type ContainerFormat = "hcf" | "efu" | "bin";

/** Reads a file of one format and gives back the calibration image inside it. */
export interface CalibrationDecoder {
  readonly format: ContainerFormat;
  /**
   * @param file The bytes of a file of this format.
   * @returns A new 262,144-byte image.
   * @throws HydraFileError when the file cannot be read.
   */
  decode(file: Uint8Array): Uint8Array;
}

/** Writes a calibration image as a file of one format. */
export interface CalibrationEncoder {
  readonly format: ContainerFormat;
  /** File name extension of this format, with the dot: ".hcf" or ".bin". */
  readonly fileExtension: string;
  /**
   * @param image A 262,144-byte image.
   * @returns A new array holding the bytes of the file.
   * @throws InvalidFileSizeError unless the image is 262,144 bytes.
   */
  encode(image: Uint8Array): Uint8Array;
}
