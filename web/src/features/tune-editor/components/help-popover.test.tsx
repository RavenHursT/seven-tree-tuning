import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HelpPopover } from "./help-popover";

const LABEL = "About the base tune";
const TEXT = "The base tune is the file the editor starts from.";

function renderHelp() {
  return render(
    <>
      <HelpPopover label={LABEL}>
        <p>{TEXT}</p>
        <p>Open it as a .hcf, a .efu or a .bin.</p>
      </HelpPopover>
      <label>
        Other field
        <input />
      </label>
      <p>Text outside the popover</p>
    </>,
  );
}

function getButton() {
  return screen.getByRole("button", { name: LABEL });
}

describe("HelpPopover", () => {
  describe("the button", () => {
    it("is a button named by the label, with no visible text", () => {
      renderHelp();

      expect(getButton()).toHaveAttribute("type", "button");
      expect(getButton()).toHaveTextContent("");
    });

    it("is a small ghost icon button with a decorative question icon", () => {
      renderHelp();
      const icon = getButton().querySelector("svg");

      expect(getButton()).toHaveAttribute("data-variant", "ghost");
      expect(getButton().getAttribute("data-size")).toMatch(/^icon/);
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("tells assistive technology that it opens a dialog", () => {
      renderHelp();

      expect(getButton()).toHaveAttribute("aria-haspopup", "dialog");
    });
  });

  describe("opening", () => {
    it("is closed by default", () => {
      renderHelp();

      expect(getButton()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    });

    it("opens on click and shows the text", async () => {
      const user = userEvent.setup();
      renderHelp();

      await user.click(getButton());

      expect(getButton()).toHaveAttribute("aria-expanded", "true");
      const dialog = await screen.findByRole("dialog", { name: LABEL });
      expect(within(dialog).getByText(TEXT)).toBeInTheDocument();
      expect(within(dialog).getByText("Open it as a .hcf, a .efu or a .bin.")).toBeInTheDocument();
    });

    it("opens with Enter and with Space", async () => {
      const user = userEvent.setup();
      renderHelp();

      getButton().focus();
      await user.keyboard("{Enter}");
      expect(await screen.findByRole("dialog", { name: LABEL })).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.keyboard(" ");
      expect(await screen.findByRole("dialog", { name: LABEL })).toBeInTheDocument();
    });

    it("moves focus into the popover when it opens", async () => {
      const user = userEvent.setup();
      renderHelp();

      await user.click(getButton());

      const dialog = await screen.findByRole("dialog", { name: LABEL });
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    });
  });

  describe("closing", () => {
    it("closes on Escape and puts focus back on the button", async () => {
      const user = userEvent.setup();
      renderHelp();
      await user.click(getButton());
      await screen.findByRole("dialog", { name: LABEL });

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
      await waitFor(() => expect(getButton()).toHaveFocus());
      expect(getButton()).toHaveAttribute("aria-expanded", "false");
    });

    it("closes on a click outside", async () => {
      const user = userEvent.setup();
      renderHelp();
      await user.click(getButton());
      await screen.findByRole("dialog", { name: LABEL });

      await user.click(screen.getByText("Text outside the popover"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(getButton()).toHaveAttribute("aria-expanded", "false");
    });

    it("leaves focus on the field that was clicked outside, as a browser does", async () => {
      const user = userEvent.setup();
      renderHelp();
      await user.click(getButton());
      await screen.findByRole("dialog", { name: LABEL });

      await user.click(screen.getByLabelText("Other field"));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByLabelText("Other field")).toHaveFocus();
    });

    it("closes when the button is clicked again", async () => {
      const user = userEvent.setup();
      renderHelp();
      await user.click(getButton());
      await screen.findByRole("dialog", { name: LABEL });

      await user.click(getButton());

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(getButton()).toHaveFocus();
    });

    it("does not close when the text inside it is clicked", async () => {
      const user = userEvent.setup();
      renderHelp();
      await user.click(getButton());
      await screen.findByRole("dialog", { name: LABEL });

      await user.click(screen.getByText(TEXT));

      expect(screen.getByRole("dialog", { name: LABEL })).toBeInTheDocument();
    });
  });
});
