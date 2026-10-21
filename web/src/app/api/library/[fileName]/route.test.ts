// @vitest-environment node
import { PHP_LIBRARY_INDEX_URL, libraryTuneUrl } from "@seven-tree/hydra";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const INDEX_TEXT = "FA20M0C_0S.efu\r\nVCAB0_02_65T.efu\r\nVCAB0_02_0S.efu\r\n";
const TUNE_NAME = "VCAB0_02_65T.efu";
const UPSTREAM = Uint8Array.from({ length: 262_152 }, (_unused, index) => index % 253);

type Answer = () => Response | Promise<Response>;

function stubPhp(answers: Record<string, Answer>) {
  const fetchMock = vi.fn(async (input: string) => {
    const answer = answers[input];
    if (answer === undefined) throw new Error(`unexpected request to ${input}`);
    return answer();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function phpWithTune(): Record<string, Answer> {
  return {
    [PHP_LIBRARY_INDEX_URL]: () => new Response(INDEX_TEXT),
    [libraryTuneUrl(TUNE_NAME)]: () => new Response(UPSTREAM),
  };
}

function callGet(fileName: string, search = ""): Promise<Response> {
  const url = `http://localhost:3000/api/library/${encodeURIComponent(fileName)}${search}`;
  return GET(new Request(url), { params: Promise.resolve({ fileName }) });
}

function requestedUrls(fetchMock: ReturnType<typeof stubPhp>): string[] {
  return fetchMock.mock.calls.map(([url]) => url);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GET /api/library/[fileName] for a tune in PHP's library", () => {
  it("answers 200 with PHP's exact bytes as a binary download", async () => {
    const fetchMock = stubPhp(phpWithTune());
    const response = await callGet(TUNE_NAME);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-length")).toBe("262152");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${TUNE_NAME}"`);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(UPSTREAM);
    expect(requestedUrls(fetchMock)).toEqual([PHP_LIBRARY_INDEX_URL, libraryTuneUrl(TUNE_NAME)]);
  });

  it("lets browsers and shared caches keep the answer", async () => {
    stubPhp(phpWithTune());
    const cacheControl = (await callGet(TUNE_NAME)).headers.get("cache-control") ?? "";
    expect(cacheControl).toMatch(/\bpublic\b/);
    expect(cacheControl).toMatch(/\bmax-age=\d+/);
  });

  it("uses only the file name from the request, never its query string", async () => {
    const fetchMock = stubPhp(phpWithTune());
    const response = await callGet(TUNE_NAME, "?url=https://evil.example/x&fileName=other.efu");

    expect(response.status).toBe(200);
    expect(requestedUrls(fetchMock)).toEqual([PHP_LIBRARY_INDEX_URL, libraryTuneUrl(TUNE_NAME)]);
  });
});

describe("GET /api/library/[fileName] for a name that is not a tune in the library", () => {
  it.each([
    ["a path", "../../etc/passwd"],
    ["a whole URL", "https://evil.example/VCAB0_02_65T.efu"],
    ["a name with a query", "VCAB0_02_65T.efu?x=1"],
    ["a name with lowercase letters", "vcab0_02_65t.efu"],
    ["a name of another calibration", "VCAB0_06_65T.efu"],
    ["no .efu extension", "VCAB0_02_65T"],
  ])("answers 404 for %s and makes no request to PHP", async (_description, fileName) => {
    const fetchMock = stubPhp({});
    const response = await callGet(fileName);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "No such tune in the PHP library." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 404 for a well-formed name the index does not list, after asking only for the index", async () => {
    const fetchMock = stubPhp(phpWithTune());
    const response = await callGet("VCAB0_02_99T.efu");

    expect(response.status).toBe(404);
    expect(requestedUrls(fetchMock)).toEqual([PHP_LIBRARY_INDEX_URL]);
  });
});

describe("GET /api/library/[fileName] when PHP does not give a usable answer", () => {
  async function expectBadGateway(response: Response, message: string): Promise<void> {
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: message });
  }

  it("answers 502 when PHP cannot be reached", async () => {
    stubPhp({ [PHP_LIBRARY_INDEX_URL]: () => Promise.reject(new TypeError("fetch failed")) });
    await expectBadGateway(await callGet(TUNE_NAME), "Could not reach PHP's server.");
  });

  it("answers 502 when the index request gets an HTTP error", async () => {
    stubPhp({ [PHP_LIBRARY_INDEX_URL]: () => new Response("down", { status: 503 }) });
    await expectBadGateway(await callGet(TUNE_NAME), "PHP's server answered HTTP 503.");
  });

  it("answers 502 when the tune request gets an HTTP error", async () => {
    stubPhp({
      ...phpWithTune(),
      [libraryTuneUrl(TUNE_NAME)]: () => new Response("gone", { status: 404 }),
    });
    await expectBadGateway(await callGet(TUNE_NAME), "PHP's server answered HTTP 404.");
  });

  it("answers 502 when the file has the wrong size", async () => {
    stubPhp({
      ...phpWithTune(),
      [libraryTuneUrl(TUNE_NAME)]: () => new Response(new Uint8Array(1_000)),
    });
    await expectBadGateway(
      await callGet(TUNE_NAME),
      "PHP's server sent 1000 bytes. Expected 262152 bytes.",
    );
  });
});
