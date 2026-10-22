#!/usr/bin/env bun
/**
 * update-tire-chart.ts - writes packages/hydra/src/calibration/tire-chart.ts, the list of
 * light-truck tire sizes the web editor offers, from a saved copy of https://tiresize.com/chart/.
 *
 *     bun tools/update-tire-chart.ts <chart.html> [--retrieved YYYY-MM-DD] [--out <file>]
 *
 * The tool reads the saved page and nothing else: it makes no network request. Save the page
 * first, for example with `curl -o chart.html https://tiresize.com/chart/`, and keep the saved
 * page out of the repository. Without --retrieved, the date of the file's last change is used.
 *
 * What it reads. The page has two charts that list the same sizes. This tool reads only the one
 * under the heading "Tire Size Charts by Wheel Size". It builds a tree from the page's markup,
 * finds that heading, and takes every <h3> below it ("Tire Size Chart for 16" Wheels") with the
 * links (<a>) that share its parent. The text of a link is the size. A metric size is followed by
 * its inch conversion as plain text outside the link ("155/70R13 = 21.5X6.1R13"), which is never
 * read. A link that `parseTireSize` does not read as a metric size ("315/75R16") or a flotation
 * size ("35X12.5R17") is skipped and reported. That covers the single-number sizes the page lists,
 * such as "7.5R16", and a size with a number outside `TIRE_SIZE_LIMITS`. Text is not decoded: a
 * link text with an entity in it is not a size and is skipped too.
 *
 * Light-truck filter. A size is kept only when all of these hold:
 *   - its rim diameter is 15, 16, 16.5, 17, 18, 19, 20, 22 or 24 in;
 *   - a metric size has a section width of at least 195 mm and an aspect ratio of at least 55;
 *   - a flotation size has a section width of at least 8.5 in;
 *   - its overall diameter is from 28 to 44 in, both included. A metric size gets its diameter
 *     from `tireDiameterIn`; a flotation size names it.
 * `LIGHT_TRUCK_FILTER` below holds these numbers, and the header of the generated file is
 * written from it.
 *
 * Output. The 1996 F-350 factory size LT235/85R16 comes first with the only note. The kept sizes
 * follow, one entry for each set of dimensions, sorted by rim diameter, then overall diameter,
 * then label, with the numbers in a label compared as numbers (35x9.50R17 before 35x10R17 before
 * 35x10.50R17). Labels are written the way `formatTireSize` writes them.
 *
 * Fails, and writes nothing, when the heading is missing, a tab page heading is not a wheel
 * size, a size sits under another wheel size, or the section lists no size.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// This file, not the package index: the index exports the chart file this tool writes, and a
// damaged chart file must not stop the tool that repairs it.
import {
  formatTireSize,
  parseTireSize,
  STOCK_TIRE,
  tireDiameterIn,
} from "../packages/hydra/src/calibration/tire";
import type { TireChartEntry, TireSize } from "../packages/hydra/src/calibration/tire";

const SOURCE_URL = "https://tiresize.com/chart/";
const SECTION_HEADING = "Tire Size Charts by Wheel Size";
const FACTORY_NOTE = "1996 F-350 factory size";
const DEFAULT_OUTPUT = fileURLToPath(
  new URL("../packages/hydra/src/calibration/tire-chart.ts", import.meta.url),
);
const USAGE =
  "usage: bun tools/update-tire-chart.ts <chart.html> [--retrieved YYYY-MM-DD] [--out <file>]";

/** The light-truck filter. See the header of this file. */
export const LIGHT_TRUCK_FILTER = {
  rimDiametersIn: [15, 16, 16.5, 17, 18, 19, 20, 22, 24],
  minMetricWidthMm: 195,
  minMetricAspectRatio: 55,
  minFlotationWidthIn: 8.5,
  minOverallDiameterIn: 28,
  maxOverallDiameterIn: 44,
} as const;

// --- Reading the page: a small tree of elements ----------------------------------------------

