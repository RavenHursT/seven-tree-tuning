import { describe, expect, it } from "vitest";

import { containerFormatFromFileName } from "./file-name";

describe("containerFormatFromFileName", () => {
  it.each([
    ["TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf", "hcf"],
    ["VCAB0_02_65T.efu", "efu"],
    ["base.bin", "bin"],
  ])("reads the format of %s as %s", (fileName, format) => {
    expect(containerFormatFromFileName(fileName)).toBe(format);
  });

  it.each([
    ["TUNE.HCF", "hcf"],
    ["Tune.Efu", "efu"],
    ["IMAGE.BiN", "bin"],
  ])("ignores the case of the extension in %s", (fileName, format) => {
    expect(containerFormatFromFileName(fileName)).toBe(format);
  });

  it.each([
    ["my.tune.v2.hcf", "hcf"],
    ["C:\\Users\\me\\tune.bin", "bin"],
    ["/home/me/library.v1/tune.efu", "efu"],
    [".hcf", "hcf"],
  ])("uses only the part after the last dot of the name in %s", (fileName, format) => {
    expect(containerFormatFromFileName(fileName)).toBe(format);
  });

  it.each([
    "",
    "tune",
    "tune.",
    "tune.pcm",
    "tune.hcf.bak",
    "tune.hcfx",
    "tune.hc",
    "hcf",
    "folder.hcf/tune",
    "folder.hcf\\tune",
    "tune.constructor",
    "tune.__proto__",
    "tune.toString",
  ])("returns undefined for %j", (fileName) => {
    expect(containerFormatFromFileName(fileName)).toBeUndefined();
  });
});
