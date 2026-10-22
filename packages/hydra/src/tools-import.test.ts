import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The command-line tools must run in a checkout that has not run `npm install`. A bare package
// name only resolves through node_modules, so the tools import the library by relative path.
describe.each(["hcf.ts", "tirecomp.ts"])("tools/%s", (name) => {
  const source = readFileSync(new URL(`../../../tools/${name}`, import.meta.url), "utf8");

  it("imports the library by relative path", () => {
    expect(source).toMatch(/from "\.\.\/packages\/hydra\/src";/);
  });

  it("does not import the library by its package name", () => {
    expect(source).not.toMatch(/from "@seven-tree\/hydra"/);
  });
});
