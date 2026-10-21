import { createRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NumberField, type NumberFieldProps } from "./number-field";

const oneDecimal = (value: number): string => value.toFixed(1);
const toHalf = (value: number): number => Math.round(value * 2) / 2;

interface HarnessProps extends Partial<Omit<NumberFieldProps, "value" | "onValueChange">> {
  initial: number;
  quantize?: (value: number) => number;
  onCommit?: (value: number) => void;
}

function Harness({ initial, quantize = (value) => value, onCommit, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      aria-label="Shift point"
      {...props}
      value={value}
      onValueChange={(next) => {
        onCommit?.(next);
        setValue(quantize(next));
      }}
    />
  );
}

function getField(): HTMLInputElement {
  return screen.getByRole("textbox", { name: "Shift point" });
}

describe("NumberField display", () => {
  it("shows the formatted value when it is not focused", () => {
    render(<Harness initial={38} format={oneDecimal} />);

    expect(getField()).toHaveValue("38.0");
  });

  it("shows the value as a plain number when no format is given", () => {
    render(<Harness initial={38.5} />);

    expect(getField()).toHaveValue("38.5");
  });

  it("shows a new value from props right away when it is not focused", () => {
    const { rerender } = render(
      <NumberField
        aria-label="Shift point"
        value={10}
        onValueChange={vi.fn()}
        format={oneDecimal}
      />,
    );

    rerender(
      <NumberField
        aria-label="Shift point"
        value={40.5}
        onValueChange={vi.fn()}
        format={oneDecimal}
      />,
    );

    expect(getField()).toHaveValue("40.5");
  });

  it("asks for the decimal keyboard and is not a number input", () => {
    render(<Harness initial={38} />);

    expect(getField()).toHaveAttribute("inputmode", "decimal");
    expect(getField().type).toBe("text");
  });

  it("shows the suffix next to the input", () => {
    render(<Harness initial={38} suffix="mph" />);

    expect(screen.getByText("mph")).toBeInTheDocument();
  });

  it("puts the class name on the outer group so callers can size the field", () => {
    render(<Harness initial={38} className="w-24" />);

    expect(getField().closest("[data-slot=input-group]")).toHaveClass("w-24");
  });

  it("gives a ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Harness initial={38} ref={ref} />);

    expect(ref.current).toBe(getField());
  });

  it("passes the accessible name and disabled state to the input", () => {
    render(<Harness initial={38} aria-label="Warm idle" disabled />);

    expect(screen.getByRole("textbox", { name: "Warm idle" })).toBeDisabled();
  });
});

describe("NumberField editing", () => {
  it("commits each valid keystroke and keeps showing exactly what was typed", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={0} format={oneDecimal} onCommit={onCommit} />);

    await user.clear(getField());
    await user.type(getField(), "38");

    expect(onCommit.mock.calls).toEqual([[3], [38]]);
    expect(getField()).toHaveValue("38");
  });

  it("does not replace the draft when the value changes from props while focused", async () => {
    const user = userEvent.setup();
    const props = { "aria-label": "Shift point", onValueChange: vi.fn(), format: oneDecimal };
    const { rerender } = render(<NumberField {...props} value={10} />);
    await user.clear(getField());
    await user.type(getField(), "5");

    rerender(<NumberField {...props} value={99} />);

    expect(getField()).toHaveValue("5");
  });

  it("shows the formatted value from props again after blur", async () => {
    const user = userEvent.setup();
    render(<Harness initial={38} quantize={toHalf} format={oneDecimal} />);
    await user.clear(getField());
    await user.type(getField(), "41.3");
    expect(getField()).toHaveValue("41.3");

    await user.tab();

    expect(getField()).toHaveValue("41.5");
  });
});

describe("NumberField validation", () => {
  it.each(["abc", "12abc", "1.2.3", ".", "-", "0x10"])(
    "does not commit %j and marks the field invalid",
    async (text) => {
      const user = userEvent.setup();
      const onCommit = vi.fn();
      render(<Harness initial={10} onCommit={onCommit} />);
      await user.clear(getField());

      await user.paste(text);

      expect(onCommit).not.toHaveBeenCalled();
      expect(getField()).toBeInvalid();
    },
  );

  it("does not commit empty text and marks the field invalid", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={10} onCommit={onCommit} />);

    await user.clear(getField());

    expect(onCommit).not.toHaveBeenCalled();
    expect(getField()).toBeInvalid();
  });

  it.each([
    ["127.6", "above max"],
    ["-0.5", "below min"],
  ])("does not commit %s (%s) and marks the field invalid", async (text) => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={10} min={0} max={127.5} onCommit={onCommit} />);
    await user.clear(getField());

    await user.paste(text);

    expect(onCommit).not.toHaveBeenCalled();
    expect(getField()).toBeInvalid();
  });

  it.each([
    ["0", 0],
    ["127.5", 127.5],
    [" 41.5 ", 41.5],
    [".5", 0.5],
    ["7.", 7],
  ])("commits %j as %d", async (text, expected) => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={10} min={0} max={127.5} onCommit={onCommit} />);
    await user.clear(getField());

    await user.paste(text);

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(expected);
    expect(getField()).toBeValid();
  });

  it("accepts any number when min and max are not given", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={10} onCommit={onCommit} />);
    await user.clear(getField());

    await user.paste("-5000");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(-5000);
  });

  it("clears the invalid mark once the text is valid again", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={10} onCommit={onCommit} />);
    await user.clear(getField());
    await user.paste("abc");
    expect(getField()).toBeInvalid();

    await user.clear(getField());
    await user.type(getField(), "40");

    expect(getField()).toBeValid();
    expect(onCommit).toHaveBeenLastCalledWith(40);
  });

  it("drops an invalid draft on blur and shows the last value again", async () => {
    const user = userEvent.setup();
    render(<Harness initial={38} format={oneDecimal} />);
    await user.clear(getField());
    await user.paste("abc");

    await user.tab();

    expect(getField()).toHaveValue("38.0");
    expect(getField()).toBeValid();
  });

  it("marks the field invalid when the invalid prop is set", () => {
    render(<Harness initial={10} invalid />);

    expect(getField()).toBeInvalid();
  });

  it("does not mark a valid value invalid", () => {
    render(<Harness initial={10} />);

    expect(getField()).toBeValid();
  });
});

