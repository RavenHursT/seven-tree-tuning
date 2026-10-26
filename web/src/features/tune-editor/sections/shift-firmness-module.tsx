"use client";

import { GaugeIcon } from "@phosphor-icons/react";

import { CollapsibleModule } from "@/components/layout/collapsible-module";

import { FirmnessCurveTable } from "../components/firmness-curve-table";
import { HelpPopover } from "../components/help-popover";
import { NoTuneNotice } from "../components/no-tune-notice";
import { selectFirmnessTables } from "../state/transmission-selectors";
import { summarizeShiftFirmness } from "../state/transmission-summaries";
import { useTuneEditor } from "../tune-editor-provider";

const FIRMNESS_HELP =
  "Each value is a line-pressure adder (PCM units) that the PCM adds to the line-pressure request during that upshift, for each accelerator pedal position. Higher is a firmer shift. The units are internal to the PCM, so the tune shows the stored signed value as it is.";

/** The line-pressure adder of the 1→2, 2→3 and 3→4 upshifts. */
export function ShiftFirmnessModule() {
  const { state } = useTuneEditor();

  return (
    <CollapsibleModule
      id="shift-firmness"
      title="Shift firmness"
      headingAction={
        <HelpPopover label="About shift firmness">
          <p>{FIRMNESS_HELP}</p>
        </HelpPopover>
      }
      summary={summarizeShiftFirmness(state)}
    >
      {state.tune ? (
        <ShiftFirmnessEditor />
      ) : (
        <NoTuneNotice
          icon={<GaugeIcon />}
          description="Upload a .hcf or pick a PHP library tune to see how firm each upshift is."
        />
      )}
    </CollapsibleModule>
  );
}

function ShiftFirmnessEditor() {
  const { state, dispatch } = useTuneEditor();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {selectFirmnessTables(state).map((table) => (
        <FirmnessCurveTable
          key={table.functionId}
          functionId={table.functionId}
          title={table.title}
          description="Line-pressure adder; higher is a firmer shift"
          min={table.min}
          max={table.max}
          rows={table.rows}
          onValueChange={(index, value) =>
            dispatch({ type: "epcValueChanged", functionId: table.functionId, index, value })
          }
          onReset={() => dispatch({ type: "functionReset", functionId: table.functionId })}
        />
      ))}
    </div>
  );
}
