import { formatTireSize, parseTireSize, STOCK_TIRE, TIRE_CHART } from "@seven-tree/hydra";
import { describe, expect, it } from "vitest";

import { formatTireSizeValue, parseTireSizeValue, selectTireSizeOptions } from "./tire-options";

describe("selectTireSizeOptions", () => {
  const options = selectTireSizeOptions();

  it("offers every size of the tire chart, in chart order, with its id, label and tire", () => {
    expect(options).toHaveLength(TIRE_CHART.length);
    expect(options.map((option) => option.id)).toEqual(TIRE_CHART.map((entry) => entry.id));
    expect(options.map((option) => option.label)).toEqual(TIRE_CHART.map((entry) => entry.label));
    expect(options.map((option) => option.value)).toEqual(TIRE_CHART.map((entry) => entry.tire));
  });

  it("puts the factory size first in the Factory group, with its note", () => {
    expect(options[0]).toEqual({
      id: "LT235/85R16",
      label: "LT235/85R16",
      group: "Factory",
      note: "1996 F-350 factory size",
      value: STOCK_TIRE,
    });
    expect(options.filter((option) => option.group === "Factory")).toHaveLength(1);
  });

  it("gives every other size its rim as the group, written as 15 in rims or 16.5 in rims", () => {
    for (const option of options.slice(1)) {
      expect(option.group).toBe(`${option.value.rimDiameterIn} in rims`);
    }
    const groups = new Set(options.map((option) => option.group));
    expect([...groups]).toEqual([
      "Factory",
      "15 in rims",
      "16 in rims",
      "16.5 in rims",
      "17 in rims",
      "18 in rims",
      "19 in rims",
      "20 in rims",
      "22 in rims",
      "24 in rims",
    ]);
  });

  it("keeps each group together, so a group never appears twice", () => {
    const runs = options
      .map((option) => option.group)
      .filter((group, index, all) => group !== all[index - 1]);
    expect(new Set(runs).size).toBe(runs.length);
  });

  it("gives only the factory size a note", () => {
    expect(
      options.filter((option) => option.note !== undefined).map((option) => option.id),
    ).toEqual(["LT235/85R16"]);
    expect(options.slice(1).some((option) => "note" in option)).toBe(false);
  });

  it("lists a metric size and a flotation size, each as the value the fields component takes", () => {
    expect(options.find((option) => option.id === "315/75R16")?.value).toEqual({
      kind: "metric",
      widthMm: 315,
      aspectRatio: 75,
      rimDiameterIn: 16,
    });
    expect(options.find((option) => option.id === "35x12.50R17")?.value).toEqual({
      kind: "flotation",
      diameterIn: 35,
      widthIn: 12.5,
      rimDiameterIn: 17,
    });
  });
});

describe("parseTireSizeValue", () => {
  it("reads a metric size and a flotation size the way parseTireSize does", () => {
    expect(parseTireSizeValue("LT315/75R16")).toEqual(parseTireSize("LT315/75R16"));
    expect(parseTireSizeValue("35x12.50R17")).toEqual({
      kind: "flotation",
      diameterIn: 35,
      widthIn: 12.5,
      rimDiameterIn: 17,
    });
  });

  it("returns undefined for text that is not a size", () => {
    expect(parseTireSizeValue("")).toBeUndefined();
    expect(parseTireSizeValue("315/75")).toBeUndefined();
    expect(parseTireSizeValue("501/75R16")).toBeUndefined();
  });
});

describe("formatTireSizeValue", () => {
  it("writes a size the way formatTireSize does", () => {
    expect(formatTireSizeValue(STOCK_TIRE)).toBe(formatTireSize(STOCK_TIRE));
    expect(formatTireSizeValue(STOCK_TIRE)).toBe("235/85R16");
    expect(
      formatTireSizeValue({ kind: "flotation", diameterIn: 35, widthIn: 12.5, rimDiameterIn: 17 }),
    ).toBe("35x12.50R17");
  });
});
