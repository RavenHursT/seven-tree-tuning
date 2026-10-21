import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TuneSourcePanel, type TuneSourcePanelProps } from "./tune-source-panel";

function renderPanel(props: Partial<TuneSourcePanelProps> = {}) {
  render(
    <TuneSourcePanel upload={<p>Upload section</p>} library={<p>Library section</p>} {...props} />,
  );
}

describe("TuneSourcePanel", () => {
  it("is titled Starting tune", () => {
    renderPanel();

    expect(screen.getByRole("heading", { level: 2, name: "Starting tune" })).toBeInTheDocument();
  });

  it("makes the title a real h2 element inside the card title", () => {
    renderPanel();

    const heading = screen.getByRole("heading", { level: 2, name: "Starting tune" });

    expect(heading.tagName).toBe("H2");
    expect(heading).not.toHaveAttribute("role");
    expect(heading).not.toHaveAttribute("aria-level");
    expect(heading.closest("[data-slot=card-title]")).not.toBeNull();
  });

  it("offers an upload tab and a public library tab", () => {
    renderPanel();

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);

    expect(tabs).toEqual(["Upload a file", "PHP public library"]);
    expect(screen.getByRole("tablist", { name: "Tune source" })).toBeInTheDocument();
  });

  it("opens on the upload tab and shows only the upload section", () => {
    renderPanel();

    expect(screen.getByRole("tab", { name: "Upload a file" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Upload section")).toBeInTheDocument();
    expect(screen.queryByText("Library section")).not.toBeInTheDocument();
  });

  it("shows the library section after the library tab is chosen", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("tab", { name: "PHP public library" }));

    expect(screen.getByRole("tab", { name: "PHP public library" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Library section")).toBeInTheDocument();
    expect(screen.queryByText("Upload section")).not.toBeInTheDocument();
  });

  it("goes back to the upload section when the upload tab is chosen again", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("tab", { name: "PHP public library" }));
    await user.click(screen.getByRole("tab", { name: "Upload a file" }));

    expect(screen.getByText("Upload section")).toBeInTheDocument();
    expect(screen.queryByText("Library section")).not.toBeInTheDocument();
  });

  it("opens on the library tab when asked to", () => {
    renderPanel({ defaultTab: "library" });

    expect(screen.getByRole("tab", { name: "PHP public library" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Library section")).toBeInTheDocument();
    expect(screen.queryByText("Upload section")).not.toBeInTheDocument();
  });

  it("switches tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "PHP public library" })).toHaveFocus();
    expect(screen.getByText("Library section")).toBeInTheDocument();
  });

  it("links the visible section to its tab", () => {
    renderPanel();

    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Upload a file");
  });
});
