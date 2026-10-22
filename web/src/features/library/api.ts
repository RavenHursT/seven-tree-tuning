// What the download route and the code that calls it agree on. This file imports nothing, so a
// client component can use it without pulling server code into the browser bundle.

/** The path of the route that downloads one tune file from PHP's library. */
export function libraryTuneApiPath(fileName: string): string {
  return `/api/library/${encodeURIComponent(fileName)}`;
}

/** The JSON body the route sends with every error status. */
export interface LibraryApiError {
  readonly error: string;
}

/**
 * The message in the body of an error answer from the route, or undefined when the body is not a
 * `LibraryApiError` or its message is empty.
 */
export function readLibraryApiError(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("error" in body)) return undefined;
  const { error } = body;
  return typeof error === "string" && error.trim() !== "" ? error : undefined;
}
