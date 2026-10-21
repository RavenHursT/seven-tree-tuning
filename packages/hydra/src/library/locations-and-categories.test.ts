import { describe, expect, it } from "vitest";

import {
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_CATEGORY_ORDER,
  PHP_LIBRARY_BASE_URL,
  PHP_LIBRARY_INDEX_URL,
  TDE1_LIBRARY_PREFIX,
} from "./index";

describe("PHP library locations", () => {
  it("names the folder that holds the tune files", () => {
    expect(PHP_LIBRARY_BASE_URL).toBe("https://local.gopowerhungry.com/hydra/downloads/_cal256k/");
  });

  it("names the index file inside that folder", () => {
    expect(PHP_LIBRARY_INDEX_URL).toBe(`${PHP_LIBRARY_BASE_URL}_all_files_v1.txt`);
  });

  it("uses the file name prefix of the TDE1 calibration (Cal_Lib.csv row VCAB0_02)", () => {
    expect(TDE1_LIBRARY_PREFIX).toBe("VCAB0_02_");
  });
});

describe("library categories", () => {
  it("lists the categories in display order", () => {
    expect(LIBRARY_CATEGORY_ORDER).toEqual(["stock", "towing", "daily", "performance", "utility"]);
  });

  it("gives every category a display label", () => {
    expect(LIBRARY_CATEGORY_LABELS).toEqual({
      stock: "Stock & diagnostic",
      towing: "Towing",
      daily: "Daily driving",
      performance: "Performance",
      utility: "Utility",
    });
  });

  it("has a label for exactly the categories in the order", () => {
    expect(Object.keys(LIBRARY_CATEGORY_LABELS).sort()).toEqual([...LIBRARY_CATEGORY_ORDER].sort());
  });
});
