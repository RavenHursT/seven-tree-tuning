import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  LibraryTunePicker,
  type LibraryTuneOption,
  type LibraryTunePickerProps,
} from "./library-tune-picker";

const TOW_STANDARD: LibraryTuneOption = {
  fileName: "TDE1_TOW_STANDARD.hcf",
  code: "TDE1-T1",
  label: "Tow standard",
  description: "Firm shifts for pulling a trailer.",
  category: "tow",
  categoryLabel: "Towing",
  valveBody: false,
};

const DAILY_STANDARD: LibraryTuneOption = {
  fileName: "TDE1_DAILY_STANDARD.hcf",
  code: "TDE1-D1",
  label: "Daily standard",
  category: "daily",
  categoryLabel: "Daily driver",
  valveBody: false,
};

const TOW_VALVE_BODY: LibraryTuneOption = {
  fileName: "TDE1_TOW_VB.hcf",
  code: "TDE1-T1-VB",
  label: "Tow standard VB",
  category: "tow",
  categoryLabel: "Towing",
  valveBody: true,
};

const TUNES = [TOW_STANDARD, DAILY_STANDARD, TOW_VALVE_BODY];
const SOURCE_URL = "https://example.com/library";
const SOURCE_LINK_NAME = "Power Hungry Performance public library";

function renderPicker(props: Partial<LibraryTunePickerProps> = {}) {
  const onSelect = vi.fn();
  render(<LibraryTunePicker tunes={TUNES} onSelect={onSelect} sourceUrl={SOURCE_URL} {...props} />);
  return { onSelect };
}

function getOption(label: string): HTMLElement {
  const option = screen.getByText(label).closest<HTMLElement>('[role="option"]');
  if (!option) throw new Error(`No option contains the text "${label}"`);
  return option;
}

