"use client";

import { LockSimpleIcon } from "@phosphor-icons/react";

import { CollapsibleModule } from "@/components/layout/collapsible-module";

import { HelpPopover } from "../components/help-popover";
import { LockupCurveTable } from "../components/lockup-curve-table";
import { NoTuneNotice } from "../components/no-tune-notice";
import { ShiftOverlapAlert } from "../components/shift-overlap-alert";
import { selectSpeedometerFactor } from "../state/editor-selectors";
import { selectLockupTables, selectLockupWarnings } from "../state/transmission-selectors";
import { summarizeConverterLockup } from "../state/transmission-summaries";
import { useTuneEditor } from "../tune-editor-provider";

const LOCKUP_HELP =
  "The torque converter locks in 2nd, 3rd and 4th gear at or above the lock speed and unlocks below the unlock speed, for each accelerator pedal position. Lock speed and Speedometer are the same value in two units, like shift points: the first is the speed stored in the tune, the second is the road speed on the tires entered. A lock speed of 127 mph is shown as never: the converter does not lock at that pedal position. For an unlock speed, the editor treats 127 mph as an ordinary speed. The exact PCM behavior at an unlock speed of 127 mph is not verified. Keep each unlock speed below its lock speed, or the converter locks and releases again and again. The editor warns when an unlock speed is at or above the lock speed.";

/** The converter lock and unlock speeds of 2nd, 3rd and 4th gear. */
export function ConverterLockupModule() {
  const { state } = useTuneEditor();

  return (
    <CollapsibleModule
      id="converter-lockup"
      title="Converter lockup"
      headingAction={
        <HelpPopover label="About converter lockup">
          <p>{LOCKUP_HELP}</p>
        </HelpPopover>
      }
      summary={summarizeConverterLockup(state)}
    >
      {state.tune ? (
        <ConverterLockupEditor />
      ) : (
        <NoTuneNotice
          icon={<LockSimpleIcon />}
          description="Upload a .hcf or pick a PHP library tune to see its converter lock and unlock speeds."
        />
      )}
    </CollapsibleModule>
  );
}

function ConverterLockupEditor() {
  const { state, dispatch } = useTuneEditor();
  // One stored step (0.5 mph in the tune) as it reads on the speedometer.
  const speedometerStep = 0.5 * selectSpeedometerFactor(state);

  return (
    <div className="flex flex-col gap-4">
      <ShiftOverlapAlert
        overlaps={selectLockupWarnings(state)}
        title="Possible converter cycling"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {selectLockupTables(state).map((table) => (
          <LockupCurveTable
            key={table.functionId}
            functionId={table.functionId}
            kind={table.kind}
            title={table.title}
            description={
              table.kind === "lock" ? "Locks at or above this speed" : "Unlocks below this speed"
            }
            speedLabel={`${table.kind} speed`}
            rows={table.rows}
            speedometerMaxMph={table.speedometerMaxMph}
            speedometerStep={speedometerStep}
            onSpeedChange={(index, mph) =>
              dispatch({ type: "lockupSpeedChanged", functionId: table.functionId, index, mph })
            }
            onSpeedoChange={(index, mph) =>
              dispatch({
                type: "lockupSpeedometerChanged",
                functionId: table.functionId,
                index,
                mph,
              })
            }
            onNever={(index) =>
              dispatch({ type: "lockupNeverSet", functionId: table.functionId, index })
            }
            onReset={() => dispatch({ type: "functionReset", functionId: table.functionId })}
          />
        ))}
      </div>
    </div>
  );
}
