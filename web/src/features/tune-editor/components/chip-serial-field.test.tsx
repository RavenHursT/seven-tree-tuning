import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { ChipSerialField, type ChipSerialFieldProps } from "./chip-serial-field";

const DEFAULT_DESCRIPTION =
  "The first 8 characters of the chip's USB serial. HydraFlash shows it in its status bar. It is the key for .hcf files and never leaves this browser.";

function Harness(props: Partial<ChipSerialFieldProps> & { initial?: string }) {
  const { initial = "", onChange, ...rest } = props;
  const [value, setValue] = React.useState(initial);
  return (
    <ChipSerialField
      id="serial"
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
      {...rest}
    />
  );
}

describe("ChipSerialField", () => {
  it("has a visible label that names the input", () => {
    render(<Harness />);

    expect(screen.getByRole("textbox", { name: "Chip serial" })).toBeInTheDocument();
  });

  it("allows at most 8 characters and turns off browser helpers", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Chip serial");

    expect(input).toHaveAttribute("maxlength", "8");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
  });

  it("shows the 8 hex digits hint as the placeholder", () => {
    render(<Harness />);

    expect(screen.getByPlaceholderText("8 hex digits")).toBe(screen.getByLabelText("Chip serial"));
  });

  it("shows the value in uppercase", () => {
    render(<Harness initial="ab12cd34" />);

    expect(screen.getByLabelText("Chip serial")).toHaveValue("AB12CD34");
  });

  it("reports typed text in uppercase", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByLabelText("Chip serial"), "ab12");

    expect(onChange).toHaveBeenLastCalledWith("AB12");
    expect(screen.getByLabelText("Chip serial")).toHaveValue("AB12");
  });

  it("stops accepting characters after the eighth", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByLabelText("Chip serial"), "a1b2c3d4e5f6");

    expect(onChange).toHaveBeenLastCalledWith("A1B2C3D4");
    expect(screen.getByLabelText("Chip serial")).toHaveValue("A1B2C3D4");
  });

  it("explains what the serial is and that it stays in the browser", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Chip serial")).toHaveAccessibleDescription(DEFAULT_DESCRIPTION);
  });

  it("shows a custom description in place of the default one", () => {
    render(<Harness description="Find it in the HydraFlash title bar." />);

    expect(screen.getByLabelText("Chip serial")).toHaveAccessibleDescription(
      "Find it in the HydraFlash title bar.",
    );
    expect(screen.queryByText(/never leaves this browser/)).not.toBeInTheDocument();
  });

  it("is valid and has no alert when there is no error", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Chip serial")).toBeValid();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error as an alert, marks the input invalid and describes it with the error", () => {
    render(<Harness initial="ZZ" error="The serial must be 8 hex digits." />);
    const input = screen.getByLabelText("Chip serial");

    expect(screen.getByRole("alert")).toHaveTextContent("The serial must be 8 hex digits.");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      `${DEFAULT_DESCRIPTION} The serial must be 8 hex digits.`,
    );
  });

  it("marks the input required when asked and keeps the label text exactly Chip serial", () => {
    render(<Harness required />);

    expect(screen.getByLabelText("Chip serial")).toBeRequired();
  });

  it("is not required unless asked", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Chip serial")).not.toBeRequired();
  });

  it("can be disabled", () => {
    render(<Harness disabled />);

    expect(screen.getByLabelText("Chip serial")).toBeDisabled();
  });
});
