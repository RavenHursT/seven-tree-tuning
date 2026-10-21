import {
  HcfCodec,
  InvalidChipSerialError,
  readTuneValues,
  setWarmIdleRpm,
  UnrecognizedFileError,
  UnsupportedCalibrationError,
  WrongChipSerialError,
} from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";
import { describe, expect, it } from "vitest";

import {
  buildTuneFile,
  decodeTuneFile,
  describeError,
  needsChipSerial,
  outputFileWithExtension,
} from "./tune-files";

const SERIAL = "0A1B2C3D";

describe("decodeTuneFile", () => {
  it("decodes a .hcf with the chip serial", () => {
    const image = buildTde1Image();
    const tune = decodeTuneFile(new HcfCodec(SERIAL).encode(image), "tune.hcf", "upload", SERIAL);
    expect(tune.source).toEqual({ kind: "upload", fileName: "tune.hcf", format: "hcf" });
    expect(tune.originalValues).toEqual(readTuneValues(image));
  });

  it("refuses a .hcf when the serial is wrong", () => {
    const file = new HcfCodec(SERIAL).encode(buildTde1Image());
    expect(() => decodeTuneFile(file, "tune.hcf", "upload", "FFFFFFFF")).toThrow(
      WrongChipSerialError,
    );
  });

  it("decodes a plain .bin image without a serial", () => {
    const tune = decodeTuneFile(buildTde1Image(), "TUNE.BIN", "upload", "");
    expect(tune.source.format).toBe("bin");
  });

  it("refuses a file type it does not read", () => {
    expect(() => decodeTuneFile(new Uint8Array(8), "notes.txt", "upload", SERIAL)).toThrow(
      UnrecognizedFileError,
    );
  });

  it("refuses an image that is not a TDE1 tune", () => {
    expect(() => decodeTuneFile(new Uint8Array(262_144), "other.bin", "upload", "")).toThrow(
      UnsupportedCalibrationError,
    );
  });
});

describe("needsChipSerial", () => {
  it("is true only for .hcf files", () => {
    expect(needsChipSerial("a.hcf")).toBe(true);
    expect(needsChipSerial("A.HCF")).toBe(true);
    expect(needsChipSerial("VCAB0_02_0S.efu")).toBe(false);
    expect(needsChipSerial("a.bin")).toBe(false);
  });
});

describe("buildTuneFile", () => {
  it("re-encodes unchanged values to the same .hcf bytes", () => {
    const file = new HcfCodec(SERIAL).encode(buildTde1Image());
    const tune = decodeTuneFile(file, "tune.hcf", "upload", SERIAL);
    expect(buildTuneFile(tune, tune.originalValues, SERIAL)).toEqual(file);
  });

  it("writes the edited values into a .hcf for the given chip", () => {
    const tune = decodeTuneFile(buildTde1Image(), "tune.bin", "upload", "");
    const edited = setWarmIdleRpm(tune.originalValues, 700);
    const output = buildTuneFile(tune, edited, SERIAL);
    expect(readTuneValues(new HcfCodec(SERIAL).decode(output))).toEqual(edited);
  });

  it("needs a valid chip serial", () => {
    const tune = decodeTuneFile(buildTde1Image(), "tune.bin", "upload", "");
    expect(() => buildTuneFile(tune, tune.originalValues, "nope")).toThrow(InvalidChipSerialError);
  });
});

describe("outputFileWithExtension", () => {
  it("adds .hcf once", () => {
    expect(outputFileWithExtension("TDE1_30N_DAILYDRIVER-CUSTOM")).toBe(
      "TDE1_30N_DAILYDRIVER-CUSTOM.hcf",
    );
    expect(outputFileWithExtension(" my tune.HCF ")).toBe("my tune.hcf");
  });
});

describe("describeError", () => {
  it("passes on the library's own messages and hides anything else", () => {
    expect(describeError(new WrongChipSerialError())).toBe(
      "The chip serial does not match this file.",
    );
    expect(describeError(new UnsupportedCalibrationError([]))).toBe(
      "This file does not have the TDE1 shift-curve layout.",
    );
    expect(describeError(new TypeError("x is undefined"))).toBe(
      "Something went wrong: x is undefined",
    );
    expect(describeError("boom")).toBe("Something went wrong.");
  });
});
