import {
  PHP_LIBRARY_INDEX_URL,
  isLibraryFileName,
  libraryTuneUrl,
  parseLibraryIndex,
} from "@seven-tree/hydra";

import type { FetchLike, LibraryTuneFileResult, LibraryTunesResult } from "./types";

/** Size in bytes of every .efu file in PHP's folder. */
export const LIBRARY_TUNE_FILE_SIZE = 262_152;

/**
 * The most bytes read from one answer of PHP's server: 1 MB. The index is a few kilobytes and a
 * tune file is 262,152 bytes, so a longer answer is not what was asked for.
 */
export const LIBRARY_MAX_BODY_BYTES = 1_000_000;

const REQUEST_TIMEOUT_MS = 15_000;

const INDEX_TOO_LARGE = "PHP's tune library index is larger than 1 MB.";

/** What `loadLibraryTuneFile` needs from outside: the current index and a way to fetch. */
export interface LibrarySource {
  readonly getTunes: () => Promise<LibraryTunesResult>;
  readonly fetchImpl: FetchLike;
}

type Fetched<T> = { ok: true; value: T } | { ok: false; message: string };

function isTimeout(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError"
  );
}

/** Gives up a response without reading it, so its connection is released at once. */
async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

/**
 * Asks PHP's server for `url` and hands a successful response to `read`. A redirect is an error:
 * the host check on the URL would mean nothing if the answer could send the request elsewhere.
 */
async function request<T>(
  url: string,
  fetchImpl: FetchLike,
  read: (response: Response) => Promise<Fetched<T>>,
): Promise<Fetched<T>> {
  try {
    const init = { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: "error" } as const;
    const response = await fetchImpl(url, init);
    if (!response.ok) {
      await discardBody(response);
      return { ok: false, message: `PHP's server answered HTTP ${response.status}.` };
    }
    return await read(response);
  } catch (error) {
    const message = isTimeout(error)
      ? "PHP's server did not answer in time."
      : "Could not reach PHP's server.";
    return { ok: false, message };
  }
}

/** The Content-Length header as a number, or undefined when it is absent or not a whole number. */
function contentLength(response: Response): number | undefined {
  const text = response.headers.get("content-length");
  return text !== null && /^\d+$/.test(text) ? Number(text) : undefined;
}

/** True when the body was compressed in transit, so Content-Length counts the compressed bytes. */
function isEncoded(response: Response): boolean {
  const encoding = response.headers.get("content-encoding")?.trim().toLowerCase();
  return encoding !== undefined && encoding !== "" && encoding !== "identity";
}

function joinPieces(pieces: readonly Uint8Array[], length: number): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const piece of pieces) {
    joined.set(piece, offset);
    offset += piece.byteLength;
  }
  return joined;
}

/**
 * Reads the whole body, or gives it up and returns undefined as soon as it is longer than
 * `LIBRARY_MAX_BODY_BYTES`. This holds when the answer has no Content-Length, or a wrong one.
 */
async function readBodyWithinLimit(
  response: Response,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const pieces: Uint8Array[] = [];
  let length = 0;
  for (let piece = await reader.read(); !piece.done; piece = await reader.read()) {
    length += piece.value.byteLength;
    if (length > LIBRARY_MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    pieces.push(piece.value);
  }
  return joinPieces(pieces, length);
}

async function readIndexText(response: Response): Promise<Fetched<string>> {
  const announced = contentLength(response);
  if (announced !== undefined && announced > LIBRARY_MAX_BODY_BYTES) {
    await discardBody(response);
    return { ok: false, message: INDEX_TOO_LARGE };
  }
  const bytes = await readBodyWithinLimit(response);
  if (bytes === undefined) return { ok: false, message: INDEX_TOO_LARGE };
  return { ok: true, value: new TextDecoder().decode(bytes) };
}

function wrongSizeMessage(sent: number | string): string {
  return `PHP's server sent ${sent} bytes. Expected ${LIBRARY_TUNE_FILE_SIZE} bytes.`;
}

async function readTuneBytes(response: Response): Promise<Fetched<Uint8Array<ArrayBuffer>>> {
  const announced = isEncoded(response) ? undefined : contentLength(response);
  if (announced !== undefined && announced !== LIBRARY_TUNE_FILE_SIZE) {
    await discardBody(response);
    return { ok: false, message: wrongSizeMessage(announced) };
  }
  const bytes = await readBodyWithinLimit(response);
  if (bytes === undefined) {
    return { ok: false, message: wrongSizeMessage(`more than ${LIBRARY_MAX_BODY_BYTES}`) };
  }
  return { ok: true, value: bytes };
}

function notFound(): LibraryTuneFileResult {
  return { ok: false, reason: "not-found", message: "No such tune in the PHP library." };
}

function upstreamFailed(message: string): LibraryTuneFileResult {
  return { ok: false, reason: "upstream-failed", message };
}

function checkSize(fileName: string, bytes: Uint8Array<ArrayBuffer>): LibraryTuneFileResult {
  if (bytes.length === LIBRARY_TUNE_FILE_SIZE) return { ok: true, fileName, bytes };
  return upstreamFailed(wrongSizeMessage(bytes.length));
}

/** Fetches PHP's index and lists its TDE1 tunes. Every failure becomes `ok: false`. */
export async function loadLibraryTunes(fetchImpl: FetchLike): Promise<LibraryTunesResult> {
  const sourceUrl = PHP_LIBRARY_INDEX_URL;
  const index = await request(sourceUrl, fetchImpl, readIndexText);
  if (!index.ok) return { ok: false, message: index.message, sourceUrl };
  const tunes = parseLibraryIndex(index.value);
  if (tunes.length === 0) {
    return { ok: false, message: "PHP's tune library lists no TDE1 tunes.", sourceUrl };
  }
  return { ok: true, tunes, sourceUrl };
}

/**
 * Fetches one tune file from PHP. Only a name that has the library's file name shape and is in
 * the current index is fetched, and only from the URL built for it, never from user input.
 */
export async function loadLibraryTuneFile(
  fileName: string,
  source: LibrarySource,
): Promise<LibraryTuneFileResult> {
  if (!isLibraryFileName(fileName)) return notFound();
  const library = await source.getTunes();
  if (!library.ok) return upstreamFailed(library.message);
  if (!library.tunes.some((tune) => tune.fileName === fileName)) return notFound();
  const file = await request(libraryTuneUrl(fileName), source.fetchImpl, readTuneBytes);
  return file.ok ? checkSize(fileName, file.value) : upstreamFailed(file.message);
}
