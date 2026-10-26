"use client";

import * as React from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** One row or column heading. `reached` is false when the tune's axis never gets to that index. */
export interface GridAxisHeader {
  text: string;
  reached: boolean;
}

export interface GridAxisView {
  /** What the axis measures, for example "Engine speed". */
  name: string;
  /** The unit of the headings, for example "rpm". Absent when no unit is confirmed. */
  unit?: string;
  headers: readonly GridAxisHeader[];
}

/** How a stored cell value shows: display = raw x perRaw, with `decimals` decimals. */
export interface GridValueFormat {
  perRaw: number;
  /** Short unit mark, for example "°". Absent when the cell is shown as stored. */
  unit?: string;
  /** The unit in words, for the line under the grid. */
  unitName: string;
  decimals: number;
}

export interface GridEditorView {
  gridId: string;
  label: string;
  rowAxis: GridAxisView;
  colAxis: GridAxisView;
  /** Stored cell values, row by row. */
  cells: readonly number[];
  /** The stored cell values of the loaded tune, row by row. */
  originalCells: readonly number[];
  minRaw: number;
  maxRaw: number;
  value: GridValueFormat;
}

export interface GridEditorProps extends GridEditorView {
  onCellChange(row: number, col: number, raw: number): void;
  /** `factor` is above zero: 1.1 scales every cell up by 10 %. */
  onScale(factor: number): void;
  onReset(): void;
}

const DECIMAL_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const UNREACHED_NOTE = "not reached by this tune";
const UNAVAILABLE_CLASS = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  return DECIMAL_TEXT.test(trimmed) ? Number(trimmed) : null;
}

function formatRaw(raw: number, value: GridValueFormat): string {
  return (raw * value.perRaw).toFixed(value.decimals);
}

/** The longest text a cell of the grid can show: the text of its smallest or largest value. */
function longestText(view: GridEditorView): number {
  return Math.max(
    formatRaw(view.minRaw, view.value).length,
    formatRaw(view.maxRaw, view.value).length,
  );
}

function axisCaption(kind: "Rows" | "Columns", axis: GridAxisView): string {
  return `${kind}: ${axis.name} (${axis.unit ?? "PCM units"})`;
}

interface GridCellProps {
  name: string;
  /** Width of the field in characters: the longest text any value of the grid can have. */
  chars: number;
  row: number;
  col: number;
  raw: number;
  originalRaw: number;
  minRaw: number;
  maxRaw: number;
  value: GridValueFormat;
  unreached: boolean;
  onChange(row: number, col: number, raw: number): void;
  /** The first keystroke of an edit: the text is not committed until the draft ends. */
  onDraftStart(): void;
  /** Blur, Enter or Escape: the edit is committed or cancelled. */
  onDraftEnd(): void;
}

/**
 * One number field. As in NumberField, the typed text stays while the field has focus and each
 * valid number is stored at once; leaving the field shows the stored value. A number outside the
 * range of the cell is stored clamped, and the field is marked invalid until focus leaves.
 */
