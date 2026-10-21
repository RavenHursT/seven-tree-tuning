import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { TireSizeFields, type TireSizePresetOption, type TireSizeValue } from "./tire-size-fields";

const FACTORY: TireSizeValue = { widthMm: 235, aspectRatio: 85, rimDiameterIn: 16 };
const LARGE: TireSizeValue = { widthMm: 315, aspectRatio: 70, rimDiameterIn: 17 };

const PRESETS: readonly TireSizePresetOption[] = [
  { id: "factory", label: "LT235/85R16", value: FACTORY, note: "1996 F-350 factory size" },
  { id: "large", label: "LT315/70R17", value: LARGE, note: "About 34 in" },
];

interface HarnessProps {
  initial?: TireSizeValue;
  diameterIn?: number;
  description?: React.ReactNode;
  onChange?(next: TireSizeValue): void;
}

function Harness({ initial = FACTORY, diameterIn = 31.73, description, onChange }: HarnessProps) {
  const [value, setValue] = React.useState(initial);
  return (
    <TireSizeFields
      id="tires"
      legend="Tire size"
      description={description}
      value={value}
      diameterIn={diameterIn}
      presets={PRESETS}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

function renderFrozen(onChange = vi.fn(), value: TireSizeValue = FACTORY) {
  render(
    <TireSizeFields
      id="tires"
      legend="Tire size"
      value={value}
      diameterIn={31.73}
      presets={PRESETS}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("TireSizeFields", () => {
  describe("layout and labels", () => {
    it("groups the fields under the legend", () => {
      render(<Harness />);

      expect(screen.getByRole("group", { name: "Tire size" })).toBeInTheDocument();
    });

    it("describes the group with the description when one is given", () => {
      render(<Harness description="Used to scale every shift speed." />);

      expect(screen.getByRole("group", { name: "Tire size" })).toHaveAccessibleDescription(
        "Used to scale every shift speed.",
      );
    });

    it("shows the width, aspect ratio and rim size in labelled inputs", () => {
      render(<Harness />);

      expect(screen.getByLabelText("Width (mm)")).toHaveValue("235");
      expect(screen.getByLabelText("Aspect (%)")).toHaveValue("85");
      expect(screen.getByLabelText("Rim (in)")).toHaveValue("16");
    });

    it("shows the computed diameter with two decimals and the unit", () => {
      render(<Harness diameterIn={31.7345} />);

      expect(screen.getByRole("status", { name: "Diameter" })).toHaveTextContent("31.73 in");
    });

    it("shows a dash when the diameter is not known", () => {
      render(
        <TireSizeFields
          id="tires"
          legend="Tire size"
          value={FACTORY}
          presets={PRESETS}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByRole("status", { name: "Diameter" })).toHaveTextContent("—");
    });
  });

  describe("typing a size", () => {
    it("reports each valid change with the other two values kept", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();

      await user.clear(screen.getByLabelText("Width (mm)"));
      await user.type(screen.getByLabelText("Width (mm)"), "265");

      expect(onChange).toHaveBeenLastCalledWith({ ...FACTORY, widthMm: 265 });
      expect(onChange).toHaveBeenCalledTimes(3);
    });

    it("reports aspect ratio and rim changes, including a half inch rim", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();

      await user.clear(screen.getByLabelText("Aspect (%)"));
      await user.type(screen.getByLabelText("Aspect (%)"), "75");
      expect(onChange).toHaveBeenLastCalledWith({ ...FACTORY, aspectRatio: 75 });

      await user.clear(screen.getByLabelText("Rim (in)"));
      await user.type(screen.getByLabelText("Rim (in)"), "16.5");
      expect(onChange).toHaveBeenLastCalledWith({ ...FACTORY, rimDiameterIn: 16.5 });
    });

    it("does not report an empty field", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();

      await user.clear(screen.getByLabelText("Width (mm)"));

      expect(onChange).not.toHaveBeenCalled();
    });

    it.each(["0", "-5", "abc"])("does not report %s and marks the field invalid", async (text) => {
      const user = userEvent.setup();
      const onChange = renderFrozen();
      const width = screen.getByLabelText("Width (mm)");

      await user.clear(width);
      await user.type(width, text);

      expect(onChange).not.toHaveBeenCalled();
      expect(width).toBeInvalid();
      expect(width).toHaveAccessibleDescription("Enter a number greater than 0.");
    });

    it("keeps the last valid size when a later character makes the text unusable", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();
      const width = screen.getByLabelText("Width (mm)");

      await user.clear(width);
      await user.type(width, "1.2.3");

      expect(onChange).toHaveBeenLastCalledWith({ ...FACTORY, widthMm: 1.2 });
      expect(width).toBeInvalid();
    });

    it("keeps the typed text while the field has focus", async () => {
      const user = userEvent.setup();
      renderFrozen();
      const width = screen.getByLabelText("Width (mm)");

      await user.clear(width);
      await user.type(width, "300");

      expect(width).toHaveValue("300");
    });

    it("goes back to the current size when the field loses focus with unusable text", async () => {
      const user = userEvent.setup();
      renderFrozen();
      const width = screen.getByLabelText("Width (mm)");

      await user.clear(width);
      await user.type(width, "0");
      await user.tab();

      expect(width).toHaveValue("235");
      expect(width).toBeValid();
    });

    it("shows the new size after it is accepted", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const width = screen.getByLabelText("Width (mm)");

      await user.clear(width);
      await user.type(width, "265");
      await user.tab();

      expect(width).toHaveValue("265");
    });

    it("shows a size set from outside when the field is not focused", () => {
      const { rerender } = render(
        <TireSizeFields
          id="tires"
          legend="Tire size"
          value={FACTORY}
          presets={PRESETS}
          onChange={vi.fn()}
        />,
      );

      rerender(
        <TireSizeFields
          id="tires"
          legend="Tire size"
          value={LARGE}
          presets={PRESETS}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByLabelText("Width (mm)")).toHaveValue("315");
      expect(screen.getByLabelText("Aspect (%)")).toHaveValue("70");
      expect(screen.getByLabelText("Rim (in)")).toHaveValue("17");
    });
  });

  describe("presets", () => {
    it("shows only the label of the preset that matches the current size", () => {
      render(<Harness />);
      const trigger = screen.getByRole("combobox", { name: "Preset" });

      expect(trigger).toHaveTextContent("LT235/85R16");
      expect(trigger).not.toHaveTextContent("factory size");
    });

    it("shows a custom size label when no preset matches", () => {
      render(<Harness initial={{ widthMm: 285, aspectRatio: 75, rimDiameterIn: 16 }} />);

      expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent("Custom size");
    });

    it("lists every preset with its note", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole("combobox", { name: "Preset" }));

      expect(await screen.findByRole("option", { name: /LT235\/85R16/ })).toHaveTextContent(
        "1996 F-350 factory size",
      );
      expect(screen.getByRole("option", { name: /LT315\/70R17/ })).toHaveTextContent("About 34 in");
    });

    it("reports the preset size when one is chosen", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      await user.click(screen.getByRole("combobox", { name: "Preset" }));
      await user.click(await screen.findByRole("option", { name: /LT315\/70R17/ }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(LARGE);
    });

    it("fills the inputs with the chosen preset", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole("combobox", { name: "Preset" }));
      await user.click(await screen.findByRole("option", { name: /LT315\/70R17/ }));

      expect(screen.getByLabelText("Width (mm)")).toHaveValue("315");
      expect(screen.getByLabelText("Aspect (%)")).toHaveValue("70");
      expect(screen.getByLabelText("Rim (in)")).toHaveValue("17");
      expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent("LT315/70R17");
    });

    it("switches to the custom label after a typed size no longer matches a preset", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const width = screen.getByLabelText("Width (mm)");

      await user.clear(width);
      await user.type(width, "245");

      expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent("Custom size");
    });
  });
});
