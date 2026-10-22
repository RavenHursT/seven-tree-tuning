import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildChart,
  isLightTruckSize,
  LIGHT_TRUCK_FILTER,
  parseArguments,
  readWheelSizeChart,
  renderChartModule,
} from "../../../../tools/update-tire-chart";
import { formatTireSize, parseTireSize, STOCK_TIRE } from "./tire";
import type { TireSize } from "./tire";
import { TIRE_CHART } from "./tire-chart";

/** A size from its text. The test fails on a typo instead of passing `undefined` on. */
function tire(text: string): TireSize {
  const parsed = parseTireSize(text);
  if (!parsed) throw new Error(`Not a tire size: ${text}`);
  return parsed;
}

function labelsOf(entries: readonly { label: string }[]): string[] {
  return entries.map((entry) => entry.label);
}

// The two sections of https://tiresize.com/chart/, cut down to a few sizes but with the same
// markup: one tab page per rim, one <div> per rounded diameter, one <a> per size. A metric size
// has its inch conversion as plain text after the link. The same sizes repeat in the second
// section, "by Diameter", and that section also lists 32X10R16, which the first one does not.
const WHEEL_SIZE_SECTION = `
<div id="tabwrapper">
<h2 style="text-align:center">Tire Size Charts by Wheel Size</h2>
  <div id="tabContainer">
    <div class="tabs">
      <ul>
        <li id="tabHeader_1">16"</li>
        <li id="tabHeader_2">16.5"</li>
      </ul>
    </div>
    <div class="tabscontent">
<div class="tabpage" id="tabpage_1">
<h3>Tire Size Chart for 16" Wheels</h3>
<div><h4>31" Tire Diameter</h4>
<a href="/tiresizes/265-75R16.htm">265/75R16</a> = 31.6x10.4R16<br><a href="/tiresizes/31X10.50R16.htm">31X10.5R16</a><br><a href="/tiresizes/31X11R16.htm">31X11R16</a><br><a href="/tiresizes/7.50R16.htm">7.5R16</a> = 31.8x8.7R16<br></div>
<div><h4>34" Tire Diameter</h4>
<a href="/tiresizes/315-75R16.htm">315/75R16</a> = 34.6x12.4R16<br><a href="/tiresizes/34X12.50R16.htm">34X12.5R16</a><br><a href="/tiresizes/315-75R16.htm">315/75R16</a> = 34.6x12.4R16<br></div>
</div>
<div class="tabpage" id="tabpage_2">
<h3>Tire Size Chart for 16.5" Wheels</h3>
<div><h4>33" Tire Diameter</h4>
<a href="/tiresizes/33X12.50R16.5.htm">33X12.5R16.5</a><br></div>
<div><h4>38" Tire Diameter</h4>
<a href="/tiresizes/38.5X14.50R16.5.htm">38.5X14.5R16.5</a><br></div>
</div>
      </div><!--close_tab_content-->
    </div><!--close_tab_container-->
  </div><!--close_tab_wrapper-->
`;

const DIAMETER_SECTION = `
<div id="tabwrapper2">
<h2 style="text-align:center">Tire Size Charts by Diameter</h2>
  <div id="tabContainer2">
    <div class="tabscontent2">
<div class="tabpage2" id="tabpage2_1">
<h3>31" Diameter Tire Size Chart</h3>
<div><h4>16" Wheels</h4>
<a href="/tiresizes/265-75R16.htm">265/75R16</a> = 31.6x10.4R16<br><a href="/tiresizes/32X10R16.htm">32X10R16</a><br></div>
</div>
      </div><!--close_tab_content2-->
    </div><!--close_tab_container2-->
  </div><!--close_tab_wrapper2-->
`;