function GridCell({
  name,
  chars,
  row,
  col,
  raw,
  originalRaw,
  minRaw,
  maxRaw,
  value,
  unreached,
  onChange,
  onDraftStart,
  onDraftEnd,
}: GridCellProps) {
  const originalId = React.useId();
  const [draft, setDraft] = React.useState<string | null>(null);
  const rawAtFocus = React.useRef<number | null>(null);
  const committedSinceFocus = React.useRef(false);
  const changed = raw !== originalRaw;
  const typed = draft === null ? null : parseDecimal(draft);
  const typedRaw = typed === null ? null : Math.round(typed / value.perRaw);
  const invalid = draft !== null && (typedRaw === null || typedRaw < minRaw || typedRaw > maxRaw);

  function commit(next: number) {
    committedSinceFocus.current = true;
    onChange(row, col, next);
  }

  function endDraft() {
    setDraft(null);
    onDraftEnd();
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (draft === null) onDraftStart();
    setDraft(event.target.value);
    const parsed = parseDecimal(event.target.value);
    if (parsed === null) return;
    commit(Math.min(maxRaw, Math.max(minRaw, Math.round(parsed / value.perRaw))));
  }

  function cancelEdit() {
    const original = rawAtFocus.current;
    if (original !== null && (committedSinceFocus.current || original !== raw)) {
      onChange(row, col, original);
    }
    committedSinceFocus.current = false;
    endDraft();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") endDraft();
    else if (event.key === "Escape") cancelEdit();
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    rawAtFocus.current = raw;
    committedSinceFocus.current = false;
    event.target.select();
  }

  return (
    <TableCell
      className="p-px text-right data-[changed=true]:bg-primary/15 data-[unreached=true]:bg-muted"
      data-changed={changed || undefined}
      data-unreached={unreached || undefined}
      title={changed ? `was ${formatRaw(originalRaw, value)}` : undefined}
    >
      <Input
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={name}
        aria-invalid={invalid || undefined}
        aria-describedby={changed ? originalId : undefined}
        data-row={row}
        data-col={col}
        // Wide enough for the longest value the cell can hold, so no digit is cut off. The fields
        // of the widest grid (16 columns) must still fit the module at 1280 px.
        style={{ width: `calc(${chars}ch + 0.75rem)` }}
        className={cn("h-7 px-1 text-right tabular-nums", unreached && "text-muted-foreground")}
        value={draft ?? formatRaw(raw, value)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={endDraft}
      />
      {changed ? (
        <span id={originalId} className="sr-only">
          was {formatRaw(originalRaw, value)}
        </span>
      ) : null}
    </TableCell>
  );
}

function ColumnHeader({ header }: { header: GridAxisHeader }) {
  return (
    <TableHead
      scope="col"
      className="h-8 px-1 text-right tabular-nums data-[unreached=true]:font-normal data-[unreached=true]:text-muted-foreground"
      data-unreached={header.reached ? undefined : true}
    >
      {header.text}
      {header.reached ? null : <span className="sr-only"> ({UNREACHED_NOTE})</span>}
    </TableHead>
  );
}

function RowHeader({ header }: { header: GridAxisHeader }) {
  return (
    <TableHead
      scope="row"
      className="sticky left-0 z-[1] h-auto bg-card px-2 py-0.5 text-right tabular-nums data-[unreached=true]:font-normal data-[unreached=true]:text-muted-foreground"
      data-unreached={header.reached ? undefined : true}
    >
      {header.text}
      {header.reached ? null : <span className="sr-only"> ({UNREACHED_NOTE})</span>}
    </TableHead>
  );
}

type Arrow = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
const ARROW_STEPS: Readonly<Record<Arrow, readonly [row: number, col: number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function isArrow(key: string): key is Arrow {
  return key in ARROW_STEPS;
}

function hasModifier(event: React.KeyboardEvent<HTMLElement>): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/**
 * True when Left or Right may leave the field: the caret is at the start (Left) or the end (Right)
 * of the text, or the whole text is selected. Anywhere else the arrow moves the caret.
 */
function caretAllowsLeaving(input: HTMLInputElement, key: Arrow): boolean {
  const { selectionStart: start, selectionEnd: end, value } = input;
  if (start === null || end === null) return true;
  if (start === 0 && end === value.length) return true;
  if (start !== end) return false;
  return key === "ArrowLeft" ? start === 0 : start === value.length;
}

function mayMove(event: React.KeyboardEvent<HTMLElement>, input: HTMLInputElement, key: Arrow) {
  if (key === "ArrowUp" || key === "ArrowDown") return true;
  return !hasModifier(event) && caretAllowsLeaving(input, key);
}

/**
 * Moves focus one cell with an arrow key, and stays on the edge cell at the edge of the grid. Left
 * and Right move only from the start or end of the text (or with the whole text selected) and
 * with no Alt, Ctrl, Meta or Shift held, so they still move the caret and select text.
 */
function moveFocus(event: React.KeyboardEvent<HTMLElement>, rows: number, cols: number) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !isArrow(event.key)) return;
  if (!mayMove(event, input, event.key)) return;
  const [rowStep, colStep] = ARROW_STEPS[event.key];
  const row = Math.min(rows - 1, Math.max(0, Number(input.dataset.row) + rowStep));
  const col = Math.min(cols - 1, Math.max(0, Number(input.dataset.col) + colStep));
  const next = event.currentTarget.querySelector<HTMLInputElement>(
    `input[data-row="${row}"][data-col="${col}"]`,
  );
  event.preventDefault();
  next?.focus();
}

interface ScaleControlProps {
  onScale(factor: number): void;
}

/** A percent field and its button. The field goes back to 100 after each use, so a second press cannot scale twice. */
function ScaleControl({ onScale }: ScaleControlProps) {
  const fieldId = React.useId();
  const [text, setText] = React.useState("100");
  const percent = parseDecimal(text);
  const valid = percent !== null && percent > 0;

  function apply() {
    if (!valid) return;
    onScale(percent / 100);
    setText("100");
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId}>Scale grid by %</Label>
        <Input
          id={fieldId}
          inputMode="decimal"
          autoComplete="off"
          className="h-7 w-20 text-right tabular-nums"
          value={text}
          aria-invalid={valid ? undefined : true}
          onChange={(event) => setText(event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply();
          }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="xs"
        aria-label="Apply scale"
        aria-disabled={valid ? undefined : true}
        className={UNAVAILABLE_CLASS}
        onClick={apply}
      >
        Apply
      </Button>
    </div>
  );
}

