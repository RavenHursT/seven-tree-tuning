import {
  assertSupportedLayout,
  readIdleCurve,
  readShiftCurves,
  readTuneValues,
  type ContainerFormat,
  type IdlePoint,
  type ShiftCurve,
  type TuneValues,
} from "@seven-tree/hydra";

export type TuneSourceKind = "upload" | "library";

/** Where a loaded tune came from. */
export interface TuneSource {
  readonly kind: TuneSourceKind;
  readonly fileName: string;
  readonly format: ContainerFormat;
}

/** A decoded TDE1 tune: its image plus everything the editor reads from it once. */
export interface LoadedTune {
  readonly source: TuneSource;
  readonly image: Uint8Array;
  /** Throttle axes and original speeds of the six shift curves. */
  readonly curves: readonly ShiftCurve[];
  readonly originalValues: TuneValues;
  readonly idleCurve: readonly IdlePoint[];
}

/**
 * Reads a decoded 256 KiB image. Throws UnsupportedCalibrationError when the image does not
 * have the TDE1 shift-curve layout (for example a tune for another PCM strategy).
 */
export function createLoadedTune(image: Uint8Array, source: TuneSource): LoadedTune {
  assertSupportedLayout(image);
  const copy = image.slice();
  return {
    source,
    image: copy,
    curves: readShiftCurves(copy),
    originalValues: readTuneValues(copy),
    idleCurve: readIdleCurve(copy),
  };
}
