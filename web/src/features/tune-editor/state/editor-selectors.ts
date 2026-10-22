import {
  closedThrottleIndex,
  findShiftOverlaps,
  idleRawToRpm,
  isChipSerial,
  shiftPointToSpeedoMph,
  speedometerFactor,
  speedRawToMph,
  throttleRawToPercent,
  tireDiameterIn,
  type IdlePoint,
  type ShiftCurveId,
  type ShiftKind,
} from "@seven-tree/hydra";

import type { ShiftCurveRow } from "../components/shift-curve-table";
import type { ShiftOverlapView } from "../components/shift-overlap-alert";

import type { EditorState } from "./editor-reducer";

export interface CurveTableView {
  readonly curveId: ShiftCurveId;
  readonly title: string;
  readonly kind: ShiftKind;
  readonly rows: readonly ShiftCurveRow[];
}

export interface CurveTablesView {
  readonly upshifts: readonly CurveTableView[];
  readonly downshifts: readonly CurveTableView[];
}

export interface ChangeSummary {
  readonly changedShiftPoints: number;
  readonly idleChanged: boolean;
}

export interface IdleView {
  readonly rpm: number;
  readonly originalRpm: number;
  readonly warning: string | undefined;
  readonly idleCurve: readonly IdlePoint[];
}

/** Speedometer mph = tune mph x this factor (fitted diameter / calibration diameter). */
export function selectSpeedometerFactor(state: EditorState): number {
  return speedometerFactor(state.fittedTire, state.calibrationTire);
}

export function selectCurveTables(state: EditorState): CurveTablesView {
  const { tune, values } = state;
  if (!tune || !values) return { upshifts: [], downshifts: [] };

  const factor = selectSpeedometerFactor(state);
  const tables = tune.curves.map((curve): CurveTableView => {
    const id = curve.definition.id;
    const speeds = values.shiftSpeedsRaw[id];
    const originals = tune.originalValues.shiftSpeedsRaw[id];
    const visible = curve.breakpoints.slice(0, closedThrottleIndex(curve) + 1);
    return {
      curveId: id,
      title: curve.definition.label,
      kind: curve.definition.kind,
      rows: visible.map((point, row) => {
        const speedRaw = speeds[point.index] ?? 0;
        const originalRaw = originals[point.index] ?? 0;
        return {
          breakpointIndex: point.index,
          throttleRaw: point.throttleRaw,
          throttlePercent: throttleRawToPercent(point.throttleRaw),
          isStep: row > 0 && visible[row - 1]?.throttleRaw === point.throttleRaw,
          shiftPointMph: speedRawToMph(speedRaw),
          shiftPointRaw: speedRaw,
          speedoMph: shiftPointToSpeedoMph(speedRaw, factor),
          originalShiftPointMph: speedRawToMph(originalRaw),
          changed: speedRaw !== originalRaw,
        };
      }),
    };
  });

  return {
    upshifts: tables.filter((table) => table.kind === "upshift"),
    downshifts: tables.filter((table) => table.kind === "downshift"),
  };
}

/** One line per throttle range where a downshift is above its upshift (gear hunting). */
export function selectOverlapViews(state: EditorState): ShiftOverlapView[] {
  const { tune, values } = state;
  if (!tune || !values) return [];

  return findShiftOverlaps(tune.curves, values).map((overlap) => {
    const from = Math.round(throttleRawToPercent(overlap.throttleFromRaw));
    const to = Math.round(throttleRawToPercent(overlap.throttleToRaw));
    const range = from === to ? `Throttle ${from}%` : `Throttle ${from}–${to}%`;
    const excess = (-overlap.worstMarginMph).toFixed(1);
    return {
      id: `${overlap.upshift}:${overlap.throttleFromRaw}-${overlap.throttleToRaw}`,
      title: `${overlap.upperGear}→${overlap.lowerGear} downshift above ${overlap.lowerGear}→${overlap.upperGear} upshift`,
      detail: `${range}: the downshift is up to ${excess} mph above the upshift.`,
    };
  });
}

/** Counts changed visible rows (padding entries follow their row and are not counted). */
export function selectChangeSummary(state: EditorState): ChangeSummary {
  const { tune, values } = state;
  if (!tune || !values) return { changedShiftPoints: 0, idleChanged: false };

  const { upshifts, downshifts } = selectCurveTables(state);
  const changedShiftPoints = [...upshifts, ...downshifts]
    .flatMap((table) => table.rows)
    .filter((row) => row.changed).length;
  const idleChanged = values.warmIdleRaw.some(
    (raw, copy) => raw !== tune.originalValues.warmIdleRaw[copy],
  );
  return { changedShiftPoints, idleChanged };
}

/** Field error for a chip serial as typed; undefined while empty or when valid. */
export function selectChipSerialError(chipSerial: string): string | undefined {
  if (chipSerial === "" || isChipSerial(chipSerial)) return undefined;
  if (/[^0-9A-F]/.test(chipSerial)) return "Use only the digits 0–9 and letters A–F.";
  return "Enter all 8 hex digits.";
}

/** Why "Generate Tune" is unavailable, or undefined when it is available. */
export function selectGenerateDisabledReason(state: EditorState): string | undefined {
  if (!state.tune) return "Load a tune first.";
  if (!isChipSerial(state.chipSerial)) return "Enter the 8-digit chip serial in Base Tune.";
  if (state.outputFileName.trim() === "") return "Enter an output file name.";
  return undefined;
}

export function selectIdleView(state: EditorState): IdleView | undefined {
  const { tune, values } = state;
  if (!tune || !values) return undefined;

  const rpm = idleRawToRpm(values.warmIdleRaw[0]);
  const nextPoint = tune.idleCurve[2];
  const warning =
    nextPoint && rpm > nextPoint.rpm
      ? `Higher than the next point on the idle curve (${nextPoint.rpm.toLocaleString("en-US")} rpm).`
      : undefined;
  return {
    rpm,
    originalRpm: idleRawToRpm(tune.originalValues.warmIdleRaw[0]),
    warning,
    // The first two points are the warm idle; show them as edited.
    idleCurve: tune.idleCurve.map((point, index) => (index < 2 ? { ...point, rpm } : point)),
  };
}

export function selectTireDiameters(state: EditorState): { fitted: number; calibration: number } {
  return {
    fitted: tireDiameterIn(state.fittedTire),
    calibration: tireDiameterIn(state.calibrationTire),
  };
}
