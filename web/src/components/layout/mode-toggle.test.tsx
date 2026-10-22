import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ModeToggle } from "./mode-toggle";
import { ThemeProvider } from "./theme-provider";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ModeToggle />
    </ThemeProvider>,
  );
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Toggle theme" }));
}

describe("ModeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
  });

  it("shows a button named Toggle theme", () => {
    renderToggle();

    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });

  it("offers Light, Dark and System when opened", async () => {
    const user = userEvent.setup();
    renderToggle();

    await openMenu(user);

    const choices = screen.getAllByRole("menuitemradio").map((item) => item.textContent);
    expect(choices).toEqual(["Light", "Dark", "System"]);
  });

  it("marks System as the current choice before any choice is made", async () => {
    const user = userEvent.setup();
    renderToggle();

    await openMenu(user);

    expect(screen.getByRole("menuitemradio", { name: "System" })).toBeChecked();
  });

  it("switches to the dark theme and marks Dark as current", async () => {
    const user = userEvent.setup();
    renderToggle();

    await openMenu(user);
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(document.documentElement).toHaveClass("dark");
    await openMenu(user);
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toBeChecked();
  });

  it("switches back to the light theme", async () => {
    const user = userEvent.setup();
    renderToggle();

    await openMenu(user);
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    await openMenu(user);
    await user.click(screen.getByRole("menuitemradio", { name: "Light" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("can be used with the keyboard", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });
});
