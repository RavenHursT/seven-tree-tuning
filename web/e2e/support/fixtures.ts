import { expect, test as base, type Page } from "@playwright/test";

import { EditorPage } from "./editor-page";

interface EditorFixtures {
  editor: EditorPage;
}

/** Records what the page logs as an error or throws, so a test can fail on it. */
function recordBrowserProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`uncaught error: ${error.message}`));
  return problems;
}

/**
 * Playwright's `test` with an `editor` fixture. Every test also fails when its page logged a
 * console error or threw an uncaught error, even when its own checks passed.
 *
 * The second argument of a fixture is called `provide` here, not `use` as in Playwright's
 * documentation: the React lint rules take a call to `use` for a call to React's `use` hook.
 */
export const test = base.extend<EditorFixtures>({
  page: async ({ page }, provide) => {
    const problems = recordBrowserProblems(page);
    await provide(page);
    expect(problems, "errors the page logged or threw").toEqual([]);
  },
  editor: async ({ page }, provide) => {
    await provide(new EditorPage(page));
  },
});

export { expect };