describe("NumberField keyboard", () => {
  it("shows the formatted value from props again when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={38} format={oneDecimal} />);
    await user.clear(getField());
    await user.paste("abc");

    await user.keyboard("{Escape}");

    expect(getField()).toHaveValue("38.0");
    expect(getField()).toBeValid();
  });

  it("shows the formatted value from props again when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness initial={38} quantize={toHalf} format={oneDecimal} />);
    await user.clear(getField());
    await user.type(getField(), "41.3");
    expect(getField()).toHaveValue("41.3");

    await user.keyboard("{Enter}");

    expect(getField()).toHaveValue("41.5");
  });

  it("changes the value by step with ArrowUp and ArrowDown", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={38} step={0.5} format={oneDecimal} onCommit={onCommit} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");

    expect(onCommit.mock.calls).toEqual([[38.5], [39], [38.5]]);
    expect(getField()).toHaveValue("38.5");
  });

  it("does not step above max or below min", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={127.5} step={0.5} min={0} max={127.5} onCommit={onCommit} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}");
    expect(onCommit).toHaveBeenLastCalledWith(127.5);

    await user.clear(getField());
    await user.type(getField(), "0");
    await user.keyboard("{ArrowDown}");
    expect(onCommit).toHaveBeenLastCalledWith(0);
  });

  it("steps without floating-point noise", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={0.2} step={0.1} onCommit={onCommit} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(0.3);
  });

  it("steps from the typed number, not from the value the caller rounded it to", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={38} quantize={toHalf} step={0.1} onCommit={onCommit} />);
    await user.clear(getField());
    await user.type(getField(), "41.6");
    onCommit.mockClear();

    await user.keyboard("{ArrowUp}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(41.7);
    expect(getField()).toHaveValue("41.7");
  });

  it("steps from the number the field shows, not from decimals it hides", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={41.4428} step={0.1} format={oneDecimal} onCommit={onCommit} />);
    expect(getField()).toHaveValue("41.4");
    await user.click(getField());

    await user.keyboard("{ArrowUp}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(41.5);
    expect(getField()).toHaveValue("41.5");
  });

  it("keeps the decimals of the number it steps from", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={38.25} step={0.5} onCommit={onCommit} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(38.75);
  });

  it("steps from the value when the formatted text is not a plain number", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const withUnit = (value: number): string => `${value} mph`;
    render(<Harness initial={38} step={0.5} format={withUnit} onCommit={onCommit} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(38.5);
  });

  it("steps an out-of-range number to the nearest allowed value", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={100} step={0.5} min={0} max={127.5} onCommit={onCommit} />);
    await user.clear(getField());
    await user.paste("130");

    await user.keyboard("{ArrowDown}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(127.5);
    expect(getField()).toBeValid();
  });

  it("steps from the current value when the typed text is not valid", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={38} step={0.5} onCommit={onCommit} />);
    await user.clear(getField());
    await user.paste("abc");

    await user.keyboard("{ArrowUp}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(38.5);
    expect(getField()).toBeValid();
  });

  it("does nothing on ArrowUp when no step is given", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness initial={38} onCommit={onCommit} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}");

    expect(onCommit).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(getField(), { key: "ArrowUp" })).toBe(true);
  });

  it("stops the caret from jumping when the arrow keys change the value", () => {
    render(<Harness initial={38} step={0.5} />);

    expect(fireEvent.keyDown(getField(), { key: "ArrowUp" })).toBe(false);
    expect(fireEvent.keyDown(getField(), { key: "ArrowDown" })).toBe(false);
  });

  it("calls the onBlur and onKeyDown handlers it is given", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    render(<Harness initial={38} step={0.5} onBlur={onBlur} onKeyDown={onKeyDown} />);
    await user.click(getField());

    await user.keyboard("{ArrowUp}");
    await user.tab();

    expect(onKeyDown.mock.calls.map(([event]) => event.key)).toEqual(["ArrowUp", "Tab"]);
    expect(onBlur).toHaveBeenCalledOnce();
  });
});
