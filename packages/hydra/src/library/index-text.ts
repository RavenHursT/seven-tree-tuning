import { LIBRARY_CATEGORY_ORDER } from "./categories";
import { LIBRARY_FILE_EXTENSION, TDE1_LIBRARY_PREFIX, isLibraryFileName } from "./locations";
import { LIBRARY_MODES } from "./modes";
import { parseLibraryTuneCode } from "./tune-code";
import type { LibraryTune } from "./tune-code";

const LINE_BREAK = /\r\n|\r|\n/;

function compareText(first: string, second: string): number {
  if (first < second) return -1;
  return first > second ? 1 : 0;
}

const MODE_ORDER = [...LIBRARY_MODES.keys()];

/** Known modes in the order PHP's Hydra page lists them; unknown modes after them. */
function modeRank(mode: string): number {
  const rank = MODE_ORDER.indexOf(mode);
  return rank === -1 ? MODE_ORDER.length : rank;
}

function compareTunes(first: LibraryTune, second: LibraryTune): number {
  return (
    LIBRARY_CATEGORY_ORDER.indexOf(first.category) -
      LIBRARY_CATEGORY_ORDER.indexOf(second.category) ||
    modeRank(first.mode) - modeRank(second.mode) ||
    first.horsepower - second.horsepower ||
    Number(first.valveBody) - Number(second.valveBody) ||
    compareText(first.code, second.code)
  );
}

function readFileName(fileName: string, prefix: string): LibraryTune | undefined {
  if (!isLibraryFileName(fileName, prefix)) return undefined;
  const code = fileName.slice(prefix.length, fileName.length - LIBRARY_FILE_EXTENSION.length);
  const details = parseLibraryTuneCode(code);
  return details === undefined ? undefined : { fileName, code, ...details };
}

/**
 * Reads PHP's index text (one file name per line, any line ending) into the tunes whose names
 * start with `prefix`. Other lines are ignored. Sorted by category, then mode in the order PHP's
 * Hydra page lists them, then horsepower, plain before VB, then code.
 */
export function parseLibraryIndex(
  indexText: string,
  prefix: string = TDE1_LIBRARY_PREFIX,
): LibraryTune[] {
  const tunes = new Map<string, LibraryTune>();
  for (const line of indexText.split(LINE_BREAK)) {
    const fileName = line.trim();
    const tune = readFileName(fileName, prefix);
    if (tune !== undefined) tunes.set(fileName, tune);
  }
  return [...tunes.values()].sort(compareTunes);
}
