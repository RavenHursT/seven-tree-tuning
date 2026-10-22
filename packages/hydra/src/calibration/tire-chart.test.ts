import { describe, expect, it } from "vitest";

import { formatTireSize, parseTireSize, STOCK_TIRE, tireDiameterIn } from "./tire";
import type { TireChartEntry, TireSize } from "./tire";
import { TIRE_CHART } from "./tire-chart";

// The light-truck filter the chart is built with, written out here on purpose: the generator
// (tools/update-tire-chart.ts) states the same numbers, and this test fails if they drift apart.
const RIM_DIAMETERS_IN = [15, 16, 16.5, 17, 18, 19, 20, 22, 24];
const MIN_METRIC_WIDTH_MM = 195;
const MIN_METRIC_ASPECT_RATIO = 55;
const MIN_FLOTATION_WIDTH_IN = 8.5;
const MIN_DIAMETER_IN = 28;
const MAX_DIAMETER_IN = 44;

const FACTORY_NOTE = "1996 F-350 factory size";

function labels(entries: readonly TireChartEntry[]): string[] {
  return entries.map((entry) => entry.label);
}

function dimensions(tire: TireSize): string {
  return tire.kind === "metric"
    ? `metric ${tire.widthMm} ${tire.aspectRatio} ${tire.rimDiameterIn}`
    : `flotation ${tire.diameterIn} ${tire.widthIn} ${tire.rimDiameterIn}`;
}

/** The numbers in a label, in order: "35x12.50R17" gives [35, 12.5, 17]. */
function numbersIn(label: string): number[] {
  return (label.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** Compares two lists of numbers from the first number on, a shorter list first when equal so far. */
function compareNumbers(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function compareEntries(a: TireChartEntry, b: TireChartEntry): number {
  return (
    a.tire.rimDiameterIn - b.tire.rimDiameterIn ||
    tireDiameterIn(a.tire) - tireDiameterIn(b.tire) ||
    compareNumbers(numbersIn(a.label), numbersIn(b.label))
  );
}

describe("TIRE_CHART", () => {
  it("starts with the 1996 F-350 factory size, LT235/85R16, built from STOCK_TIRE", () => {
    expect(TIRE_CHART[0]).toEqual({
      id: "LT235/85R16",
      label: "LT235/85R16",
      tire: STOCK_TIRE,
      note: FACTORY_NOTE,
    });
  });

  it("gives the factory size the only note", () => {
    const withNote = TIRE_CHART.filter((entry) => entry.note !== undefined);
    expect(withNote.map((entry) => entry.label)).toEqual(["LT235/85R16"]);
    expect(TIRE_CHART.slice(1).some((entry) => "note" in entry)).toBe(false);
  });

  it.each(["265/75R16", "285/75R16", "315/75R16", "33x12.50R15", "35x12.50R17", "37x12.50R17"])(
    "lists %s",
    (label) => {
      expect(labels(TIRE_CHART)).toContain(label);
    },
  );

  it("lists both kinds of size on every rim of the filter", () => {
    const rims = new Set(TIRE_CHART.map((entry) => entry.tire.rimDiameterIn));
    expect([...rims].sort((a, b) => a - b)).toEqual(RIM_DIAMETERS_IN);
    expect(TIRE_CHART.some((entry) => entry.tire.kind === "metric")).toBe(true);
    expect(TIRE_CHART.some((entry) => entry.tire.kind === "flotation")).toBe(true);
  });

  it("offers a comprehensive list of sizes, not a handful", () => {
    expect(TIRE_CHART.length).toBeGreaterThan(400);
  });

  it("keeps every entry inside the light-truck filter", () => {
    for (const { label, tire } of TIRE_CHART) {
      const diameter = tireDiameterIn(tire);
      expect(RIM_DIAMETERS_IN, `${label} rim`).toContain(tire.rimDiameterIn);
      expect(diameter, `${label} overall diameter`).toBeGreaterThanOrEqual(MIN_DIAMETER_IN);
      expect(diameter, `${label} overall diameter`).toBeLessThanOrEqual(MAX_DIAMETER_IN);
      if (tire.kind === "metric") {
        expect(tire.widthMm, `${label} width`).toBeGreaterThanOrEqual(MIN_METRIC_WIDTH_MM);
        expect(tire.aspectRatio, `${label} aspect`).toBeGreaterThanOrEqual(MIN_METRIC_ASPECT_RATIO);
      } else {
        expect(tire.widthIn, `${label} width`).toBeGreaterThanOrEqual(MIN_FLOTATION_WIDTH_IN);
      }
    }
  });

  it("has no two entries with the same dimensions", () => {
    const seen = new Map<string, string>();
    for (const { label, tire } of TIRE_CHART) {
      const key = dimensions(tire);
      expect(seen.get(key), `${label} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, label);
    }
  });

  it("lists 235/85R16 only as the factory entry", () => {
    const labelsOfThatSize = TIRE_CHART.filter(
      ({ tire }) => dimensions(tire) === dimensions(STOCK_TIRE),
    ).map((entry) => entry.label);
    expect(labelsOfThatSize).toEqual(["LT235/85R16"]);
  });

  it("sorts the sizes after the factory entry by rim, overall diameter, then the numbers in the label", () => {
    const rest = TIRE_CHART.slice(1);
    for (let index = 1; index < rest.length; index++) {
      const before = rest[index - 1] as TireChartEntry;
      const after = rest[index] as TireChartEntry;
      expect(compareEntries(before, after), `${before.label} before ${after.label}`).toBeLessThan(
        0,
      );
    }
  });

  it("gives each entry a unique id that is its label", () => {
    expect(new Set(TIRE_CHART.map((entry) => entry.id)).size).toBe(TIRE_CHART.length);
    for (const entry of TIRE_CHART) expect(entry.id).toBe(entry.label);
  });

  it("writes each label the way formatTireSize writes the size, apart from the factory prefix", () => {
    for (const { label, tire } of TIRE_CHART.slice(1)) expect(label).toBe(formatTireSize(tire));
    expect(formatTireSize(STOCK_TIRE)).toBe("235/85R16");
  });

  it("gives each label a size parseTireSize reads back to the same tire", () => {
    for (const { label, tire } of TIRE_CHART) expect(parseTireSize(label), label).toEqual(tire);
  });
});