/** A page where markup-like text sits in a script, a comment and a quoted attribute. */
function page(...sections: string[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<title>Tire Size Chart</title>
<script>
  if (a < b && c > d) { document.write('<h2>Tire Size Charts by Wheel Size</h2><a href="x">99/99R99</a>'); }
</script>
</head>
<body>
<!-- <h2>Tire Size Charts by Wheel Size</h2><a href="x">99X99R99</a> -->
<div id="Wrapper" data-note="a > b <h2>Tire Size Charts by Wheel Size</h2>">
<!-- begin charts -->
${sections.join("\n")}
<!-- end charts -->
</div>
</body>
</html>`;
}

describe("readWheelSizeChart", () => {
  const reading = readWheelSizeChart(page(WHEEL_SIZE_SECTION, DIAMETER_SECTION));

  it("reads every size of the by-wheel-size section, in page order, as a metric or flotation size", () => {
    expect(reading.tires.map(formatTireSize)).toEqual([
      "265/75R16",
      "31x10.50R16",
      "31x11R16",
      "315/75R16",
      "34x12.50R16",
      "315/75R16",
      "33x12.50R16.5",
      "38.5x14.50R16.5",
    ]);
    expect(reading.tires[0]?.kind).toBe("metric");
    expect(reading.tires[1]?.kind).toBe("flotation");
  });

  it("reads only the link text, so the inch conversion of a metric size is not a flotation size", () => {
    const conversions = ["31.6x10.4R16", "34.6x12.4R16", "31.8x8.7R16"];
    const flotation = reading.tires.filter((size) => size.kind === "flotation").map(formatTireSize);
    for (const conversion of conversions) {
      expect(flotation).not.toContain(formatTireSize(tire(conversion)));
    }
    expect(flotation).toEqual([
      "31x10.50R16",
      "31x11R16",
      "34x12.50R16",
      "33x12.50R16.5",
      "38.5x14.50R16.5",
    ]);
  });

  it("leaves out the by-diameter section that repeats the sizes", () => {
    expect(reading.tires.map(formatTireSize)).not.toContain("32x10R16");
  });

  it("reports an entry that is neither a metric nor a flotation size, and does not read its conversion", () => {
    expect(reading.unreadable).toEqual(["7.5R16"]);
    expect(reading.tires.map(formatTireSize)).not.toContain("31.8x8.70R16");
  });

  it("ignores headings and links inside a script, a comment or a quoted attribute", () => {
    expect(reading.tires.map(formatTireSize)).not.toContain("99/99R99");
    expect(reading.tires).toHaveLength(8);
  });

  it("reads the same sizes when the markup has upper-case tags, single quotes and unclosed items", () => {
    const loose = `<HTML><BODY><DIV><H2>Tire Size Charts by Wheel Size</H2>
      <UL><LI>16"<LI>17"</UL>
      <DIV class='tabpage'><H3>Tire Size Chart for 16" Wheels</H3>
      <P><A HREF='/x'>265/75R16</A> = 31.6x10.4R16<BR><A HREF='/y'>31X10.5R16</A><BR></DIV></DIV>`;
    expect(readWheelSizeChart(loose).tires.map(formatTireSize)).toEqual([
      "265/75R16",
      "31x10.50R16",
    ]);
  });

  it("fails when the page has no by-wheel-size section", () => {
    expect(() => readWheelSizeChart(page(DIAMETER_SECTION))).toThrow(
      'no "Tire Size Charts by Wheel Size" section',
    );
  });

  it("fails when a tab page has a heading that is not a wheel size", () => {
    const broken = WHEEL_SIZE_SECTION.replace('Tire Size Chart for 16" Wheels', "Something else");
    expect(() => readWheelSizeChart(page(broken))).toThrow('"Something else"');
  });

  it("fails when a size is listed under another wheel size", () => {
    const broken = WHEEL_SIZE_SECTION.replace(">31X11R16<", ">31X11R17<");
    expect(() => readWheelSizeChart(page(broken))).toThrow("31x11R17");
  });

  it("fails when the section lists no size", () => {
    const empty = `<div><h2>Tire Size Charts by Wheel Size</h2><div class="tabpage"><h3>Tire Size Chart for 16" Wheels</h3></div></div>`;
    expect(() => readWheelSizeChart(page(empty))).toThrow("lists no tire size");
  });
});

