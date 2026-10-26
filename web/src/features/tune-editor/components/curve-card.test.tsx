import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UnitHeading } from "./curve-card";

function unitSpan(): HTMLElement {
  const span = document.querySelector<HTMLElement>("span[aria-hidden='true']");
  if (!span) throw new Error("no unit span");
  return span;
}

describe("UnitHeading", () => {
  it("shows the heading and a unit that screen readers skip", () => {
    render(<UnitHeading>Speedometer</UnitHeading>);

    expect(screen.getByText(/Speedometer/)).toBeInTheDocument();
    expect(unitSpan()).toHaveTextContent("mph");
  });

  it("leaves max-sm:hidden off the unit by default", () => {
    render(<UnitHeading>Speedometer</UnitHeading>);

    expect(unitSpan()).toHaveClass("font-normal", "text-muted-foreground");
    expect(unitSpan()).not.toHaveClass("max-sm:hidden");
  });

  it("adds max-sm:hidden as its own class when hideUnitWhenNarrow is set", () => {
    render(<UnitHeading hideUnitWhenNarrow>Speedometer</UnitHeading>);

    expect(unitSpan()).toHaveClass("max-sm:hidden");
    expect(unitSpan()).toHaveClass("text-muted-foreground");
    expect(unitSpan().className).not.toContain("text-muted-foregroundmax-sm:hidden");
  });
});
