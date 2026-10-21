/** Folder on Power Hungry Performance's site that holds the public calibration files. */
export const PHP_LIBRARY_BASE_URL = "https://local.gopowerhungry.com/hydra/downloads/_cal256k/";

/** Plain-text index of every file in the folder, one file name per line. */
export const PHP_LIBRARY_INDEX_URL = `${PHP_LIBRARY_BASE_URL}_all_files_v1.txt`;

/** File name prefix of the TDE1 calibration (row VCAB0_02 of PHP's Cal_Lib.csv). */
export const TDE1_LIBRARY_PREFIX = "VCAB0_02_";

/** Extension of the calibration files in the folder. */
export const LIBRARY_FILE_EXTENSION = ".efu";

const CODE_CHARACTERS = /^[0-9A-Z]+$/;

/**
 * True when `value` is exactly `<prefix><code>.efu`, where the code is digits and capital
 * letters. Nothing else passes, so a passing name cannot contain a path, a query or a host.
 */
export function isLibraryFileName(value: string, prefix: string = TDE1_LIBRARY_PREFIX): boolean {
  if (typeof value !== "string") return false;
  if (!value.startsWith(prefix) || !value.endsWith(LIBRARY_FILE_EXTENSION)) return false;
  const code = value.slice(prefix.length, value.length - LIBRARY_FILE_EXTENSION.length);
  return CODE_CHARACTERS.test(code);
}

/** URL of one TDE1 tune file in PHP's folder. Throws a RangeError for any other name. */
export function libraryTuneUrl(fileName: string): string {
  if (!isLibraryFileName(fileName)) {
    throw new RangeError(`not a PHP library file name: ${JSON.stringify(fileName)}`);
  }
  return `${PHP_LIBRARY_BASE_URL}${fileName}`;
}
