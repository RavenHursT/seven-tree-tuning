import {
  GRID_IDS,
  gridValueRange,
  setGridCellRaw,
  TDE1,
  type GridDefinition,
  type GridId,
  type TuneValues,
} from "@seven-tree/hydra";

/** The definition of a grid of the TDE1 strategy. Throws RangeError for an id that is not one. */
export function findGrid(id: GridId): GridDefinition {
  const definition = TDE1.grids.find((candidate) => candidate.id === id);
  if (!definition) throw new RangeError(`TDE1 has no grid ${id}`);
  return definition;
}

function withCells(values: TuneValues, id: GridId, cells: readonly number[]): TuneValues {
  return { ...values, gridsRaw: { ...values.gridsRaw, [id]: cells } };
}

/**
 * Sets one cell, rounded and clamped to the range of its cell size. Returns `values` itself for a
 * cell outside the grid or a value that is not a number, so a stray input changes nothing.
 */
export function setGridCell(
  values: TuneValues,
  id: GridId,
  row: number,
  col: number,
  raw: number,
): TuneValues {
  const definition = findGrid(id);
  const inside =
    Number.isInteger(row) &&
    row >= 0 &&
    row < definition.rows &&
    Number.isInteger(col) &&
    col >= 0 &&
    col < definition.cols;
  if (!inside || Number.isNaN(raw)) return values;
  return setGridCellRaw(values, definition, row, col, raw);
}

/**
 * Multiplies every cell of the grid by `factor`, rounded and clamped to the range of the cell.
 * Returns `values` itself unless `factor` is a finite number above zero.
 */
export function scaleGrid(values: TuneValues, id: GridId, factor: number): TuneValues {
  if (!Number.isFinite(factor) || factor <= 0) return values;
  const [min, max] = gridValueRange(findGrid(id));
  const scaled = values.gridsRaw[id].map((cell) =>
    Math.min(max, Math.max(min, Math.round(cell * factor))),
  );
  return withCells(values, id, scaled);
}

/** Puts the cells of one grid back to the values of the loaded tune. */
export function resetGrid(values: TuneValues, original: TuneValues, id: GridId): TuneValues {
  return withCells(values, id, original.gridsRaw[id]);
}

/** How many cells differ from the loaded tune, and in how many grids. `ids` limits it to some grids. */
export function countChangedGridCells(
  values: TuneValues,
  original: TuneValues,
  ids: readonly GridId[] = GRID_IDS,
): { changedCells: number; changedGrids: number } {
  const perGrid = ids.map((id) => {
    const before = original.gridsRaw[id];
    return values.gridsRaw[id].filter((cell, at) => cell !== before[at]).length;
  });
  return {
    changedCells: perGrid.reduce((total, count) => total + count, 0),
    changedGrids: perGrid.filter((count) => count > 0).length,
  };
}
