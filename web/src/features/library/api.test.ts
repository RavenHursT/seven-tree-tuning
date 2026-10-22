// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { libraryTuneApiPath, readLibraryApiError } from "./api";
import type { LibraryApiError } from "./api";

describe("libraryTuneApiPath", () => {
  it("is the path of the download route for the file name", () => {
    expect(libraryTuneApiPath("VCAB0_02_65T.efu")).toBe("/api/library/VCAB0_02_65T.efu");
  });

  it("encodes characters that would change the path", () => {
    expect(libraryTuneApiPath("a b/c?d#e")).toBe("/api/library/a%20b%2Fc%3Fd%23e");
    expect(libraryTuneApiPath("../../etc/passwd")).toBe("/api/library/..%2F..%2Fetc%2Fpasswd");
  });

  it("gives a path that decodes back to the file name", () => {
    const name = "VCAB0_02_65T.efu";
    expect(decodeURIComponent(libraryTuneApiPath(name).slice("/api/library/".length))).toBe(name);
  });
});

describe("readLibraryApiError", () => {
  it("returns the message of an error body", () => {
    const body: LibraryApiError = { error: "No such tune in the PHP library." };
    expect(readLibraryApiError(body)).toBe("No such tune in the PHP library.");
  });

  it("ignores other properties of the body", () => {
    expect(readLibraryApiError({ error: "Gone.", status: 404 })).toBe("Gone.");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "PHP's server answered HTTP 503."],
    ["a number", 503],
    ["an array", ["PHP's server answered HTTP 503."]],
    ["an object without error", { message: "PHP's server answered HTTP 503." }],
    ["a number as error", { error: 503 }],
    ["null as error", { error: null }],
    ["an object as error", { error: { message: "x" } }],
    ["an empty error", { error: "" }],
    ["an error of white space only", { error: "  \n" }],
  ])("returns undefined for %s", (_description, body) => {
    expect(readLibraryApiError(body)).toBeUndefined();
  });
});

describe("the api module", () => {
  it("imports and re-exports nothing, so a client component can use it without server code", () => {
    const source = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/^\s*export\b[^;{]*\bfrom\b/m);
    expect(source).not.toMatch(/^\s*export\s*\{[^}]*\}\s*from\b/m);
  });
});
