import type { EditorState } from "./editor-reducer";
import {
  selectFirmnessTables,
  selectLockupTables,
  selectLockupWarnings,
  selectTransmissionChanges,
  type LockupTableView,
} from "./transmission-selectors";

// Text for the header of each collapsed transmission module, like the ones in module-summaries.ts.

const NO_TUNE = "No tune loaded";
const SEPARATOR = " · ";
const GEARS_SHOWN = [
  ["4th", "4"],
  ["3rd", "3"],
  ["2nd", "2"],
] as const;

/** "30", "27.5" or "never": up to one decimal, no trailing zero. */
function formatSpeed(mph: number, never: boolean): string {
  return never ? "never" : String(Number(mph.toFixed(1)));
}

/** Closed-pedal value, then wide-open value: "27–31", or one value when they are the same. */
function closedToWideOpen(values: readonly string[]): string {
  const closed = values[0];
  const wideOpen = values.at(-1);
  return closed === wideOpen ? `${closed}` : `${closed}–${wideOpen}`;
}

function speedRange(table: LockupTableView | undefined): string {
  if (!table) return "";
  return closedToWideOpen(table.rows.map((row) => formatSpeed(row.speedMph, row.never)));
}

/**
 * "4th 30/28 · 3rd 27–31/17 · 2nd never–32/15 · 2 changed · converter cycling warning": the lock
 * and unlock speed of each gear from closed pedal to wide open, in mph as stored in the tune. The
 * count shows only when a point differs from the loaded tune, and the warning only when an unlock
 * speed is at or above its lock speed.
 */
export function summarizeConverterLockup(state: EditorState): string {
  const tables = selectLockupTables(state);
  if (tables.length === 0) return NO_TUNE;

  const { changedLockupPoints } = selectTransmissionChanges(state);
  const gears = GEARS_SHOWN.map(([name, gear]) => {
    const lock = tables.find((table) => table.functionId === `lock-${gear}`);
    const unlock = tables.find((table) => table.functionId === `unlock-${gear}`);
    return `${name} ${speedRange(lock)}/${speedRange(unlock)}`;
  });
  return [
    ...gears,
    ...(changedLockupPoints > 0 ? [`${changedLockupPoints} changed`] : []),
    ...(selectLockupWarnings(state).length > 0 ? ["converter cycling warning"] : []),
  ].join(SEPARATOR);
}

/** "1→2 10–18 · 2→3 10–14 · 3→4 28–38 · 1 changed": closed-to-wide-open adder of each upshift. */
export function summarizeShiftFirmness(state: EditorState): string {
  const tables = selectFirmnessTables(state);
  if (tables.length === 0) return NO_TUNE;

  const { changedFirmnessPoints } = selectTransmissionChanges(state);
  return [
    ...tables.map((table) => {
      const [, from, to] = table.functionId.split("-");
      return `${from}→${to} ${closedToWideOpen(table.rows.map((row) => String(row.value)))}`;
    }),
    ...(changedFirmnessPoints > 0 ? [`${changedFirmnessPoints} changed`] : []),
  ].join(SEPARATOR);
}
