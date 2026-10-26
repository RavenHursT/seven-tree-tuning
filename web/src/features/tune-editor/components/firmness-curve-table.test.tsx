import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  FirmnessCurveTable,
  type FirmnessCurveRow,
  type FirmnessCurveTableProps,
} from "./firmness-curve-table";

const TITLE = "3→4 line pressure";

function makeRow(overrides: Partial<FirmnessCurveRow> = {}): FirmnessCurveRow {
  return {
    pointIndex: 0,
    pedalRaw: 255,
    pedalPercent: 100,
    isStep: false,
    value: 38,
    originalValue: 38,
    changed: false,
    ...overrides,
  };
}

const rows: FirmnessCurveRow[] = [
  makeRow({
    pointIndex: 5,
    pedalRaw: 0,
    pedalPercent: 0,
    value: 28,
    originalValue: 24,
    changed: true,
  }),
  makeRow({ pointIndex: 2, pedalRaw: 75, pedalPercent: 29.4, value: -3, originalValue: -3 }),
  makeRow({ pointIndex: 0 }),
];

function renderTable(props: Partial<FirmnessCurveTableProps> = {}) {
  const handlers = { onValueChange: vi.fn() };
  render(
    <FirmnessCurveTable
      functionId="epc-3-4"
      title={TITLE}
      description="Upshift"
      min={-128}
      max={127}
      rows={rows}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function field(pedal: string) {
  return screen.getByRole("textbox", { name: `${TITLE}, ${pedal}, adder (PCM units)` });
}

describe("FirmnessCurveTable", () => {
  it("lists the pedal positions closed first, with signed whole numbers", () => {
    renderTable();

    const table = screen.getByRole("table", { name: TITLE });
    const labels = within(table)
      .getAllByRole("rowheader")
      .map((header) => header.textContent);

    expect(labels).toEqual(["Closed", "29%", "WOT"]);
    expect(field("0% pedal")).toHaveValue("28");
    expect(field("29% pedal")).toHaveValue("-3");
    expect(field("100% pedal")).toHaveValue("38");
  });

  it("reports a typed value with the row's point index", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderTable();

    const input = field("100% pedal");
    await user.clear(input);
    await user.type(input, "-12");

    expect(onValueChange).toHaveBeenLastCalledWith(0, -12);
  });

  it("does not accept a value outside the range of the byte", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderTable();

    const input = field("100% pedal");
    await user.clear(input);
    await user.type(input, "300");

    expect(onValueChange).not.toHaveBeenCalledWith(0, 300);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a number from -128 to 127.")).toBeInTheDocument();
  });

  it("steps by one with the arrow keys", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderTable();

    await user.click(field("100% pedal"));
    await user.keyboard("{ArrowUp}");

    expect(onValueChange).toHaveBeenLastCalledWith(0, 39);
  });

  it("shows the original value of a changed row", () => {
    renderTable();

    expect(screen.getByText("was 24")).toBeInTheDocument();
    expect(field("0% pedal")).toHaveAccessibleDescription("was 24");
  });

  it("resets the curve when something changed, and is unusable otherwise", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const { rerender } = render(
      <FirmnessCurveTable
        functionId="epc-3-4"
        title={TITLE}
        description="Upshift"
        min={-128}
        max={127}
        rows={rows}
        onValueChange={vi.fn()}
        onReset={onReset}
      />,
    );

    await user.click(screen.getByRole("button", { name: `Reset ${TITLE}` }));
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <FirmnessCurveTable
        functionId="epc-3-4"
        title={TITLE}
        description="Upshift"
        min={-128}
        max={127}
        rows={[makeRow()]}
        onValueChange={vi.fn()}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: `Reset ${TITLE}` }));

    expect(screen.getByRole("button", { name: `Reset ${TITLE}` })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
