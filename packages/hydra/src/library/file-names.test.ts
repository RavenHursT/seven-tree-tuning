import { describe, expect, it } from "vitest";

import { PHP_LIBRARY_BASE_URL, isLibraryFileName, libraryTuneUrl } from "./index";

describe("isLibraryFileName", () => {
  it.each([
    "VCAB0_02_65T.efu",
    "VCAB0_02_0HIVB1100.efu",
    "VCAB0_02_0S.efu",
    "VCAB0_02_0VMVB35.efu",
  ])("accepts %s", (fileName) => {
    expect(isLibraryFileName(fileName)).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["a prefix and extension with no code", "VCAB0_02_.efu"],
    ["a prefix with no extension", "VCAB0_02_65T"],
    ["another calibration prefix", "VCAB0_06_65T.efu"],
    ["a prefix in lowercase", "vcab0_02_65T.efu"],
    ["a code in lowercase", "VCAB0_02_65t.efu"],
    ["another file extension", "VCAB0_02_65T.hcf"],
    ["an extension in uppercase", "VCAB0_02_65T.EFU"],
    ["a doubled extension", "VCAB0_02_65T.efu.efu"],
    ["a trailing newline", "VCAB0_02_65T.efu\n"],
    ["a leading space", " VCAB0_02_65T.efu"],
    ["a path before the name", "../VCAB0_02_65T.efu"],
    ["a path inside the code", "VCAB0_02_65T/../../secret.efu"],
    ["a backslash", "VCAB0_02_65T\\x.efu"],
    ["a query string", "VCAB0_02_65T.efu?x=1"],
    ["a fragment", "VCAB0_02_65T.efu#top"],
    ["a percent escape", "VCAB0_02_65%2FT.efu"],
    ["a whole URL", "https://example.com/VCAB0_02_65T.efu"],
  ])("rejects %s", (_description, fileName) => {
    expect(isLibraryFileName(fileName)).toBe(false);
  });

  it("rejects a value that is not a string", () => {
    expect(isLibraryFileName(undefined as unknown as string)).toBe(false);
    expect(isLibraryFileName(65 as unknown as string)).toBe(false);
  });

  it("checks against the prefix it is given", () => {
    expect(isLibraryFileName("VCAB0_06_65T.efu", "VCAB0_06_")).toBe(true);
    expect(isLibraryFileName("VCAB0_02_65T.efu", "VCAB0_06_")).toBe(false);
  });

  it("treats every character of a prefix as plain text", () => {
    expect(isLibraryFileName("A.B_65T.efu", "A.B_")).toBe(true);
    expect(isLibraryFileName("AxB_65T.efu", "A.B_")).toBe(false);
  });
});

describe("libraryTuneUrl", () => {
  it("puts the file name after the PHP library folder", () => {
    expect(libraryTuneUrl("VCAB0_02_65T.efu")).toBe(`${PHP_LIBRARY_BASE_URL}VCAB0_02_65T.efu`);
  });

  it.each(["", "../VCAB0_02_65T.efu", "https://example.com/VCAB0_02_65T.efu", "VCAB0_06_65T.efu"])(
    "throws a RangeError for %j",
    (fileName) => {
      expect(() => libraryTuneUrl(fileName)).toThrow(RangeError);
    },
  );

  it("names the rejected value in the error", () => {
    expect(() => libraryTuneUrl("evil.efu")).toThrow('"evil.efu"');
  });
});
