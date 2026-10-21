import { describe, expect, it } from "vitest";

import { parseLibraryTuneCode, VALVE_BODY_NOTE } from "./index";
import type { LibraryCategory } from "./index";

type ExpectedTune = readonly [
  code: string,
  horsepower: number,
  mode: string,
  valveBody: boolean,
  parameter: number | undefined,
  category: LibraryCategory,
  label: string,
];

/** Every code in PHP's live TDE1 index on 2026-10-21 (35 files), with what each must parse to. */
const REAL_TDE1_CODES: readonly ExpectedTune[] = [
  ["0AT", 0, "AT", false, undefined, "utility", "Anti-Theft Mode"],
  ["0ATVB", 0, "AT", true, undefined, "utility", "Anti-Theft Mode · valve body"],
  ["0HI1000", 0, "HI", false, 1000, "utility", "High Idle 1,000 rpm"],
  ["0HI1100", 0, "HI", false, 1100, "utility", "High Idle 1,100 rpm"],
  ["0HI1200", 0, "HI", false, 1200, "utility", "High Idle 1,200 rpm"],
  ["0HIVB1000", 0, "HI", true, 1000, "utility", "High Idle 1,000 rpm · valve body"],
  ["0HIVB1100", 0, "HI", true, 1100, "utility", "High Idle 1,100 rpm · valve body"],
  ["0HIVB1200", 0, "HI", true, 1200, "utility", "High Idle 1,200 rpm · valve body"],
  ["0MS", 0, "MS", false, undefined, "stock", "Modified Stock"],
  ["0MSVB", 0, "MS", true, undefined, "stock", "Modified Stock · valve body"],
  ["0S", 0, "S", false, undefined, "stock", "Stock"],
  ["0VM35", 0, "VM", false, 35, "utility", "Valet Mode 35 mph"],
  ["0VMVB35", 0, "VM", true, 35, "utility", "Valet Mode 35 mph · valve body"],
  ["0WM", 0, "WM", false, undefined, "utility", "Whisper Mode"],
  ["0WMVB", 0, "WM", true, undefined, "utility", "Whisper Mode · valve body"],
  ["25T", 25, "T", false, undefined, "towing", "Tow +25 hp"],
  ["25TVB", 25, "T", true, undefined, "towing", "Tow +25 hp · valve body"],
  ["40DD", 40, "DD", false, undefined, "daily", "Daily Driver +40 hp"],
  ["40DDVB", 40, "DD", true, undefined, "daily", "Daily Driver +40 hp · valve body"],
  ["40T", 40, "T", false, undefined, "towing", "Tow +40 hp"],
  ["40TVB", 40, "T", true, undefined, "towing", "Tow +40 hp · valve body"],
  ["65DD", 65, "DD", false, undefined, "daily", "Daily Driver +65 hp"],
  ["65DDVB", 65, "DD", true, undefined, "daily", "Daily Driver +65 hp · valve body"],
  ["65FS", 65, "FS", false, undefined, "daily", "Fuel Sipper +65 hp"],
  ["65FSVB", 65, "FS", true, undefined, "daily", "Fuel Sipper +65 hp · valve body"],
  ["65P", 65, "P", false, undefined, "performance", "Performance +65 hp"],
  ["65PVB", 65, "P", true, undefined, "performance", "Performance +65 hp · valve body"],
  ["65T", 65, "T", false, undefined, "towing", "Tow +65 hp"],
  ["65TVB", 65, "T", true, undefined, "towing", "Tow +65 hp · valve body"],
  ["80DD", 80, "DD", false, undefined, "daily", "Daily Driver +80 hp"],
  ["80DDVB", 80, "DD", true, undefined, "daily", "Daily Driver +80 hp · valve body"],
  ["80P", 80, "P", false, undefined, "performance", "Performance +80 hp"],
  ["80PVB", 80, "P", true, undefined, "performance", "Performance +80 hp · valve body"],
  ["80T", 80, "T", false, undefined, "towing", "Tow +80 hp"],
  ["80TVB", 80, "T", true, undefined, "towing", "Tow +80 hp · valve body"],
];

describe("parseLibraryTuneCode on every code in PHP's TDE1 library", () => {
  it("covers all 35 files of the live index", () => {
    expect(REAL_TDE1_CODES).toHaveLength(35);
  });

  it.each(REAL_TDE1_CODES)(
    "reads horsepower, mode, valve body flag, parameter, category and label of %s",
    (code, horsepower, mode, valveBody, parameter, category, label) => {
      const tune = parseLibraryTuneCode(code);
      expect(tune).toMatchObject({ horsepower, mode, valveBody, category, label });
      expect(tune?.parameter).toBe(parameter);
      expect(tune).not.toHaveProperty("fileName");
      expect(tune).not.toHaveProperty("code");
    },
  );

  it("leaves the parameter key out when a code has no parameter", () => {
    expect(parseLibraryTuneCode("65T")).not.toHaveProperty("parameter");
    expect(parseLibraryTuneCode("0HI1100")).toHaveProperty("parameter", 1100);
  });
});

describe("parseLibraryTuneCode mode names", () => {
  it.each([
    ["0S", "Stock"],
    ["0MS", "Modified Stock"],
    ["25T", "Tow"],
    ["65DD", "Daily Driver"],
    ["65FS", "Fuel Sipper"],
    ["65P", "Performance"],
    ["100R", "Race"],
    ["140X", "Extreme"],
    ["0HI1000", "High Idle"],
    ["0AT", "Anti-Theft Mode"],
    ["0WM", "Whisper Mode"],
    ["0VM25", "Valet Mode"],
    ["0TD65", "Teen Driver"],
  ])("names the mode of %s as %s", (code, modeName) => {
    expect(parseLibraryTuneCode(code)?.modeName).toBe(modeName);
  });
});

