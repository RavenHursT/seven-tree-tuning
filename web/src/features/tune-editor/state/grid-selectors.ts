import {
  gridValueRange,
  readGridAxes,
  TDE1,
  type DisplayUnit,
  type GridAxisDefinition,
  type GridDefinition,
  type GridGroup,
  type GridId,
} from "@seven-tree/hydra";

import type {
  GridAxisHeader,
  GridAxisView,
  GridEditorView,
  GridValueFormat,
} from "../components/grid-editor";

import type { EditorState } from "./editor-reducer";
import { countChangedGridCells, findGrid } from "./grid-edits";

/** The grids of each module, in the order of the hydra definitions. */
export const GRID_GROUP_IDS: Readonly<Record<GridGroup, readonly GridId[]>> = {
  "fuel-power": gridIdsOf("fuel-power"),
  "timing-icp": gridIdsOf("timing-icp"),
};

function gridIdsOf(group: GridGroup): GridId[] {
  return TDE1.grids.filter((grid) => grid.group === group).map((grid) => grid.id);
}

/** A grid in the picker of a module: its name and how many of its cells were edited. */
export interface GridTabView {
  readonly id: GridId;
  readonly label: string;
  readonly changedCells: number;
}

export interface GridChangeSummary {
  readonly changedCells: number;
  readonly changedGrids: number;
}

/** How a unit label from the hydra definitions reads in words. */
const UNIT_NAMES: Readonly<Record<string, string>> = {
  "×": "multiplier (×)",
  "°": "crank degrees (°)",
  rpm: "rpm",
};

const NO_TUNE = "No tune loaded";

/** Decimals that tell two neighbouring stored values apart: 2 for 1/64, 4 for 1/4096, 0 for 1. */
function decimalsFor(perRaw: number): number {
  return Math.max(0, Math.ceil(-Math.log10(perRaw)));
}

function valueFormat(definition: GridDefinition): GridValueFormat {
  const unit = definition.valueUnit;
  if (!unit) return { perRaw: 1, unit: undefined, unitName: "PCM units", decimals: 0 };
  return {
    perRaw: unit.perRaw,
    unit: unit.label,
    unitName: UNIT_NAMES[unit.label] ?? unit.label,
    decimals: decimalsFor(unit.perRaw),
  };
}

/** A breakpoint as the user reads it: the stored value times the axis unit, without trailing zeros. */
function formatBreakpoint(raw: number, unit: DisplayUnit | undefined): string {
  return String(Number((raw * (unit?.perRaw ?? 1)).toFixed(2)));
}

function axisView(
  axis: GridAxisDefinition,
  breakpointsRaw: readonly (number | undefined)[],
): GridAxisView {
  const headers = breakpointsRaw.map((raw, index): GridAxisHeader => {
    if (raw === undefined) return { text: `index ${index}`, reached: false };
    return { text: formatBreakpoint(raw, axis.unit), reached: true };
  });
  return { name: axis.name, unit: axis.unit?.label, headers };
}

/** The props of the grid editor for one grid, or undefined before a tune is loaded. */
export function selectGridEditorView(state: EditorState, id: GridId): GridEditorView | undefined {
  const { tune, values } = state;
  if (!tune || !values) return undefined;

  const definition = findGrid(id);
  const axes = readGridAxes(tune.image, definition);
  const [minRaw, maxRaw] = gridValueRange(definition);
  return {
    gridId: id,
    label: definition.label,
    rowAxis: axisView(definition.rowAxis, axes.rowBreakpointsRaw),
    colAxis: axisView(definition.colAxis, axes.colBreakpointsRaw),
    cells: values.gridsRaw[id],
    originalCells: tune.originalValues.gridsRaw[id],
    minRaw,
    maxRaw,
    value: valueFormat(definition),
  };
}

function changedCellsOf(state: EditorState, id: GridId): number {
  const { tune, values } = state;
  if (!tune || !values) return 0;
  return countChangedGridCells(values, tune.originalValues, [id]).changedCells;
}

/** Every grid, over both modules: the cells edited and the grids they are in. */
export function selectGridChangeSummary(state: EditorState): GridChangeSummary {
  const { tune, values } = state;
  if (!tune || !values) return { changedCells: 0, changedGrids: 0 };
  return countChangedGridCells(values, tune.originalValues);
}

export function selectGridTabs(state: EditorState, group: GridGroup): GridTabView[] {
  return GRID_GROUP_IDS[group].map((id) => ({
    id,
    label: findGrid(id).label,
    changedCells: changedCellsOf(state, id),
  }));
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "No changes", or "3 cells changed in 2 grids", for the grids of one module. */
export function summarizeGridGroup(state: EditorState, group: GridGroup): string {
  if (!state.tune) return NO_TUNE;
  const tabs = selectGridTabs(state, group).filter((tab) => tab.changedCells > 0);
  if (tabs.length === 0) return "No changes";
  const cells = tabs.reduce((total, tab) => total + tab.changedCells, 0);
  return `${plural(cells, "cell")} changed in ${plural(tabs.length, "grid")}`;
}
