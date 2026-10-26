import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  LockupCurveTable,
  type LockupCurveRow,
  type LockupCurveTableProps,
} from "./lockup-curve-table";

const TITLE = "2nd gear lock";

function makeRow(overrides: Partial<LockupCurveRow> = {}): LockupCurveRow {
  return {
    pointIndex: 0,
    pedalRaw: 255,
    pedalPercent: 100,
    isStep: false,
    speedMph: 32,
    speedRaw: 64,
    speedoMph: 34.9,
    originalSpeedMph: 32,
    never: false,
    changed: false,
    ...overrides,
  };
}

// Listed closed pedal first: never, then a step at 40% (never, 20 mph), then wide open.
const rows: LockupCurveRow[] = [
  makeRow({
    pointIndex: 4,
    pedalRaw: 0,
    pedalPercent: 0,
    speedMph: 127,
    speedRaw: 254,
    speedoMph: 138.5,
    originalSpeedMph: 127,
    never: true,
  }),
  makeRow({
    pointIndex: 3,
    pedalRaw: 102,
    pedalPercent: 40,
    isStep: true,
    speedMph: 127,
    speedRaw: 254,
    speedoMph: 138.5,
    originalSpeedMph: 127,
    never: true,
  }),
  makeRow({
    pointIndex: 2,
    pedalRaw: 102,
    pedalPercent: 40,
    speedMph: 22,
    speedRaw: 44,
    speedoMph: 24,
    originalSpeedMph: 20,
    changed: true,
  }),
  makeRow({ pointIndex: 0 }),
];

function renderTable(props: Partial<LockupCurveTableProps> = {}) {
  const handlers = { onSpeedChange: vi.fn(), onSpeedoChange: vi.fn(), onNever: vi.fn() };
  render(
    <LockupCurveTable
      functionId="lock-2"
      title={TITLE}
      description="Locks at or above this speed"
      speedLabel="lock speed"
      rows={rows}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function field(pedal: string, column: "lock speed" | "speedometer", index = 0) {
  return screen.getAllByRole("textbox", { name: `${TITLE}, ${pedal}, ${column} (mph)` })[index]!;
}

describe("LockupCurveTable", () => {
  it("names the table, says what the curve does and lists the pedal positions closed first", () => {
    renderTable();

    const table = screen.getByRole("table", { name: TITLE });
    const labels = within(table)
      .getAllByRole("rowheader")
      .map((header) => header.textContent);

    expect(screen.getByRole("heading", { name: TITLE, level: 4 })).toBeInTheDocument();
    expect(screen.getByText("Locks at or above this speed")).toBeInTheDocument();
    expect(labels).toEqual(["Closed", "40% step", "40%", "WOT"]);
  });

  it("shows the lock speed and the speedometer speed", () => {
    renderTable();

    expect(field("100% pedal", "lock speed")).toHaveValue("32.0");
    expect(field("100% pedal", "speedometer")).toHaveValue("34.9");
  });

  it("shows never in both fields for 127 mph", () => {
    renderTable();

    expect(field("0% pedal", "lock speed")).toHaveValue("never");
    expect(field("0% pedal", "speedometer")).toHaveValue("never");
    expect(
      screen.getByRole("button", { name: `${TITLE}, 0% pedal, set to never` }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("reports a typed lock speed with the row's point index", async () => {
    const user = userEvent.setup();
    const { onSpeedChange } = renderTable();

    const input = field("100% pedal", "lock speed");
    await user.clear(input);
    await user.type(input, "35");

    expect(onSpeedChange).toHaveBeenLastCalledWith(0, 35);
  });

  it("reports a typed speedometer speed with the row's point index", async () => {
    const user = userEvent.setup();
    const { onSpeedoChange } = renderTable();

    const input = field("100% pedal", "speedometer");
    await user.clear(input);
    await user.type(input, "40");

    expect(onSpeedoChange).toHaveBeenLastCalledWith(0, 40);
  });

  it("sets never with the button of a row that is not never", async () => {
    const user = userEvent.setup();
    const { onNever } = renderTable();

    await user.click(screen.getByRole("button", { name: `${TITLE}, 100% pedal, set to never` }));

    expect(onNever).toHaveBeenCalledWith(0);
  });

  it("does nothing when the button of a row that is already never is clicked", async () => {
    const user = userEvent.setup();
    const { onNever } = renderTable();

    await user.click(screen.getByRole("button", { name: `${TITLE}, 0% pedal, set to never` }));

    expect(onNever).not.toHaveBeenCalled();
  });

  it("marks a changed row and shows its original speed", () => {
    renderTable();

    expect(screen.getByText("was 20.0")).toBeInTheDocument();
    expect(field("40% pedal", "lock speed")).toHaveAccessibleDescription("was 20.0");
  });

  it("shows was never when the original was never", () => {
    renderTable({
      rows: [makeRow({ pointIndex: 1, changed: true, originalSpeedMph: 127 })],
    });

    expect(screen.getByText("was never")).toBeInTheDocument();
  });

  it("keeps Reset in the tab order but unusable while nothing changed", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    renderTable({ onReset, rows: [makeRow()] });

    const reset = screen.getByRole("button", { name: `Reset ${TITLE}` });
    await user.click(reset);

    expect(reset).toHaveAttribute("aria-disabled", "true");
    expect(onReset).not.toHaveBeenCalled();
  });

  it("resets the curve when something changed", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    renderTable({ onReset });

    await user.click(screen.getByRole("button", { name: `Reset ${TITLE}` }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