function changedText(count: number): string {
  if (count === 0) return "No changes";
  return `${count} ${count === 1 ? "cell" : "cells"} changed`;
}

interface GridToolbarProps {
  /** The count shown as text, which follows every keystroke. */
  changedCells: number;
  /** The count the status line announces: it changes only when an edit is committed. */
  announcedCells: number;
  gridLabel: string;
  onScale(factor: number): void;
  onReset(): void;
}

function GridToolbar({
  changedCells,
  announcedCells,
  gridLabel,
  onScale,
  onReset,
}: GridToolbarProps) {
  const unavailable = changedCells === 0;

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <ScaleControl onScale={onScale} />
      {/* Stays in the page and in the tab order when nothing changed, so focus is not lost when a reset removes the last change. */}
      <Button
        type="button"
        variant="outline"
        size="xs"
        aria-disabled={unavailable || undefined}
        className={UNAVAILABLE_CLASS}
        onClick={() => {
          if (!unavailable) onReset();
        }}
      >
        <ArrowCounterClockwiseIcon data-icon="inline-start" />
        Reset grid
      </Button>
      <p aria-hidden="true" className="text-xs text-muted-foreground">
        {changedText(changedCells)}
      </p>
      {/* Present before its text changes, and changed only when an edit is committed. */}
      <p role="status" className="sr-only">
        {gridLabel}: {changedText(announcedCells)}
      </p>
    </div>
  );
}

function cellName(view: GridEditorView, row: number, col: number): string {
  const rowText = view.rowAxis.headers[row]?.text ?? `index ${row}`;
  const colText = view.colAxis.headers[col]?.text ?? `index ${col}`;
  return `${view.label}, ${view.rowAxis.name} ${rowText}, ${view.colAxis.name} ${colText}`;
}

/**
 * An editable grid: a table of number fields with the axis breakpoints as row and column
 * headings, a Scale and a Reset button, and a count of changed cells. It scrolls inside its own
 * container when it is wider than the module.
 */
export function GridEditor(props: GridEditorProps) {
  const { label, rowAxis, colAxis, cells, originalCells, value, onCellChange } = props;
  const rows = rowAxis.headers.length;
  const cols = colAxis.headers.length;
  const changedCells = cells.filter((cell, at) => cell !== originalCells[at]).length;
  // The count before the cell being typed in was touched; null while no cell is being typed in.
  const [heldCount, setHeldCount] = React.useState<number | null>(null);
  const axesId = React.useId();
  const chars = longestText(props);
  const anyUnreached = [...rowAxis.headers, ...colAxis.headers].some((header) => !header.reached);

  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-3">
      <GridToolbar
        changedCells={changedCells}
        announcedCells={heldCount ?? changedCells}
        gridLabel={label}
        onScale={props.onScale}
        onReset={props.onReset}
      />
      {/* Outside the scrolling table, so it stays in view while a wide grid is scrolled. */}
      <div id={axesId} className="text-xs text-muted-foreground">
        <p>{axisCaption("Rows", rowAxis)}</p>
        <p>{axisCaption("Columns", colAxis)}</p>
      </div>
      <Table className="w-max" aria-describedby={axesId} data-grid-id={props.gridId}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-[1] bg-card">
              <span className="sr-only">Rows, columns</span>
            </TableHead>
            {colAxis.headers.map((header, col) => (
              <ColumnHeader key={col} header={header} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody onKeyDown={(event) => moveFocus(event, rows, cols)}>
          {rowAxis.headers.map((rowHeader, row) => (
            <TableRow key={row} className="hover:bg-transparent">
              <RowHeader header={rowHeader} />
              {colAxis.headers.map((colHeader, col) => (
                <GridCell
                  key={col}
                  name={cellName(props, row, col)}
                  chars={chars}
                  row={row}
                  col={col}
                  raw={cells[row * cols + col] ?? 0}
                  originalRaw={originalCells[row * cols + col] ?? 0}
                  minRaw={props.minRaw}
                  maxRaw={props.maxRaw}
                  value={value}
                  unreached={!rowHeader.reached || !colHeader.reached}
                  onChange={onCellChange}
                  onDraftStart={() => setHeldCount((held) => held ?? changedCells)}
                  onDraftEnd={() => setHeldCount(null)}
                />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">Cell values: {value.unitName}.</p>
      {anyUnreached ? (
        <p className="text-xs text-muted-foreground">
          Dimmed rows and columns are {UNREACHED_NOTE}. The PCM does not read them with this tune,
          but you can still edit them.
        </p>
      ) : null}
    </div>
  );
}
