import { describe, expect, it } from "vitest";

import * as container from "./index";
import type { CalibrationDecoder, CalibrationEncoder, ContainerFormat } from "./index";

describe("container public API", () => {
  it("exports exactly the documented names", () => {
    expect(Object.keys(container).sort()).toEqual(
      [
        "BinCodec",
        "EFU_FILE_SIZE",
        "EfuDecoder",
        "HCF_FILE_SIZE",
        "HcfCodec",
        "HydraFileError",
        "InvalidChipSerialError",
        "InvalidFileSizeError",
        "UnrecognizedFileError",
        "WrongChipSerialError",
        "containerFormatFromFileName",
        "formatCalibration",
        "hcfKey",
        "parseChipSerial",
        "unformatCalibration",
      ].sort(),
    );
  });

  it("exports the sizes of a .hcf file and a .efu file", () => {
    expect(container.HCF_FILE_SIZE).toBe(229_384);
    expect(container.EFU_FILE_SIZE).toBe(262_152);
  });

  it("lets the codecs be used through the decoder and encoder interfaces", () => {
    const decoders: CalibrationDecoder[] = [
      new container.HcfCodec("0A1B2C3D"),
      new container.EfuDecoder(),
      new container.BinCodec(),
    ];
    const encoders: CalibrationEncoder[] = [
      new container.HcfCodec("0A1B2C3D"),
      new container.BinCodec(),
    ];
    const formats: ContainerFormat[] = decoders.map((decoder) => decoder.format);

    expect(formats).toEqual(["hcf", "efu", "bin"]);
    expect(encoders.map((encoder) => encoder.fileExtension)).toEqual([".hcf", ".bin"]);
  });
});
