"use client";

import type * as React from "react";

import { CollapsibleModule } from "@/components/layout/collapsible-module";

import { TuneSourcePanel } from "../components/tune-source-panel";
import type { LoadedTune } from "../state/loaded-tune";
import { FORMAT_LABELS, summarizeBaseTune } from "../state/module-summaries";
import { useTuneEditor } from "../tune-editor-provider";

export interface BaseTuneModuleProps {
  /** The content of the upload tab. */
  upload: React.ReactNode;
  /** The content of the PHP public library tab. The page renders the list on the server. */
  library: React.ReactNode;
}

/** Where the person picks the tune to edit: a file to upload, or a tune from PHP's library. */
export function BaseTuneModule({ upload, library }: BaseTuneModuleProps) {
  const { state } = useTuneEditor();

  return (
    <CollapsibleModule id="base-tune" title="Base Tune" summary={summarizeBaseTune(state)}>
      <TuneSourcePanel upload={upload} library={library} />
      <OpenTune tune={state.tune} />
    </CollapsibleModule>
  );
}

/**
 * "Editing <file> · <format>" below both tabs, so it names the open tune whichever tab is shown.
 * The live region is there before a tune loads, so a screen reader announces the load.
 */
function OpenTune({ tune }: { tune: LoadedTune | null }) {
  return (
    <div aria-live="polite">
      {tune && (
        <p className="mt-3 text-sm">
          Editing <span className="font-semibold">{tune.source.fileName}</span>
          {` · ${FORMAT_LABELS[tune.source.format]}`}
        </p>
      )}
    </div>
  );
}
