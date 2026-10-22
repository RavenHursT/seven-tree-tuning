import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TuneEditorPage from "./page";

// The library list is a Server Component that asks PHP for its index. These tests only need to
// know where the page puts it, so a plain stand-in replaces it.
vi.mock("@/features/tune-editor/sections/library-tunes", () => ({
  LibraryTunes: () => "Library list",
  LibraryTunesFallback: () => "Loading the library",
}));

/** The card of the module whose level 2 heading has this title. */
function moduleCard(title: string): HTMLElement {
  const card = screen
    .getByRole("heading", { level: 2, name: title })
    .closest<HTMLElement>('[data-slot="card"]');
  if (!card) throw new Error(`No module card for ${title}`);
  return card;
}

/** The live region for loading messages and alerts: a child of the column, outside every module. */
function alertsRegion(column: HTMLElement): Element | null {
  return column.querySelector(':scope > [aria-live="polite"]');
}

describe("TuneEditorPage layout", () => {
  it("stacks Base Tune, the alerts and Idle in the left column, in that order", () => {
    render(<TuneEditorPage />);
    const column = moduleCard("Base Tune").parentElement as HTMLElement;

    expect(Array.from(column.children)).toEqual([
      moduleCard("Base Tune"),
      alertsRegion(column),
      moduleCard("Idle"),
    ]);
  });

  it("puts Tires alone in the right column, next to the left column", () => {
    render(<TuneEditorPage />);
    const left = moduleCard("Base Tune").parentElement as HTMLElement;
    const grid = left.parentElement as HTMLElement;

    expect(Array.from(grid.children)).toEqual([left, moduleCard("Tires")]);
  });

  it("puts Shiftpoints below both columns, directly in the main area", () => {
    render(<TuneEditorPage />);
    const grid = moduleCard("Base Tune").parentElement?.parentElement as HTMLElement;
    const main = screen.getByRole("main");

    expect(Array.from(main.children)).toEqual([grid, moduleCard("Shiftpoints")]);
  });

  it("keeps the Generate Tune bar after the main area, outside every module", () => {
    render(<TuneEditorPage />);
    const bar = screen.getByRole("region", { name: "Generate tune" });

    expect(screen.getByRole("main").compareDocumentPosition(bar)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(bar.closest('[data-slot="card"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Generate Tune" })).toBeInTheDocument();
  });

  it("shows the four modules open, with Base Tune on the upload tab", () => {
    render(<TuneEditorPage />);

    for (const title of ["Base Tune", "Idle", "Tires", "Shiftpoints"]) {
      expect(screen.getByRole("button", { name: title })).toHaveAttribute("aria-expanded", "true");
    }
    expect(screen.getByRole("tab", { name: "Upload a file" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
