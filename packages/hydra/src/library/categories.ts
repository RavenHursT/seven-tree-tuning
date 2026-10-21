/** Group a library tune belongs to in the tune picker. */
export type LibraryCategory = "stock" | "towing" | "daily" | "performance" | "utility";

/** Display name of each category. */
export const LIBRARY_CATEGORY_LABELS: Readonly<Record<LibraryCategory, string>> = Object.freeze({
  stock: "Stock & diagnostic",
  towing: "Towing",
  daily: "Daily driving",
  performance: "Performance",
  utility: "Utility",
});

/** Categories in the order the picker shows them. */
export const LIBRARY_CATEGORY_ORDER: readonly LibraryCategory[] = Object.freeze([
  "stock",
  "towing",
  "daily",
  "performance",
  "utility",
] as const);
