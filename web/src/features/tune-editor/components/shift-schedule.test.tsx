import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ShiftCurveTableProps } from "./shift-curve-table";
import { ShiftSchedule } from "./shift-schedule";

function makeCurve(
  curveId: string,
  title: string,
  kind: ShiftCurveTableProps["kind"],
): ShiftCurveTableProps {
  return {
    curveId,
    title,
    kind,
    rows: [
      {
        breakpointIndex: 0,
        throttleRaw: 255,
        throttlePercent: 100,
        isStep: false,
        shiftPointMph: 27,
        shiftPointRaw: 54,
        speedoMph: 27,
        originalShiftPointMph: 27,
        changed: false,
      },
    ],
    onShiftPointChange: vi.fn(),
    onSpeedoChange: vi.fn(),
  };
}

const upshifts = [
  makeCurve("up-1-2", "1→2", "upshift"),
  makeCurve("up-2-3", "2→3", "upshift"),
  makeCurve("up-3-4", "3→4 (overdrive)", "upshift"),
];
const downshifts = [
  makeCurve("down-2-1", "2→1", "downshift"),
  makeCurve("down-3-2", "3→2", "downshift"),
  makeCurve("down-4-3", "4→3 (out of overdrive)", "downshift"),
];

function tableNames(section: HTMLElement): string[] {
  return within(section)
    .getAllByRole("table")
    .map((table) => table.getAttribute("aria-label") ?? "");
}

describe("ShiftSchedule", () => {
  it("shows the three upshift curves under an Upshifts heading", () => {
    render(<ShiftSchedule upshifts={upshifts} downshifts={downshifts} />);

    const section = screen.getByRole("region", { name: "Upshifts" });

    expect(within(section).getByRole("heading", { name: "Upshifts" })).toBeInTheDocument();
    expect(tableNames(section)).toEqual(["1→2", "2→3", "3→4 (overdrive)"]);
  });

  it("shows the three downshift curves under a Downshifts heading", () => {
    render(<ShiftSchedule upshifts={upshifts} downshifts={downshifts} />);

    const section = screen.getByRole("region", { name: "Downshifts" });

    expect(within(section).getByRole("heading", { name: "Downshifts" })).toBeInTheDocument();
    expect(tableNames(section)).toEqual(["2→1", "3→2", "4→3 (out of overdrive)"]);
  });

  it("shows six curve tables in all", () => {
    render(<ShiftSchedule upshifts={upshifts} downshifts={downshifts} />);

    expect(screen.getAllByRole("table")).toHaveLength(6);
  });

  it("passes each curve's props on to its table", () => {
    render(<ShiftSchedule upshifts={upshifts} downshifts={downshifts} />);

    const downshift = screen.getByRole("table", { name: "2→1" });

    expect(
      within(downshift).getByRole("textbox", { name: "2→1, 100% throttle, shift point (mph)" }),
    ).toHaveValue("27.0");
  });

  it("puts the overlaps above both sections", () => {
    render(
      <ShiftSchedule
        upshifts={upshifts}
        downshifts={downshifts}
        overlaps={<p>Overlap notice</p>}
      />,
    );

    const notice = screen.getByText("Overlap notice");
    const upshiftHeading = screen.getByRole("heading", { name: "Upshifts" });
    const downshiftHeading = screen.getByRole("heading", { name: "Downshifts" });

    expect(notice.compareDocumentPosition(upshiftHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(notice.compareDocumentPosition(downshiftHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("lays each section's curves out in one column on small screens and three on wide screens", () => {
    render(<ShiftSchedule upshifts={upshifts} downshifts={downshifts} />);

    for (const name of ["Upshifts", "Downshifts"]) {
      const section = screen.getByRole("region", { name });
      const firstCard = within(section).getAllByRole("table")[0].closest("[data-curve-id]");
      const grid = firstCard?.parentElement;

      expect(grid).toHaveClass("grid", "grid-cols-1");
      expect(grid?.className).toMatch(/\b(md|lg|xl|2xl):grid-cols-3\b/);
    }
  });
});
