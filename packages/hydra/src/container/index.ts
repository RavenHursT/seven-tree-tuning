// Public API of the container module. Each module owns its own barrel.
export { BinCodec } from "./bin-codec";
export { hcfKey, isChipSerial, normalizeChipSerial, parseChipSerial } from "./chip-serial";
export type { CalibrationDecoder, CalibrationEncoder, ContainerFormat } from "./codec";
export { EfuDecoder } from "./efu-decoder";
export {
  HydraFileError,
  InvalidChipSerialError,
  InvalidFileSizeError,
  UnrecognizedFileError,
  WrongChipSerialError,
} from "./errors";
export { containerFormatFromFileName } from "./file-name";
export { formatCalibration, unformatCalibration } from "./format-calibration";
export { HcfCodec } from "./hcf-codec";
export { EFU_FILE_SIZE, HCF_FILE_SIZE } from "./layout";
