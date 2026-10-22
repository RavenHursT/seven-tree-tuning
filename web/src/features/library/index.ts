import "server-only";

import { cacheLife } from "next/cache";

import { loadLibraryTuneFile, loadLibraryTunes } from "./library-source";
import type { LibraryTuneFileResult, LibraryTunesResult } from "./types";

export { libraryTuneResponse } from "./library-response";
export type { LibraryTuneFailure, LibraryTuneFileResult, LibraryTunesResult } from "./types";

/**
 * PHP's list of TDE1 tunes. Kept for a day while PHP answers and for a second when it does not,
 * so an outage is tried again soon. Never throws. Render it inside a Suspense boundary.
 */
export async function getLibraryTunes(): Promise<LibraryTunesResult> {
  "use cache";
  const result = await loadLibraryTunes(fetch);
  if (result.ok) {
    cacheLife("days");
  } else {
    cacheLife("seconds");
  }
  return result;
}

/**
 * Bytes of one tune file from PHP. Only a name in the current index is fetched. Never throws:
 * a name that is not in the library gives `not-found`, a PHP failure gives `upstream-failed`.
 */
export function fetchLibraryTuneFile(fileName: string): Promise<LibraryTuneFileResult> {
  return loadLibraryTuneFile(fileName, { getTunes: getLibraryTunes, fetchImpl: fetch });
}
