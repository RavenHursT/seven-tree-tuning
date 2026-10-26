import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GridEditor, type GridEditorProps } from "./grid-editor";

/** A 2 x 3 grid of unsigned words: rows are boost, columns are engine speed in rpm. */
function props(overrides: Partial<GridEditorProps> = {}): GridEditorProps {
  return {
    gridId: "fuel-demand",
    label: "Fuel demand",
    rowAxis: {
      name: "Boost",
      headers: [
        { text: "0", reached: true },
        { text: "12.5", reached: true },
      ],
    },
    colAxis: {
      name: "Engine speed",
      unit: "rpm",
      headers: [
        { text: "500", reached: true },
        { text: "1000", reached: true },
        { text: "index 2", reached: false },
      ],
    },
    cells: [10, 20, 30, 40, 50, 60],
    originalCells: [10, 20, 30, 40, 50, 60],
    minRaw: 0,
    maxRaw: 255,
    value: { perRaw: 1, unitName: "PCM units", decimals: 0 },
    onCellChange: vi.fn(),
    onScale: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

function cell(row: number, col: number): HTMLElement {
  const rows = ["Boost 0", "Boost 12.5"];
  const cols = ["Engine speed 500", "Engine speed 1000", "Engine speed index 2"];
  return screen.getByRole("textbox", { name: `Fuel demand, ${rows[row]}, ${cols[col]}` });
}

describe("GridEditor layout", () => {
  it("is a group named for the grid, with a table that has a caption naming both axes", () => {
    render(<GridEditor {...props()} />);
    const group = screen.getByRole("group", { name: "Fuel demand" });

    expect(within(group).getByRole("table")).toBeInTheDocument();
    expect(within(group).getByText("Rows: Boost (PCM units)")).toBeInTheDocument();
    expect(within(group).getByText("Columns: Engine speed (rpm)")).toBeInTheDocument();
  });

  it("gives every row and column a header, and every cell a number field", () => {
    render(<GridEditor {...props()} />);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Rows, columns",
      "500",
      "1000",
      "index 2 (not reached by this tune)",
    ]);
    expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual([
      "0",
      "12.5",
    ]);
    expect(screen.getAllByRole("textbox")).toHaveLength(6 + 1);
  });

  it("names the corner cell with a header that only screen readers see", () => {
    render(<GridEditor {...props()} />);

    const corner = screen.getByRole("columnheader", { name: "Rows, columns" });

    expect(corner.tagName).toBe("TH");
    expect(within(corner).getByText("Rows, columns")).toHaveClass("sr-only");
  });

  it("shows each cell as its display value, with the decimals of the format", () => {
    render(
      <GridEditor
        {...props({
          cells: [4096, 6144, 0, 1, 2, 3],
          originalCells: [4096, 6144, 0, 1, 2, 3],
          value: { perRaw: 1 / 4096, unit: "×", unitName: "multiplier (×)", decimals: 4 },
        })}
      />,
    );

    expect(cell(0, 0)).toHaveValue("1.0000");
    expect(cell(0, 1)).toHaveValue("1.5000");
    expect(cell(1, 0)).toHaveValue("0.0002");
  });

  it("dims a row or column the tune does not reach, says so, and keeps it editable", () => {
    render(<GridEditor {...props()} />);

    expect(screen.getByRole("columnheader", { name: /index 2/ })).toHaveAttribute(
      "data-unreached",
      "true",
    );
    expect(cell(0, 2).closest("td")).toHaveAttribute("data-unreached", "true");
    expect(cell(0, 1).closest("td")).not.toHaveAttribute("data-unreached");
    expect(cell(0, 2)).toBeEnabled();
    expect(screen.getByText(/dimmed rows and columns are not reached by this tune/i)).toBeVisible();
  });

  it("leaves out the note about dimmed rows when every row and column is reached", () => {
    const reached = props();
    render(
      <GridEditor
        {...reached}
        colAxis={{
          ...reached.colAxis,
          headers: reached.colAxis.headers.map((h) => ({ ...h, reached: true })),
        }}
      />,
    );

    expect(screen.queryByText(/dimmed rows/i)).not.toBeInTheDocument();
  });

  it("says what the cell values are", () => {
    render(<GridEditor {...props()} />);

    expect(screen.getByText("Cell values: PCM units.")).toBeVisible();
  });
});

