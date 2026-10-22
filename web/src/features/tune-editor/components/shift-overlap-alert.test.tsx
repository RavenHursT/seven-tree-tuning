import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShiftOverlapAlert, type ShiftOverlapView } from "./shift-overlap-alert";

const overlaps: ShiftOverlapView[] = [
  {
    id: "4to3-vs-3to4-50",
    title: "4→3 downshift and 3→4 upshift at 50% throttle",
    detail: "The downshift is at 63.0 mph and the upshift is at 59.0 mph.",
  },
  {
    id: "3to2-vs-2to3-0",
    title: "3→2 downshift and 2→3 upshift at 0% throttle",
    detail: "The downshift is at 19.0 mph and the upshift is at 18.0 mph.",
  },
];

describe("ShiftOverlapAlert", () => {
  it("renders one empty live region and no alert styling when there are no overlaps", () => {
    const { container } = render(<ShiftOverlapAlert overlaps={[]} />);

    const region = screen.getByRole("status");

    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(region);
    expect(region).toBeEmptyDOMElement();
    expect(region.className).not.toMatch(/warning|border|bg-/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes no space in the layout while it is empty", () => {
    const { rerender } = render(<ShiftOverlapAlert overlaps={[]} />);
    expect(screen.getByRole("status")).toHaveClass("sr-only");

    rerender(<ShiftOverlapAlert overlaps={overlaps} />);

    expect(screen.getByRole("status")).not.toHaveClass("sr-only");
  });

  it("shows one titled warning with a line for each overlap, inside the live region", () => {
    render(<ShiftOverlapAlert overlaps={overlaps} />);

    const region = screen.getByRole("status");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(within(region).getByText("Possible gear hunting")).toBeInTheDocument();
    const lines = within(region).getAllByRole("listitem");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent(
      "4→3 downshift and 3→4 upshift at 50% throttle The downshift is at 63.0 mph and the upshift is at 59.0 mph.",
    );
    expect(lines[1]).toHaveTextContent("3→2 downshift and 2→3 upshift at 0% throttle");
  });

  it("puts the warning styling on the content, not on the live region", () => {
    render(<ShiftOverlapAlert overlaps={overlaps} />);

    const region = screen.getByRole("status");
    const warning = within(region).getByText("Possible gear hunting").closest("[data-slot=alert]");

    expect(region.className).not.toMatch(/warning|border|bg-/);
    expect(warning).toHaveClass("border-warning/50", "bg-warning/10", "text-warning");
  });

  it("does not add a second live region inside the first", () => {
    render(<ShiftOverlapAlert overlaps={overlaps} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("keeps the same live region element when overlaps appear and go away", () => {
    const { rerender } = render(<ShiftOverlapAlert overlaps={[]} />);
    const region = screen.getByRole("status");

    rerender(<ShiftOverlapAlert overlaps={overlaps} />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Possible gear hunting");

    rerender(<ShiftOverlapAlert overlaps={[]} />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toBeEmptyDOMElement();
  });
});
