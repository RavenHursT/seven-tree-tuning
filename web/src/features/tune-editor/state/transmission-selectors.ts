import {
  closedPedalIndex,
  evaluateShiftSpeedRaw,
  functionYRange,
  LOCKUP_NEVER_SPEED_RAW,
  shiftPointToSpeedoMph,
  speedometerFactor,
  speedRawToMph,
  throttleRawToPercent,
  type ByteFunction,
  type ByteFunctionDefinition,
  type EpcFunctionId,
  type LockupFunctionId,
} from "@seven-tree/hydra";

import type { FirmnessCurveRow } from "../components/firmness-curve-table";
import type { LockupCurveRow } from "../components/lockup-curve-table";
import type { ShiftOverlapView } from "../components/shift-overlap-alert";

import type { EditorState } from "./editor-reducer";
import { epcFunctionsOf, lockupFunctionsOf } from "./transmission-functions";

export interface LockupTableView {
  readonly functionId: LockupFunctionId;
  readonly title: string;
  readonly kind: "lock" | "unlock";
  /** The most the Speedometer field accepts: the speedometer value that stores 127 mph (254). */
  readonly speedometerMaxMph: number;
  /** Top to bottom as shown: closed pedal first. Names its rows by `pointIndex`. */
  readonly rows: readonly LockupCurveRow[];
}

export interface FirmnessTableView {
  readonly functionId: EpcFunctionId;
  readonly title: string;
  readonly min: number;
  readonly max: number;
  readonly rows: readonly FirmnessCurveRow[];
}

export interface TransmissionChanges {
  readonly changedLockupPoints: number;
  readonly changedFirmnessPoints: number;
}

/** The order the page shows the lockup curves in: each gear's lock curve, then its unlock curve. */
const LOCKUP_ORDER: readonly LockupFunctionId[] = [
  "lock-2",
  "unlock-2",
  "lock-3",
  "unlock-3",
  "lock-4",
  "unlock-4",
];

const GEAR_NAMES: Readonly<Record<string, string>> = { "2": "2nd", "3": "3rd", "4": "4th" };

interface PedalRow {
  readonly pointIndex: number;
  readonly pedalRaw: number;
  readonly pedalPercent: number;
  readonly isStep: boolean;
}

/** The rows the PCM reads, closed pedal first. The padding after the closed point is left out. */
function visiblePedalRows(fn: ByteFunction): PedalRow[] {
  const visible = fn.points.slice(0, closedPedalIndex(fn) + 1);
  return visible
    .map((point, row) => ({
      pointIndex: point.index,
      pedalRaw: point.xRaw,
      pedalPercent: throttleRawToPercent(point.xRaw),
      isStep: row > 0 && visible[row - 1]?.xRaw === point.xRaw,
    }))
    .reverse();
}

function lockupRows(
  fn: ByteFunction,
  speeds: readonly number[],
  originals: readonly number[],
  factor: number,
  kind: "lock" | "unlock",
): LockupCurveRow[] {
  return visiblePedalRows(fn).map((row) => {
    const speedRaw = speeds[row.pointIndex] ?? 0;
    const originalRaw = originals[row.pointIndex] ?? 0;
    return {
      ...row,
      speedMph: speedRawToMph(speedRaw),
      speedRaw,
      speedoMph: shiftPointToSpeedoMph(speedRaw, factor),
      originalSpeedMph: speedRawToMph(originalRaw),
      // 127 mph is "never" for a lock speed only. The editor shows an unlock speed as a number.
      never: kind === "lock" && speedRaw >= LOCKUP_NEVER_SPEED_RAW,
      changed: speedRaw !== originalRaw,
    };
  });
}

export function selectLockupTables(state: EditorState): LockupTableView[] {
  const { tune, values } = state;
  if (!tune || !values) return [];

  const factor = speedometerFactor(state.fittedTire, state.calibrationTire);
  const functions = lockupFunctionsOf(tune);
  return LOCKUP_ORDER.flatMap((id) => {
    const fn = functions.find((item) => item.definition.id === id);
    if (!fn) return [];
    const kind = id.startsWith("lock-") ? "lock" : "unlock";
    return {
      functionId: id,
      title: fn.definition.label,
      kind,
      speedometerMaxMph: shiftPointToSpeedoMph(LOCKUP_NEVER_SPEED_RAW, factor),
      rows: lockupRows(
        fn,
        values.lockupSpeedsRaw[id],
        tune.originalValues.lockupSpeedsRaw[id],
        factor,
        kind,
      ),
    } satisfies LockupTableView;
  });
}