describe("GridEditor editing a cell", () => {
  it("stores the typed display value as the rounded raw value", async () => {
    const onCellChange = vi.fn();
    render(
      <GridEditor
        {...props({
          onCellChange,
          maxRaw: 32767,
          minRaw: -32768,
          value: { perRaw: 1 / 64, unit: "°", unitName: "crank degrees (°)", decimals: 2 },
        })}
      />,
    );
    const field = cell(1, 2);

    await userEvent.clear(field);
    await userEvent.type(field, "2.5");

    expect(onCellChange).toHaveBeenLastCalledWith(1, 2, 160);
  });

  it("rounds a typed value that falls between two stored steps", async () => {
    const onCellChange = vi.fn();
    render(
      <GridEditor
        {...props({
          onCellChange,
          maxRaw: 32767,
          value: { perRaw: 1 / 64, unit: "°", unitName: "crank degrees (°)", decimals: 2 },
        })}
      />,
    );
    const field = cell(0, 0);

    await userEvent.clear(field);
    await userEvent.type(field, "0.03");

    expect(onCellChange).toHaveBeenLastCalledWith(0, 0, 2);
  });

  it("clamps a typed value to the range of the cell, and shows the stored value on leaving", async () => {
    const onCellChange = vi.fn();
    const { rerender } = render(<GridEditor {...props({ onCellChange })} />);
    const field = cell(0, 0);

    await userEvent.clear(field);
    await userEvent.type(field, "300");

    expect(onCellChange).toHaveBeenLastCalledWith(0, 0, 255);
    expect(field).toHaveAttribute("aria-invalid", "true");

    rerender(<GridEditor {...props({ onCellChange, cells: [255, 20, 30, 40, 50, 60] })} />);
    await userEvent.tab();

    expect(cell(0, 0)).toHaveValue("255");
    expect(cell(0, 0)).not.toHaveAttribute("aria-invalid");
  });

  it("ignores text that is not a number, and shows the stored value on leaving", async () => {
    const onCellChange = vi.fn();
    render(<GridEditor {...props({ onCellChange })} />);
    const field = cell(0, 1);

    await userEvent.clear(field);
    await userEvent.type(field, "abc");

    expect(onCellChange).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("aria-invalid", "true");
    await userEvent.tab();
    expect(cell(0, 1)).toHaveValue("20");
  });

  it("puts the old value back on Escape", async () => {
    const onCellChange = vi.fn();
    render(<GridEditor {...props({ onCellChange })} />);
    const field = cell(0, 0);

    await userEvent.clear(field);
    await userEvent.type(field, "99");
    await userEvent.keyboard("{Escape}");

    expect(onCellChange).toHaveBeenLastCalledWith(0, 0, 10);
    expect(field).toHaveValue("10");
  });

  it("selects the text of a cell when it gets focus, so typing replaces the value", async () => {
    const onCellChange = vi.fn();
    render(<GridEditor {...props({ onCellChange })} />);

    await userEvent.click(cell(0, 0));
    await userEvent.keyboard("77");

    expect(onCellChange).toHaveBeenLastCalledWith(0, 0, 77);
  });
});

