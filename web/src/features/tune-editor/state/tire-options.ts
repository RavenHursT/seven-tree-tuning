import {
  formatTireSize,
  STOCK_TIRE,
  TIRE_CHART,
  tireSizeFromParts,
  tireSizeParts,
  type TireChartEntry,
} from "@seven-tree/hydra";

import type { TireSizeOption, TireSizeParts, TireSizeValue } from "../components/tire-size-fields";

const FACTORY_GROUP = "Factory";

function isFactorySize(entry: TireChartEntry): boolean {
  return formatTireSize(entry.tire) === formatTireSize(STOCK_TIRE);
}

function toOption(entry: TireChartEntry): TireSizeOption {
  return {
    id: entry.id,
    label: entry.label,
    group: isFactorySize(entry) ? FACTORY_GROUP : `${entry.tire.rimDiameterIn} in rims`,
    ...(entry.note === undefined ? {} : { note: entry.note }),
    value: entry.tire,
  };
}

/** The sizes the tire list offers: the tire chart in its order, grouped by rim diameter. */
export function selectTireSizeOptions(): TireSizeOption[] {
  return TIRE_CHART.map(toOption);
}

/** The Width, Height and Rim numbers of a size: "315", "75", "16" or "12.50", "35", "17". */
export function tireSizeValueParts(value: TireSizeValue): TireSizeParts {
  return tireSizeParts(value);
}

/** Reads the Width, Height and Rim numbers, metric or flotation. Undefined when not a size. */
export function tireSizeValueFromParts(parts: TireSizeParts): TireSizeValue | undefined {
  return tireSizeFromParts(parts);
}

/** The text of a size: "315/75R16" for a metric size, "35x12.50R17" for a flotation size. */
export function formatTireSizeValue(value: TireSizeValue): string {
  return formatTireSize(value);
}
