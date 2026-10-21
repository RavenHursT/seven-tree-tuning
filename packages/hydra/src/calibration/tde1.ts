/** Forward gear number of the E4OD automatic transmission. 4 is overdrive. */
export type Gear = 1 | 2 | 3 | 4;

export type ShiftKind = "upshift" | "downshift";

/** Every shift curve id, upshifts first. The one place the ids are listed. */
export const SHIFT_CURVE_IDS = [
  "up-1-2",
  "up-2-3",
  "up-3-4",
  "down-2-1",
  "down-3-2",
  "down-4-3",
] as const;

export type ShiftCurveId = (typeof SHIFT_CURVE_IDS)[number];

/**
 * One shift-speed curve: ten (throttle, speed) byte pairs in the decrypted 256 KiB image.
 * Breakpoint i has its throttle byte at `speedOffset - 1 + 2 * i` and its speed byte
 * (mph x 2) at `speedOffset + 2 * i`. The byte at `speedOffset + 2 * breakpointsPerCurve - 1`
 * is 0xFF.
 */
export interface ShiftCurveDefinition {
  readonly id: ShiftCurveId;
  readonly kind: ShiftKind;
  readonly fromGear: Gear;
  readonly toGear: Gear;
  readonly label: string;
  /** Image offset of the first shift-speed byte. */
  readonly speedOffset: number;
}

/**
 * The idle function: `pointCount` points of (input: int16 LE, rpm x 4: uint16 LE), 4 bytes each,
 * starting at `curveOffset`. Warm idle is the rpm of the first two points.
 */
export interface IdleDefinition {
  /** Image offset of the first point's input. */
  readonly curveOffset: number;
  readonly pointCount: number;
  /** Image offsets of the two rpm x 4 values that hold warm idle (uint16 LE, equal in every known tune). */
  readonly warmIdleOffsets: readonly [number, number];
}

export interface StrategyDefinition {
  readonly id: "TDE1";
  readonly description: string;
  readonly breakpointsPerCurve: number;
  /** Upshifts first, then downshifts. */
  readonly shiftCurves: readonly ShiftCurveDefinition[];
  readonly idle: IdleDefinition;
}

/**
 * Ford PCM strategy TDE1: 1994.5 to 1996 7.3L Power Stroke with the E4OD automatic.
 * First shift-speed byte of each curve: 0x14521 (1→2), 0x14579 (2→3), 0x145d1 (3→4),
 * 0x145f9 (2→1), 0x14621 (3→2), 0x14649 (4→3). Idle points start at 0x124a4; warm idle is the
 * rpm x 4 word at 0x124a6 and its copy at 0x124aa.
 */
export const TDE1: StrategyDefinition = {
  id: "TDE1",
  description:
    "Ford PCM strategy TDE1: 7.3L Power Stroke diesel with the E4OD automatic transmission",
  breakpointsPerCurve: 10,
  shiftCurves: [
    { id: "up-1-2", kind: "upshift", fromGear: 1, toGear: 2, label: "1→2", speedOffset: 0x14521 },
    { id: "up-2-3", kind: "upshift", fromGear: 2, toGear: 3, label: "2→3", speedOffset: 0x14579 },
    {
      id: "up-3-4",
      kind: "upshift",
      fromGear: 3,
      toGear: 4,
      label: "3→4 (overdrive)",
      speedOffset: 0x145d1,
    },
    {
      id: "down-2-1",
      kind: "downshift",
      fromGear: 2,
      toGear: 1,
      label: "2→1",
      speedOffset: 0x145f9,
    },
    {
      id: "down-3-2",
      kind: "downshift",
      fromGear: 3,
      toGear: 2,
      label: "3→2",
      speedOffset: 0x14621,
    },
    {
      id: "down-4-3",
      kind: "downshift",
      fromGear: 4,
      toGear: 3,
      label: "4→3 (out of overdrive)",
      speedOffset: 0x14649,
    },
  ],
  idle: { curveOffset: 0x124a4, pointCount: 6, warmIdleOffsets: [0x124a6, 0x124aa] },
};
