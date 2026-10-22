import { mphToSpeedRaw, speedRawToMph } from "./units";

const MM_PER_INCH = 25.4;

/** A metric tire size such as 315/75R16. */
export interface MetricTireSize {
  readonly kind: "metric";
  /** Section width in millimetres. */
  readonly widthMm: number;
  /** Sidewall height as a percentage of the width. */
  readonly aspectRatio: number;
  /** Wheel diameter in inches. */
  readonly rimDiameterIn: number;
}

/** A flotation tire size such as 35x12.50R17. It names the overall diameter. */
export interface FlotationTireSize {
  readonly kind: "flotation";
  /** Overall diameter in inches, as written on the tire. */
  readonly diameterIn: number;
  /** Section width in inches. */
  readonly widthIn: number;
  /** Wheel diameter in inches. */
  readonly rimDiameterIn: number;
}

export type TireSize = MetricTireSize | FlotationTireSize;

/** One size in the list the editor offers. */
export interface TireChartEntry {
  readonly id: string;
  /** Size as printed on a tire, for example "LT235/85R16" or "35x12.50R17". */
  readonly label: string;
  readonly tire: TireSize;
  readonly note?: string;
}

/** The 1996 F-350 factory size, LT235/85R16, 31.7283 in. The calibration tire the editor assumes. */
export const STOCK_TIRE: MetricTireSize = {
  kind: "metric",
  widthMm: 235,
  aspectRatio: 85,
  rimDiameterIn: 16,
};

type Limit = readonly [smallest: number, largest: number];

/**
 * The smallest and largest value of each part of a tire size that `parseTireSize` accepts, as
 * [smallest, largest], both included, for each kind of size. A size outside them is not a real
 * tire. The text pattern reads a metric aspect ratio of two digits, so 99 is the largest it can
 * see.
 */
export const TIRE_SIZE_LIMITS: {
  readonly metric: {
    readonly widthMm: Limit;
    readonly aspectRatio: Limit;
    readonly rimDiameterIn: Limit;
  };
  readonly flotation: {
    readonly diameterIn: Limit;
    readonly widthIn: Limit;
    readonly rimDiameterIn: Limit;
  };
} = {
  metric: {
    widthMm: [100, 500],
    aspectRatio: [20, 100],
    rimDiameterIn: [8, 40],
  },
  flotation: {
    diameterIn: [20, 60],
    widthIn: [3, 25],
    rimDiameterIn: [8, 40],
  },
};

const METRIC_PATTERN =
  /^\s*[A-Za-z]{0,2}\s*(\d{3})\s*\/\s*(\d{2})\s*(?:[Zz]?[Rr]|-)\s*(\d{2}(?:\.\d)?)(?=$|[\sA-Za-z])/;

const FLOTATION_PATTERN =
  /^\s*[A-Za-z]{0,2}\s*(\d{2}(?:\.\d{1,2})?)\s*[xX]\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:[Rr]|-)\s*(\d{2}(?:\.\d)?)(?=$|[\sA-Za-z])/;

function isWithin(value: number, [smallest, largest]: Limit): boolean {
  return value >= smallest && value <= largest;
}

function isPlausible(tire: TireSize): boolean {
  if (tire.kind === "flotation") {
    const limits = TIRE_SIZE_LIMITS.flotation;
    return (
      isWithin(tire.diameterIn, limits.diameterIn) &&
      isWithin(tire.widthIn, limits.widthIn) &&
      isWithin(tire.rimDiameterIn, limits.rimDiameterIn)
    );
  }
  const limits = TIRE_SIZE_LIMITS.metric;
  return (
    isWithin(tire.widthMm, limits.widthMm) &&
    isWithin(tire.aspectRatio, limits.aspectRatio) &&
    isWithin(tire.rimDiameterIn, limits.rimDiameterIn)
  );
}

function readMetric(text: string): MetricTireSize | undefined {
  const match = METRIC_PATTERN.exec(text);
  if (!match) return undefined;
  const [, width, aspect, rim] = match;
  return {
    kind: "metric",
    widthMm: Number(width),
    aspectRatio: Number(aspect),
    rimDiameterIn: Number(rim),
  };
}

function readFlotation(text: string): FlotationTireSize | undefined {
  const match = FLOTATION_PATTERN.exec(text);
  if (!match) return undefined;
  const [, diameter, width, rim] = match;
  return {
    kind: "flotation",
    diameterIn: Number(diameter),
    widthIn: Number(width),
    rimDiameterIn: Number(rim),
  };
}

/**
 * Reads a metric size such as "LT235/85R16", "315/75R16", "P265/70R17", "lt 235/85 r16",
 * "315/75R16 127/124Q" or "315/75-16", or a flotation size such as "35x12.50R17", "35X12.5R17",
 * "35x12.50-17" or "LT35x12.50R17LT". Text after the rim size is ignored when it starts with a
 * space or a letter. Returns undefined for anything else, and for sizes outside
 * `TIRE_SIZE_LIMITS`.
 */
export function parseTireSize(text: string): TireSize | undefined {
  const tire = readMetric(text) ?? readFlotation(text);
  return tire && isPlausible(tire) ? tire : undefined;
}

/** "31" stays "31" and "12.5" becomes "12.50": a whole width has no decimals, any other has two. */
function formatWidthIn(widthIn: number): string {
  return Number.isInteger(widthIn) ? String(widthIn) : widthIn.toFixed(2);
}

/**
 * "235/85R16" for a metric size (width, aspect ratio and rim, with no type prefix), and
 * "35x12.50R17" for a flotation size (diameter as written, width, rim).
 */
export function formatTireSize(tire: TireSize): string {
  if (tire.kind === "flotation") {
    return `${tire.diameterIn}x${formatWidthIn(tire.widthIn)}R${tire.rimDiameterIn}`;
  }
  return `${tire.widthMm}/${tire.aspectRatio}R${tire.rimDiameterIn}`;
}

/**
 * Overall diameter in inches. A metric size gives rim + 2 x width x aspect / 100 / 25.4. A
 * flotation size gives the diameter its name states.
 */
export function tireDiameterIn(tire: TireSize): number {
  if (tire.kind === "flotation") return tire.diameterIn;
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
