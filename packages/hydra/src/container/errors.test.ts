import { describe, expect, it } from "vitest";

import {
  HydraFileError,
  InvalidChipSerialError,
  InvalidFileSizeError,
  UnrecognizedFileError,
  WrongChipSerialError,
} from "./errors";

describe("Hydra file errors", () => {
  const errors: [string, HydraFileError][] = [
    ["HydraFileError", new HydraFileError("something went wrong")],
    ["InvalidChipSerialError", new InvalidChipSerialError()],
    ["WrongChipSerialError", new WrongChipSerialError()],
    ["InvalidFileSizeError", new InvalidFileSizeError(".hcf file", 229_384, 1_024)],
    ["UnrecognizedFileError", new UnrecognizedFileError()],
  ];

  it.each(errors)("%s is an Error that carries its own class name", (name, error) => {
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HydraFileError);
    expect(error.name).toBe(name);
  });

  it("keeps the message given to the base class", () => {
    expect(new HydraFileError("something went wrong").message).toBe("something went wrong");
  });

  it("tells the user the chip serial must be 8 hexadecimal digits", () => {
    expect(new InvalidChipSerialError().message).toBe(
      "The chip serial must be exactly 8 hexadecimal digits (0-9 and A-F).",
    );
  });

  it("tells the user the chip serial does not match the file", () => {
    expect(new WrongChipSerialError().message).toBe("The chip serial does not match this file.");
  });

  it("names the expected and actual size with thousands separators", () => {
    const error = new InvalidFileSizeError(".hcf file", 229_384, 1_024);

    expect(error.message).toBe("A .hcf file must be 229,384 bytes; this file is 1,024 bytes.");
    expect(error.expected).toBe(229_384);
    expect(error.actual).toBe(1_024);
  });

  it("uses the last word of the subject to name the thing that has the wrong size", () => {
    const error = new InvalidFileSizeError("calibration image", 262_144, 5);

    expect(error.message).toBe("A calibration image must be 262,144 bytes; this image is 5 bytes.");
  });

  it("has a default message for an unrecognized file and accepts a custom one", () => {
    expect(new UnrecognizedFileError().message).toBe(
      "This file is not in a format this tool reads.",
    );
    expect(new UnrecognizedFileError("Cannot read it.").message).toBe("Cannot read it.");
  });
});
