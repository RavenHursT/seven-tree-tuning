import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LIBRARY_CATEGORY_ORDER, TDE1_LIBRARY_PREFIX, parseLibraryIndex } from "./index";
import type { LibraryTune } from "./index";

/** 289 file names copied from PHP's live index on 2026-10-21: all 35 TDE1 names and 254 others. */
const SAMPLE_INDEX = readFileSync(
  new URL("./fixtures/php-index-sample.txt", import.meta.url),
  "utf8",
);

const SORTED_TDE1_CODES = [
  // stock: Stock before Modified Stock, then plain before VB
  "0S",
  "0MS",
  "0MSVB",
  // towing
  "25T",
  "25TVB",
  "40T",
  "40TVB",
  "65T",
  "65TVB",
  "80T",
  "80TVB",
  // daily: Daily Driver before Fuel Sipper
  "40DD",
  "40DDVB",
  "65DD",
  "65DDVB",
  "80DD",
  "80DDVB",
  "65FS",
  "65FSVB",
  // performance
  "65P",
  "65PVB",
  "80P",
  "80PVB",
  // utility, in the order of PHP's Hydra page: High Idle, Anti-Theft, Whisper, Valet
  "0HI1000",
  "0HI1100",
  "0HI1200",
  "0HIVB1000",
  "0HIVB1100",
  "0HIVB1200",
  "0AT",
  "0ATVB",
  "0WM",
  "0WMVB",
  "0VM35",
  "0VMVB35",
];

function fileNamesFor(codes: readonly string[]): string[] {
  return codes.map((code) => `${TDE1_LIBRARY_PREFIX}${code}.efu`);
}

function codesOf(tunes: readonly LibraryTune[]): string[] {
  return tunes.map((tune) => tune.code);
}

