import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ShiftCurveTable,
  type ShiftCurveRow,
  type ShiftCurveTableProps,
} from "./shift-curve-table";

const TITLE = "3→4 (overdrive)";

function makeRow(overrides: Partial<ShiftCurveRow> = {}): ShiftCurveRow {
  return {
    breakpointIndex: 0,
    throttleRaw: 255,
    throttlePercent: 100,
    isStep: false,
    shiftPointMph: 64.5,
    shiftPointRaw: 129,
    speedoMph: 70.34,
    originalShiftPointMph: 64.5,
    changed: false,
    ...overrides,
  };
}

const rows: ShiftCurveRow[] = [
  makeRow({ breakpointIndex: 0 }),
  makeRow({
    breakpointIndex: 1,
    throttleRaw: 128,
    throttlePercent: 50.196,
    shiftPointMph: 52,
    shiftPointRaw: 104,
    speedoMph: 56.71,
    originalShiftPointMph: 52,
  }),
  makeRow({
    breakpointIndex: 2,
    throttleRaw: 128,
    throttlePercent: 50.196,
    isStep: true,
    shiftPointMph: 44.5,
    shiftPointRaw: 89,
    speedoMph: 48.53,
    originalShiftPointMph: 44.5,
  }),
  makeRow({
    breakpointIndex: 3,
    throttleRaw: 0,
    throttlePercent: 0,
    shiftPointMph: 38,
    shiftPointRaw: 76,
    speedoMph: 41.4428,
    originalShiftPointMph: 36,
    changed: true,
  }),
];

