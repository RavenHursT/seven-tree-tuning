import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { CollapsibleModule, type CollapsibleModuleProps } from "./collapsible-module";

const SUMMARY = "TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf · Hydra .hcf";

function renderModule(props: Partial<Omit<CollapsibleModuleProps, "children">> = {}) {
  return render(
    <CollapsibleModule id="base-tune" title="Base Tune" summary={SUMMARY} {...props}>
      <label>
        Output name
        <input />
      </label>
      <button type="button">Reset</button>
    </CollapsibleModule>,
  );
}

function getToggle() {
  return screen.getByRole("button", { name: "Base Tune" });
}

function controlledElement(toggle: HTMLElement): HTMLElement | null {
  const id = toggle.getAttribute("aria-controls");
  return id === null ? null : document.getElementById(id);
}

describe("CollapsibleModule", () => {
  describe("heading and toggle", () => {
    it("shows the title as the only level 2 heading", () => {
      renderModule({ headingAction: <button type="button">Help</button> });

      expect(screen.getAllByRole("heading")).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 2, name: "Base Tune" })).toBeInTheDocument();
    });

    it("puts the toggle button inside the heading, named by the title alone", () => {
      renderModule({ headingAction: <button type="button">Help</button> });
      const heading = screen.getByRole("heading", { level: 2 });

      expect(within(heading).getByRole("button", { name: "Base Tune" })).toBe(getToggle());
      expect(within(heading).getAllByRole("button")).toHaveLength(1);
    });

    it("hides the chevron from assistive technology", () => {
      renderModule();
      const chevron = getToggle().querySelector("svg");

      expect(chevron).not.toBeNull();
      expect(chevron).toHaveAttribute("aria-hidden", "true");
    });

    it("puts the id and the class name on the card", () => {
      const { container } = renderModule({ className: "custom-class" });

      const card = container.querySelector("#base-tune");
      expect(card).toHaveAttribute("data-slot", "card");
      expect(card).toHaveClass("custom-class");
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild).toBe(card);
    });
  });

  describe("open and closed", () => {
    it("is expanded by default: shows the content and hides the summary", () => {
      renderModule();

      expect(getToggle()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("Output name")).toBeInTheDocument();
      expect(screen.queryByText(SUMMARY)).not.toBeInTheDocument();
    });

    it("starts collapsed with defaultOpen false: no content, the summary shows", () => {
      renderModule({ defaultOpen: false });

      expect(getToggle()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByLabelText("Output name")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
      expect(screen.getByText(SUMMARY)).toBeInTheDocument();
    });

    it("hides the content and shows the summary when toggled, and back", async () => {
      const user = userEvent.setup();
      renderModule();

      await user.click(getToggle());
      expect(getToggle()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByLabelText("Output name")).not.toBeInTheDocument();
      expect(screen.getByText(SUMMARY)).toBeInTheDocument();

      await user.click(getToggle());
      expect(getToggle()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("Output name")).toBeInTheDocument();
      expect(screen.queryByText(SUMMARY)).not.toBeInTheDocument();
    });

    it("shows a summary that is more than text", () => {
      renderModule({
        defaultOpen: false,
        summary: (
          <>
            <strong>315/75R16</strong> · 34.60 in
          </>
        ),
      });

      expect(screen.getByText("315/75R16")).toBeInTheDocument();
      expect(screen.getByText(/34\.60 in/)).toBeInTheDocument();
    });

    it("toggles with Enter and with Space", async () => {
      const user = userEvent.setup();
      renderModule();

      await user.tab();
      expect(getToggle()).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(getToggle()).toHaveAttribute("aria-expanded", "false");

      await user.keyboard(" ");
      expect(getToggle()).toHaveAttribute("aria-expanded", "true");
    });

    it("keeps focus on the toggle button after a click and after a key press", async () => {
      const user = userEvent.setup();
      renderModule();
      const toggle = getToggle();

      await user.click(toggle);
      expect(toggle).toHaveFocus();
      await user.click(toggle);
      expect(toggle).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(toggle).toHaveFocus();
      await user.keyboard(" ");
      expect(toggle).toHaveFocus();
      expect(getToggle()).toBe(toggle);
    });

    it("keeps each module's state apart", async () => {
      const user = userEvent.setup();
      render(
        <>
          <CollapsibleModule id="one" title="One" summary="first summary">
            <p>first content</p>
          </CollapsibleModule>
          <CollapsibleModule id="two" title="Two" summary="second summary">
            <p>second content</p>
          </CollapsibleModule>
        </>,
      );

      await user.click(screen.getByRole("button", { name: "One" }));

      expect(screen.queryByText("first content")).not.toBeInTheDocument();
      expect(screen.getByText("first summary")).toBeInTheDocument();
      expect(screen.getByText("second content")).toBeInTheDocument();
      expect(screen.queryByText("second summary")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "One" }).getAttribute("aria-controls")).not.toBe(
        screen.getByRole("button", { name: "Two" }).getAttribute("aria-controls"),
      );
    });
  });

  describe("accessibility", () => {
    it("points aria-controls at the element that holds the content", () => {
      renderModule();
      const toggle = getToggle();

      expect(toggle).toHaveAttribute("aria-controls");
      expect(controlledElement(toggle)).toContainElement(screen.getByLabelText("Output name"));
    });

    it("refers to the content only while the content is rendered", async () => {
      const user = userEvent.setup();
      renderModule();
      const whileOpen = getToggle().getAttribute("aria-controls");

      await user.click(getToggle());
      expect(getToggle()).not.toHaveAttribute("aria-controls");

      await user.click(getToggle());
      expect(getToggle().getAttribute("aria-controls")).toBe(whileOpen);
      expect(controlledElement(getToggle())).toContainElement(screen.getByLabelText("Output name"));
    });

    it("has no aria-controls when it starts collapsed", () => {
      renderModule({ defaultOpen: false });

      expect(getToggle()).not.toHaveAttribute("aria-controls");
    });

    it("describes the toggle with the summary while collapsed, and with nothing while open", async () => {
      const user = userEvent.setup();
      renderModule();
      expect(getToggle()).not.toHaveAccessibleDescription();

      await user.click(getToggle());
      expect(getToggle()).toHaveAccessibleDescription(SUMMARY);
      expect(getToggle()).toHaveAccessibleName("Base Tune");

      await user.click(getToggle());
      expect(getToggle()).not.toHaveAccessibleDescription();
    });
  });

  describe("heading action", () => {
    it("is shown right after the heading and outside the toggle button", () => {
      renderModule({ headingAction: <button type="button">Help</button> });
      const action = screen.getByRole("button", { name: "Help" });
      const heading = screen.getByRole("heading", { level: 2 });

      expect(getToggle()).not.toContainElement(action);
      expect(heading).not.toContainElement(action);
      expect(heading.compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(heading.parentElement).toBe(action.parentElement);
      expect(heading.nextElementSibling).toBe(action);
    });

    it("can be clicked without toggling the module", async () => {
      const user = userEvent.setup();
      const onHelp = vi.fn();
      renderModule({
        headingAction: (
          <button type="button" onClick={onHelp}>
            Help
          </button>
        ),
      });

      await user.click(screen.getByRole("button", { name: "Help" }));

      expect(onHelp).toHaveBeenCalledTimes(1);
      expect(getToggle()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByLabelText("Output name")).toBeInTheDocument();
    });

    it("does not toggle the module when something it opens in a portal is clicked", async () => {
      const user = userEvent.setup();
      const onInside = vi.fn();
      renderModule({
        headingAction: createPortal(
          <button type="button" onClick={onInside}>
            Inside the popover
          </button>,
          document.body,
        ),
      });

      await user.click(screen.getByRole("button", { name: "Inside the popover" }));

      expect(onInside).toHaveBeenCalledTimes(1);
      expect(getToggle()).toHaveAttribute("aria-expanded", "true");
    });

    it("stays available, and does not expand the module, while collapsed", async () => {
      const user = userEvent.setup();
      const onHelp = vi.fn();
      renderModule({
        defaultOpen: false,
        headingAction: (
          <button type="button" onClick={onHelp}>
            Help
          </button>
        ),
      });

      await user.click(screen.getByRole("button", { name: "Help" }));

      expect(onHelp).toHaveBeenCalledTimes(1);
      expect(getToggle()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByLabelText("Output name")).not.toBeInTheDocument();
    });
  });
});