describe("isLightTruckSize", () => {
  it.each([
    ["265/75R16", "an ordinary light-truck size"],
    ["195/80R16", "a metric width of exactly 195 mm"],
    ["275/55R20", "a metric aspect ratio of exactly 55"],
    ["215/65R17", "an overall diameter just above 28 in"],
    ["31x8.5R15", "a flotation width of exactly 8.5 in"],
    ["28x9.50R15", "an overall diameter of exactly 28 in"],
    ["44x15.50R20", "an overall diameter of exactly 44 in"],
    ["33x12.50R16.5", "a rim of 16.5 in"],
    ["35x12.50R24", "the largest rim"],
  ])("accepts %s: %s", (text) => {
    expect(isLightTruckSize(tire(text))).toBe(true);
  });

  it.each([
    ["265/70R21", "a rim that is not in the filter"],
    ["35x12.50R21", "a flotation rim that is not in the filter"],
    ["185/85R16", "a metric width under 195 mm"],
    ["315/50R20", "a metric aspect ratio under 55"],
    ["275/60R15", "an overall diameter just under 28 in"],
    ["31x8R15", "a flotation width under 8.5 in"],
    ["27.9x9.50R15", "a flotation diameter under 28 in"],
    ["44.5x15.50R20", "a flotation diameter over 44 in"],
    ["33x12.50R14", "a rim under the filter"],
  ])("rejects %s: %s", (text) => {
    expect(isLightTruckSize(tire(text))).toBe(false);
  });

  it("states the filter in one constant the generated file's header is written from", () => {
    expect(LIGHT_TRUCK_FILTER).toEqual({
      rimDiametersIn: [15, 16, 16.5, 17, 18, 19, 20, 22, 24],
      minMetricWidthMm: 195,
      minMetricAspectRatio: 55,
      minFlotationWidthIn: 8.5,
      minOverallDiameterIn: 28,
      maxOverallDiameterIn: 44,
    });
  });
});

describe("buildChart", () => {
  const sizes = [
    "315/75R16",
    "265/75R16",
    "235/85R16",
    "35x12.50R17",
    "35x12.50R17",
    "31x10.50R15",
    "265/70R21",
    "285/75R16",
    "37x12.50R17",
    "33x12.50R15",
    "35x13.50R17",
    "185/85R16",
  ].map(tire);

  it("starts with the factory entry, built from STOCK_TIRE, with the only note", () => {
    const [factory, ...rest] = buildChart(sizes);
    expect(factory).toEqual({
      id: "LT235/85R16",
      label: "LT235/85R16",
      tire: STOCK_TIRE,
      note: "1996 F-350 factory size",
    });
    expect(rest.some((entry) => "note" in entry)).toBe(false);
  });

  it("starts with the factory entry even when the page does not list 235/85R16", () => {
    const chart = buildChart([tire("315/75R16")]);
    expect(labelsOf(chart)).toEqual(["LT235/85R16", "315/75R16"]);
  });

  it("drops 235/85R16 from the list because the factory entry covers it", () => {
    expect(labelsOf(buildChart(sizes))).not.toContain("235/85R16");
    expect(labelsOf(buildChart(sizes)).filter((label) => label.includes("235/85"))).toEqual([
      "LT235/85R16",
    ]);
  });

  it("keeps one entry for each set of dimensions, and drops a size outside the filter", () => {
    const labels = labelsOf(buildChart(sizes));
    expect(labels.filter((label) => label === "35x12.50R17")).toHaveLength(1);
    expect(labels).not.toContain("265/70R21");
    expect(labels).not.toContain("185/85R16");
  });

  it("sorts by rim diameter, then overall diameter, then label", () => {
    expect(labelsOf(buildChart(sizes))).toEqual([
      "LT235/85R16",
      "31x10.50R15",
      "33x12.50R15",
      "265/75R16",
      "285/75R16",
      "315/75R16",
      "35x12.50R17",
      "35x13.50R17",
      "37x12.50R17",
    ]);
  });

  it("orders sizes of the same rim and diameter by label, with the numbers in the label compared as numbers", () => {
    const sameDiameter = ["35x12.50R17", "35x10.50R17", "35x9.50R17", "35x10R17", "35x15R17"];
    expect(labelsOf(buildChart(sameDiameter.map(tire)).slice(1))).toEqual([
      "35x9.50R17",
      "35x10R17",
      "35x10.50R17",
      "35x12.50R17",
      "35x15R17",
    ]);
  });

  it("writes each label the way formatTireSize writes it, and uses it as the id", () => {
    for (const entry of buildChart(sizes).slice(1)) {
      expect(entry.label).toBe(formatTireSize(entry.tire));
      expect(entry.id).toBe(entry.label);
    }
  });
});