function renderTable(props: Partial<ShiftCurveTableProps> = {}) {
  const handlers = { onShiftPointChange: vi.fn(), onSpeedoChange: vi.fn() };
  render(
    <ShiftCurveTable
      curveId="up-3-4"
      title={TITLE}
      kind="upshift"
      rows={rows}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function getTable(): HTMLElement {
  return screen.getByRole("table", { name: TITLE });
}

function shiftPoint(throttle: string): HTMLInputElement {
  return screen.getByRole("textbox", { name: `${TITLE}, ${throttle}, shift point (mph)` });
}

function speedometer(throttle: string): HTMLInputElement {
  return screen.getByRole("textbox", { name: `${TITLE}, ${throttle}, speedometer (mph)` });
}

describe("ShiftCurveTable layout", () => {
  it.each([
    ["upshift", "Upshift"],
    ["downshift", "Downshift"],
  ] as const)("shows the title and says this is a %s", (kind, label) => {
    renderTable({ kind });

    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows the title as a level 4 heading, under the Upshifts or Downshifts level 3 heading", () => {
    renderTable();

    expect(screen.getByRole("heading", { level: 4, name: TITLE })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("keeps the title inside the card title slot", () => {
    renderTable();

    const heading = screen.getByRole("heading", { level: 4, name: TITLE });

    expect(heading.closest("[data-slot=card-title]")).not.toBeNull();
  });

  it("has a Throttle, a Shift point and a Speedometer column, with mph shown for the last two", () => {
    renderTable();

    const table = getTable();

    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getByRole("columnheader", { name: "Throttle" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Shift point" })).toHaveTextContent(
      "Shift point mph",
    );
    expect(within(table).getByRole("columnheader", { name: "Speedometer" })).toHaveTextContent(
      "Speedometer mph",
    );
  });

  it("labels each row with its throttle and marks the step", () => {
    renderTable();

    const labels = within(getTable()).getAllByRole("rowheader");

    expect(labels.map((label) => label.textContent)).toEqual(["WOT", "50%", "50% step", "Closed"]);
  });

  it("shows shift points and speedometer values with one decimal", () => {
    renderTable();

    expect(shiftPoint("100% throttle")).toHaveValue("64.5");
    expect(speedometer("100% throttle")).toHaveValue("70.3");
    expect(shiftPoint("50% throttle")).toHaveValue("52.0");
    expect(speedometer("50% throttle")).toHaveValue("56.7");
    expect(shiftPoint("50% throttle, step")).toHaveValue("44.5");
    expect(speedometer("50% throttle, step")).toHaveValue("48.5");
    expect(shiftPoint("0% throttle")).toHaveValue("38.0");
    expect(speedometer("0% throttle")).toHaveValue("41.4");
  });

  it("shows the raw byte of each shift point in hex", () => {
    renderTable();

    const table = getTable();
    expect(within(table).getByText("0x81")).toBeInTheDocument();
    expect(within(table).getByText("0x68")).toBeInTheDocument();
    expect(within(table).getByText("0x59")).toBeInTheDocument();
    expect(within(table).getByText("0x4C")).toBeInTheDocument();
  });

  it("writes a single digit byte with a leading zero", () => {
    renderTable({ rows: [makeRow({ throttleRaw: 0, throttlePercent: 0, shiftPointRaw: 11 })] });

    expect(screen.getByText("0x0B")).toBeInTheDocument();
  });

  it("puts the curve id on the card", () => {
    const { container } = render(
      <ShiftCurveTable
        curveId="down-4-3"
        title="4→3 (out of overdrive)"
        kind="downshift"
        rows={rows}
        onShiftPointChange={vi.fn()}
        onSpeedoChange={vi.fn()}
      />,
    );

    expect(container.querySelector("[data-curve-id=down-4-3]")).toBeInTheDocument();
  });
});

describe("ShiftCurveTable editing", () => {
  it("calls onShiftPointChange with the breakpoint index and mph when a shift point is typed", async () => {
    const user = userEvent.setup();
    const { onShiftPointChange, onSpeedoChange } = renderTable();

    await user.clear(shiftPoint("0% throttle"));
    await user.type(shiftPoint("0% throttle"), "40");

    expect(onShiftPointChange.mock.calls).toEqual([
      [3, 4],
      [3, 40],
    ]);
    expect(onSpeedoChange).not.toHaveBeenCalled();
  });

  it("calls onSpeedoChange with the breakpoint index and mph when a speedometer value is typed", async () => {
    const user = userEvent.setup();
    const { onShiftPointChange, onSpeedoChange } = renderTable();

    await user.clear(speedometer("50% throttle, step"));
    await user.type(speedometer("50% throttle, step"), "46.5");

    expect(onSpeedoChange).toHaveBeenLastCalledWith(2, 46.5);
    expect(onShiftPointChange).not.toHaveBeenCalled();
  });

  it("steps a shift point by 0.5 mph and a speedometer value by 0.1 mph with the arrow keys", async () => {
    const user = userEvent.setup();
    const { onShiftPointChange, onSpeedoChange } = renderTable();

    await user.click(shiftPoint("0% throttle"));
    await user.keyboard("{ArrowUp}");
    await user.click(speedometer("0% throttle"));
    await user.keyboard("{ArrowUp}");

    expect(onShiftPointChange).toHaveBeenCalledExactlyOnceWith(3, 38.5);
    expect(onSpeedoChange).toHaveBeenCalledExactlyOnceWith(3, 41.5);
  });

  it("steps the speedometer value by speedometerStep when it is given", async () => {
    const user = userEvent.setup();
    const { onShiftPointChange, onSpeedoChange } = renderTable({ speedometerStep: 0.5 });

    await user.click(speedometer("0% throttle"));
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");

    expect(onSpeedoChange.mock.calls).toEqual([
      [3, 41.9],
      [3, 42.4],
      [3, 41.9],
    ]);
    expect(onShiftPointChange).not.toHaveBeenCalled();
  });

  it("uses speedometerStep for every row and leaves the shift point step at 0.5 mph", async () => {
    const user = userEvent.setup();
    const { onShiftPointChange, onSpeedoChange } = renderTable({ speedometerStep: 0.545 });

    await user.click(speedometer("100% throttle"));
    await user.keyboard("{ArrowUp}");
    await user.click(shiftPoint("100% throttle"));
    await user.keyboard("{ArrowUp}");

    expect(onSpeedoChange).toHaveBeenCalledExactlyOnceWith(0, 70.845);
    expect(onShiftPointChange).toHaveBeenCalledExactlyOnceWith(0, 65);
  });

  it("accepts shift points from 0 to 127.5 mph only", async () => {
    const user = userEvent.setup();
    const { onShiftPointChange } = renderTable();

    await user.clear(shiftPoint("0% throttle"));
    await user.paste("127.5");
    expect(onShiftPointChange).toHaveBeenLastCalledWith(3, 127.5);
    expect(shiftPoint("0% throttle")).toBeValid();
    onShiftPointChange.mockClear();

    await user.clear(shiftPoint("0% throttle"));
    await user.paste("128");
    expect(onShiftPointChange).not.toHaveBeenCalled();
    expect(shiftPoint("0% throttle")).toBeInvalid();

    await user.clear(shiftPoint("0% throttle"));
    await user.paste("-0.5");
    expect(onShiftPointChange).not.toHaveBeenCalled();
    expect(shiftPoint("0% throttle")).toBeInvalid();
  });

  it("tells the user the allowed range under a shift point that is typed outside it", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.clear(shiftPoint("0% throttle"));
    await user.paste("128");

    expect(screen.getByText("Enter a number from 0 to 127.5.")).toBeVisible();
    expect(shiftPoint("0% throttle")).toHaveAccessibleDescription(
      "was 36.0 Enter a number from 0 to 127.5.",
    );
  });

  it("tells the user the lowest speedometer value under a speedometer value below it", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.clear(speedometer("50% throttle"));
    await user.paste("-1");

    expect(screen.getByText("Enter a number of at least 0.")).toBeVisible();
    expect(speedometer("50% throttle")).toHaveAccessibleDescription(
      "Enter a number of at least 0.",
    );
  });

  it("accepts speedometer values of 0 mph or more, with no upper limit", async () => {
    const user = userEvent.setup();
    const { onSpeedoChange } = renderTable();

    await user.clear(speedometer("0% throttle"));
    await user.paste("200");
    expect(onSpeedoChange).toHaveBeenLastCalledWith(3, 200);
    onSpeedoChange.mockClear();

    await user.clear(speedometer("0% throttle"));
    await user.paste("-1");

    expect(onSpeedoChange).not.toHaveBeenCalled();
    expect(speedometer("0% throttle")).toBeInvalid();
  });
});

function ResetHarness() {
  const [changed, setChanged] = useState(true);
  return (
    <ShiftCurveTable
      curveId="up-3-4"
      title={TITLE}
      kind="upshift"
      rows={rows.map((row) => ({ ...row, changed }))}
      onShiftPointChange={vi.fn()}
      onSpeedoChange={vi.fn()}
      onReset={() => setChanged(false)}
    />
  );
}

describe("ShiftCurveTable changes", () => {
  it("highlights a changed row and shows the original shift point", () => {
    renderTable();

    const [, ...bodyRows] = within(getTable()).getAllByRole("row");

    expect(bodyRows.map((row) => row.getAttribute("data-changed"))).toEqual([
      "false",
      "false",
      "false",
      "true",
    ]);
    expect(within(bodyRows[3]).getByText("was 36.0")).toBeInTheDocument();
    expect(within(getTable()).getAllByText(/^was /)).toHaveLength(1);
    expect(shiftPoint("0% throttle")).toHaveAccessibleDescription("was 36.0");
  });

  it("offers a reset button named for its curve when the curve has a change, and calls onReset when it is clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    renderTable({ onReset });
    const button = screen.getByRole("button", { name: `Reset ${TITLE}` });

    await user.click(button);

    // The visible text is part of the accessible name (WCAG 2.5.3, label in name).
    expect(button).toHaveTextContent(/^Reset$/);
    expect(button).toHaveAccessibleName(`Reset ${TITLE}`);
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("shows the reset button even when nothing in the curve has changed, marked aria-disabled", () => {
    renderTable({ onReset: vi.fn(), rows: rows.map((row) => ({ ...row, changed: false })) });

    const button = screen.getByRole("button", { name: `Reset ${TITLE}` });

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });

  it("does nothing when the aria-disabled reset button is clicked or activated from the keyboard", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    renderTable({ onReset, rows: rows.map((row) => ({ ...row, changed: false })) });
    const button = screen.getByRole("button", { name: `Reset ${TITLE}` });

    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(button).toHaveFocus();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("can be reached with the Tab key when nothing has changed", async () => {
    const user = userEvent.setup();
    renderTable({ onReset: vi.fn(), rows: rows.map((row) => ({ ...row, changed: false })) });

    await user.tab();

    expect(screen.getByRole("button", { name: `Reset ${TITLE}` })).toHaveFocus();
  });

  it("has no reset button when no reset handler is given", () => {
    renderTable();

    expect(screen.queryByRole("button", { name: /^Reset/ })).not.toBeInTheDocument();
  });

  it("keeps focus on the reset button after the reset clears every change", async () => {
    const user = userEvent.setup();
    render(<ResetHarness />);
    const button = screen.getByRole("button", { name: `Reset ${TITLE}` });
    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: `Reset ${TITLE}` })).toBe(button);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
  });
});

describe("ShiftCurveTable warning", () => {
  it("shows the warning when one is given", () => {
    renderTable({ warning: "The 4→3 downshift is above the 3→4 upshift at 50% throttle." });

    expect(
      screen.getByText("The 4→3 downshift is above the 3→4 upshift at 50% throttle."),
    ).toBeInTheDocument();
  });

  it("shows no warning when none is given", () => {
    renderTable();

    expect(screen.queryByText(/downshift is above/)).not.toBeInTheDocument();
  });
});

describe("ShiftCurveTable with two-way editing", () => {
  const FACTOR = 1.0906;
  const ORIGINAL_MPH = 36;
  const toHalfMph = (mph: number): number => Math.round(mph * 2) / 2;

  function Harness() {
    const [mph, setMph] = useState(ORIGINAL_MPH);
    const row = makeRow({
      shiftPointMph: mph,
      shiftPointRaw: mph * 2,
      speedoMph: mph * FACTOR,
      originalShiftPointMph: ORIGINAL_MPH,
      changed: mph !== ORIGINAL_MPH,
    });
    return (
      <ShiftCurveTable
        curveId="up-3-4"
        title={TITLE}
        kind="upshift"
        rows={[row]}
        onShiftPointChange={(_, next) => setMph(toHalfMph(next))}
        onSpeedoChange={(_, next) => setMph(toHalfMph(next / FACTOR))}
      />
    );
  }

  it("starts with the speedometer value converted from the shift point", () => {
    render(<Harness />);

    expect(shiftPoint("100% throttle")).toHaveValue("36.0");
    expect(speedometer("100% throttle")).toHaveValue("39.3");
  });

  it("updates the shift point at once when a speedometer value is typed, and keeps the typed text", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.clear(speedometer("100% throttle"));
    await user.type(speedometer("100% throttle"), "41.5");

    expect(speedometer("100% throttle")).toHaveValue("41.5");
    expect(shiftPoint("100% throttle")).toHaveValue("38.0");
    expect(screen.getByText("0x4C")).toBeInTheDocument();
    expect(screen.getByText("was 36.0")).toBeInTheDocument();

    await user.tab();

    expect(speedometer("100% throttle")).toHaveValue("41.4");
  });

  it("updates the speedometer value at once when a shift point is typed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.clear(shiftPoint("100% throttle"));
    await user.type(shiftPoint("100% throttle"), "40");

    expect(shiftPoint("100% throttle")).toHaveValue("40");
    expect(speedometer("100% throttle")).toHaveValue("43.6");
  });
});