describe("parseLibraryIndex on a sample of PHP's live index", () => {
  it("keeps the 35 TDE1 tunes and drops the 254 names of other calibrations", () => {
    expect(SAMPLE_INDEX.trim().split("\n")).toHaveLength(289);
    const tunes = parseLibraryIndex(SAMPLE_INDEX);
    expect(tunes).toHaveLength(35);
    expect(tunes.every((tune) => tune.fileName.startsWith("VCAB0_02_"))).toBe(true);
  });

  it("orders them by category, then mode as PHP lists them, then horsepower, plain before VB, then code", () => {
    expect(codesOf(parseLibraryIndex(SAMPLE_INDEX))).toEqual(SORTED_TDE1_CODES);
  });

  it("gives the same result for CRLF line endings, which PHP's index uses", () => {
    const crlf = SAMPLE_INDEX.replace(/\n/g, "\r\n");
    expect(crlf).toContain("\r\n");
    expect(parseLibraryIndex(crlf)).toEqual(parseLibraryIndex(SAMPLE_INDEX));
  });

  it("puts every tune in one of the known categories, in category order", () => {
    const ranks = parseLibraryIndex(SAMPLE_INDEX).map((tune) =>
      LIBRARY_CATEGORY_ORDER.indexOf(tune.category),
    );
    expect(ranks.every((rank) => rank >= 0)).toBe(true);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("parseLibraryIndex output", () => {
  it("returns the file name, the code and everything the code says", () => {
    expect(parseLibraryIndex("VCAB0_02_65T.efu")).toStrictEqual([
      {
        fileName: "VCAB0_02_65T.efu",
        code: "65T",
        horsepower: 65,
        mode: "T",
        modeName: "Tow",
        valveBody: false,
        category: "towing",
        label: "Tow +65 hp",
        description: "Moderate loads, 7,500–10,000 lb",
      },
    ]);
  });

  it("returns an empty array for empty text and for text with no names", () => {
    expect(parseLibraryIndex("")).toEqual([]);
    expect(parseLibraryIndex(" \r\n\t\n\n")).toEqual([]);
  });
});

describe("parseLibraryIndex line handling", () => {
  const expected = fileNamesFor(["0S", "65T", "80P"]);

  it.each([
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["a lone CR", "\r"],
  ])("splits lines on %s", (_name, ending) => {
    const text = fileNamesFor(["80P", "0S", "65T"]).join(ending) + ending;
    expect(parseLibraryIndex(text).map((tune) => tune.fileName)).toEqual(expected);
  });

  it("reads a last line that has no line ending", () => {
    expect(parseLibraryIndex("VCAB0_02_0S.efu\r\nVCAB0_02_65T.efu")).toHaveLength(2);
  });

  it("skips blank lines and spaces or tabs around a name", () => {
    const text = "\r\n  VCAB0_02_0S.efu  \r\n\r\n\tVCAB0_02_65T.efu\t\r\n   \r\n";
    expect(parseLibraryIndex(text).map((tune) => tune.code)).toEqual(["0S", "65T"]);
  });

  it("skips a byte order mark at the start of the text", () => {
    expect(parseLibraryIndex("\uFEFFVCAB0_02_0S.efu\r\n")).toHaveLength(1);
  });

  it("lists a file name that appears twice only once", () => {
    const text = "VCAB0_02_65T.efu\r\nVCAB0_02_65T.efu\r\n  VCAB0_02_65T.efu";
    expect(parseLibraryIndex(text)).toHaveLength(1);
  });
});

describe("parseLibraryIndex lines that are not tunes", () => {
  it.each([
    ["a different file extension", "VCAB0_02_65T.hcf"],
    ["text after the extension", "VCAB0_02_65T.efu.bak"],
    ["no extension", "VCAB0_02_65T"],
    ["another calibration", "VCAB0_06_65T.efu"],
    ["a similar prefix", "VDAB0_02_65T.efu"],
    ["a prefix in lowercase", "vcab0_02_65T.efu"],
    ["a comment", "# VCAB0_02_65T.efu"],
    ["a code with no horsepower", "VCAB0_02_STOCK.efu"],
    ["a code with no mode letters", "VCAB0_02_65.efu"],
    ["a code with no characters", "VCAB0_02_.efu"],
  ])("ignores a line with %s", (_description, line) => {
    expect(parseLibraryIndex(`${line}\r\nVCAB0_02_0S.efu\r\n`).map((tune) => tune.code)).toEqual([
      "0S",
    ]);
  });

  it("keeps a tune with mode letters it does not know, as a utility tune", () => {
    expect(parseLibraryIndex("VCAB0_02_30ZZ.efu")).toMatchObject([
      { code: "30ZZ", modeName: "ZZ", category: "utility", label: "ZZ +30 hp" },
    ]);
  });
});

describe("parseLibraryIndex sorting", () => {
  it("compares horsepower as a number, so 100 comes after 65 and 80", () => {
    const text = fileNamesFor(["100P", "80P", "65P"]).join("\n");
    expect(codesOf(parseLibraryIndex(text))).toEqual(["65P", "80P", "100P"]);
  });

  it("sorts by horsepower before the VB flag, then puts a plain tune before its VB variant", () => {
    const text = fileNamesFor(["65PVB", "65P", "40PVB"]).join("\n");
    expect(codesOf(parseLibraryIndex(text))).toEqual(["40PVB", "65P", "65PVB"]);
  });

  it("breaks a tie by code", () => {
    const text = fileNamesFor(["65FS", "65DD"]).join("\n");
    expect(codesOf(parseLibraryIndex(text))).toEqual(["65DD", "65FS"]);
  });

  it("orders a mixed list by category before anything else", () => {
    const text = fileNamesFor(["80P", "100P", "65PVB", "65P", "0AT", "65DD", "25T", "0S", "65FS"]);
    expect(codesOf(parseLibraryIndex(text.join("\n")))).toEqual([
      "0S",
      "25T",
      "65DD",
      "65FS",
      "65P",
      "65PVB",
      "80P",
      "100P",
      "0AT",
    ]);
  });

  it("gives the same order for any order of the input lines", () => {
    const lines = SAMPLE_INDEX.split("\n").reverse().join("\n");
    expect(codesOf(parseLibraryIndex(lines))).toEqual(SORTED_TDE1_CODES);
  });
});

describe("parseLibraryIndex with another prefix", () => {
  const text = "VCAB0_02_65T.efu\r\nVCAB0_06_80P.efu\r\nVCAB0_06_0S.efu\r\n";

  it("reads only the names that start with the prefix it is given", () => {
    const tunes = parseLibraryIndex(text, "VCAB0_06_");
    expect(tunes.map((tune) => tune.fileName)).toEqual(["VCAB0_06_0S.efu", "VCAB0_06_80P.efu"]);
    expect(tunes[1]).toMatchObject({ code: "80P", horsepower: 80, mode: "P" });
  });

  it("reads real codes of other PHP calibrations, such as Race and Extreme", () => {
    const other = parseLibraryIndex("VSAA4R9_140X.efu\r\nVSAA4M9_120R.efu\r\n", "VSAA4R9_");
    expect(other).toMatchObject([{ modeName: "Extreme", label: "Extreme +140 hp" }]);
  });
});