describe("renderChartModule", () => {
  const entries = buildChart(
    ["265/75R16", "315/75R16", "35x12.50R17", "38.5x14.50R17", "31x11R15"].map(tire),
  );
  const source = renderChartModule(entries, "2026-10-22");

  it("starts with a comment that names the source, the retrieval date, the filter and the generator", () => {
    const header = source.slice(0, source.indexOf("\nimport "));
    expect(header.split("\n").every((line) => line === "" || line.startsWith("//"))).toBe(true);
    expect(header).toContain("https://tiresize.com/chart/");
    expect(header).toContain("Retrieved: 2026-10-22");
    expect(header).toContain("rim diameter: 15, 16, 16.5, 17, 18, 19, 20, 22 or 24 in");
    expect(header).toContain("section width of at least 195 mm and aspect ratio of at least 55");
    expect(header).toContain("section width of at least 8.5 in");
    expect(header).toContain("overall diameter: 28 to 44 in, both included");
    expect(header).toContain("Generated by tools/update-tire-chart.ts; do not edit by hand.");
  });

  it("imports STOCK_TIRE and the entry type, and exports the entries as TIRE_CHART", () => {
    expect(source).toContain('import { STOCK_TIRE, type TireChartEntry } from "./tire";');
    expect(source).toContain("export const TIRE_CHART: readonly TireChartEntry[] = [\n");
    expect(source.endsWith("];\n")).toBe(true);
  });

  it("writes the factory entry on one line", () => {
    expect(source).toContain(
      '  { id: "LT235/85R16", label: "LT235/85R16", tire: STOCK_TIRE, note: "1996 F-350 factory size" },\n',
    );
  });

  it("writes a metric entry with one property to a line", () => {
    expect(source).toContain(
      [
        "  {",
        '    id: "315/75R16",',
        '    label: "315/75R16",',
        '    tire: { kind: "metric", widthMm: 315, aspectRatio: 75, rimDiameterIn: 16 },',
        "  },",
        "",
      ].join("\n"),
    );
  });

  it("writes a flotation entry with the diameter and width as numbers", () => {
    expect(source).toContain(
      [
        "  {",
        '    id: "38.5x14.50R17",',
        '    label: "38.5x14.50R17",',
        '    tire: { kind: "flotation", diameterIn: 38.5, widthIn: 14.5, rimDiameterIn: 17 },',
        "  },",
        "",
      ].join("\n"),
    );
  });

  it("writes the entries in the order it is given", () => {
    const positions = labelsOf(entries).map((label) => source.indexOf(`label: "${label}"`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("the committed tire-chart.ts", () => {
  const text = readFileSync(new URL("./tire-chart.ts", import.meta.url), "utf8");

  it("is exactly what the generator writes for its own entries, so nobody edited it by hand", () => {
    const retrieved = /^\/\/ Retrieved: (\d{4}-\d{2}-\d{2})$/m.exec(text)?.[1];
    expect(retrieved).toBeDefined();
    expect(renderChartModule(TIRE_CHART, retrieved ?? "")).toBe(text);
  });
});

describe("parseArguments", () => {
  it("takes the path of the saved page", () => {
    expect(parseArguments(["chart.html"])).toEqual({ htmlPath: "chart.html" });
  });

  it("takes the retrieval date and the output file", () => {
    expect(
      parseArguments(["--retrieved", "2026-10-22", "chart.html", "--out", "out/tire-chart.ts"]),
    ).toEqual({ htmlPath: "chart.html", retrieved: "2026-10-22", outPath: "out/tire-chart.ts" });
  });

  const REFUSED: [argv: string[], message: string][] = [
    [[], "usage:"],
    [["a.html", "b.html"], "usage:"],
    [["--unknown", "a.html"], "usage:"],
    [["a.html", "--retrieved"], "usage:"],
    [["a.html", "--retrieved", "22 Oct 2026"], "YYYY-MM-DD"],
    [["a.html", "--retrieved", "2026-13-40"], "YYYY-MM-DD"],
  ];

  it.each(REFUSED)("refuses %j", (argv, message) => {
    expect(() => parseArguments(argv)).toThrow(message);
  });
});
