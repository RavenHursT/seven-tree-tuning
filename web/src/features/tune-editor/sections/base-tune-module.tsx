"use client";

import type * as React from "react";

import { CollapsibleModule } from "@/components/layout/collapsible-module";

import { ChipSerialField } from "../components/chip-serial-field";
import { TuneSourcePanel } from "../components/tune-source-panel";
import { selectChipSerialError } from "../state/editor-selectors";
import type { LoadedTune } from "../state/loaded-tune";
import { FORMAT_LABELS, summarizeBaseTune } from "../state/module-summaries";
import { useTuneEditor } from "../tune-editor-provider";

/** On the library tab the serial is needed only to save, so its description says that first. */
const LIBRARY_SERIAL_DESCRIPTION =
  "Generate Tune needs it to write the .hcf for your chip: the first 8 characters of the chip's USB serial. HydraFlash shows it in its status bar. It never leaves this browser.";

export interface BaseTuneModuleProps {
  /** The content of the upload tab. */
  upload: React.ReactNode;
  /** The content of the PHP public library tab. The page renders the list on the server. */
  library: React.ReactNode;
}

/**
 * Where the person picks the tune to edit: a file to upload, or a tune from PHP's library.
 * The upload tab starts with the chip serial, because a .hcf opens only with it. A PHP library
 * .efu opens without it, so the library tab asks for it only once a PHP tune is open: Generate
 * Tune always writes a .hcf, and a .hcf is encrypted with the serial.
 */
export function BaseTuneModule({ upload, library }: BaseTuneModuleProps) {
  const { state } = useTuneEditor();
  const libraryTuneOpen = state.tune?.source.kind === "library";

  return (
    <CollapsibleModule id="base-tune" title="Base Tune" summary={summarizeBaseTune(state)}>
      <TuneSourcePanel
        upload={
          <div className="space-y-4">
            <ChipSerial />
            {upload}
          </div>
        }
        library={
          <div className="space-y-4">
            {library}
            {libraryTuneOpen ? <ChipSerial description={LIBRARY_SERIAL_DESCRIPTION} /> : null}
          </div>
        }
      />
      <OpenTune tune={state.tune} />
    </CollapsibleModule>
  );
}

/** The chip serial field. Only one tab is rendered at a time, so its id stays unique. */
function ChipSerial({ description }: { description?: string }) {
  const { state, setChipSerial } = useTuneEditor();

  return (
    <ChipSerialField
      id="chip-serial"
      value={state.chipSerial}
      onChange={setChipSerial}
      error={selectChipSerialError(state.chipSerial)}
      description={description}
    />
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
