import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppHeader } from "./app-header";

function getLogos(container: HTMLElement) {
  const light = container.querySelector<HTMLImageElement>('img[src*="seven-tree-logo.png"]');
  const dark = container.querySelector<HTMLImageElement>('img[src*="seven-tree-logo-dark.png"]');
  return { light, dark };
}

describe("AppHeader", () => {
  it("shows the app title as the main heading", () => {
    render(<AppHeader />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Seven-Tree Tune Editor" }),
    ).toBeInTheDocument();
  });

  it("shows the one-line subtitle", () => {
    render(<AppHeader />);

    expect(screen.getByText("Hydra chip tunes · 1996 F-350 7.3L · PCM TDE1")).toBeInTheDocument();
  });

  it("is a page banner", () => {
    render(<AppHeader />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders both logos at their intrinsic size", () => {
    const { container } = render(<AppHeader />);
    const { light, dark } = getLogos(container);

    expect(light).not.toBeNull();
    expect(dark).not.toBeNull();
    for (const logo of [light, dark]) {
      expect(logo).toHaveAttribute("width", "824");
      expect(logo).toHaveAttribute("height", "760");
    }
  });

  it("hides the light logo in dark mode and shows only the dark logo there", () => {
    const { container } = render(<AppHeader />);
    const { light, dark } = getLogos(container);

    expect(light).toHaveClass("dark:hidden");
    expect(dark).toHaveClass("hidden", "dark:block");
  });

  it("marks the logos as decorative because the title names the app", () => {
    const { container } = render(<AppHeader />);
    const { light, dark } = getLogos(container);

    expect(light).toHaveAttribute("alt", "");
    expect(dark).toHaveAttribute("alt", "");
  });

  it("links to the project repository on GitHub in a new tab", () => {
    render(<AppHeader />);

    const link = screen.getByRole("link", { name: /github/i });

    expect(link).toHaveAttribute("href", "https://github.com/RavenHursT/seven-tree-tuning");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("includes the theme toggle", () => {
    render(<AppHeader />);

    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });
});
