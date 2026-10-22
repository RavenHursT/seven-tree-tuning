import { formatTireSize, tireDiameterIn, type ContainerFormat } from "@seven-tree/hydra";

import type { EditorState } from "./editor-reducer";
import {
  selectChangeSummary,
  selectCurveTables,
  selectIdleView,
  selectOverlapViews,
  selectSpeedometerFactor,
  type CurveTableView,
} from "./editor-selectors";

// Text for the header of each collapsed module: the values that are set, and nothing else.
// Every function reads the editor state only, and every one is safe to call before a tune loads.

/** How each file format is named on screen. */
export const FORMAT_LABELS: Readonly<Record<ContainerFormat, string>> = {
  hcf: "Hydra .hcf",
  efu: "PHP library .efu",
  bin: "decrypted .bin",
};

const NO_TUNE = "No tune loaded";
const SEPARATOR = " · ";

function joinParts(parts: readonly string[]): string {
  return parts.join(SEPARATOR);
}

/**
 * "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf · Hydra .hcf · chip serial 0A1B2C3D": the open
 * tune, then the serial as entered, even when it is only partly typed. No serial, no serial part.
 */
export function summarizeBaseTune(state: EditorState): string {
  const { tune, chipSerial } = state;
  const tunePart = tune
    ? joinParts([tune.source.fileName, FORMAT_LABELS[tune.source.format]])
    : NO_TUNE;
  return joinParts([tunePart, ...(chipSerial === "" ? [] : [`chip serial ${chipSerial}`])]);
}

/** "315/75R16 · 34.60 in · calibrated for 235/85R16 · speedometer × 1.0906" */
export function summarizeTires(state: EditorState): string {
  const { fittedTire, calibrationTire } = state;
  return joinParts([
    formatTireSize(fittedTire),
    `${tireDiameterIn(fittedTire).toFixed(2)} in`,
    `calibrated for ${formatTireSize(calibrationTire)}`,
    `speedometer × ${selectSpeedometerFactor(state).toFixed(4)}`,
  ]);
}

/** "1→2" for the curve with id "up-1-2" (its title also says "(overdrive)" for 3→4). */
function gearsOf(curve: CurveTableView): string {
  const [, from, to] = curve.curveId.split("-");
  return `${from}→${to}`;
}

/** Wide-open shift point, then closed-throttle shift point, in the tune's mph. */
function shiftPointRange(curve: CurveTableView): string {
  const wideOpen = curve.rows[0]?.shiftPointMph;
  const closed = curve.rows.at(-1)?.shiftPointMph;
  return `${wideOpen}–${closed}`;
}

/**
 * "1→2 27–7 · 2→3 43–18 · ... · 1 changed · gear hunting warning": the wide-open and
 * closed-throttle shift point of each curve, in curve order. The count shows only when a shift
 * point differs from the loaded tune, and the warning only when a downshift is above its upshift.
 */
export function summarizeShiftPoints(state: EditorState): string {
  const { upshifts, downshifts } = selectCurveTables(state);
  const curves = [...upshifts, ...downshifts];
  if (curves.length === 0) return NO_TUNE;

  const { changedShiftPoints } = selectChangeSummary(state);
  return joinParts([
    ...curves.map((curve) => `${gearsOf(curve)} ${shiftPointRange(curve)}`),
    ...(changedShiftPoints > 0 ? [`${changedShiftPoints} changed`] : []),
    ...(selectOverlapViews(state).length > 0 ? ["gear hunting warning"] : []),
  ]);
}

/** Up to two decimals, no trailing zeros: 680 -> "680", 687.5 -> "687.5". Same as the idle field. */
function formatRpm(rpm: number): string {
  return String(Number(rpm.toFixed(2)));
}

/** "680 rpm" */
export function summarizeIdle(state: EditorState): string {
  const view = selectIdleView(state);
  return view ? `${formatRpm(view.rpm)} rpm` : NO_TUNE;
}