interface HtmlElement {
  readonly tag: string;
  readonly parent: HtmlElement | null;
  readonly children: HtmlNode[];
}

type HtmlNode = HtmlElement | string;

/** One piece of the page: some text, the start of an element, or the end of an element. */
type MarkupPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "start"; readonly tag: string }
  | { readonly kind: "end"; readonly tag: string };

/** Elements that never have content, so they have no end tag. */
const TAGS_WITHOUT_CONTENT = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Elements whose content is plain text up to their end tag, even when it holds "<". */
const TEXT_ONLY_TAGS = new Set(["script", "style", "textarea", "title"]);

/** A "<" that starts a tag, an end tag, a comment, a doctype or an instruction. */
const MARKUP_START = /<(?:[A-Za-z]|\/[A-Za-z]|!|\?)/g;
const TAG_NAME = /[A-Za-z][A-Za-z0-9-]*/y;

function nextMarkupStart(html: string, from: number): number {
  MARKUP_START.lastIndex = from;
  return MARKUP_START.exec(html)?.index ?? html.length;
}

function readTagName(html: string, from: number): string {
  TAG_NAME.lastIndex = from;
  return (TAG_NAME.exec(html)?.[0] ?? "").toLowerCase();
}

/** The position after the ">" that ends a tag. A ">" inside a quoted attribute value does not. */
function endOfTag(html: string, from: number): number {
  for (let position = from; position < html.length; position++) {
    const char = html.charAt(position);
    if (char === ">") return position + 1;
    if (char === '"' || char === "'") {
      const close = html.indexOf(char, position + 1);
      if (close === -1) return html.length;
      position = close;
    }
  }
  return html.length;
}

interface MarkupRead {
  /** The part that was read. A comment, a doctype or an instruction gives no part. */
  readonly part: MarkupPart | undefined;
  /** The position after it. */
  readonly end: number;
}

function readMarkup(html: string, open: number): MarkupRead {
  if (html.startsWith("<!--", open)) {
    const close = html.indexOf("-->", open + 4);
    return { part: undefined, end: close === -1 ? html.length : close + 3 };
  }
  const marker = html.charAt(open + 1);
  if (marker === "!" || marker === "?") {
    return { part: undefined, end: endOfTag(html, open + 2) };
  }
  if (marker === "/") {
    const tag = readTagName(html, open + 2);
    return { part: { kind: "end", tag }, end: endOfTag(html, open + 2 + tag.length) };
  }
  const tag = readTagName(html, open + 1);
  return { part: { kind: "start", tag }, end: endOfTag(html, open + 1 + tag.length) };
}

/** Splits the page into text, element starts and element ends, in page order. */
function* splitMarkup(html: string): Generator<MarkupPart> {
  const lower = html.toLowerCase();
  let position = 0;
  while (position < html.length) {
    const open = nextMarkupStart(html, position);
    if (open > position) yield { kind: "text", text: html.slice(position, open) };
    if (open >= html.length) return;
    const { part, end } = readMarkup(html, open);
    if (part) yield part;
    position = end;
    if (part?.kind === "start" && TEXT_ONLY_TAGS.has(part.tag)) {
      const close = lower.indexOf(`</${part.tag}`, position);
      const rawEnd = close === -1 ? html.length : close;
      if (rawEnd > position) yield { kind: "text", text: html.slice(position, rawEnd) };
      position = rawEnd;
    }
  }
}

/** The nearest open element named `tag`, from `from` up to the root. */
function findOpen(from: HtmlElement, tag: string): HtmlElement | undefined {
  for (let element: HtmlElement | null = from; element; element = element.parent) {
    if (element.tag === tag) return element;
  }
  return undefined;
}

/**
 * Builds a tree from the markup. An end tag closes the nearest open element of that name and
 * everything inside it, so an unclosed <li> or <p> does not break the tree. An end tag with no
 * open element of that name is ignored, and so is the end tag of a void element.
 */