describe("GridEditor changed cells", () => {
  const changed = props({ cells: [10, 21, 30, 40, 50, 60] });

  it("marks a changed cell and says what it was", () => {
    render(<GridEditor {...changed} />);

    expect(cell(0, 1).closest("td")).toHaveAttribute("data-changed", "true");
    expect(cell(0, 1)).toHaveAccessibleDescription("was 20");
    expect(cell(0, 1).closest("td")).toHaveAttribute("title", "was 20");
    expect(cell(0, 0).closest("td")).not.toHaveAttribute("data-changed");
    expect(cell(0, 0)).not.toHaveAccessibleDescription();
  });

  it("says the number of changed cells in a status line that is always there", () => {
    const { rerender } = render(<GridEditor {...props()} />);
    expect(screen.getByRole("status")).toHaveTextContent("No changes");

    rerender(<GridEditor {...changed} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 cell changed");

    rerender(<GridEditor {...props({ cells: [11, 21, 30, 40, 50, 60] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("2 cells changed");
  });

  it("shows the count as visible text that follows every keystroke", async () => {
    const { rerender } = render(<GridEditor {...props()} />);
    await userEvent.click(cell(0, 0));
    await userEvent.keyboard("7");

    rerender(<GridEditor {...props({ cells: [7, 20, 30, 40, 50, 60] })} />);

    expect(screen.getByText("1 cell changed")).toBeVisible();
    expect(screen.getByText("1 cell changed")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the announcement as it was while a cell is being typed in, and updates it on Tab", async () => {
    const { rerender } = render(<GridEditor {...props()} />);
    const status = screen.getByRole("status");
    await userEvent.click(cell(0, 0));
    await userEvent.keyboard("7");
    rerender(<GridEditor {...props({ cells: [7, 20, 30, 40, 50, 60] })} />);
    await userEvent.keyboard("7");
    rerender(<GridEditor {...props({ cells: [77, 20, 30, 40, 50, 60] })} />);

    expect(status).toHaveTextContent("No changes");

    await userEvent.tab();

    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Fuel demand: 1 cell changed");
  });

  it("updates the announcement on Enter", async () => {
    const { rerender } = render(<GridEditor {...props()} />);
    await userEvent.click(cell(0, 1));
    await userEvent.keyboard("5");
    rerender(<GridEditor {...props({ cells: [10, 5, 30, 40, 50, 60] })} />);
    expect(screen.getByRole("status")).toHaveTextContent("No changes");

    await userEvent.keyboard("{Enter}");

    expect(screen.getByRole("status")).toHaveTextContent("1 cell changed");
  });

  it("goes back to the announced count on Escape, which puts the old value back", async () => {
    const onCellChange = vi.fn();
    const { rerender } = render(<GridEditor {...props({ onCellChange })} />);
    await userEvent.click(cell(0, 1));
    await userEvent.keyboard("5");
    rerender(<GridEditor {...props({ onCellChange, cells: [10, 5, 30, 40, 50, 60] })} />);

    await userEvent.keyboard("{Escape}");
    rerender(<GridEditor {...props({ onCellChange })} />);

    expect(screen.getByRole("status")).toHaveTextContent("No changes");
  });

  it("announces a change made with the Scale or Reset buttons at once", () => {
    const { rerender } = render(<GridEditor {...props()} />);

    rerender(<GridEditor {...props({ cells: [11, 22, 33, 44, 55, 66] })} />);

    expect(screen.getByRole("status")).toHaveTextContent("6 cells changed");
  });
});

describe("GridEditor keyboard", () => {
  it("moves between cells with the arrow keys", async () => {
    render(<GridEditor {...props()} />);
    await userEvent.click(cell(0, 0));

    await userEvent.keyboard("{ArrowRight}");
    expect(cell(0, 1)).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(cell(1, 1)).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(cell(1, 0)).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(cell(0, 0)).toHaveFocus();
  });

  it("moves left and right only when the caret is at the start or end of the text", async () => {
    render(<GridEditor {...props()} />);
    const field = cell(0, 1) as HTMLInputElement;
    await userEvent.click(field);

    field.setSelectionRange(1, 1);
    await userEvent.keyboard("{ArrowRight}");
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(2);

    await userEvent.keyboard("{ArrowRight}");
    expect(cell(0, 2)).toHaveFocus();

    await userEvent.click(cell(0, 1));
    (cell(0, 1) as HTMLInputElement).setSelectionRange(1, 1);
    await userEvent.keyboard("{ArrowLeft}");
    expect(cell(0, 1)).toHaveFocus();
    expect((cell(0, 1) as HTMLInputElement).selectionStart).toBe(0);

    await userEvent.keyboard("{ArrowLeft}");
    expect(cell(0, 0)).toHaveFocus();
  });

  it("moves left and right when the whole text is selected", async () => {
    render(<GridEditor {...props()} />);
    const field = cell(0, 1) as HTMLInputElement;
    await userEvent.click(field);
    field.setSelectionRange(0, 2);

    await userEvent.keyboard("{ArrowRight}");

    expect(cell(0, 2)).toHaveFocus();
  });

  it("does not move left or right with Alt, Ctrl, Meta or Shift held", async () => {
    render(<GridEditor {...props()} />);
    const field = cell(0, 1) as HTMLInputElement;
    await userEvent.click(field);

    for (const modifier of ["Alt", "Control", "Meta", "Shift"]) {
      field.setSelectionRange(0, 2);
      await userEvent.keyboard(`{${modifier}>}{ArrowRight}{/${modifier}}`);
      expect(field, modifier).toHaveFocus();
      field.setSelectionRange(0, 2);
      await userEvent.keyboard(`{${modifier}>}{ArrowLeft}{/${modifier}}`);
      expect(field, modifier).toHaveFocus();
    }
  });

  it("still moves up and down from any caret position", async () => {
    render(<GridEditor {...props()} />);
    const field = cell(0, 1) as HTMLInputElement;
    await userEvent.click(field);
    field.setSelectionRange(1, 1);

    await userEvent.keyboard("{ArrowDown}");

    expect(cell(1, 1)).toHaveFocus();
  });

  it("stays on the edge cell at the edge of the grid", async () => {
    render(<GridEditor {...props()} />);
    await userEvent.click(cell(0, 0));

    await userEvent.keyboard("{ArrowUp}{ArrowLeft}");

    expect(cell(0, 0)).toHaveFocus();
  });

  it("reaches every cell with Tab, row by row", async () => {
    render(<GridEditor {...props()} />);
    await userEvent.click(cell(0, 2));

    await userEvent.tab();

    expect(cell(1, 0)).toHaveFocus();
  });
});

describe("GridEditor toolbar", () => {
  it("scales the grid by the percent typed, then goes back to 100", async () => {
    const onScale = vi.fn();
    render(<GridEditor {...props({ onScale })} />);
    const percent = screen.getByRole("textbox", { name: "Scale grid by %" });

    expect(percent).toHaveValue("100");
    await userEvent.clear(percent);
    await userEvent.type(percent, "110");
    await userEvent.click(screen.getByRole("button", { name: "Apply scale" }));

    expect(onScale).toHaveBeenCalledWith(1.1);
    expect(percent).toHaveValue("100");
  });

  it("scales on Enter", async () => {
    const onScale = vi.fn();
    render(<GridEditor {...props({ onScale })} />);
    const percent = screen.getByRole("textbox", { name: "Scale grid by %" });

    await userEvent.clear(percent);
    await userEvent.type(percent, "95{Enter}");

    expect(onScale).toHaveBeenCalledWith(0.95);
  });

  it("does not scale for a percent that is not a number above zero", async () => {
    const onScale = vi.fn();
    render(<GridEditor {...props({ onScale })} />);
    const percent = screen.getByRole("textbox", { name: "Scale grid by %" });
    const apply = screen.getByRole("button", { name: "Apply scale" });

    for (const text of ["0", "abc", "-5", ""]) {
      await userEvent.clear(percent);
      if (text) await userEvent.type(percent, text);
      expect(apply).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(apply);
    }

    expect(onScale).not.toHaveBeenCalled();
  });

  it("resets the grid only when a cell changed, and keeps the button in the page either way", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<GridEditor {...props({ onReset })} />);
    const reset = screen.getByRole("button", { name: "Reset grid" });

    expect(reset).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(reset);
    expect(onReset).not.toHaveBeenCalled();

    rerender(<GridEditor {...props({ onReset, cells: [11, 20, 30, 40, 50, 60] })} />);
    expect(screen.getByRole("button", { name: "Reset grid" })).not.toHaveAttribute("aria-disabled");
    await userEvent.click(screen.getByRole("button", { name: "Reset grid" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
