"use client";

import { VALVE_BODY_NOTE } from "@seven-tree/hydra";

import { LibraryTunePicker, type LibraryTuneOption } from "../components/library-tune-picker";
import { useTuneEditor } from "../tune-editor-provider";

export interface LibrarySectionProps {
  tunes: readonly LibraryTuneOption[];
  sourceUrl: string;
}

export function LibrarySection({ tunes, sourceUrl }: LibrarySectionProps) {
  const { state, openLibraryTune } = useTuneEditor();
  const selected = state.tune?.source.kind === "library" ? state.tune.source.fileName : undefined;
  const loading = state.loading?.kind === "library" ? state.loading.fileName : undefined;

  return (
    <div className="space-y-2">
      <LibraryTunePicker
        tunes={tunes}
        selectedFileName={selected}
        loadingFileName={loading}
        onSelect={openLibraryTune}
        sourceUrl={sourceUrl}
        disabled={state.loading !== null}
      />
      <p className="text-xs text-muted-foreground">{`${VALVE_BODY_NOTE}.`}</p>
    </div>
  );
}