function parseHtml(html: string): HtmlElement {
  const root: HtmlElement = { tag: "#document", parent: null, children: [] };
  let current = root;
  for (const part of splitMarkup(html)) {
    if (part.kind === "text") {
      current.children.push(part.text);
    } else if (part.kind === "start") {
      const element: HtmlElement = { tag: part.tag, parent: current, children: [] };
      current.children.push(element);
      if (!TAGS_WITHOUT_CONTENT.has(part.tag)) current = element;
    } else {
      current = findOpen(current, part.tag)?.parent ?? current;
    }
  }
  return root;
}

function rawText(node: HtmlNode): string {
  return typeof node === "string" ? node : node.children.map(rawText).join("");
}

/** The text of a node with each run of white space as one space, and no space at either end. */
function textOf(node: HtmlNode): string {
  return rawText(node).replace(/\s+/g, " ").trim();
}

/** Every element named `tag` inside `element`, in page order. */
function descendants(element: HtmlElement, tag: string): HtmlElement[] {
  return element.children.flatMap((child) => {
    if (typeof child === "string") return [];
    return child.tag === tag ? [child, ...descendants(child, tag)] : descendants(child, tag);
  });
}

// --- Reading the chart ----------------------------------------------------------------------

export interface ChartReading {
  /** Every size the by-wheel-size section lists, in page order, repeats included. */
  readonly tires: readonly TireSize[];
  /** The text of each link that is neither a metric nor a flotation size, such as "7.5R16". */
  readonly unreadable: readonly string[];
}

const RIM_HEADING = /^Tire Size Chart for (\d+(?:\.\d)?)" Wheels$/;

function findSection(document: HtmlElement): HtmlElement {
  const heading = descendants(document, "h2").find((h2) => textOf(h2) === SECTION_HEADING);
  if (!heading?.parent) throw new Error(`The page has no "${SECTION_HEADING}" section.`);
  return heading.parent;
}

function readRimHeading(heading: HtmlElement): number {
  const match = RIM_HEADING.exec(textOf(heading));
  if (!match) throw new Error(`Unexpected heading "${textOf(heading)}" in the wheel size chart.`);
  return Number(match[1]);
}

function readWheelSizePage(
  heading: HtmlElement,
  reading: { tires: TireSize[]; unreadable: string[] },
): void {
  const rim = readRimHeading(heading);
  for (const link of descendants(heading.parent ?? heading, "a")) {
    const text = textOf(link);
    const tire = parseTireSize(text);
    if (!tire) {
      reading.unreadable.push(text);
    } else if (tire.rimDiameterIn !== rim) {
      throw new Error(`${formatTireSize(tire)} is listed under ${rim} in wheels.`);
    } else {
      reading.tires.push(tire);
    }
  }
}

/** Reads the sizes of the "Tire Size Charts by Wheel Size" section. See the header of this file. */
export function readWheelSizeChart(html: string): ChartReading {
  const section = findSection(parseHtml(html));
  const reading = { tires: [] as TireSize[], unreadable: [] as string[] };
  for (const heading of descendants(section, "h3")) readWheelSizePage(heading, reading);
  if (reading.tires.length === 0)
    throw new Error(`The "${SECTION_HEADING}" section lists no tire size.`);
  return reading;
}

// --- Choosing and ordering the sizes ---------------------------------------------------------

function isOneOf(value: number, list: readonly number[]): boolean {
  return list.includes(value);
}

function isWideEnough(tire: TireSize): boolean {
  const filter = LIGHT_TRUCK_FILTER;
  if (tire.kind === "flotation") return tire.widthIn >= filter.minFlotationWidthIn;
  return tire.widthMm >= filter.minMetricWidthMm && tire.aspectRatio >= filter.minMetricAspectRatio;
}

