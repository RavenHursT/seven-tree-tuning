import { describe, expect, it } from "vitest";

import { CALIBRATION_IMAGE_SIZE } from "../image";
import { gridCellOffsets } from "./grid";
import {
  EPC_FUNCTION_IDS,
  GRID_IDS,
  LOCKUP_FUNCTION_IDS,
  TDE1_EPC_FUNCTIONS,
  TDE1_GRIDS,
  TDE1_LOCKUP_FUNCTIONS,
} from "./tde1-items";
import { TDE1 } from "./tde1";

describe("lockup function definitions", () => {
  it("lists the six ids in the same order as the TDE1 definition: lock 2nd, 3rd, 4th, then unlock", () => {
    expect(LOCKUP_FUNCTION_IDS).toEqual([
      "lock-2",
      "lock-3",
      "lock-4",
      "unlock-2",
      "unlock-3",
      "unlock-4",
    ]);
    expect(TDE1.lockupFunctions).toBe(TDE1_LOCKUP_FUNCTIONS);
    expect(TDE1_LOCKUP_FUNCTIONS.map((definition) => definition.id)).toEqual(LOCKUP_FUNCTION_IDS);
  });

  it("puts each function at the address the REA session decoded", () => {
    expect(TDE1_LOCKUP_FUNCTIONS.map((definition) => definition.address)).toEqual([
      0x1468c, 0x146a0, 0x146b4, 0x146ec, 0x14700, 0x14714,
    ]);
  });

  it("gives 2nd and 3rd gear ten pairs and 4th gear four pairs", () => {
    expect(TDE1_LOCKUP_FUNCTIONS.map((definition) => definition.pairCount)).toEqual([
      10, 10, 4, 10, 10, 4,
    ]);
  });

  it("stores speeds as unsigned bytes in the lockup group", () => {
    for (const definition of TDE1_LOCKUP_FUNCTIONS) {
      expect(definition.signedY).toBe(false);
      expect(definition.group).toBe("lockup");
    }
  });
});

describe("line-pressure adder function definitions", () => {
  it("lists the three upshift adders in order", () => {
    expect(EPC_FUNCTION_IDS).toEqual(["epc-1-2", "epc-2-3", "epc-3-4"]);
    expect(TDE1.epcFunctions).toBe(TDE1_EPC_FUNCTIONS);
    expect(TDE1_EPC_FUNCTIONS.map((definition) => definition.id)).toEqual(EPC_FUNCTION_IDS);
  });

  it("leaves out the three unused zero functions at 0x14820, 0x1483c and 0x14858", () => {
    expect(TDE1_EPC_FUNCTIONS.map((definition) => definition.address)).toEqual([
      0x14828, 0x14844, 0x14860,
    ]);
  });

  it("gives each ten pairs of signed adders", () => {
    for (const definition of TDE1_EPC_FUNCTIONS) {
      expect(definition.pairCount).toBe(10);
      expect(definition.signedY).toBe(true);
      expect(definition.group).toBe("line-pressure");
    }
  });
});

