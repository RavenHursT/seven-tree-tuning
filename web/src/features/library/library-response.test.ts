// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readLibraryApiError } from "./api";
import { libraryTuneResponse } from "./library-response";
import type { LibraryTuneFileResult } from "./types";

const FILE_NAME = "VCAB0_02_65T.efu";
const BYTES = Uint8Array.from({ length: 262_152 }, (_unused, index) => index % 251);
const FOUND: LibraryTuneFileResult = { ok: true, fileName: FILE_NAME, bytes: BYTES };

describe("libraryTuneResponse for a tune file", () => {
  it("answers 200 with the exact bytes as a binary download", async () => {
    const response = libraryTuneResponse(FOUND);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-length")).toBe("262152");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="VCAB0_02_65T.efu"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it("lets browsers and shared caches keep the file, because PHP's files do not change", () => {
    const cacheControl = libraryTuneResponse(FOUND).headers.get("cache-control") ?? "";

    expect(cacheControl).toMatch(/\bpublic\b/);
    expect(cacheControl).not.toMatch(/no-store|no-cache|private/);
    expect(Number(/\bmax-age=(\d+)/.exec(cacheControl)?.[1])).toBeGreaterThanOrEqual(3600);
    expect(Number(/\bs-maxage=(\d+)/.exec(cacheControl)?.[1])).toBeGreaterThanOrEqual(3600);
  });

  it("stops browsers from guessing another content type", () => {
    expect(libraryTuneResponse(FOUND).headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("libraryTuneResponse for a failure", () => {
  const notFound: LibraryTuneFileResult = {
    ok: false,
    reason: "not-found",
    message: "No such tune in the PHP library.",
  };
  const upstreamFailed: LibraryTuneFileResult = {
    ok: false,
    reason: "upstream-failed",
    message: "PHP's server answered HTTP 503.",
  };

  it("answers 404 with a short JSON error for a tune that is not in the library", async () => {
    const response = libraryTuneResponse(notFound);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "No such tune in the PHP library." });
  });

  it("answers 502 with a short JSON error when PHP gave no usable answer", async () => {
    const response = libraryTuneResponse(upstreamFailed);

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "PHP's server answered HTTP 503." });
  });

  it.each([notFound, upstreamFailed])(
    "sends a body that readLibraryApiError reads %#",
    async (result) => {
      const response = libraryTuneResponse(result);
      const message = result.ok ? undefined : result.message;
      expect(readLibraryApiError(await response.json())).toBe(message);
    },
  );

  it.each([notFound, upstreamFailed])("never lets a cache keep the error %#", (result) => {
    expect(libraryTuneResponse(result).headers.get("cache-control")).toBe("no-store");
  });
});