/** True when the size passes the light-truck filter. See the header of this file. */
export function isLightTruckSize(tire: TireSize): boolean {
  const filter = LIGHT_TRUCK_FILTER;
  const diameter = tireDiameterIn(tire);
  return (
    isOneOf(tire.rimDiameterIn, filter.rimDiametersIn) &&
    isWideEnough(tire) &&
    diameter >= filter.minOverallDiameterIn &&
    diameter <= filter.maxOverallDiameterIn
  );
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** "35x12.50R17" gives [35, "x", 12.5, "R", 17]: each number, with its decimals, and the text between. */
function labelParts(label: string): (string | number)[] {
  const parts = label.match(/\d+(?:\.\d+)?|\D+/g) ?? [];
  return parts.map((part) => (/^\d/.test(part) ? Number(part) : part));
}

function comparePart(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return compareText(String(a), String(b));
}

/**
 * Compares labels part by part, text as text and numbers as numbers, so 35x9.50R17 comes before
 * 35x10R17, which comes before 35x10.50R17. Plain text order would put 10.50 before 10 and 9.50
 * last.
 */
function compareLabels(a: string, b: string): number {
  const left = labelParts(a);
  const right = labelParts(b);
  for (const [index, part] of left.entries()) {
    const other = right[index];
    if (other === undefined) return 1;
    const order = comparePart(part, other);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

function compareTires(a: TireSize, b: TireSize): number {
  return (
    a.rimDiameterIn - b.rimDiameterIn ||
    tireDiameterIn(a) - tireDiameterIn(b) ||
    compareLabels(formatTireSize(a), formatTireSize(b))
  );
}

function toEntry(tire: TireSize): TireChartEntry {
  const label = formatTireSize(tire);
  return { id: label, label, tire };
}

const FACTORY_ENTRY: TireChartEntry = {
  id: "LT235/85R16",
  label: "LT235/85R16",
  tire: STOCK_TIRE,
  note: FACTORY_NOTE,
};

/**
 * The entries of the chart: the factory size first, then the sizes that pass the filter, once
 * for each set of dimensions, in order. The factory size is not repeated as 235/85R16.
 */
export function buildChart(tires: readonly TireSize[]): TireChartEntry[] {
  const byLabel = new Map<string, TireSize>();
  for (const tire of tires) {
    if (isLightTruckSize(tire)) byLabel.set(formatTireSize(tire), tire);
  }
  byLabel.delete(formatTireSize(STOCK_TIRE));
  return [FACTORY_ENTRY, ...[...byLabel.values()].sort(compareTires).map(toEntry)];
}

// --- Writing the module ----------------------------------------------------------------------

function listWithOr(numbers: readonly number[]): string {
  const last = numbers.at(-1);
  return `${numbers.slice(0, -1).join(", ")} or ${last}`;
}

function renderHeader(retrieved: string): string {
  const filter = LIGHT_TRUCK_FILTER;
  return [
    "// Light-truck tire sizes the editor offers in its list of sizes.",
    "//",
    `// Source: ${SOURCE_URL} ("${SECTION_HEADING}")`,
    `// Retrieved: ${retrieved}`,
    "// Filter, all of these:",
    `//   - rim diameter: ${listWithOr(filter.rimDiametersIn)} in`,
    `//   - metric sizes: section width of at least ${filter.minMetricWidthMm} mm and aspect ratio of at least ${filter.minMetricAspectRatio}`,
    `//   - flotation sizes: section width of at least ${filter.minFlotationWidthIn} in`,
    `//   - overall diameter: ${filter.minOverallDiameterIn} to ${filter.maxOverallDiameterIn} in, both included`,
    "// Order: the factory size first, then by rim diameter, overall diameter and label.",
    "// Numbers in a label compare as numbers, so 35x9.50R17 comes before 35x10R17.",
    "// A set of dimensions appears once, and 235/85R16 appears only as the factory size.",
    "//",
    "// Generated by tools/update-tire-chart.ts; do not edit by hand.",
  ].join("\n");
}

function renderTire(tire: TireSize): string {
  if (tire.kind === "flotation") {
    return `{ kind: "flotation", diameterIn: ${tire.diameterIn}, widthIn: ${tire.widthIn}, rimDiameterIn: ${tire.rimDiameterIn} }`;
  }
  return `{ kind: "metric", widthMm: ${tire.widthMm}, aspectRatio: ${tire.aspectRatio}, rimDiameterIn: ${tire.rimDiameterIn} }`;
}

function isFactorySize(tire: TireSize): boolean {
  return formatTireSize(tire) === formatTireSize(STOCK_TIRE);
}

/** The factory entry on one line; any other entry with one property to a line, as Prettier writes them. */
function renderEntry(entry: TireChartEntry): string {
  const id = JSON.stringify(entry.id);
  const label = JSON.stringify(entry.label);
  if (isFactorySize(entry.tire)) {
    const note = entry.note === undefined ? "" : `, note: ${JSON.stringify(entry.note)}`;
    return `  { id: ${id}, label: ${label}, tire: STOCK_TIRE${note} },`;
  }
  return [
    "  {",
    `    id: ${id},`,
    `    label: ${label},`,
    `    tire: ${renderTire(entry.tire)},`,
    "  },",
  ].join("\n");
}

/** The text of tire-chart.ts for these entries. It is already formatted the way Prettier writes it. */
export function renderChartModule(entries: readonly TireChartEntry[], retrieved: string): string {
  return [
    renderHeader(retrieved),
    "",
    'import { STOCK_TIRE, type TireChartEntry } from "./tire";',
    "",
    "/** The sizes the editor offers, the factory size first. */",
    "export const TIRE_CHART: readonly TireChartEntry[] = [",
    ...entries.map(renderEntry),
    "];",
    "",
  ].join("\n");
}

// --- Command line ----------------------------------------------------------------------------

export interface CliOptions {
  readonly htmlPath: string;
  readonly retrieved?: string;
  readonly outPath?: string;
}

function isCalendarDate(text: string): boolean {
  const date = new Date(`${text}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(text) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(text)
  );
}

function readArguments(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { retrieved: { type: "string" }, out: { type: "string" } },
    });
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  }
}

/** Reads the command line. Throws an Error that holds the usage line when it is not valid. */
export function parseArguments(argv: readonly string[]): CliOptions {
  const { values, positionals } = readArguments(argv);
  const [htmlPath, ...extra] = positionals;
  if (htmlPath === undefined || extra.length > 0) throw new Error(USAGE);
  if (values.retrieved !== undefined && !isCalendarDate(values.retrieved)) {
    throw new Error(`--retrieved must be a date written YYYY-MM-DD, not "${values.retrieved}".`);
  }
  return {
    htmlPath,
    ...(values.retrieved === undefined ? {} : { retrieved: values.retrieved }),
    ...(values.out === undefined ? {} : { outPath: values.out }),
  };
}

function summarize(
  reading: ChartReading,
  entries: readonly TireChartEntry[],
  retrieved: string,
  outPath: string,
): string {
  const metric = entries.filter((entry) => entry.tire.kind === "metric").length;
  const skipped =
    reading.unreadable.length === 0 ? "" : ` Skipped: ${reading.unreadable.join(", ")}.`;
  return [
    `Read ${reading.tires.length} sizes from the "${SECTION_HEADING}" section.${skipped}`,
    `Wrote ${entries.length} entries (${metric} metric including the factory size, ${entries.length - metric} flotation) retrieved ${retrieved} to ${outPath}.`,
  ].join("\n");
}

function run(argv: readonly string[]): void {
  const options = parseArguments(argv);
  const reading = readWheelSizeChart(readFileSync(options.htmlPath, "utf8"));
  const entries = buildChart(reading.tires);
  const retrieved =
    options.retrieved ?? statSync(options.htmlPath).mtime.toISOString().slice(0, 10);
  const outPath = options.outPath ?? DEFAULT_OUTPUT;
  writeFileSync(outPath, renderChartModule(entries, retrieved));
  console.log(summarize(reading, entries, retrieved, outPath));
}

if (import.meta.main) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
