import type { ContainerFormat } from "./codec";

const FORMATS: readonly ContainerFormat[] = ["hcf", "efu", "bin"];
/**
 * The text after the last dot. A dot in a folder name gives text that contains "/" or "\",
 * which matches no format.
 */
const EXTENSION_PATTERN = /\.([^.]+)$/;

/**
 * Finds the file format from the extension of a file name or path. The comparison ignores case.
 * @returns "hcf", "efu" or "bin", or undefined for any other or missing extension.
 */
export function containerFormatFromFileName(fileName: string): ContainerFormat | undefined {
  const extension = EXTENSION_PATTERN.exec(fileName)?.[1]?.toLowerCase();
  return FORMATS.find((format) => format === extension);
}
