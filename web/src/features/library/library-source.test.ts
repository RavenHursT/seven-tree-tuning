// @vitest-environment node
import { PHP_LIBRARY_INDEX_URL, libraryTuneUrl } from "@seven-tree/hydra";
import type { LibraryTune } from "@seven-tree/hydra";
import { describe, expect, it, vi } from "vitest";

import { LIBRARY_TUNE_FILE_SIZE, loadLibraryTuneFile, loadLibraryTunes } from "./library-source";
import type { LibrarySource } from "./library-source";
import type { FetchLike, LibraryTunesResult } from "./types";

const INDEX_TEXT = [
  "FA20M0C_0S.efu",
  "VCAB0_02_65T.efu",
  "VCAB0_02_0S.efu",
  "VCAB0_06_80P.efu",
  "VCAB0_02_0HI1100.efu",
  "",
].join("\r\n");

const TUNE_NAME = "VCAB0_02_65T.efu";

function fileBytes(size: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.from({ length: size }, (_unused, index) => index % 251);
}

function fetchReturning(...responses: Array<Response | Error>) {
  const queue = [...responses];
  return vi.fn<FetchLike>(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error("fake fetch has no response left");
    if (next instanceof Error) throw next;
    return next;
  });
}

function tunesResult(): LibraryTunesResult {
  return {
    ok: true,
    tunes: tunesOf(["VCAB0_02_0S.efu", TUNE_NAME]),
    sourceUrl: PHP_LIBRARY_INDEX_URL,
  };
}

function tunesOf(fileNames: string[]): LibraryTune[] {
  return fileNames.map((fileName) => ({
    fileName,
    code: fileName.slice(9, -4),
    horsepower: 0,
    mode: "S",
    modeName: "Stock",
    valveBody: false,
    category: "stock",
    label: "Stock",
  }));
}

function sourceWith(
  fetchImpl: FetchLike,
  tunes: LibraryTunesResult = tunesResult(),
): LibrarySource {
  return { getTunes: vi.fn(async () => tunes), fetchImpl };
}

describe("loadLibraryTunes", () => {
  it("fetches PHP's index and lists its TDE1 tunes, in picker order", async () => {
    const fetchImpl = fetchReturning(new Response(INDEX_TEXT));
    const result = await loadLibraryTunes(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(PHP_LIBRARY_INDEX_URL);
    expect(result).toMatchObject({ ok: true, sourceUrl: PHP_LIBRARY_INDEX_URL });
    expect(result.ok && result.tunes.map((tune) => tune.fileName)).toEqual([
      "VCAB0_02_0S.efu",
      "VCAB0_02_65T.efu",
      "VCAB0_02_0HI1100.efu",
    ]);
  });

  it("gives the request a time limit", async () => {
    const fetchImpl = fetchReturning(new Response(INDEX_TEXT));
    await loadLibraryTunes(fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports an HTTP error as a short message and keeps the source URL", async () => {
    const result = await loadLibraryTunes(fetchReturning(new Response("down", { status: 503 })));
    expect(result).toEqual({
      ok: false,
      message: "PHP's server answered HTTP 503.",
      sourceUrl: PHP_LIBRARY_INDEX_URL,
    });
  });

  it("reports a network error without the technical text of the error", async () => {
    const result = await loadLibraryTunes(fetchReturning(new TypeError("fetch failed")));
    expect(result).toEqual({
      ok: false,
      message: "Could not reach PHP's server.",
      sourceUrl: PHP_LIBRARY_INDEX_URL,
    });
  });

  it("reports a request that ran out of time as such", async () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    const result = await loadLibraryTunes(fetchReturning(timeout));
    expect(result).toMatchObject({ ok: false, message: "PHP's server did not answer in time." });
  });

  it("does not throw when fetch throws at once instead of returning a promise", async () => {
    const fetchImpl: FetchLike = () => {
      throw new Error("boom");
    };
    await expect(loadLibraryTunes(fetchImpl)).resolves.toMatchObject({ ok: false });
  });

  it("does not throw when the body breaks while it is read", async () => {
    const broken = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("connection reset"));
        },
      }),
    );
    await expect(loadLibraryTunes(fetchReturning(broken))).resolves.toMatchObject({
      ok: false,
      message: "Could not reach PHP's server.",
    });
  });

  it("reports an index that lists no TDE1 tune as a failure, so an empty list is never kept", async () => {
    const result = await loadLibraryTunes(fetchReturning(new Response("FA20M0C_0S.efu\r\n")));
    expect(result).toEqual({
      ok: false,
      message: "PHP's tune library lists no TDE1 tunes.",
      sourceUrl: PHP_LIBRARY_INDEX_URL,
    });
  });
});

