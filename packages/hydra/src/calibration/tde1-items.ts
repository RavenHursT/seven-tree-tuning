import type { EpcFunctionDefinition, LockupFunctionDefinition } from "./byte-function";
import type { DisplayUnit, GridAxisDefinition, GridDefinition } from "./grid";

// The TDE1 items below were decoded from the PCM code with a Ghidra 8065 module and an emulator,
// then checked against the 256 KiB images of the shipped tunes and the Power Hungry library.

/** Every lockup function id: lock speeds first, then unlock speeds. The one place they are listed. */
export const LOCKUP_FUNCTION_IDS = [
  "lock-2",
  "lock-3",
  "lock-4",
  "unlock-2",
  "unlock-3",
  "unlock-4",
] as const;

export type LockupFunctionId = (typeof LOCKUP_FUNCTION_IDS)[number];

/** Every upshift line-pressure adder id. */
export const EPC_FUNCTION_IDS = ["epc-1-2", "epc-2-3", "epc-3-4"] as const;

export type EpcFunctionId = (typeof EPC_FUNCTION_IDS)[number];

/** Every grid id, fuel and power grids first. */
export const GRID_IDS = [
  "max-fuel",
  "base-pulse-width",
  "pulse-width-multiplier",
  "fuel-demand",
  "fuel-limit-sea-level",
  "fuel-limit-altitude",
  "base-timing-sea-level",
  "base-timing-altitude",
  "timing-time-adder",
  "timing-correction-eot",
  "desired-icp",
  "ipr-duty-feed-forward",
] as const;

export type GridId = (typeof GRID_IDS)[number];

function lockupFunction(
  id: LockupFunctionId,
  label: string,
  address: number,
  pairCount: number,
): LockupFunctionDefinition {
  return { id, group: "lockup", label, address, pairCount, signedY: false };
}

function epcFunction(id: EpcFunctionId, label: string, address: number): EpcFunctionDefinition {
  return { id, group: "line-pressure", label, address, pairCount: 10, signedY: true };
}

/**
 * Converter lockup speeds: y = vehicle mph x 2, the same speed byte as the shift curves. Lock
 * functions give the speed above which the converter locks, unlock functions the speed below which
 * it releases. Second and third gear have ten pairs, fourth gear four. A y of 0xFE (127 mph) in a
 * lock function means the converter never locks there. For an unlock function the editor treats
 * 127 mph as an ordinary speed and warns when it is at or above the lock speed; the exact PCM
 * behavior at an unlock speed of 127 mph is not verified. The PCM (0x8b59a to 0x8b5df) reads the
 * unlock function when the converter speed ratio (RAM 0x874) is at or above the minimum ratio, and
 * the lock function otherwise, so an unlock speed at or above the lock speed cycles the converter.
 */
export const TDE1_LOCKUP_FUNCTIONS: readonly LockupFunctionDefinition[] = [
  lockupFunction("lock-2", "2nd gear lock", 0x1468c, 10),
  lockupFunction("lock-3", "3rd gear lock", 0x146a0, 10),
  lockupFunction("lock-4", "4th gear lock", 0x146b4, 4),
  lockupFunction("unlock-2", "2nd gear unlock", 0x146ec, 10),
  lockupFunction("unlock-3", "3rd gear unlock", 0x14700, 10),
  lockupFunction("unlock-4", "4th gear unlock", 0x14714, 4),
];

/**
 * Upshift line-pressure (EPC) adders: y = signed byte in PCM pressure units added to the shift
 * pressure request, so a higher value gives a firmer shift. The zero functions at 0x14820, 0x1483c
 * and 0x14858 (1st gear and the downshifts) are not used and are left out.
 */
export const TDE1_EPC_FUNCTIONS: readonly EpcFunctionDefinition[] = [
  epcFunction("epc-1-2", "1→2 line pressure", 0x14828),
  epcFunction("epc-2-3", "2→3 line pressure", 0x14844),
  epcFunction("epc-3-4", "3→4 line pressure", 0x14860),
];

/** Engine speed word, rpm x 4, PCM RAM 0x00b6. */
const RPM_UNIT: DisplayUnit = { label: "rpm", perRaw: 0.25 };
const ANGLE_UNIT: DisplayUnit = { label: "°", perRaw: 1 / 64 };

