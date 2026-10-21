import { assertCalibrationImage, CALIBRATION_IMAGE_SIZE } from "../image";
import { BANK_SIZE, BANKS_SIZE, HCF_FILE_SIZE, TRAILER_SIZE, TRAILER_VALUE } from "./layout";

interface BankPlacement {
  /** Offset of the bank in the decrypted .hcf data. */
  readonly dataOffset: number;
  /** Offset of the bank in the 256 KiB image. */
  readonly imageOffset: number;
}

/**
 * HydraFlash's FormatCalibration: where each 57,344-byte bank goes. Image bytes between banks
 * are 0xFF.
 */
const BANK_PLACEMENTS: readonly BankPlacement[] = [
  { dataOffset: 0, imageOffset: 0x22000 },
  { dataOffset: 57_344, imageOffset: 0x12000 },
  { dataOffset: 114_688, imageOffset: 0x02000 },
  { dataOffset: 172_032, imageOffset: 0x32000 },
];

/**
 * Builds the 262,144-byte image from the decrypted data of a .hcf file: each of the four
 * 57,344-byte banks is copied to its place and the four 8 KiB gaps (offsets 0x00000, 0x10000,
 * 0x20000 and 0x30000) are 0xFF.
 * @param banks 229,376 bytes of banks, or 229,384 bytes with the 8-byte trailer, which is ignored.
 * @returns A new 262,144-byte image.
 * @throws RangeError for any other length.
 */
export function formatCalibration(banks: Uint8Array): Uint8Array {
  if (banks.length !== BANKS_SIZE && banks.length !== HCF_FILE_SIZE) {
    throw new RangeError(
      `expected ${BANKS_SIZE} or ${HCF_FILE_SIZE} bytes of calibration banks, ` +
        `got ${banks.length} bytes`,
    );
  }
  const image = new Uint8Array(CALIBRATION_IMAGE_SIZE).fill(0xff);
  for (const { dataOffset, imageOffset } of BANK_PLACEMENTS) {
    image.set(banks.subarray(dataOffset, dataOffset + BANK_SIZE), imageOffset);
  }
  return image;
}

/**
 * Reverses formatCalibration: copies the four banks out of the image and appends the 8-byte
 * trailer of 0x08. Image bytes outside the four banks are not stored.
 * @param image A 262,144-byte image.
 * @returns A new 229,384-byte array, ready for encryption.
 * @throws RangeError unless the image is 262,144 bytes.
 */
export function unformatCalibration(image: Uint8Array): Uint8Array {
  assertCalibrationImage(image);
  const data = new Uint8Array(HCF_FILE_SIZE);
  for (const { dataOffset, imageOffset } of BANK_PLACEMENTS) {
    data.set(image.subarray(imageOffset, imageOffset + BANK_SIZE), dataOffset);
  }
  data.fill(TRAILER_VALUE, HCF_FILE_SIZE - TRAILER_SIZE);
  return data;
}
