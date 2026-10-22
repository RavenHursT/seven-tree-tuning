import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  TireSizeFields,
  type TireSizeFieldsProps,
  type TireSizeOption,
  type TireSizeParts,
  type TireSizeValue,
} from "./tire-size-fields";

const FACTORY: TireSizeValue = { kind: "metric", widthMm: 235, aspectRatio: 85, rimDiameterIn: 16 };
const MEDIUM: TireSizeValue = { kind: "metric", widthMm: 265, aspectRatio: 75, rimDiameterIn: 16 };
const LARGE: TireSizeValue = { kind: "metric", widthMm: 315, aspectRatio: 75, rimDiameterIn: 16 };
const FLOATING: TireSizeValue = {
  kind: "flotation",
  diameterIn: 35,
  widthIn: 12.5,
  rimDiameterIn: 17,
};
const BIG_FLOATING: TireSizeValue = {
  kind: "flotation",
  diameterIn: 37,
  widthIn: 12.5,
  rimDiameterIn: 17,
};
const UNLISTED: TireSizeValue = {
  kind: "metric",
  widthMm: 245,
  aspectRatio: 75,
  rimDiameterIn: 16,
};

const OPTIONS: readonly TireSizeOption[] = [
  {
    id: "LT235/85R16",
    label: "LT235/85R16",
    group: "Factory",
    note: "1996 F-350 factory size",
    value: FACTORY,
  },
  { id: "265/75R16", label: "265/75R16", group: "16 in rims", value: MEDIUM },
  { id: "315/75R16", label: "315/75R16", group: "16 in rims", value: LARGE },
  { id: "35x12.50R17", label: "35x12.50R17", group: "17 in rims", value: FLOATING },
  { id: "37x12.50R17", label: "37x12.50R17", group: "17 in rims", value: BIG_FLOATING },
];

// The component takes toParts, fromParts and format as props, so these stand-ins keep the tests
// free of the size rules: fromParts knows the sizes above and nothing else.
const KNOWN_SIZES: readonly TireSizeValue[] = [FACTORY, MEDIUM, LARGE, FLOATING];

function toParts(value: TireSizeValue): TireSizeParts {
  return value.kind === "metric"
    ? {
        width: String(value.widthMm),
        height: String(value.aspectRatio),
        rim: String(value.rimDiameterIn),
      }
    : {
        width: value.widthIn.toFixed(2),
        height: String(value.diameterIn),
        rim: String(value.rimDiameterIn),
      };
}

/** The three parts as numbers, so "12.5" matches "12.50"; an empty part matches nothing. */
function numbersOf(parts: TireSizeParts): string {
  return [parts.width, parts.height, parts.rim]
    .map((part) => (part.trim() === "" ? "empty" : String(Number(part))))
    .join("|");
}

function fromParts(parts: TireSizeParts): TireSizeValue | undefined {
  return KNOWN_SIZES.find((size) => numbersOf(toParts(size)) === numbersOf(parts));
}

function format(value: TireSizeValue): string {
  return value.kind === "metric"
    ? `${value.widthMm}/${value.aspectRatio}R${value.rimDiameterIn}`
    : `${value.diameterIn}x${value.widthIn.toFixed(2)}R${value.rimDiameterIn}`;
}

interface HarnessProps {
  initial?: TireSizeValue;
  diameterIn?: number;
  description?: React.ReactNode;
  disabled?: boolean;
  onChange?(next: TireSizeValue): void;
}

