import { mphToSpeedRaw, speedRawToMph } from "./units";

const MM_PER_INCH = 25.4;

/** A metric tire size such as 315/75R16. */
export interface TireSize {
  /** Section width in millimetres. */
  readonly widthMm: number;
  /** Sidewall height as a percentage of the width. */
  readonly aspectRatio: number;
  /** Wheel diameter in inches. */
  readonly rimDiameterIn: number;
}

export interface TirePreset {
  readonly id: string;
  /** Size as printed on a tire, for example "LT235/85R16". */
  readonly label: string;
  readonly tire: TireSize;
  readonly note?: string;
}

/** The 1996 F-350 factory size, LT235/85R16, 31.7283 in. The calibration tire the editor assumes. */
export const STOCK_TIRE: TireSize = { widthMm: 235, aspectRatio: 85, rimDiameterIn: 16 };

export const TIRE_PRESETS: readonly TirePreset[] = [
  { id: "lt235-85r16", label: "LT235/85R16", tire: STOCK_TIRE, note: "1996 F-350 factory size" },
  {
    id: "lt265-75r16",
    label: "LT265/75R16",
    tire: { widthMm: 265, aspectRatio: 75, rimDiameterIn: 16 },
    note: "reference size the shipped -TIRECOMP-UPDOWN tunes used",
  },
  {
    id: "285-75r16",
    label: "285/75R16",
    tire: { widthMm: 285, aspectRatio: 75, rimDiameterIn: 16 },
  },
  {
    id: "315-75r16",
    label: "315/75R16",
    tire: { widthMm: 315, aspectRatio: 75, rimDiameterIn: 16 },
    note: "34.6 in, this truck",
  },
];

/**
 * The smallest and largest value of each part of a tire size that `parseTireSize` accepts, as
 * [smallest, largest], both included. A size outside them is not a real tire. The text pattern
 * reads an aspect ratio of two digits, so 99 is the largest it can see.
 */
export const TIRE_SIZE_LIMITS: {
  readonly widthMm: readonly [number, number];
  readonly aspectRatio: readonly [number, number];
  readonly rimDiameterIn: readonly [number, number];
} = {
  widthMm: [100, 500],
  aspectRatio: [20, 100],
  rimDiameterIn: [8, 40],
};

const TIRE_PATTERN =
  /^\s*[A-Za-z]{0,2}\s*(\d{3})\s*\/\s*(\d{2})\s*(?:[Zz]?[Rr]|-)\s*(\d{2}(?:\.\d)?)(?=$|[\sA-Za-z])/;

function isWithin(value: number, [smallest, largest]: readonly [number, number]): boolean {
  return value >= smallest && value <= largest;
}

function isPlausible(tire: TireSize): boolean {
  return (
    isWithin(tire.widthMm, TIRE_SIZE_LIMITS.widthMm) &&
    isWithin(tire.aspectRatio, TIRE_SIZE_LIMITS.aspectRatio) &&
    isWithin(tire.rimDiameterIn, TIRE_SIZE_LIMITS.rimDiameterIn)
  );
}

/**
 * Reads a tire size such as "LT235/85R16", "315/75R16", "P265/70R17", "lt 235/85 r16",
 * "315/75R16 127/124Q" or "315/75-16". Text after the rim size is ignored when it starts with a
 * space or a letter. Returns undefined for anything else, and for sizes outside
 * `TIRE_SIZE_LIMITS` (width under 100 or over 500 mm, aspect under 20 or over 100, rim under 8 or
 * over 40 inches).
 */
export function parseTireSize(text: string): TireSize | undefined {
  const match = TIRE_PATTERN.exec(text);
  if (!match) return undefined;
  const [, width, aspect, rim] = match;
  const tire = {
    widthMm: Number(width),
    aspectRatio: Number(aspect),
    rimDiameterIn: Number(rim),
  };
  return isPlausible(tire) ? tire : undefined;
}

/** "235/85R16": width, aspect ratio and rim, with no type prefix. */
export function formatTireSize(tire: TireSize): string {
  return `${tire.widthMm}/${tire.aspectRatio}R${tire.rimDiameterIn}`;
}

/** Overall diameter in inches: rim + 2 x width x aspect / 100 / 25.4. */
export function tireDiameterIn(tire: TireSize): number {
  return tire.rimDiameterIn + (2 * tire.widthMm * tire.aspectRatio) / 100 / MM_PER_INCH;
}

/**
 * Fitted diameter over calibration diameter. The PCM computes speed for the calibration tire, so
 * on the fitted tires true road speed (what a speedometer calibrated for them reads) is the
 * stored mph times this factor.
 */
export function speedometerFactor(fitted: TireSize, calibration: TireSize): number {
  return tireDiameterIn(fitted) / tireDiameterIn(calibration);
}

/**
 * Calibration diameter over fitted diameter: what to multiply stored shift speeds by so each
 * shift lands at the same road speed on the fitted tires. 315/75R16 against LT265/75R16 gives
 * 0.9147, the factor of the shipped -TIRECOMP-UPDOWN tunes.
 */
export function tireCompensationFactor(fitted: TireSize, calibration: TireSize): number {
  return tireDiameterIn(calibration) / tireDiameterIn(fitted);
}

/** Stored shift speed byte (mph x 2) to speedometer mph: raw / 2 x factor. */
export function shiftPointToSpeedoMph(speedRaw: number, factor: number): number {
  return speedRawToMph(speedRaw) * factor;
}

/** Speedometer mph to the nearest shift speed byte, clamped to 0..255: round(mph / factor x 2). */
export function speedoMphToShiftPointRaw(speedoMph: number, factor: number): number {
  return mphToSpeedRaw(speedoMph / factor);
}
