/** Size of a decoded PCM image: the 256 KiB .bin that Minotaur and TunerPro load. */
export const CALIBRATION_IMAGE_SIZE = 262_144;

/** Throws a RangeError unless `image` is exactly one decoded 256 KiB PCM image. */
export function assertCalibrationImage(image: Uint8Array): void {
  if (image.length !== CALIBRATION_IMAGE_SIZE) {
    throw new RangeError(
      `expected a ${CALIBRATION_IMAGE_SIZE}-byte calibration image, got ${image.length} bytes`,
    );
  }
}
