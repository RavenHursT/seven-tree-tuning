import type { LibraryApiError } from "./api";
import type { LibraryTuneFailure, LibraryTuneFileResult } from "./types";

const FILE_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

const STATUS_BY_FAILURE: Readonly<Record<LibraryTuneFailure, number>> = {
  "not-found": 404,
  "upstream-failed": 502,
};

/**
 * Turns a tune file result into the HTTP answer of the download route: the bytes with caching
 * headers, or a short JSON error that no cache keeps.
 */
export function libraryTuneResponse(result: LibraryTuneFileResult): Response {
  if (!result.ok) {
    const body: LibraryApiError = { error: result.message };
    return Response.json(body, {
      status: STATUS_BY_FAILURE[result.reason],
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(result.bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(result.bytes.byteLength),
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": FILE_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
