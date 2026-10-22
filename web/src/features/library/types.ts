import type { LibraryTune } from "@seven-tree/hydra";

/** The part of `fetch` this feature uses. Tests pass a fake. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** PHP's list of TDE1 tunes, or the reason it could not be loaded. Loading never throws. */
export type LibraryTunesResult =
  | { ok: true; tunes: LibraryTune[]; sourceUrl: string }
  | { ok: false; message: string; sourceUrl: string };

/** `not-found`: no such tune in the library. `upstream-failed`: PHP did not give a usable answer. */
export type LibraryTuneFailure = "not-found" | "upstream-failed";

/** The bytes of one .efu file from PHP, or the reason they could not be returned. */
export type LibraryTuneFileResult =
  | { ok: true; fileName: string; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; reason: LibraryTuneFailure; message: string };