describe("LibraryTunePicker", () => {
  describe("grouping", () => {
    it("shows one group per category label in the order the labels first appear", () => {
      renderPicker();

      const groups = screen.getAllByRole("group");

      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveAccessibleName("Towing");
      expect(groups[1]).toHaveAccessibleName("Daily driver");
    });

    it("puts tunes of the same category together even when they are not next to each other", () => {
      renderPicker();

      const towing = within(screen.getByRole("group", { name: "Towing" }));
      const daily = within(screen.getByRole("group", { name: "Daily driver" }));

      expect(towing.getByText("Tow standard")).toBeInTheDocument();
      expect(towing.getByText("Tow standard VB")).toBeInTheDocument();
      expect(towing.getAllByRole("option")).toHaveLength(2);
      expect(daily.getByText("Daily standard")).toBeInTheDocument();
      expect(daily.getAllByRole("option")).toHaveLength(1);
    });

    it("lists all the tunes in one named list", () => {
      renderPicker();

      const list = screen.getByRole("listbox", { name: "Public library tunes" });

      expect(within(list).getAllByRole("option")).toHaveLength(3);
    });
  });

  describe("what each tune shows", () => {
    it("shows the label, the code and the description", () => {
      renderPicker();
      const option = within(getOption("Tow standard"));

      expect(option.getByText("Tow standard")).toBeInTheDocument();
      expect(option.getByText("TDE1-T1")).toBeInTheDocument();
      expect(option.getByText("Firm shifts for pulling a trailer.")).toBeInTheDocument();
    });

    it("shows the code in a monospace font", () => {
      renderPicker();

      expect(screen.getByText("TDE1-D1")).toHaveClass("font-mono");
    });

    it("shows a valve body badge on valve body tunes only", () => {
      renderPicker();

      expect(within(getOption("Tow standard VB")).getByText("valve body")).toBeInTheDocument();
      expect(within(getOption("Daily standard")).queryByText("valve body")).not.toBeInTheDocument();
      expect(screen.getAllByText("valve body")).toHaveLength(1);
    });
  });

  describe("selecting", () => {
    it("reports the file name of a clicked tune", async () => {
      const user = userEvent.setup();
      const { onSelect } = renderPicker();

      await user.click(getOption("Daily standard"));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith("TDE1_DAILY_STANDARD.hcf");
    });

    it("marks only the selected tune as selected", () => {
      renderPicker({ selectedFileName: DAILY_STANDARD.fileName });

      expect(getOption("Daily standard")).toHaveAttribute("aria-selected", "true");
      expect(getOption("Tow standard VB")).toHaveAttribute("aria-selected", "false");
      expect(screen.getAllByRole("option", { selected: true })).toHaveLength(1);
    });

    it("marks no tune as selected when none is chosen", () => {
      renderPicker();

      expect(screen.queryAllByRole("option", { selected: true })).toHaveLength(0);
    });
  });

  describe("loading", () => {
    it("shows a spinner on the loading tune only and marks it busy", () => {
      renderPicker({ loadingFileName: DAILY_STANDARD.fileName });
      const loading = getOption("Daily standard");

      expect(loading.querySelector('[data-slot="spinner"]')).not.toBeNull();
      expect(loading).toHaveAttribute("aria-busy", "true");
      expect(document.querySelectorAll('[data-slot="spinner"]')).toHaveLength(1);
    });

    it("announces which tune is loading", () => {
      renderPicker({ loadingFileName: DAILY_STANDARD.fileName });

      expect(screen.getByRole("status")).toHaveTextContent("Loading Daily standard…");
    });

    it("shows no spinner and an empty announcement when nothing is loading", () => {
      renderPicker();

      expect(document.querySelector('[data-slot="spinner"]')).toBeNull();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  describe("keyboard", () => {
    it("has one tab stop that starts on the first tune", async () => {
      const user = userEvent.setup();
      renderPicker();

      await user.tab();

      expect(getOption("Tow standard")).toHaveFocus();
      const stops = screen.getAllByRole("option").filter((option) => option.tabIndex === 0);
      expect(stops).toHaveLength(1);
    });

    it("starts the tab stop on the selected tune", async () => {
      const user = userEvent.setup();
      renderPicker({ selectedFileName: DAILY_STANDARD.fileName });

      await user.tab();

      expect(getOption("Daily standard")).toHaveFocus();
    });

    it("moves focus with the arrow keys, Home and End without choosing a tune", async () => {
      const user = userEvent.setup();
      const { onSelect } = renderPicker();
      const options = screen.getAllByRole("option");

      await user.tab();
      await user.keyboard("{ArrowDown}");
      expect(options[1]).toHaveFocus();

      await user.keyboard("{End}");
      expect(options[2]).toHaveFocus();

      await user.keyboard("{ArrowDown}");
      expect(options[2]).toHaveFocus();

      await user.keyboard("{ArrowUp}");
      expect(options[1]).toHaveFocus();

      await user.keyboard("{Home}");
      expect(options[0]).toHaveFocus();

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("moves the tab stop to the tune that has focus", async () => {
      const user = userEvent.setup();
      renderPicker();
      const options = screen.getAllByRole("option");

      await user.tab();
      await user.keyboard("{ArrowDown}");

      expect(options[1]).toHaveAttribute("tabindex", "0");
      expect(options[0]).toHaveAttribute("tabindex", "-1");
    });

    it("chooses the focused tune with Enter and with Space", async () => {
      const user = userEvent.setup();
      const { onSelect } = renderPicker();

      await user.tab();
      await user.keyboard("{ArrowDown}{Enter}");
      expect(onSelect).toHaveBeenLastCalledWith(TOW_VALVE_BODY.fileName);

      await user.keyboard("{ArrowDown} ");
      expect(onSelect).toHaveBeenLastCalledWith(DAILY_STANDARD.fileName);
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it("leaves the list with Tab and reaches the source link", async () => {
      const user = userEvent.setup();
      renderPicker();

      await user.tab();
      await user.tab();

      expect(screen.getByRole("link", { name: SOURCE_LINK_NAME })).toHaveFocus();
    });
  });

  describe("disabled", () => {
    it("does not report clicks or key presses and marks every tune disabled", async () => {
      const user = userEvent.setup();
      const { onSelect } = renderPicker({ disabled: true });

      await user.click(getOption("Daily standard"));
      await user.tab();
      await user.keyboard("{Enter}");

      expect(onSelect).not.toHaveBeenCalled();
      for (const option of screen.getAllByRole("option")) {
        expect(option).toHaveAttribute("aria-disabled", "true");
      }
    });
  });

  describe("source link", () => {
    it("links to the public library", () => {
      renderPicker();

      expect(screen.getByRole("link", { name: SOURCE_LINK_NAME })).toHaveAttribute(
        "href",
        SOURCE_URL,
      );
    });

    it("opens the library in a new tab safely", () => {
      renderPicker();
      const link = screen.getByRole("link", { name: SOURCE_LINK_NAME });

      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    });

    it("shows no link when there is no source URL", () => {
      renderPicker({ sourceUrl: undefined });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("no tunes", () => {
    it("shows an empty state instead of the list", () => {
      renderPicker({ tunes: [] });

      expect(screen.getByText("No library tunes")).toBeInTheDocument();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("still links to the public library", () => {
      renderPicker({ tunes: [] });

      expect(screen.getByRole("link", { name: SOURCE_LINK_NAME })).toHaveAttribute(
        "href",
        SOURCE_URL,
      );
    });
  });
});