export function selectFirmnessTables(state: EditorState): FirmnessTableView[] {
  const { tune, values } = state;
  if (!tune || !values) return [];

  return epcFunctionsOf(tune).map((fn) => {
    const id = fn.definition.id;
    const [min, max] = functionYRange(fn.definition as ByteFunctionDefinition);
    const adders = values.epcAddersRaw[id];
    const originals = tune.originalValues.epcAddersRaw[id];
    return {
      functionId: id,
      title: fn.definition.label,
      min,
      max,
      rows: visiblePedalRows(fn).map((row) => {
        const value = adders[row.pointIndex] ?? 0;
        const originalValue = originals[row.pointIndex] ?? 0;
        return { ...row, value, originalValue, changed: value !== originalValue };
      }),
    };
  });
}

/** Counts changed visible rows (padding entries follow their row and are not counted). */
export function selectTransmissionChanges(state: EditorState): TransmissionChanges {
  const countChanged = (rows: readonly { changed: boolean }[]) =>
    rows.filter((row) => row.changed).length;
  const sum = (counts: readonly number[]) => counts.reduce((total, count) => total + count, 0);
  return {
    changedLockupPoints: sum(selectLockupTables(state).map((table) => countChanged(table.rows))),
    changedFirmnessPoints: sum(
      selectFirmnessTables(state).map((table) => countChanged(table.rows)),
    ),
  };
}

const MAX_PEDAL = 255;

/** Two interpolated speeds that are equal in exact arithmetic can differ by rounding error. */
const SPEED_TIE_TOLERANCE_RAW = 1e-9;

interface PedalRange {
  from: number;
  to: number;
  worstMph: number;
}

function curvePoints(fn: ByteFunction, speeds: readonly number[]) {
  return fn.points.map((point) => ({
    throttleRaw: point.xRaw,
    speedRaw: speeds[point.index] ?? 0,
  }));
}

/**
 * Unlock minus lock in mph where the converter could cycle, or undefined where it cannot. The PCM
 * (0x8b59a to 0x8b5df) reads the unlock function when the converter speed ratio is at or above the
 * minimum ratio, else the lock function, so an unlock speed at or above the lock speed cycles the
 * converter. That holds for an unlock speed of 127 mph too. Only a lock speed of 127 mph (never)
 * cannot cycle.
 */
function cycleMarginMph(lockRaw: number, unlockRaw: number): number | undefined {
  if (lockRaw >= LOCKUP_NEVER_SPEED_RAW) return undefined;
  const margin = unlockRaw - lockRaw;
  return margin >= -SPEED_TIE_TOLERANCE_RAW ? speedRawToMph(Math.max(margin, 0)) : undefined;
}

function cycleRanges(
  lock: readonly { throttleRaw: number; speedRaw: number }[],
  unlock: readonly { throttleRaw: number; speedRaw: number }[],
): PedalRange[] {
  const ranges: PedalRange[] = [];
  let open: PedalRange | undefined;
  for (let pedal = 0; pedal <= MAX_PEDAL; pedal++) {
    const margin = cycleMarginMph(
      evaluateShiftSpeedRaw(lock, pedal),
      evaluateShiftSpeedRaw(unlock, pedal),
    );
    if (margin === undefined) {
      open = undefined;
    } else if (open) {
      open.to = pedal;
      open.worstMph = Math.max(open.worstMph, margin);
    } else {
      open = { from: pedal, to: pedal, worstMph: margin };
      ranges.push(open);
    }
  }
  return ranges;
}

function describeRange(range: PedalRange): string {
  const from = Math.round(throttleRawToPercent(range.from));
  const to = Math.round(throttleRawToPercent(range.to));
  const pedal = from === to ? `Pedal ${from}%` : `Pedal ${from}–${to}%`;
  const relation =
    range.worstMph > 0
      ? `up to ${range.worstMph.toFixed(1)} mph above the lock speed`
      : "equal to the lock speed";
  return `${pedal}: the unlock speed is ${relation}.`;
}

/**
 * One line per pedal range where a gear's unlock speed is at or above its lock speed, so the
 * converter would lock and release again. Both functions are read the way the PCM reads them, at
 * every pedal byte 0..255. Where the lock speed is "never" there is nothing to cycle and nothing
 * shows. An unlock speed of 127 mph is an ordinary speed here and warns like any other.
 */
export function selectLockupWarnings(state: EditorState): ShiftOverlapView[] {
  const { tune, values } = state;
  if (!tune || !values) return [];

  const functions = lockupFunctionsOf(tune);
  return ["2", "3", "4"].flatMap((gear) => {
    const lock = functions.find((fn) => fn.definition.id === `lock-${gear}`);
    const unlock = functions.find((fn) => fn.definition.id === `unlock-${gear}`);
    if (!lock || !unlock) return [];
    const ranges = cycleRanges(
      curvePoints(lock, values.lockupSpeedsRaw[lock.definition.id]),
      curvePoints(unlock, values.lockupSpeedsRaw[unlock.definition.id]),
    );
    return ranges.map((range) => ({
      id: `${gear}:${range.from}-${range.to}`,
      title: `${GEAR_NAMES[gear]} gear unlocks at or above its lock speed`,
      detail: describeRange(range),
    }));
  });
}
