/**
 * Base class of every error that describes a problem with a file or a chip serial. The message
 * is short, plain and written for the person using the web app.
 */
export class HydraFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HydraFileError";
  }
}

/** The chip serial is not exactly 8 hexadecimal digits. */
export class InvalidChipSerialError extends HydraFileError {
  constructor() {
    super("The chip serial must be exactly 8 hexadecimal digits (0-9 and A-F).");
    this.name = "InvalidChipSerialError";
  }
}

/** The file decrypted to noise, so it was made for a different chip serial. */
export class WrongChipSerialError extends HydraFileError {
  constructor() {
    super("The chip serial does not match this file.");
    this.name = "WrongChipSerialError";
  }
}

/** A file or image does not have the byte length its format requires. */
export class InvalidFileSizeError extends HydraFileError {
  /** The byte length the format requires. */
  readonly expected: number;
  /** The byte length that was given. */
  readonly actual: number;

  /**
   * @param subject A noun phrase such as ".hcf file". Its last word names the thing that has
   * the wrong size in the message.
   */
  constructor(subject: string, expected: number, actual: number) {
    const noun = subject.slice(subject.lastIndexOf(" ") + 1);
    super(
      `A ${subject} must be ${formatCount(expected)} bytes; ` +
        `this ${noun} is ${formatCount(actual)} bytes.`,
    );
    this.name = "InvalidFileSizeError";
    this.expected = expected;
    this.actual = actual;
  }
}

/** The file does not match any format this library reads. */
export class UnrecognizedFileError extends HydraFileError {
  constructor(message = "This file is not in a format this tool reads.") {
    super(message);
    this.name = "UnrecognizedFileError";
  }
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