describe("loadLibraryTuneFile", () => {
  it("is 262,152 bytes, the size of every file in PHP's folder", () => {
    expect(LIBRARY_TUNE_FILE_SIZE).toBe(262_152);
  });

  it("returns the bytes of a tune in the index, fetched from PHP's own URL", async () => {
    const upstream = fileBytes(LIBRARY_TUNE_FILE_SIZE);
    const fetchImpl = fetchReturning(new Response(upstream));
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(libraryTuneUrl(TUNE_NAME));
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({ ok: true, fileName: TUNE_NAME });
    expect(result.ok && result.bytes).toEqual(upstream);
  });

  it.each([
    ["an empty name", ""],
    ["a path", "../../etc/passwd"],
    ["a URL", "https://example.com/VCAB0_02_65T.efu"],
    ["a name with a query", "VCAB0_02_65T.efu?x=1"],
    ["another calibration", "VCAB0_06_80P.efu"],
    ["lowercase letters", "vcab0_02_65t.efu"],
  ])("answers not-found for %s without asking the index or PHP", async (_description, name) => {
    const fetchImpl = fetchReturning();
    const source = sourceWith(fetchImpl);
    const result = await loadLibraryTuneFile(name, source);

    expect(result).toEqual({
      ok: false,
      reason: "not-found",
      message: "No such tune in the PHP library.",
    });
    expect(source.getTunes).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers not-found for a well-formed name that the index does not list, without asking PHP", async () => {
    const fetchImpl = fetchReturning();
    const source = sourceWith(fetchImpl);
    const result = await loadLibraryTuneFile("VCAB0_02_99T.efu", source);

    expect(result).toMatchObject({ ok: false, reason: "not-found" });
    expect(source.getTunes).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers upstream-failed with the index message when the index cannot be loaded", async () => {
    const unavailable: LibraryTunesResult = {
      ok: false,
      message: "Could not reach PHP's server.",
      sourceUrl: PHP_LIBRARY_INDEX_URL,
    };
    const fetchImpl = fetchReturning();
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchImpl, unavailable));

    expect(result).toEqual({
      ok: false,
      reason: "upstream-failed",
      message: "Could not reach PHP's server.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers upstream-failed when PHP answers with an HTTP error", async () => {
    const fetchImpl = fetchReturning(new Response("gone", { status: 404 }));
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchImpl));
    expect(result).toEqual({
      ok: false,
      reason: "upstream-failed",
      message: "PHP's server answered HTTP 404.",
    });
  });

  it("answers upstream-failed when PHP cannot be reached", async () => {
    const fetchImpl = fetchReturning(new TypeError("fetch failed"));
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchImpl));
    expect(result).toEqual({
      ok: false,
      reason: "upstream-failed",
      message: "Could not reach PHP's server.",
    });
  });

  it.each([0, 100, LIBRARY_TUNE_FILE_SIZE - 1, LIBRARY_TUNE_FILE_SIZE + 1])(
    "answers upstream-failed, naming both sizes, for a file of %i bytes",
    async (size) => {
      const fetchImpl = fetchReturning(new Response(fileBytes(size)));
      const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchImpl));
      expect(result).toEqual({
        ok: false,
        reason: "upstream-failed",
        message: `PHP's server sent ${size} bytes. Expected 262152 bytes.`,
      });
    },
  );
});
