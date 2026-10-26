import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { expectSameBytes } from "./container/test-support";
import {
  closedPedalIndex,
  EfuDecoder,
  findByteFunctionIssues,
  gridValueRange,
  HcfCodec,
  readEpcFunctions,
  readGridAxes,
  readGrids,
  readLockupFunctions,
  readTuneValues,
  speedRawToMph,
  TDE1,
  writeTuneValues,
  type ByteFunction,
} from "./index";

// Checks the lockup, line-pressure and grid items of calibration/tde1-items.ts against the real
// tunes in tunes/ and the Power Hungry library. Each group runs only when the person running the
// tests supplies what it needs:
//   HYDRA_CHIP_SERIAL  the 8 hexadecimal digits of the chip serial the tunes in tunes/ are for
//   HYDRA_EFU_DIR      a folder of Power Hungry .efu library files
const chipSerial = process.env.HYDRA_CHIP_SERIAL;
const efuFolder = process.env.HYDRA_EFU_DIR;
const tunesFolder = fileURLToPath(new URL("../../../tunes/", import.meta.url));

function namesWithExtension(folder: string | undefined, extension: string): string[] {
  if (folder === undefined || !existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((name) => name.endsWith(extension))
    .sort();
}

function readBytes(folder: string, name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(folder, name)));
}

const tuneNames = namesWithExtension(tunesFolder, ".hcf");
const efuNames = namesWithExtension(efuFolder, ".efu");

function allFunctions(image: Uint8Array): readonly ByteFunction[] {
  return [...readLockupFunctions(image), ...readEpcFunctions(image)];
}

/** Every function starts at 255, never rises, ends at pedal 0, and repeats the closed value as padding. */
function expectFunctionStructure(image: Uint8Array): void {
  expect(findByteFunctionIssues(image)).toEqual([]);
  for (const fn of allFunctions(image)) {
    const closed = closedPedalIndex(fn);
    expect(fn.points[0]?.xRaw, fn.definition.label).toBe(255);
    expect(fn.points[closed]?.xRaw, fn.definition.label).toBe(0);
    for (const point of fn.points.slice(closed + 1)) {
      expect(point.xRaw, fn.definition.label).toBe(0);
      expect(point.yRaw, fn.definition.label).toBe(fn.points[closed]?.yRaw);
    }
  }
}

/** The base pulse width stores 13 x 13 cells, but the axes of the owner's tunes stop at index 10. */
const BASE_PULSE_WIDTH_REACHED = 11;

/**
 * Every grid has cells within the range of its cell size and a breakpoint for every row and column.
 * The last two rows and columns of the base pulse width may be unreached.
 */
function expectGridStructure(image: Uint8Array): void {
  for (const { definition, cells } of readGrids(image)) {
    const [min, max] = gridValueRange(definition);
    expect(cells, definition.label).toHaveLength(definition.rows * definition.cols);
    expect(
      cells.every((cell) => cell >= min && cell <= max),
      definition.label,
    ).toBe(true);
    const axes = readGridAxes(image, definition);
    const reached = definition.id === "base-pulse-width" ? BASE_PULSE_WIDTH_REACHED : undefined;
    for (const breakpoints of [axes.rowBreakpointsRaw, axes.colBreakpointsRaw]) {
      expect(
        breakpoints.slice(0, reached).every((value) => value !== undefined),
        definition.label,
      ).toBe(true);
    }
  }
}

function expectBreakpointsInOrder(image: Uint8Array): void {
  for (const definition of TDE1.grids) {
    const axes = readGridAxes(image, definition);
    for (const all of [axes.rowBreakpointsRaw, axes.colBreakpointsRaw]) {
      const breakpoints = all.filter((value) => value !== undefined);
      const steps = breakpoints
        .slice(1)
        .map((value, index) => (value ?? 0) - (breakpoints[index] ?? 0));
      const ascending = steps.every((step) => step >= 0);
      const descending = steps.every((step) => step <= 0);
      expect(ascending || descending, `${definition.label}: ${breakpoints.join(", ")}`).toBe(true);
    }
  }
}

describe.skipIf(chipSerial === undefined)(
  "the lockup, line-pressure and grid items of every tune in tunes/ (needs HYDRA_CHIP_SERIAL)",
  () => {
    const codec = new HcfCodec(chipSerial ?? "00000000");
    const decode = (name: string) => codec.decode(readBytes(tunesFolder, name));

    it("finds the tune files", () => {
      expect(tuneNames.length).toBeGreaterThan(0);
    });

    it.each(tuneNames)(
      "%s has the function layout in all nine lockup and line-pressure functions",
      (name) => {
        expectFunctionStructure(decode(name));
      },
    );

    it.each(tuneNames)(
      "%s has grid cells in range and a breakpoint for every row and column",
      (name) => {
        expectGridStructure(decode(name));
      },
    );

    it.each(tuneNames)("%s has grid axes whose breakpoints run one way", (name) => {
      expectBreakpointsInOrder(decode(name));
    });

    it.each(tuneNames)("%s is rebuilt byte for byte from the values the editor reads", (name) => {
      const image = decode(name);
      expectSameBytes(writeTuneValues(image, readTuneValues(image)), image);
    });

    it("keeps every lockup, line-pressure and grid value when the tire compensation is applied", () => {
      for (const name of tuneNames.filter((candidate) => candidate.includes("-TIRECOMP-UPDOWN"))) {
        const base = readTuneValues(decode(name.replace("-TIRECOMP-UPDOWN", "")));
        const compensated = readTuneValues(decode(name));
        expect(compensated.lockupSpeedsRaw, name).toEqual(base.lockupSpeedsRaw);
        expect(compensated.epcAddersRaw, name).toEqual(base.epcAddersRaw);
        expect(compensated.gridsRaw, name).toEqual(base.gridsRaw);
      }
    });

    it("reads the lockup speeds of DAILYDRIVER-REVD the REA session recorded", () => {
      const { lockupSpeedsRaw } = readTuneValues(decode("TDE1_30N_DAILYDRIVER-REVD.hcf"));
      const mph = (values: readonly number[]) => values.map(speedRawToMph);
      expect(mph(lockupSpeedsRaw["lock-4"].slice(0, 1))).toEqual([30]);
      expect(mph(lockupSpeedsRaw["unlock-4"].slice(0, 1))).toEqual([28]);
      expect(mph(lockupSpeedsRaw["lock-2"].slice(0, 3))).toEqual([32, 32, 20]);
      expect(lockupSpeedsRaw["lock-2"][3]).toBe(0xfe);
    });
  },
);

describe.skipIf(efuFolder === undefined)(
  "the lockup, line-pressure and grid items of every .efu file in HYDRA_EFU_DIR",
  () => {
    const decode = (name: string) => new EfuDecoder().decode(readBytes(efuFolder ?? "", name));

    it("finds the .efu files", () => {
      expect(efuNames.length).toBeGreaterThan(0);
    });

    it.each(efuNames)(
      "%s has the function layout in all nine lockup and line-pressure functions",
      (name) => {
        expectFunctionStructure(decode(name));
      },
    );

    it.each(efuNames)(
      "%s has grid cells in range and a breakpoint for every row and column",
      (name) => {
        expectGridStructure(decode(name));
      },
    );

    it.each(efuNames)("%s has grid axes whose breakpoints run one way", (name) => {
      expectBreakpointsInOrder(decode(name));
    });

    it.each(efuNames)("%s is rebuilt byte for byte from the values the editor reads", (name) => {
      const image = decode(name);
      expectSameBytes(writeTuneValues(image, readTuneValues(image)), image);
    });
  },
);
