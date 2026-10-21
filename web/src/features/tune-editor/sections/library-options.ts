import { LIBRARY_CATEGORY_LABELS, type LibraryTune } from "@seven-tree/hydra";

import type { LibraryTuneOption } from "../components/library-tune-picker";

/** The picker's view of one PHP library tune. */
export function toLibraryTuneOption(tune: LibraryTune): LibraryTuneOption {
  return {
    fileName: tune.fileName,
    code: tune.code,
    label: tune.label,
    ...(tune.description ? { description: tune.description } : {}),
    category: tune.category,
    categoryLabel: LIBRARY_CATEGORY_LABELS[tune.category],
    valveBody: tune.valveBody,
  };
}
