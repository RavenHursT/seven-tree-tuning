import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IdleRpmField, type IdleRpmFieldProps } from "./idle-rpm-field";

interface HarnessProps extends Partial<Omit<IdleRpmFieldProps, "rpm" | "onRpmChange">> {
  initial?: number;
  onCommit?: (rpm: number) => void;
}

function Harness({ initial = 680, onCommit, originalRpm = 680, ...props }: HarnessProps) {
  const [rpm, setRpm] = useState(initial);
  return (
    <IdleRpmField
      {...props}
      rpm={rpm}
      originalRpm={originalRpm}
      onRpmChange={(next) => {
        onCommit?.(next);
        setRpm(next);
      }}
    />
  );
}

function getField(): HTMLInputElement {
  return screen.getByRole("textbox", { name: "Warm idle (rpm)" });
}

describe("IdleRpmField warm idle", () => {
  it("shows the warm idle in a field, with its unit", () => {
    render(<Harness initial={680} />);

    expect(getField()).toHaveValue("680");
    expect(screen.getByText("rpm")).toBeInTheDocument();
  });

  it("draws no card and no heading of its own: the Idle module around it provides both", () => {
    const { container } = render(<Harness initial={680} />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText("Idle")).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
    expect(container.querySelector('[data-slot="card-title"]')).toBeNull();
  });

  it.each([
    [680, "680"],
    [1098.5, "1098.5"],
    [680.25, "680.25"],
    [700.1, "700.1"],
    [1098.126, "1098.13"],
  ])("shows %d as %s", (rpm, shown) => {
    render(<Harness initial={rpm} />);

    expect(getField()).toHaveValue(shown);
  });

  it("calls onRpmChange with each valid number typed", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    await user.clear(getField());
    await user.type(getField(), "750");

    expect(onCommit.mock.calls).toEqual([[7], [75], [750]]);
    expect(getField()).toHaveValue("750");
  });

  it("changes the idle by 10 rpm with the arrow keys", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}{ArrowDown}{ArrowDown}");

    expect(onCommit.mock.calls).toEqual([[690], [680], [670]]);
  });

  it.each(["2500", "300"])("does not accept %s outside the given min and max", async (text) => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness min={400} max={2000} onCommit={onCommit} />);
    await user.clear(getField());

    await user.paste(text);

    expect(onCommit).not.toHaveBeenCalled();
    expect(getField()).toBeInvalid();
  });

  it("tells the user the allowed idle range and keeps the was text in the description", async () => {
    const user = userEvent.setup();
    render(<Harness initial={750} originalRpm={680} min={500} max={1500} />);
    expect(getField()).toHaveAccessibleDescription("was 680");
    await user.clear(getField());

    await user.paste("2500");

    expect(screen.getByText("Enter a number from 500 to 1,500.")).toBeVisible();
    expect(getField()).toHaveAccessibleDescription("was 680 Enter a number from 500 to 1,500.");
  });

  it("puts back the idle the field had when it got focus when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={680} />);
    await user.clear(getField());
    await user.type(getField(), "750");
    expect(screen.getByText("was 680")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(getField()).toHaveValue("680");
    expect(screen.queryByText(/^was /)).not.toBeInTheDocument();
    expect(getField()).toHaveFocus();
  });

  it("does not accept a negative idle when no min is given", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await user.clear(getField());

    await user.paste("-5");

    expect(onCommit).not.toHaveBeenCalled();
    expect(getField()).toBeInvalid();
  });

  it("shows the original idle only after the idle has changed", () => {
    const { rerender } = render(<IdleRpmField rpm={680} originalRpm={680} onRpmChange={vi.fn()} />);
    expect(screen.queryByText(/^was /)).not.toBeInTheDocument();

    rerender(<IdleRpmField rpm={750} originalRpm={680.25} onRpmChange={vi.fn()} />);

    expect(screen.getByText("was 680.25")).toBeInTheDocument();
    expect(getField()).toHaveAccessibleDescription("was 680.25");
  });

  it("shows the warning and ties it to the field", () => {
    const { rerender } = render(<IdleRpmField rpm={680} originalRpm={680} onRpmChange={vi.fn()} />);
    expect(getField()).not.toHaveAccessibleDescription();

    rerender(
      <IdleRpmField
        rpm={1400}
        originalRpm={680}
        onRpmChange={vi.fn()}
        warning="A high idle uses more fuel."
      />,
    );

    expect(screen.getByText("A high idle uses more fuel.")).toBeInTheDocument();
    expect(getField()).toHaveAccessibleDescription("was 680 A high idle uses more fuel.");
  });
});

describe("IdleRpmField idle curve", () => {
  const idleCurve = [
    { inputRaw: 0, rpm: 1100 },
    { inputRaw: 40, rpm: 1100 },
    { inputRaw: 80, rpm: 900 },
    { inputRaw: 120, rpm: 680.25 },
  ];

  it("lists the curve points, read-only, once the Idle curve section is opened", async () => {
    const user = userEvent.setup();
    render(<Harness idleCurve={idleCurve} />);
    expect(screen.queryByRole("table", { name: "Idle curve points" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Idle curve" }));

    const table = screen.getByRole("table", { name: "Idle curve points" });
    const points = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );
    expect(points).toEqual([
      ["0", "1100"],
      ["40", "1100"],
      ["80", "900"],
      ["120", "680.25"],
    ]);
    expect(within(table).queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.getByText(/only the warm idle \(the first two points\) is edited/i),
    ).toBeVisible();
  });

  it.each([undefined, []])("has no Idle curve section when the curve is %j", (curve) => {
    render(<Harness idleCurve={curve} />);

    expect(screen.queryByRole("button", { name: "Idle curve" })).not.toBeInTheDocument();
  });
});
