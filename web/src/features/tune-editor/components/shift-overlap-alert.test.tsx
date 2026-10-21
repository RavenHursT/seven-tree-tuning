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
  it("renders nothing when there are no overlaps", () => {
    const { container } = render(<ShiftOverlapAlert overlaps={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows one titled warning with a line for each overlap", () => {
    render(<ShiftOverlapAlert overlaps={overlaps} />);

    const alert = screen.getByRole("status");
    expect(within(alert).getByText("Possible gear hunting")).toBeInTheDocument();
    const lines = within(alert).getAllByRole("listitem");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent(
      "4→3 downshift and 3→4 upshift at 50% throttle The downshift is at 63.0 mph and the upshift is at 59.0 mph.",
    );
    expect(lines[1]).toHaveTextContent("3→2 downshift and 2→3 upshift at 0% throttle");
  });
});
