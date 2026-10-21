import {
  PHP_LIBRARY_INDEX_URL,
  isLibraryFileName,
  libraryTuneUrl,
  parseLibraryIndex,
} from "@seven-tree/hydra";

import type { FetchLike, LibraryTuneFileResult, LibraryTunesResult } from "./types";

/** Size in bytes of every .efu file in PHP's folder. */
export const LIBRARY_TUNE_FILE_SIZE = 262_152;

const REQUEST_TIMEOUT_MS = 15_000;

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

async function request<T>(
  url: string,
  fetchImpl: FetchLike,
  read: (response: Response) => Promise<T>,
): Promise<Fetched<T>> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      return { ok: false, message: `PHP's server answered HTTP ${response.status}.` };
    }
    return { ok: true, value: await read(response) };
  } catch (error) {
    const message = isTimeout(error)
      ? "PHP's server did not answer in time."
      : "Could not reach PHP's server.";
    return { ok: false, message };
  }
}

async function readBytes(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await response.arrayBuffer());
}

function notFound(): LibraryTuneFileResult {
  return { ok: false, reason: "not-found", message: "No such tune in the PHP library." };
}

function upstreamFailed(message: string): LibraryTuneFileResult {
  return { ok: false, reason: "upstream-failed", message };
}

function checkSize(fileName: string, bytes: Uint8Array<ArrayBuffer>): LibraryTuneFileResult {
  if (bytes.length === LIBRARY_TUNE_FILE_SIZE) return { ok: true, fileName, bytes };
  return upstreamFailed(
    `PHP's server sent ${bytes.length} bytes. Expected ${LIBRARY_TUNE_FILE_SIZE} bytes.`,
  );
}

/** Fetches PHP's index and lists its TDE1 tunes. Every failure becomes `ok: false`. */
export async function loadLibraryTunes(fetchImpl: FetchLike): Promise<LibraryTunesResult> {
  const sourceUrl = PHP_LIBRARY_INDEX_URL;
  const index = await request(sourceUrl, fetchImpl, (response) => response.text());
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
  const file = await request(libraryTuneUrl(fileName), source.fetchImpl, readBytes);
  return file.ok ? checkSize(fileName, file.value) : upstreamFailed(file.message);
}
