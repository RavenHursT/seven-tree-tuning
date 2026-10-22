import {
  BinCodec,
  containerFormatFromFileName,
  EfuDecoder,
  HcfCodec,
  HydraFileError,
  UnrecognizedFileError,
  UnsupportedCalibrationError,
  writeTuneValues,
  type CalibrationDecoder,
  type ContainerFormat,
  type TuneValues,
} from "@seven-tree/hydra";

import { createLoadedTune, type LoadedTune, type TuneSourceKind } from "./loaded-tune";

const DECODERS: Readonly<Record<ContainerFormat, (chipSerial: string) => CalibrationDecoder>> = {
  hcf: (chipSerial) => new HcfCodec(chipSerial),
  efu: () => new EfuDecoder(),
  bin: () => new BinCodec(),
};

/** Bigger than any tune file: the largest, a PHP library .efu, is 262,152 bytes. */
const MAX_TUNE_FILE_BYTES = 1_048_576;

/**
 * Why a picked file cannot be a tune, from its name and size alone, or undefined when it can.
 * Checked before the file is read, so a wrong or huge file is never loaded into memory.
 */
export function tuneFileProblem(fileName: string, sizeBytes: number): string | undefined {
  if (!containerFormatFromFileName(fileName)) return "Choose a .hcf, .efu or .bin file.";
  if (sizeBytes > MAX_TUNE_FILE_BYTES) {
    return `${fileName} is too large to be a tune file (${sizeBytes.toLocaleString("en-US")} bytes).`;
  }
  return undefined;
}

/** True when opening the file needs the chip serial (only .hcf files are keyed to a chip). */
export function needsChipSerial(fileName: string): boolean {
  return containerFormatFromFileName(fileName) === "hcf";
}

/**
 * Decodes a .hcf (with the chip serial), a PHP library .efu or a plain .bin image, and reads
 * it as a TDE1 tune. Throws the hydra package's errors, whose messages are user-facing.
 */
export function decodeTuneFile(
  bytes: Uint8Array,
  fileName: string,
  kind: TuneSourceKind,
  chipSerial: string,
): LoadedTune {
  const format = containerFormatFromFileName(fileName);
  if (!format) throw new UnrecognizedFileError("Choose a .hcf, .efu or .bin file.");
  const image = DECODERS[format](chipSerial).decode(bytes);
  return createLoadedTune(image, { kind, fileName, format });
}

/** Writes the edited values into the tune's image and encrypts it as a .hcf for the chip. */
export function buildTuneFile(
  tune: LoadedTune,
  values: TuneValues,
  chipSerial: string,
): Uint8Array {
  const codec = new HcfCodec(chipSerial);
  return codec.encode(writeTuneValues(tune.image, values));
}

/** The output name as typed, with exactly one ".hcf" at the end. */
export function outputFileWithExtension(name: string): string {
  return `${name.trim().replace(/\.hcf$/i, "")}.hcf`;
}

/** A message to show for an error from loading or generating a tune. */
export function describeError(error: unknown): string {
  if (error instanceof HydraFileError || error instanceof UnsupportedCalibrationError) {
    return error.message;
  }
  if (error instanceof Error) return `Something went wrong: ${error.message}`;
  return "Something went wrong.";
}
