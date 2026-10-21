import type { LibraryCategory } from "./categories";

/** What one group of mode letters in a PHP tune code means. */
export interface LibraryModeDefinition {
  readonly name: string;
  readonly category: LibraryCategory;
  /** Unit of the number after the mode letters, for modes that take one. */
  readonly parameterUnit?: string;
  readonly description?: string;
  /** Description that depends on the horsepower in the code, such as a tow load class. */
  readonly descriptionByHorsepower?: ReadonlyMap<number, string>;
}

const TOW_LOAD_CLASSES: ReadonlyMap<number, string> = new Map([
  [25, "Extremely heavy loads, 12,500+ lb"],
  [40, "Heavy loads, 10,000–12,500 lb"],
  [65, "Moderate loads, 7,500–10,000 lb"],
  [80, "Light loads, up to 7,500 lb"],
]);

/** Mode letters PHP documents on its Hydra page, plus Fuel Sipper from forum posts. */
export const LIBRARY_MODES: ReadonlyMap<string, LibraryModeDefinition> = new Map([
  ["S", { name: "Stock", category: "stock" }],
  ["MS", { name: "Modified Stock", category: "stock", description: "Diagnostic tune" }],
  ["T", { name: "Tow", category: "towing", descriptionByHorsepower: TOW_LOAD_CLASSES }],
  ["DD", { name: "Daily Driver", category: "daily" }],
  [
    "FS",
    {
      name: "Fuel Sipper",
      category: "daily",
      description: "Fuel Sipper is not on PHP's page. The name comes from Hydra users on forums",
    },
  ],
  ["P", { name: "Performance", category: "performance" }],
  ["R", { name: "Race", category: "performance" }],
  ["X", { name: "Extreme", category: "performance" }],
  ["HI", { name: "High Idle", category: "utility", parameterUnit: "rpm" }],
  ["AT", { name: "Anti-Theft Mode", category: "utility" }],
  ["WM", { name: "Whisper Mode", category: "utility", description: "Quiet drive-thru" }],
  ["VM", { name: "Valet Mode", category: "utility", parameterUnit: "mph" }],
  [
    "TD",
    { name: "Teen Driver", category: "utility", parameterUnit: "mph", description: "Speed limit" },
  ],
]);

/** Explains the VB suffix. PHP does not document it; the meaning comes from forum posts. */
export const VALVE_BODY_NOTE =
  "VB means a transmission with a modified valve body (softer shifts). " +
  "It is not on PHP's page. This comes from Hydra users on forums";
