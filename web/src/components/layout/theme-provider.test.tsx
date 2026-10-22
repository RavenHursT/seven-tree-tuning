import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "./theme-provider";

function ThemeButtons() {
  const { setTheme } = useTheme();
  return (
    <>
      <button onClick={() => setTheme("dark")}>Use dark</button>
      <button onClick={() => setTheme("light")}>Use light</button>
    </>
  );
}

function renderWithProvider() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeButtons />
    </ThemeProvider>,
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
  });

  it("adds the dark class to the html element when the theme is set to dark", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole("button", { name: "Use dark" }));

    expect(document.documentElement).toHaveClass("dark");
  });

  it("removes the dark class when the theme is set back to light", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole("button", { name: "Use dark" }));
    await user.click(screen.getByRole("button", { name: "Use light" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement).toHaveClass("light");
  });

  it("remembers the chosen theme in local storage", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole("button", { name: "Use dark" }));

    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("renders its children", () => {
    render(
      <ThemeProvider attribute="class">
        <p>Inside the provider</p>
      </ThemeProvider>,
    );

    expect(screen.getByText("Inside the provider")).toBeInTheDocument();
  });
});