describe("grid definitions", () => {
  const byId = (id: string) => {
    const grid = TDE1_GRIDS.find((candidate) => candidate.id === id);
    if (!grid) throw new Error(`no grid ${id}`);
    return grid;
  };

  it("lists twelve grids, in the order of GRID_IDS", () => {
    expect(GRID_IDS).toHaveLength(12);
    expect(TDE1.grids).toBe(TDE1_GRIDS);
    expect(TDE1_GRIDS.map((grid) => grid.id)).toEqual(GRID_IDS);
  });

  it("records address, exposed size, cell size, signedness and row stride of each grid", () => {
    const shape = TDE1_GRIDS.map((grid) => [
      grid.address,
      grid.rows,
      grid.cols,
      grid.rowStride,
      grid.cellBytes,
      grid.signed,
    ]);
    expect(shape).toEqual([
      [0x125cc, 3, 16, 16, 2, false],
      [0x1262c, 13, 13, 13, 2, false],
      [0x1277e, 11, 16, 16, 2, false],
      [0x12a5e, 15, 16, 16, 2, true],
      [0x12c3e, 10, 11, 11, 1, false],
      [0x12cac, 10, 11, 11, 1, false],
      [0x12d1a, 10, 11, 11, 2, true],
      [0x12df6, 10, 11, 11, 2, true],
      [0x12ed2, 11, 16, 16, 2, false],
      [0x13032, 7, 7, 7, 2, true],
      [0x13094, 7, 11, 11, 2, false],
      [0x13974, 11, 11, 11, 2, false],
    ]);
  });

  it("exposes all 13 x 13 stored cells of the base pulse width", () => {
    const grid = byId("base-pulse-width");
    expect([grid.rows, grid.cols, grid.rowStride]).toEqual([13, 13, 13]);
    expect(gridCellOffsets(grid)).toHaveLength(338);
    expect(Math.max(...gridCellOffsets(grid))).toBe(0x1262c + 2 * 169 - 1);
  });

  it("ends the IPR duty grid at 0x13a65, the last of 121 words, not at 0x13a5d", () => {
    const offsets = gridCellOffsets(byId("ipr-duty-feed-forward"));
    expect(offsets).toHaveLength(242);
    expect(Math.max(...offsets)).toBe(0x13a65);
  });

  it("stores every grid row by row", () => {
    for (const grid of TDE1_GRIDS) expect(grid.order).toBe("row-major");
  });

  it("scales rpm axes by 1/4 and leaves axes with no confirmed unit raw", () => {
    const fuelLimit = byId("fuel-limit-sea-level");
    expect(fuelLimit.colAxis.unit).toEqual({ label: "rpm", perRaw: 0.25 });
    expect(fuelLimit.rowAxis.unit).toBeUndefined();
  });

  it("reads timing angles as 1/64 crank degree and the pulse width multiplier as 0x1000 = 1.0", () => {
    expect(byId("base-timing-sea-level").valueUnit).toEqual({ label: "°", perRaw: 1 / 64 });
    expect(byId("timing-correction-eot").valueUnit).toEqual({ label: "°", perRaw: 1 / 64 });
    expect(byId("pulse-width-multiplier").valueUnit).toEqual({ label: "×", perRaw: 1 / 4096 });
  });

  it("names the axis function of each axis, as decoded from the PCM code", () => {
    const axes = TDE1_GRIDS.map((grid) => [
      grid.rowAxis.functionOffset,
      grid.colAxis.functionOffset,
    ]);
    expect(axes).toEqual([
      [0x120e0, 0x120a0],
      [0x121dc, 0x121a8],
      [0x12244, 0x12164],
      [0x14f18, 0x12124],
      [0x12278, 0x12050],
      [0x12278, 0x12050],
      [0x12074, 0x120f4],
      [0x12074, 0x120f4],
      [0x12210, 0x12164],
      [0x122cc, 0x122ec],
      [0x122a8, 0x1317a],
      [0x1385c, 0x13888],
    ]);
  });
});

describe("the items do not overlap each other or the shift curves and idle curve", () => {
  it("covers no byte twice", () => {
    const claimed = new Map<number, string>();
    const claim = (offset: number, owner: string) => {
      const other = claimed.get(offset);
      if (other !== undefined) throw new Error(`0x${offset.toString(16)}: ${owner} and ${other}`);
      claimed.set(offset, owner);
    };
    for (const curve of TDE1.shiftCurves) {
      for (let offset = curve.speedOffset - 1; offset <= curve.speedOffset + 19; offset++) {
        claim(offset, curve.id);
      }
    }
    for (let offset = TDE1.idle.curveOffset; offset < TDE1.idle.curveOffset + 24; offset++) {
      claim(offset, "idle");
    }
    for (const definition of [...TDE1_LOCKUP_FUNCTIONS, ...TDE1_EPC_FUNCTIONS]) {
      for (
        let offset = definition.address;
        offset < definition.address + 2 * definition.pairCount;
        offset++
      ) {
        claim(offset, definition.id);
      }
    }
    for (const grid of TDE1_GRIDS) {
      for (const offset of gridCellOffsets(grid)) claim(offset, grid.id);
    }
    expect(claimed.size).toBeGreaterThan(1000);
    expect(Math.max(...claimed.keys())).toBeLessThan(CALIBRATION_IMAGE_SIZE);
  });
});
