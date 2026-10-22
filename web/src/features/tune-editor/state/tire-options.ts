import {
  formatTireSize,
  parseTireSize,
  STOCK_TIRE,
  TIRE_CHART,
  type TireChartEntry,
} from "@seven-tree/hydra";

import type { TireSizeOption, TireSizeValue } from "../components/tire-size-fields";

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

/** Reads the text of a size, metric or flotation. Returns undefined when it is not a size. */
export function parseTireSizeValue(text: string): TireSizeValue | undefined {
  return parseTireSize(text);
}

/** The text of a size: "315/75R16" for a metric size, "35x12.50R17" for a flotation size. */
export function formatTireSizeValue(value: TireSizeValue): string {
  return formatTireSize(value);
}
