import { parseLibraryIndex } from "@seven-tree/hydra";
import { describe, expect, it } from "vitest";

import { toLibraryTuneOption } from "./library-options";

describe("toLibraryTuneOption", () => {
  it("keeps what the picker shows and names the category", () => {
    const [tow] = parseLibraryIndex("VCAB0_02_65TVB.efu");
    expect(tow && toLibraryTuneOption(tow)).toEqual({
      fileName: "VCAB0_02_65TVB.efu",
      code: "65TVB",
      label: tow?.label,
      description: tow?.description,
      category: "towing",
      categoryLabel: "Towing",
      valveBody: true,
    });
  });

  it("leaves out an empty description", () => {
    const [stock] = parseLibraryIndex("VCAB0_02_0S.efu");
    expect(stock && "description" in toLibraryTuneOption(stock)).toBe(false);
  });
});