/** Keeps the value in state, as the editor does, so a reported size comes back as the value. */
function Harness({
  initial = FACTORY,
  diameterIn = 31.73,
  description,
  disabled,
  onChange,
}: HarnessProps) {
  const [value, setValue] = React.useState(initial);
  return (
    <TireSizeFields
      id="tires"
      legend="Tires on the truck"
      description={description}
      value={value}
      diameterIn={diameterIn}
      options={OPTIONS}
      toParts={toParts}
      fromParts={fromParts}
      format={format}
      disabled={disabled}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

function frozenProps(
  value: TireSizeValue,
  onChange: TireSizeFieldsProps["onChange"],
): TireSizeFieldsProps {
  return {
    id: "tires",
    legend: "Tires on the truck",
    value,
    diameterIn: 31.73,
    options: OPTIONS,
    toParts,
    fromParts,
    format,
    onChange,
  };
}

/** Shows a fixed size, so what is typed does not come back as the value. */
function renderFrozen(onChange = vi.fn(), value: TireSizeValue = FACTORY) {
  render(<TireSizeFields {...frozenProps(value, onChange)} />);
  return onChange;
}

type User = ReturnType<typeof userEvent.setup>;

/** The button that opens the list. Its name is the legend and the size it shows. */
const LIST_BUTTON = { name: /^Tires on the truck / };

function listButton() {
  return screen.getByRole("combobox", LIST_BUTTON);
}

async function openList(user: User) {
  await user.click(listButton());
  return screen.findByRole("listbox", { name: "Tire sizes" });
}

function searchField() {
  return screen.getByRole("combobox", { name: "Search tire sizes" });
}

function optionTexts(): string[] {
  return screen.queryAllByRole("option").map((option) => option.textContent ?? "");
}

/** The examples below the Width, Height and Rim fields. */
const EXAMPLES = "For 315/75R16, enter 315, 75 and 16. For 35x12.50R17, enter 12.50, 35 and 17.";
const INVALID_MESSAGE = "These three numbers are not a tire size.";

function manualFields() {
  return {
    width: screen.getByRole("textbox", { name: "Width" }),
    height: screen.getByRole("textbox", { name: "Height" }),
    rim: screen.getByRole("textbox", { name: "Rim" }),
  };
}

type ManualFields = ReturnType<typeof manualFields>;

/** Opens the Manual tab and returns its Width, Height and Rim fields. */
async function openManual(user: User): Promise<ManualFields> {
  await user.click(screen.getByRole("tab", { name: "Manual tire size" }));
  return manualFields();
}

/** Replaces the numbers in the given fields, one field after the other, as a person types them. */
async function enterParts(user: User, fields: ManualFields, parts: Partial<TireSizeParts>) {
  for (const name of ["width", "height", "rim"] as const) {
    const text = parts[name];
    if (text === undefined) continue;
    await user.clear(fields[name]);
    if (text !== "") await user.type(fields[name], text);
  }
}

describe("TireSizeFields", () => {
  describe("layout and labels", () => {
    it("groups the fields under the legend", () => {
      render(<Harness />);

      expect(screen.getByRole("group", { name: "Tires on the truck" })).toBeInTheDocument();
    });

    it("describes the group with the description when one is given", () => {
      render(<Harness description="Used to scale every shift speed." />);

      expect(screen.getByRole("group", { name: "Tires on the truck" })).toHaveAccessibleDescription(
        "Used to scale every shift speed.",
      );
    });

    it("has two tabs, Choose tire size and Manual tire size, in one tab list", () => {
      render(<Harness />);

      const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");

      expect(tabs.map((tab) => tab.textContent)).toEqual(["Choose tire size", "Manual tire size"]);
    });

    it("opens the Choose tab when the size is one of the listed sizes", () => {
      render(<Harness initial={LARGE} />);

      expect(screen.getByRole("tab", { name: "Choose tire size" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("tab", { name: "Manual tire size" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(listButton()).toBeVisible();
      expect(screen.queryByRole("textbox", { name: "Width" })).not.toBeInTheDocument();
    });

    it("opens the Manual tab when the size is not one of the listed sizes", () => {
      render(<Harness initial={UNLISTED} />);

      expect(screen.getByRole("tab", { name: "Manual tire size" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      const { width, height, rim } = manualFields();
      expect([width, height, rim].map((field) => (field as HTMLInputElement).value)).toEqual([
        "245",
        "75",
        "16",
      ]);
      expect(screen.queryByRole("combobox", LIST_BUTTON)).not.toBeInTheDocument();
    });

    it("shows only the tab that is open", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole("tab", { name: "Manual tire size" }));

      expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
      expect(screen.getByRole("tabpanel")).toContainElement(
        screen.getByRole("group", { name: "Tire/Rim size" }),
      );
    });

    it("shows the computed diameter with two decimals and the unit on both tabs", async () => {
      const user = userEvent.setup();
      render(<Harness diameterIn={34.6024} />);

      expect(screen.getByRole("status", { name: "Diameter" })).toHaveTextContent("34.60 in");

      await openManual(user);

      expect(screen.getByRole("status", { name: "Diameter" })).toHaveTextContent("34.60 in");
    });

    it("does not announce the diameter each time it changes", () => {
      render(<Harness />);

      expect(screen.getByRole("status", { name: "Diameter" })).toHaveAttribute("aria-live", "off");
    });

    it("shows a dash when the diameter is not known, on both tabs", async () => {
      const user = userEvent.setup();
      render(
        <TireSizeFields
          id="tires"
          legend="Tires on the truck"
          value={FACTORY}
          options={OPTIONS}
          toParts={toParts}
          fromParts={fromParts}
          format={format}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByRole("status", { name: "Diameter" })).toHaveTextContent("—");

      await openManual(user);

      expect(screen.getByRole("status", { name: "Diameter" })).toHaveTextContent("—");
    });

    it("disables the tabs and the list button when it is disabled", () => {
      render(<Harness disabled />);

      expect(screen.getByRole("tab", { name: "Choose tire size" })).toBeDisabled();
      expect(screen.getByRole("tab", { name: "Manual tire size" })).toBeDisabled();
      expect(listButton()).toBeDisabled();
    });

    it("disables the Width, Height and Rim fields when it is disabled and the Manual tab is open", () => {
      render(<Harness initial={UNLISTED} disabled />);

      for (const field of Object.values(manualFields())) {
        expect(field).toBeDisabled();
      }
      expect(screen.getByRole("tab", { name: "Choose tire size" })).toBeDisabled();
    });

    it("does not open the list or switch tabs when it is disabled", async () => {
      const user = userEvent.setup();
      render(<Harness disabled />);

      await user.click(listButton());
      await user.click(screen.getByRole("tab", { name: "Manual tire size" }));

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Choose tire size" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  describe("Choose tire size", () => {
    it("shows only the label of the listed size that matches the current size", () => {
      render(<Harness />);

      expect(listButton()).toHaveTextContent("LT235/85R16");
      expect(listButton()).not.toHaveTextContent("factory size");
    });

    it("has an accessible name made of the legend and the size shown", () => {
      render(<Harness initial={LARGE} />);

      expect(
        screen.getByRole("combobox", { name: "Tires on the truck 315/75R16" }),
      ).toBeInTheDocument();
    });

    it("shows the size as text when it is not listed", async () => {
      const user = userEvent.setup();
      render(<Harness initial={UNLISTED} />);

      await user.click(screen.getByRole("tab", { name: "Choose tire size" }));

      expect(listButton()).toHaveTextContent("245/75R16");
    });

    it("opens a list box with the sizes in groups, in the order given", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const list = await openList(user);

      const groups = within(list).getAllByRole("group");
      expect(groups).toHaveLength(3);
      expect(within(list).getByRole("group", { name: "Factory" })).toBe(groups[0]);
      expect(within(list).getByRole("group", { name: "16 in rims" })).toBe(groups[1]);
      expect(within(list).getByRole("group", { name: "17 in rims" })).toBe(groups[2]);
      expect(groups.map((group) => within(group).getAllByRole("option").length)).toEqual([1, 2, 2]);
    });

    it("shows each size as its label, and the note only for a size that has one", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openList(user);

      expect(optionTexts()).toEqual([
        "LT235/85R16 1996 F-350 factory size",
        "265/75R16",
        "315/75R16",
        "35x12.50R17",
        "37x12.50R17",
      ]);
    });

    it("has the current size highlighted when the list opens", async () => {
      const user = userEvent.setup();
      render(<Harness initial={LARGE} />);

      await openList(user);

      expect(screen.getByRole("option", { name: "315/75R16" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("option", { name: "265/75R16" })).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("puts the focus in the search field", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await openList(user);

      expect(searchField()).toHaveFocus();
    });

    it("narrows the list to the sizes that contain what is typed", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openList(user);

      await user.type(searchField(), "315");

      expect(optionTexts()).toEqual(["315/75R16"]);
    });

    it("finds a flotation size from its first characters, such as 35x", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openList(user);

      await user.type(searchField(), "35x");

      expect(optionTexts()).toEqual(["35x12.50R17"]);
    });

    it("ignores letter case, spaces and a leading LT in what is typed", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openList(user);

      await user.type(searchField(), " LT 315/75 r16 ");
      expect(optionTexts()).toEqual(["315/75R16"]);

      await user.clear(searchField());
      await user.type(searchField(), "35X12.50R17");
      expect(optionTexts()).toEqual(["35x12.50R17"]);
    });

    it("finds a flotation size when its width is typed without the trailing zero", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openList(user);

      await user.type(searchField(), "35x12.5r17");

      expect(optionTexts()).toEqual(["35x12.50R17"]);
    });

    it("finds a size from its note", async () => {
      const user = userEvent.setup();
      render(<Harness initial={LARGE} />);
      await openList(user);

      await user.type(searchField(), "factory");

      expect(optionTexts()).toEqual(["LT235/85R16 1996 F-350 factory size"]);
    });

    it("keeps the order of the list while it narrows, and hides a group with no match", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const list = await openList(user);

      await user.type(searchField(), "x12.50");

      expect(optionTexts()).toEqual(["35x12.50R17", "37x12.50R17"]);
      expect(within(list).getByText("Factory")).not.toBeVisible();
      expect(within(list).getByText("16 in rims")).not.toBeVisible();
      expect(within(list).getByText("17 in rims")).toBeVisible();
    });

    it("says so when no size matches", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openList(user);

      await user.type(searchField(), "999");

      expect(optionTexts()).toEqual([]);
      expect(screen.getByText("No tire size found.")).toBeVisible();
    });

    it("reports the size of the option that is chosen, and closes the list", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await openList(user);

      await user.click(screen.getByRole("option", { name: "315/75R16" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith(LARGE);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("shows the chosen size on the button and puts the focus back on it", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openList(user);

      await user.click(screen.getByRole("option", { name: "35x12.50R17" }));

      expect(listButton()).toHaveTextContent("35x12.50R17");
      expect(listButton()).toHaveFocus();
    });

    it("chooses the highlighted size with the arrow keys and Enter", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await openList(user);

      await user.type(searchField(), "x12");
      await user.keyboard("{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledExactlyOnceWith(BIG_FLOATING);
    });

    it("chooses the only size that matches with Enter", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await openList(user);

      await user.type(searchField(), "315{Enter}");

      expect(onChange).toHaveBeenCalledExactlyOnceWith(LARGE);
    });

    it("closes the list with Escape, reports nothing and puts the focus back on the button", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await openList(user);

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
      expect(listButton()).toHaveFocus();
    });

    it("starts with an empty search each time the list opens", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openList(user);
      await user.type(searchField(), "315");
      await user.keyboard("{Escape}");

      await openList(user);

      expect(searchField()).toHaveValue("");
      expect(optionTexts()).toHaveLength(OPTIONS.length);
    });

    it("shows on the Choose tab a size that was entered on the Manual tab", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const fields = await openManual(user);
      await enterParts(user, fields, { width: "12.50", height: "35", rim: "17" });

      await user.click(screen.getByRole("tab", { name: "Choose tire size" }));

      expect(listButton()).toHaveTextContent("35x12.50R17");
    });
  });

  describe("Manual tire size", () => {
    it("has a Tire/Rim size group with Width, Height and Rim fields, described by examples", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const { width, height, rim } = await openManual(user);

      const group = screen.getByRole("group", { name: "Tire/Rim size" });

      expect(within(group).getAllByRole("textbox")).toEqual([width, height, rim]);
      expect(screen.getAllByRole("textbox")).toHaveLength(3);
      expect([width, height, rim].map((field) => field.getAttribute("placeholder"))).toEqual([
        "315",
        "75",
        "16",
      ]);
      for (const field of [width, height, rim]) {
        expect(field).toHaveAttribute("inputmode", "decimal");
        expect(field).toHaveAccessibleDescription(EXAMPLES);
      }
      expect(screen.getByText(EXAMPLES)).toBeVisible();
    });

    it("shows the current size in the three fields when they have no focus", async () => {
      const user = userEvent.setup();
      render(<Harness initial={LARGE} />);

      const { width, height, rim } = await openManual(user);

      expect(width).toHaveValue("315");
      expect(height).toHaveValue("75");
      expect(rim).toHaveValue("16");
    });

    it("shows a flotation size as its width, its overall height and its rim", async () => {
      const user = userEvent.setup();
      render(<Harness initial={FLOATING} />);

      const { width, height, rim } = await openManual(user);

      expect(width).toHaveValue("12.50");
      expect(height).toHaveValue("35");
      expect(rim).toHaveValue("17");
    });

    it("reports a size on the keystroke that makes the three numbers a size, and not before", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();
      const fields = await openManual(user);

      await enterParts(user, fields, { width: "315", height: "75" });

      expect(onChange).toHaveBeenCalledExactlyOnceWith(LARGE);
    });

    it("reports a flotation size, whose height is its overall diameter", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();
      const fields = await openManual(user);

      await enterParts(user, fields, { width: "12.50", height: "35", rim: "17" });

      expect(onChange).toHaveBeenCalledExactlyOnceWith(FLOATING);
    });

    it("keeps the numbers as typed while the focus moves between the three fields", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const fields = await openManual(user);

      await enterParts(user, fields, { width: "12.5", height: "35", rim: "17" });

      expect(fields.width).toHaveValue("12.5");
      expect(fields.height).toHaveValue("35");
      expect(fields.rim).toHaveValue("17");
    });

    it("shows the size in its standard form once the focus leaves the three fields", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const fields = await openManual(user);
      await enterParts(user, fields, { width: "12.5", height: "35", rim: "17" });

      await user.click(document.body);

      expect(fields.width).toHaveValue("12.50");
    });

    it("says what is wrong and marks the fields invalid while the three numbers are not a size", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();
      const fields = await openManual(user);

      await enterParts(user, fields, { width: "315", height: "7" });

      expect(onChange).not.toHaveBeenCalled();
      for (const field of Object.values(fields)) {
        expect(field).toBeInvalid();
      }
      expect(fields.width).toHaveAccessibleDescription(`${INVALID_MESSAGE} ${EXAMPLES}`);
      expect(screen.getByText(INVALID_MESSAGE)).toBeVisible();
    });

    it("removes the message and the marks when the numbers become a size", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const fields = await openManual(user);
      await enterParts(user, fields, { width: "315", height: "7" });
      expect(fields.height).toBeInvalid();

      await user.type(fields.height, "5");

      for (const field of Object.values(fields)) {
        expect(field).toBeValid();
      }
      expect(fields.width).toHaveAccessibleDescription(EXAMPLES);
      expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    });

    it("keeps the last size it reported while the numbers are not a size", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      const fields = await openManual(user);

      await enterParts(user, fields, { width: "315", height: "75" });
      await user.type(fields.rim, "0");

      expect(onChange).toHaveBeenCalledExactlyOnceWith(LARGE);
      expect(fields.rim).toBeInvalid();
    });

    it("goes back to the current size when the focus leaves with numbers that are not a size", async () => {
      const user = userEvent.setup();
      renderFrozen();
      const fields = await openManual(user);
      await enterParts(user, fields, { width: "50" });

      await user.click(document.body);

      expect(fields.width).toHaveValue("235");
      expect(fields.width).toBeValid();
      expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    });

    it("does not mark the fields invalid while one is empty, and does not report", async () => {
      const user = userEvent.setup();
      const onChange = renderFrozen();
      const fields = await openManual(user);

      await user.clear(fields.height);

      expect(onChange).not.toHaveBeenCalled();
      expect(fields.height).toBeValid();
      expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    });

    it("shows a size set from outside when the fields have no focus", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(<TireSizeFields {...frozenProps(FACTORY, onChange)} />);
      expect((await openManual(user)).width).toHaveValue("235");

      rerender(<TireSizeFields {...frozenProps(FLOATING, onChange)} />);

      const { width, height, rim } = manualFields();
      expect(width).toHaveValue("12.50");
      expect(height).toHaveValue("35");
      expect(rim).toHaveValue("17");
    });
  });
});