/** Builds an axis from the word function that maps one PCM value to a position. */
function axis(
  name: string,
  ramAddress: number,
  functionOffset: number,
  breakpointsSigned = false,
  unit?: DisplayUnit,
): GridAxisDefinition {
  return { name, ramAddress, functionOffset, breakpointsSigned, ...(unit ? { unit } : {}) };
}

const ICP = "Injection control pressure (ICP)";
// RAM 0x116 is probably the engine oil temperature; the REA notes mark it as a guess.
const EOT = "Engine oil temperature (probable)";
const FUEL = "Fuel mass";

function rpmAxis(functionOffset: number): GridAxisDefinition {
  return axis("Engine speed", 0xb6, functionOffset, false, RPM_UNIT);
}

/**
 * The twelve grids. Fuel and power: 0x125cc to 0x12cab. Timing and ICP: 0x12d1a to 0x13a65.
 * All are row-major; the 2-D lookup routines at 0x88062 (unsigned word), 0x8805f (signed word) and
 * 0x87ff1 (byte) take the row from `rowAxis` and the column from `colAxis`.
 */
export const TDE1_GRIDS: readonly GridDefinition[] = [
  {
    id: "max-fuel",
    label: "Maximum fuel",
    group: "fuel-power",
    description:
      "Maximum fuel against engine speed. The three rows are equal in every known tune; the PCM reads them as three rows.",
    address: 0x125cc,
    rows: 3,
    cols: 16,
    rowStride: 16,
    cellBytes: 2,
    signed: false,
    order: "row-major",
    rowAxis: axis("Unidentified value", 0x18e, 0x120e0),
    colAxis: rpmAxis(0x120a0),
  },
  {
    id: "base-pulse-width",
    label: "Base injector pulse width",
    group: "fuel-power",
    description:
      "Base pulse width in timer ticks of 5.333 µs. The grid is 13 x 13. The axis functions of the owner's tunes stop at index 10, so the PCM never reaches rows and columns 11 and 12 there; 34 of the 35 library tunes extend the axes to index 12.",
    address: 0x1262c,
    rows: 13,
    cols: 13,
    rowStride: 13,
    cellBytes: 2,
    signed: false,
    order: "row-major",
    rowAxis: axis(ICP, 0x11c, 0x121dc),
    colAxis: axis("Fuel volume", 0x194, 0x121a8),
  },
  {
    id: "pulse-width-multiplier",
    label: "Pulse width multiplier",
    group: "fuel-power",
    description: "Multiplier for the base pulse width. 0x1000 is 1.0.",
    address: 0x1277e,
    rows: 11,
    cols: 16,
    rowStride: 16,
    cellBytes: 2,
    signed: false,
    order: "row-major",
    // RAM 0x260 is named ICP by one REA note only. The other ICP grids read RAM 0x11c.
    rowAxis: axis("ICP (RAM 0x260, unconfirmed)", 0x260, 0x12244),
    colAxis: axis(EOT, 0x116, 0x12164, true),
    valueUnit: { label: "×", perRaw: 1 / 4096 },
  },
  {
    id: "fuel-demand",
    label: "Fuel demand",
    group: "fuel-power",
    description: "Fuel demand against pedal position and engine speed.",
    address: 0x12a5e,
    rows: 15,
    cols: 16,
    rowStride: 16,
    cellBytes: 2,
    signed: true,
    order: "row-major",
    rowAxis: axis("Accelerator pedal position", 0xb8, 0x14f18),
    colAxis: rpmAxis(0x12124),
  },
  {
    id: "fuel-limit-sea-level",
    label: "Fuel limit, sea level",
    group: "fuel-power",
    description:
      "Fuel limit against boost and engine speed. The names sea level and altitude are inferred from the argument order in the REA check scripts. The REA model script multiplies each byte by 256 and blends this grid with the altitude grid by barometric pressure; that is inferred from the script and was not seen in the code.",
    address: 0x12c3e,
    rows: 10,
    cols: 11,
    rowStride: 11,
    cellBytes: 1,
    signed: false,
    order: "row-major",
    rowAxis: axis("Boost", 0x16e, 0x12278, true),
    colAxis: rpmAxis(0x12050),
  },
  {
    id: "fuel-limit-altitude",
    label: "Fuel limit, altitude",
    group: "fuel-power",
    description:
      "Fuel limit against boost and engine speed. The name altitude is inferred from the argument order in the REA check scripts. See the sea level grid.",
    address: 0x12cac,
    rows: 10,
    cols: 11,
    rowStride: 11,
    cellBytes: 1,
    signed: false,
    order: "row-major",
    rowAxis: axis("Boost", 0x16e, 0x12278, true),
    colAxis: rpmAxis(0x12050),
  },
  {
    id: "base-timing-sea-level",
    label: "Base injection timing, sea level",
    group: "timing-icp",
    description:
      "Base injection timing against fuel and engine speed, in 1/64 crank degree. The names sea level and altitude are inferred from the argument order in the REA check scripts. The PCM blends this grid with the altitude grid by barometric pressure.",
    address: 0x12d1a,
    rows: 10,
    cols: 11,
    rowStride: 11,
    cellBytes: 2,
    signed: true,
    order: "row-major",
    rowAxis: axis(FUEL, 0x158, 0x12074),
    colAxis: rpmAxis(0x120f4),
    valueUnit: ANGLE_UNIT,
  },
  {
    id: "base-timing-altitude",
    label: "Base injection timing, altitude",
    group: "timing-icp",
    description:
      "Base injection timing against fuel and engine speed, in 1/64 crank degree. The name altitude is inferred from the argument order in the REA check scripts.",
    address: 0x12df6,
    rows: 10,
    cols: 11,
    rowStride: 11,
    cellBytes: 2,
    signed: true,
    order: "row-major",
    rowAxis: axis(FUEL, 0x158, 0x12074),
    colAxis: rpmAxis(0x120f4),
    valueUnit: ANGLE_UNIT,
  },
  {
    id: "timing-time-adder",
    label: "Time added to timing",
    group: "timing-icp",
    description:
      "Time added to the injection timing against ICP and engine oil temperature. It is probably the injector delay; that is an inference.",
    address: 0x12ed2,
    rows: 11,
    cols: 16,
    rowStride: 16,
    cellBytes: 2,
    signed: false,
    order: "row-major",
    rowAxis: axis(ICP, 0x11c, 0x12210),
    colAxis: axis(EOT, 0x116, 0x12164, true),
  },
  {
    id: "timing-correction-eot",
    label: "Timing correction",
    group: "timing-icp",
    description:
      "Timing correction against engine oil temperature and engine speed, in 1/64 crank degree. It is 0 to 12 degrees in the owner's tunes, larger when cold. The library tunes span -10 to 22 degrees.",
    address: 0x13032,
    rows: 7,
    cols: 7,
    rowStride: 7,
    cellBytes: 2,
    signed: true,
    order: "row-major",
    rowAxis: axis(EOT, 0x116, 0x122cc, true),
    colAxis: rpmAxis(0x122ec),
    valueUnit: ANGLE_UNIT,
  },
  {
    id: "desired-icp",
    label: "Desired ICP",
    group: "timing-icp",
    description: "Desired injection control pressure against fuel and engine speed.",
    address: 0x13094,
    rows: 7,
    cols: 11,
    rowStride: 11,
    cellBytes: 2,
    signed: false,
    order: "row-major",
    rowAxis: axis(FUEL, 0x158, 0x122a8),
    colAxis: rpmAxis(0x1317a),
  },
  {
    id: "ipr-duty-feed-forward",
    label: "IPR duty feed-forward",
    group: "timing-icp",
    description:
      "Feed-forward duty of the injection pressure regulator against desired ICP and an oil flow value. The grid is 121 words and ends at 0x13a65.",
    address: 0x13974,
    rows: 11,
    cols: 11,
    rowStride: 11,
    cellBytes: 2,
    signed: false,
    order: "row-major",
    rowAxis: axis("Oil flow value", 0x264, 0x1385c),
    colAxis: axis("Desired ICP", 0x11e, 0x13888),
  },
];
