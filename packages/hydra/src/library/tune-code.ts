import type { LibraryCategory } from "./categories";
import { LIBRARY_MODES, VALVE_BODY_NOTE } from "./modes";
import type { LibraryModeDefinition } from "./modes";

/** One tune in PHP's public library. */
export interface LibraryTune {
  readonly fileName: string;
  /** File name without the calibration prefix and the .efu extension, such as "65T". */
  readonly code: string;
  /** Horsepower over stock. */
  readonly horsepower: number;
  /** Mode letters, such as "T" or "HI". */
  readonly mode: string;
  readonly modeName: string;
  /** True for the VB variant, made for a transmission with a modified valve body. */
  readonly valveBody: boolean;
  /** Number after the mode letters: idle rpm for High Idle, mph for Valet Mode. */
  readonly parameter?: number;
  readonly category: LibraryCategory;
  readonly label: string;
  readonly description?: string;
}

/** The parts of a tune that come from its code alone. */
export type LibraryTuneDetails = Omit<LibraryTune, "fileName" | "code">;

interface CodeParts {
  readonly horsepower: number;
  readonly mode: string;
  readonly valveBody: boolean;
  readonly parameter?: number;
}

interface LabelParts {
  readonly modeName: string;
  readonly horsepower: number;
  readonly valveBody: boolean;
  readonly parameter?: number;
  readonly parameterUnit?: string;
}

const CODE_PATTERN = /^(\d+)([A-Z]+?)(VB)?(\d+)?$/;
const VALVE_BODY_LABEL_SUFFIX = " · valve body";

function splitCode(code: string): CodeParts | undefined {
  const match = CODE_PATTERN.exec(code);
  if (!match) return undefined;
  const [, horsepowerText, mode, valveBodyText, parameterText] = match;
  const horsepower = Number(horsepowerText);
  const parameter = parameterText === undefined ? undefined : Number(parameterText);
  const numbersAreExact =
    Number.isSafeInteger(horsepower) &&
    (parameter === undefined || Number.isSafeInteger(parameter));
  if (!numbersAreExact) return undefined;
  return { horsepower, mode: mode ?? "", valveBody: valveBodyText !== undefined, parameter };
}

function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function buildLabel(parts: LabelParts): string {
  const { modeName, horsepower, valveBody, parameter, parameterUnit } = parts;
  const words = [modeName];
  if (parameter !== undefined) {
    const number = formatNumber(parameter);
    words.push(parameterUnit === undefined ? number : `${number} ${parameterUnit}`);
  }
  if (horsepower > 0) words.push(`+${horsepower} hp`);
  return words.join(" ") + (valveBody ? VALVE_BODY_LABEL_SUFFIX : "");
}

function buildDescription(
  definition: LibraryModeDefinition | undefined,
  horsepower: number,
  valveBody: boolean,
): string | undefined {
  const sentences = [
    definition?.descriptionByHorsepower?.get(horsepower) ?? definition?.description,
    valveBody ? VALVE_BODY_NOTE : undefined,
  ].filter((sentence): sentence is string => sentence !== undefined);
  return sentences.length > 0 ? sentences.join(". ") : undefined;
}

/**
 * Reads a PHP tune code: horsepower over stock, mode letters, an optional VB flag, an optional
 * number. Returns undefined when the code does not have that shape. Mode letters that are not
 * known still parse, as a utility tune named by its letters.
 */
export function parseLibraryTuneCode(code: string): LibraryTuneDetails | undefined {
  const parts = splitCode(code);
  if (parts === undefined) return undefined;
  const { horsepower, mode, valveBody, parameter } = parts;
  const definition = LIBRARY_MODES.get(mode);
  const modeName = definition?.name ?? mode;
  const description = buildDescription(definition, horsepower, valveBody);
  const parameterUnit = definition?.parameterUnit;
  return {
    horsepower,
    mode,
    modeName,
    valveBody,
    ...(parameter !== undefined && { parameter }),
    category: definition?.category ?? "utility",
    label: buildLabel({ modeName, horsepower, valveBody, parameter, parameterUnit }),
    ...(description !== undefined && { description }),
  };
}
