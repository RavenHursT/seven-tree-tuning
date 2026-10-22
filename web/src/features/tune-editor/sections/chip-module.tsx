"use client";

import { CollapsibleModule } from "@/components/layout/collapsible-module";

import { ChipSerialField } from "../components/chip-serial-field";
import { selectChipSerialError } from "../state/editor-selectors";
import { summarizeChip } from "../state/module-summaries";
import { useTuneEditor } from "../tune-editor-provider";

/** The chip serial: the key that opens and builds .hcf files. */
export function ChipModule() {
  const { state, setChipSerial } = useTuneEditor();

  return (
    <CollapsibleModule id="chip" title="Chip" summary={summarizeChip(state)}>
      <ChipSerialField
        id="chip-serial"
        value={state.chipSerial}
        onChange={setChipSerial}
        error={selectChipSerialError(state.chipSerial)}
      />
    </CollapsibleModule>
  );
}
