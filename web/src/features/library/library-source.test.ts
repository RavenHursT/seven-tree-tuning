// @vitest-environment node
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { PHP_LIBRARY_INDEX_URL, libraryTuneUrl } from "@seven-tree/hydra";
import type { LibraryTune } from "@seven-tree/hydra";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LIBRARY_MAX_BODY_BYTES,
  LIBRARY_TUNE_FILE_SIZE,
  loadLibraryTuneFile,
  loadLibraryTunes,
} from "./library-source";
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

/**
 * A response body of `chunkCount` pieces of `chunkSize` bytes each, produced only when read. It
 * records how many pieces were read and whether the reader gave the body up.
 */
function watchedBody(chunkSize: number, chunkCount = 1) {
  const watch = { reads: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        watch.reads++;
        controller.enqueue(new Uint8Array(chunkSize));
        if (watch.reads === chunkCount) controller.close();
      },
      cancel() {
        watch.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { body, watch };
}

/** A response whose body arrives in the given pieces, with no Content-Length header. */
function responseInPieces(pieces: readonly Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        pieces.forEach((piece) => controller.enqueue(piece));
        controller.close();
      },
    }),
  );
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

  it("asks fetch to fail on a redirect instead of following it", async () => {
    const fetchImpl = fetchReturning(new Response(INDEX_TEXT));
    await loadLibraryTunes(fetchImpl);
    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  it("reads an index whose Content-Length is exactly the limit", async () => {
    const response = new Response(INDEX_TEXT, {
      headers: { "content-length": String(LIBRARY_MAX_BODY_BYTES) },
    });
    await expect(loadLibraryTunes(fetchReturning(response))).resolves.toMatchObject({ ok: true });
  });

  it("is 1 MB at most for anything read from PHP", () => {
    expect(LIBRARY_MAX_BODY_BYTES).toBe(1_000_000);
  });

  it("stops reading an index with no Content-Length once it is longer than 1 MB", async () => {
    const { body, watch } = watchedBody(100_000, 50);
    const result = await loadLibraryTunes(fetchReturning(new Response(body)));

    expect(result).toEqual({
      ok: false,
      message: "PHP's tune library index is larger than 1 MB.",
      sourceUrl: PHP_LIBRARY_INDEX_URL,
    });
    expect(watch).toEqual({ reads: 11, cancelled: true });
  });

  it("does not refuse an index of exactly 1 MB that has no Content-Length", async () => {
    // The bytes are zeros: the whole body is read, then the index lists no tunes.
    const { body, watch } = watchedBody(100_000, 10);
    const result = await loadLibraryTunes(fetchReturning(new Response(body)));

    expect(result).toMatchObject({ ok: false, message: "PHP's tune library lists no TDE1 tunes." });
    expect(watch).toEqual({ reads: 10, cancelled: false });
  });

  it("reads an index that arrives in several pieces, including a piece cut inside a name", async () => {
    const encoder = new TextEncoder();
    const pieces = ["FA20M0C_0S.efu\r\nVCAB0_02_", "65T.efu\r\nVCAB0_02_0S.ef", "u\r\n"];
    const result = await loadLibraryTunes(
      fetchReturning(responseInPieces(pieces.map((piece) => encoder.encode(piece)))),
    );

    expect(result.ok && result.tunes.map((tune) => tune.fileName)).toEqual([
      "VCAB0_02_0S.efu",
      "VCAB0_02_65T.efu",
    ]);
  });

  it("fails without reading the body when the index announces more than 1 MB", async () => {
    const { body, watch } = watchedBody(10);
    const response = new Response(body, {
      headers: { "content-length": String(LIBRARY_MAX_BODY_BYTES + 1) },
    });
    const result = await loadLibraryTunes(fetchReturning(response));

    expect(result).toEqual({
      ok: false,
      message: "PHP's tune library index is larger than 1 MB.",
      sourceUrl: PHP_LIBRARY_INDEX_URL,
    });
    expect(watch).toEqual({ reads: 0, cancelled: true });
  });

  it("reads an index that has no Content-Length", async () => {
    const response = new Response(INDEX_TEXT);
    expect(response.headers.get("content-length")).toBeNull();
    await expect(loadLibraryTunes(fetchReturning(response))).resolves.toMatchObject({ ok: true });
  });

  it("gives up an HTTP error answer without reading its body", async () => {
    const { body, watch } = watchedBody(10);
    const result = await loadLibraryTunes(fetchReturning(new Response(body, { status: 503 })));

    expect(result).toMatchObject({ ok: false, message: "PHP's server answered HTTP 503." });
    expect(watch).toEqual({ reads: 0, cancelled: true });
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

  it("asks fetch to fail on a redirect instead of following it", async () => {
    const fetchImpl = fetchReturning(new Response(fileBytes(LIBRARY_TUNE_FILE_SIZE)));
    await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchImpl));
    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe("error");
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

  it.each(["0", "100", "262151", "262153", "99999999999"])(
    "answers upstream-failed without reading the body when Content-Length is %s",
    async (announced) => {
      const { body, watch } = watchedBody(LIBRARY_TUNE_FILE_SIZE);
      const response = new Response(body, { headers: { "content-length": announced } });
      const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchReturning(response)));

      expect(result).toEqual({
        ok: false,
        reason: "upstream-failed",
        message: `PHP's server sent ${announced} bytes. Expected 262152 bytes.`,
      });
      expect(watch).toEqual({ reads: 0, cancelled: true });
    },
  );

  it("reads the body when Content-Length is 262152", async () => {
    const upstream = fileBytes(LIBRARY_TUNE_FILE_SIZE);
    const response = new Response(upstream, { headers: { "content-length": "262152" } });
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchReturning(response)));
    expect(result.ok && result.bytes).toEqual(upstream);
  });

  it("still checks the size after reading when Content-Length says 262152 but the body is shorter", async () => {
    const response = new Response(fileBytes(1_000), { headers: { "content-length": "262152" } });
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchReturning(response)));
    expect(result).toEqual({
      ok: false,
      reason: "upstream-failed",
      message: "PHP's server sent 1000 bytes. Expected 262152 bytes.",
    });
  });

  it("checks the size after reading when Content-Length is not a whole number", async () => {
    const response = new Response(fileBytes(LIBRARY_TUNE_FILE_SIZE), {
      headers: { "content-length": "abc" },
    });
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchReturning(response)));
    expect(result).toMatchObject({ ok: true });
  });

  it("does not hold an encoded body to Content-Length, which counts the encoded bytes", async () => {
    const upstream = fileBytes(LIBRARY_TUNE_FILE_SIZE);
    const response = new Response(upstream, {
      headers: { "content-length": "48211", "content-encoding": "gzip" },
    });
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchReturning(response)));
    expect(result.ok && result.bytes).toEqual(upstream);
  });

  it("stops reading a file with no Content-Length once it is longer than 1 MB", async () => {
    const { body, watch } = watchedBody(100_000, 50);
    const result = await loadLibraryTuneFile(
      TUNE_NAME,
      sourceWith(fetchReturning(new Response(body))),
    );

    expect(result).toEqual({
      ok: false,
      reason: "upstream-failed",
      message: "PHP's server sent more than 1000000 bytes. Expected 262152 bytes.",
    });
    expect(watch).toEqual({ reads: 11, cancelled: true });
  });

  it("stops reading an encoded file that is longer than 1 MB once decoded", async () => {
    const { body, watch } = watchedBody(100_000, 50);
    const response = new Response(body, {
      headers: { "content-length": "9000", "content-encoding": "gzip" },
    });
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchReturning(response)));

    expect(result).toMatchObject({ ok: false, reason: "upstream-failed" });
    expect(watch).toEqual({ reads: 11, cancelled: true });
  });

  it("reads a file that arrives in several pieces", async () => {
    const upstream = fileBytes(LIBRARY_TUNE_FILE_SIZE);
    const pieces = [
      upstream.slice(0, 1),
      upstream.slice(1, 100_000),
      upstream.slice(100_000, 262_000),
      upstream.slice(262_000),
    ];
    const result = await loadLibraryTuneFile(
      TUNE_NAME,
      sourceWith(fetchReturning(responseInPieces(pieces))),
    );

    expect(result.ok && result.bytes).toEqual(upstream);
  });

  it("gives up an HTTP error answer without reading its body", async () => {
    const { body, watch } = watchedBody(10);
    const response = new Response(body, { status: 404 });
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchReturning(response)));

    expect(result).toMatchObject({ ok: false, message: "PHP's server answered HTTP 404." });
    expect(watch).toEqual({ reads: 0, cancelled: true });
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

