// @vitest-environment node
import { readFileSync } from "node:fs";

import { PHP_LIBRARY_INDEX_URL, libraryTuneUrl } from "@seven-tree/hydra";
import { cacheLife } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as library from "./index";
import { fetchLibraryTuneFile, getLibraryTunes } from "./index";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const INDEX_TEXT = "FA20M0C_0S.efu\r\nVCAB0_02_65T.efu\r\nVCAB0_02_0S.efu\r\n";
const TUNE_NAME = "VCAB0_02_65T.efu";

function stubPhp(answers: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (input: string) => {
    const answer = answers[input];
    if (answer === undefined) throw new Error(`unexpected request to ${input}`);
    return answer();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("the library module", () => {
  it("exports the data access and the response builder, and nothing else at run time", () => {
    expect(Object.keys(library).sort()).toEqual([
      "fetchLibraryTuneFile",
      "getLibraryTunes",
      "libraryTuneResponse",
    ]);
  });
});

describe("getLibraryTunes caching", () => {
  it("starts with the use cache directive, which Vitest ignores, so only this check notices its loss", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(source).toMatch(/export async function getLibraryTunes\(\)[^{]*\{\s*"use cache";/);
  });
});

describe("getLibraryTunes", () => {
  it("lists the TDE1 tunes of PHP's index and keeps the result for a day", async () => {
    const fetchMock = stubPhp({ [PHP_LIBRARY_INDEX_URL]: () => new Response(INDEX_TEXT) });
    const result = await getLibraryTunes();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, sourceUrl: PHP_LIBRARY_INDEX_URL });
    expect(result.ok && result.tunes.map((tune) => tune.code)).toEqual(["0S", "65T"]);
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith("days");
  });

  it("keeps a failure for a second only, so an outage is tried again soon", async () => {
    stubPhp({ [PHP_LIBRARY_INDEX_URL]: () => new Response("down", { status: 503 }) });
    const result = await getLibraryTunes();

    expect(result).toEqual({
      ok: false,
      message: "PHP's server answered HTTP 503.",
      sourceUrl: PHP_LIBRARY_INDEX_URL,
    });
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith("seconds");
  });

  it("does not throw when PHP cannot be reached", async () => {
    stubPhp({
      [PHP_LIBRARY_INDEX_URL]: () => Promise.reject(new TypeError("fetch failed")),
    });
    await expect(getLibraryTunes()).resolves.toMatchObject({
      ok: false,
      message: "Could not reach PHP's server.",
    });
    expect(cacheLife).toHaveBeenCalledWith("seconds");
  });
});

describe("fetchLibraryTuneFile", () => {
  it("returns the bytes of a tune that is in the index", async () => {
    const upstream = Uint8Array.from({ length: 262_152 }, (_unused, index) => index % 253);
    const fetchMock = stubPhp({
      [PHP_LIBRARY_INDEX_URL]: () => new Response(INDEX_TEXT),
      [libraryTuneUrl(TUNE_NAME)]: () => new Response(upstream),
    });
    const result = await fetchLibraryTuneFile(TUNE_NAME);

    expect(result).toMatchObject({ ok: true, fileName: TUNE_NAME });
    expect(result.ok && result.bytes).toEqual(upstream);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      PHP_LIBRARY_INDEX_URL,
      libraryTuneUrl(TUNE_NAME),
    ]);
  });

  it("asks PHP for nothing but the index when the name is not in it", async () => {
    const fetchMock = stubPhp({ [PHP_LIBRARY_INDEX_URL]: () => new Response(INDEX_TEXT) });
    const result = await fetchLibraryTuneFile("VCAB0_02_99T.efu");

    expect(result).toMatchObject({ ok: false, reason: "not-found" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([PHP_LIBRARY_INDEX_URL]);
  });

  it("makes no request at all for a name of the wrong shape", async () => {
    const fetchMock = stubPhp({});
    const result = await fetchLibraryTuneFile("../../etc/passwd");

    expect(result).toMatchObject({ ok: false, reason: "not-found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers upstream-failed when the index cannot be loaded", async () => {
    stubPhp({ [PHP_LIBRARY_INDEX_URL]: () => new Response("down", { status: 500 }) });
    await expect(fetchLibraryTuneFile(TUNE_NAME)).resolves.toEqual({
      ok: false,
      reason: "upstream-failed",
      message: "PHP's server answered HTTP 500.",
    });
  });
});