describe("parseLibraryTuneCode categories beyond the live index", () => {
  it.each([
    ["100R", "performance", "Race +100 hp"],
    ["140X", "performance", "Extreme +140 hp"],
    ["100P", "performance", "Performance +100 hp"],
    ["0TD65", "utility", "Teen Driver 65 mph"],
    ["0TD75", "utility", "Teen Driver 75 mph"],
    ["0VM25", "utility", "Valet Mode 25 mph"],
    ["0VM45", "utility", "Valet Mode 45 mph"],
  ])("puts %s in %s with the label %s", (code, category, label) => {
    expect(parseLibraryTuneCode(code)).toMatchObject({ category, label });
  });
});

describe("parseLibraryTuneCode descriptions", () => {
  it.each([
    ["25T", "Extremely heavy loads, 12,500+ lb"],
    ["40T", "Heavy loads, 10,000–12,500 lb"],
    ["65T", "Moderate loads, 7,500–10,000 lb"],
    ["80T", "Light loads, up to 7,500 lb"],
  ])("gives the tow load class of %s", (code, description) => {
    expect(parseLibraryTuneCode(code)?.description).toBe(description);
  });

  it("gives no load class to a tow tune at a horsepower PHP does not list", () => {
    expect(parseLibraryTuneCode("50T")).toMatchObject({ label: "Tow +50 hp" });
    expect(parseLibraryTuneCode("50T")).not.toHaveProperty("description");
  });

  it("marks Fuel Sipper as a name from forums, not from PHP", () => {
    const description = parseLibraryTuneCode("65FS")?.description;
    expect(description).toContain("Fuel Sipper");
    expect(description).toContain("not on PHP's page");
    expect(description).toContain("forums");
  });

  it("explains the VB suffix once, as a forum report, instead of in every description", () => {
    expect(VALVE_BODY_NOTE).toContain("modified valve body");
    expect(VALVE_BODY_NOTE).toContain("softer shifts");
    expect(VALVE_BODY_NOTE).toContain("forums");
    expect(parseLibraryTuneCode("0ATVB")?.description).toBeUndefined();
  });

  it("gives a valve body tow variant the load class of the plain tune", () => {
    expect(parseLibraryTuneCode("65TVB")?.description).toBe("Moderate loads, 7,500–10,000 lb");
  });

  it("keeps the Fuel Sipper note on its valve body variant", () => {
    const description = parseLibraryTuneCode("65FSVB")?.description;
    expect(description).toContain("Fuel Sipper");
    expect(description).not.toContain("valve body");
  });

  it("gives the short note PHP prints for the diagnostic, quiet and speed limit modes", () => {
    expect(parseLibraryTuneCode("0MS")?.description).toBe("Diagnostic tune");
    expect(parseLibraryTuneCode("0WM")?.description).toBe("Quiet drive-thru");
    expect(parseLibraryTuneCode("0TD65")?.description).toBe("Speed limit");
  });

  it.each(["0S", "65DD", "65P", "0AT", "0HI1100", "0VM35"])(
    "gives %s no description when nothing needs explaining",
    (code) => {
      expect(parseLibraryTuneCode(code)).not.toHaveProperty("description");
    },
  );
});

describe("parseLibraryTuneCode splitting mode letters from the valve body flag", () => {
  it("reads VB after the mode letters as the valve body flag", () => {
    expect(parseLibraryTuneCode("0MSVB")).toMatchObject({ mode: "MS", valveBody: true });
    expect(parseLibraryTuneCode("0SVB")).toMatchObject({ mode: "S", valveBody: true });
  });

  it("reads a parameter that follows VB", () => {
    expect(parseLibraryTuneCode("0VMVB35")).toMatchObject({
      mode: "VM",
      valveBody: true,
      parameter: 35,
    });
  });

  it("does not treat the V of VM as the start of a valve body flag", () => {
    expect(parseLibraryTuneCode("0VM35")).toMatchObject({ mode: "VM", valveBody: false });
  });
});

describe("parseLibraryTuneCode with mode letters it does not know", () => {
  it("keeps the letters as the mode name and files the tune under utility", () => {
    expect(parseLibraryTuneCode("30ZZ")).toStrictEqual({
      horsepower: 30,
      mode: "ZZ",
      modeName: "ZZ",
      valveBody: false,
      category: "utility",
      label: "ZZ +30 hp",
    });
  });

  it("keeps a parameter and a valve body flag on an unknown mode", () => {
    expect(parseLibraryTuneCode("0ZZVB7")).toMatchObject({
      mode: "ZZ",
      valveBody: true,
      parameter: 7,
      category: "utility",
      label: "ZZ 7 · valve body",
    });
  });
});

describe("parseLibraryTuneCode with codes it cannot read", () => {
  it.each([
    ["an empty string", ""],
    ["mode letters with no horsepower", "S"],
    ["a horsepower with no mode letters", "65"],
    ["lowercase letters", "65t"],
    ["a space inside the code", "65 T"],
    ["a minus sign", "-5T"],
    ["a decimal point", "6.5T"],
    ["trailing punctuation", "65T!"],
    ["a file extension left on", "65T.efu"],
    ["a trailing newline", "65T\n"],
    ["a horsepower too large to be exact", "99999999999999999999T"],
    ["a parameter too large to be exact", "0HI99999999999999999999"],
  ])("returns undefined for %s", (_description, code) => {
    expect(parseLibraryTuneCode(code)).toBeUndefined();
  });
});