describe("a redirect from PHP's server", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    const open = servers.splice(0);
    open.forEach((server) => server.closeAllConnections());
    await Promise.all(open.map((server) => new Promise((done) => server.close(done))));
  });

  type Handler = (request: IncomingMessage, response: ServerResponse) => void;

  async function listen(handler: Handler): Promise<{ url: string; hits: () => number }> {
    let hits = 0;
    const server = createServer((request, response) => {
      hits++;
      handler(request, response);
    });
    servers.push(server);
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    const { port } = server.address() as AddressInfo;
    return { url: `http://127.0.0.1:${port}/`, hits: () => hits };
  }

  /** A fetch whose every request goes to a local server that redirects to another local server. */
  async function fetchRedirectedElsewhere() {
    const elsewhere = await listen((_request, response) => {
      response.end(Buffer.alloc(LIBRARY_TUNE_FILE_SIZE, 1));
    });
    const redirector = await listen((_request, response) => {
      response.writeHead(302, { location: elsewhere.url });
      response.end();
    });
    const fetchImpl: FetchLike = (_input, init) => fetch(redirector.url, init);
    return { fetchImpl, hitsElsewhere: elsewhere.hits };
  }

  it("is not followed when the index is fetched", async () => {
    const { fetchImpl, hitsElsewhere } = await fetchRedirectedElsewhere();
    const result = await loadLibraryTunes(fetchImpl);

    expect(result).toMatchObject({ ok: false, message: "Could not reach PHP's server." });
    expect(hitsElsewhere()).toBe(0);
  });

  it("is not followed when a tune file is fetched", async () => {
    const { fetchImpl, hitsElsewhere } = await fetchRedirectedElsewhere();
    const result = await loadLibraryTuneFile(TUNE_NAME, sourceWith(fetchImpl));

    expect(result).toEqual({
      ok: false,
      reason: "upstream-failed",
      message: "Could not reach PHP's server.",
    });
    expect(hitsElsewhere()).toBe(0);
  });
});
