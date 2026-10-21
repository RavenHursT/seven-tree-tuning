import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-sans-variable" }),
  Geist_Mono: () => ({ variable: "geist-mono-variable" }),
  JetBrains_Mono: () => ({ variable: "jetbrains-mono-variable" }),
}));

import RootLayout, { metadata } from "@/app/layout";

function renderLayout(): Document {
  const markup = renderToStaticMarkup(
    <RootLayout params={Promise.resolve({})}>
      <main>
        <p>Page content</p>
      </main>
    </RootLayout>,
  );
  return new DOMParser().parseFromString(markup, "text/html");
}

describe("RootLayout", () => {
  it("sets the page title and a plain description", () => {
    expect(metadata.title).toBe("Seven-Tree Tune Editor");
    expect(metadata.description).toEqual(expect.stringContaining("Hydra chip tune"));
  });

  it("declares the page language", () => {
    expect(renderLayout().documentElement.getAttribute("lang")).toBe("en");
  });

  it("applies JetBrains Mono, the only font the page uses, and loads no other font", () => {
    const classes = Array.from(renderLayout().documentElement.classList);

    expect(classes).toEqual(
      expect.arrayContaining(["font-mono", "jetbrains-mono-variable", "antialiased"]),
    );
    expect(classes).not.toContain("geist-sans-variable");
    expect(classes).not.toContain("geist-mono-variable");
  });

  it("shows the app header above the page content", () => {
    const doc = renderLayout();
    const header = doc.querySelector("header");
    const content = doc.querySelector("main");

    expect(header?.textContent).toContain("Seven-Tree Tune Editor");
    expect(content?.textContent).toContain("Page content");
    expect(
      header!.compareDocumentPosition(content!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("includes the notification area for toasts", () => {
    const doc = renderLayout();

    expect(doc.querySelector('section[aria-label^="Notifications"]')).not.toBeNull();
  });

  it("sets the theme before the page paints, using the class setting and the system default", () => {
    const doc = renderLayout();
    const script = Array.from(doc.querySelectorAll("script")).find((element) =>
      element.textContent?.includes("prefers-color-scheme"),
    );

    expect(script).toBeDefined();
    expect(script!.textContent).toContain('"class","theme","system"');
  });
});
