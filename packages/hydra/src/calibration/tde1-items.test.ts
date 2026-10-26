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

describe("the numbers of every item, written out", () => {
  // Every number below is written out from the calibration map and the REA findings, not read from
  // the definitions, so a typo in a definition fails here.
  const lastByteOfGrid = TDE1_GRIDS.map(
    (grid) => grid.address + grid.rows * grid.cols * grid.cellBytes - 1,
  );

  it("ends every grid at the address the calibration map gives", () => {
    expect(lastByteOfGrid).toEqual([
      0x1262b, 0x1277d, 0x128dd, 0x12c3d, 0x12cab, 0x12d19, 0x12df5, 0x12ed1, 0x13031, 0x13093,
      0x1312d, 0x13a65,
    ]);
  });

  it("gives every grid the cell count of the calibration map", () => {
    expect(TDE1_GRIDS.map((grid) => grid.rows * grid.cols)).toEqual([
      48, 169, 176, 240, 110, 110, 110, 110, 176, 49, 77, 121,
    ]);
  });

  it("ends every lockup and line-pressure function at the byte the calibration map implies", () => {
    const last = [...TDE1_LOCKUP_FUNCTIONS, ...TDE1_EPC_FUNCTIONS].map(
      (definition) => definition.address + 2 * definition.pairCount - 1,
    );
    expect(last).toEqual([
      0x1469f, 0x146b3, 0x146bb, 0x146ff, 0x14713, 0x1471b, 0x1483b, 0x14857, 0x14873,
    ]);
  });

  it("reads each axis from the RAM address and with the signedness the REA findings give", () => {
    const axes = TDE1_GRIDS.map((grid) => [
      grid.rowAxis.ramAddress,
      grid.rowAxis.breakpointsSigned,
      grid.colAxis.ramAddress,
      grid.colAxis.breakpointsSigned,
    ]);
    expect(axes).toEqual([
      [0x18e, false, 0xb6, false],
      [0x11c, false, 0x194, false],
      [0x260, false, 0x116, true],
      [0xb8, false, 0xb6, false],
      [0x16e, true, 0xb6, false],
      [0x16e, true, 0xb6, false],
      [0x158, false, 0xb6, false],
      [0x158, false, 0xb6, false],
      [0x11c, false, 0x116, true],
      [0x116, true, 0xb6, false],
      [0x158, false, 0xb6, false],
      [0x264, false, 0x11e, false],
    ]);
  });

  it("stores each lockup speed as an unsigned byte and each line-pressure adder as a signed byte", () => {
    expect(TDE1_LOCKUP_FUNCTIONS.map((definition) => definition.signedY)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(TDE1_EPC_FUNCTIONS.map((definition) => definition.signedY)).toEqual([true, true, true]);
  });
});

describe("what the labels and descriptions claim", () => {
  const byId = (id: string) => {
    const grid = TDE1_GRIDS.find((candidate) => candidate.id === id);
    if (!grid) throw new Error(`no grid ${id}`);
    return grid;
  };

  it("marks the sea level and altitude split of the fuel limit and base timing as inferred", () => {
    for (const id of [
      "fuel-limit-sea-level",
      "fuel-limit-altitude",
      "base-timing-sea-level",
      "base-timing-altitude",
    ]) {
      expect(byId(id).description, id).toMatch(/inferred from the argument order/);
    }
  });

  it("says the fuel limit scale and the blend are inferred from the REA model script", () => {
    const text = byId("fuel-limit-sea-level").description;
    expect(text).toContain("REA model script");
    expect(text).toContain("not seen in the code");
    expect(text).not.toMatch(/The PCM multiplies/);
  });

  it("limits the 0 to 12 degree range of the timing correction to the owner's tunes", () => {
    const text = byId("timing-correction-eot").description;
    expect(text).toContain("owner's tunes");
    expect(text).toContain("-10 to 22 degrees");
  });

  it("names the multiplier row axis as unconfirmed and the oil temperature axis as probable", () => {
    expect(byId("pulse-width-multiplier").rowAxis.name).toBe("ICP (RAM 0x260, unconfirmed)");
    expect(byId("pulse-width-multiplier").colAxis.name).toBe("Engine oil temperature (probable)");
    expect(byId("timing-time-adder").colAxis.name).toBe("Engine oil temperature (probable)");
    expect(byId("timing-correction-eot").rowAxis.name).toBe("Engine oil temperature (probable)");
  });

  it("keeps the confirmed ICP axes named as ICP", () => {
    expect(byId("base-pulse-width").rowAxis.name).toBe("Injection control pressure (ICP)");
    expect(byId("timing-time-adder").rowAxis.name).toBe("Injection control pressure (ICP)");
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
