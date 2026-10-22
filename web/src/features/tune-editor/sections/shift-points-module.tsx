"use client";

import { GearSixIcon } from "@phosphor-icons/react";

import { CollapsibleModule } from "@/components/layout/collapsible-module";

import { HelpPopover } from "../components/help-popover";
import { NoTuneNotice } from "../components/no-tune-notice";
import type { ShiftCurveTableProps } from "../components/shift-curve-table";
import { ShiftOverlapAlert } from "../components/shift-overlap-alert";
import { ShiftSchedule } from "../components/shift-schedule";
import {
  selectCurveTables,
  selectOverlapViews,
  selectSpeedometerFactor,
  type CurveTableView,
} from "../state/editor-selectors";
import { summarizeShiftPoints } from "../state/module-summaries";
import { useTuneEditor } from "../tune-editor-provider";

const SHIFT_POINTS_HELP =
  "Shift point is the speed stored in the tune; the PCM computes it for the calibration tire size. Speedometer is the road speed on the tires entered, which a speedometer calibrated for those tires shows. If the speedometer was not recalibrated for the tires, the dash shows the shift point instead. Editing either column updates the other.";

/** The six shift curves of the loaded tune, with a help button that explains the two columns. */
export function ShiftPointsModule() {
  const { state } = useTuneEditor();

  return (
    <CollapsibleModule
      id="shift-points"
      title="Shiftpoints"
      headingAction={
        <HelpPopover label="About shift points">
          <p>{SHIFT_POINTS_HELP}</p>
        </HelpPopover>
      }
      summary={summarizeShiftPoints(state)}
    >
      {state.tune ? (
        <ShiftScheduleEditor />
      ) : (
        <NoTuneNotice
          icon={<GearSixIcon />}
          description="Upload a .hcf or pick a PHP library tune to see its shift points and idle speed."
        />
      )}
    </CollapsibleModule>
  );
}

function ShiftScheduleEditor() {
  const { state, dispatch } = useTuneEditor();
  const { upshifts, downshifts } = selectCurveTables(state);
  // One stored step (0.5 mph in the tune) as it reads on the speedometer.
  const speedometerStep = 0.5 * selectSpeedometerFactor(state);
  const toTableProps = (table: CurveTableView): ShiftCurveTableProps => ({
    curveId: table.curveId,
    title: table.title,
    kind: table.kind,
    rows: table.rows,
    onShiftPointChange: (index, mph) =>
      dispatch({ type: "shiftPointChanged", curveId: table.curveId, index, mph }),
    onSpeedoChange: (index, mph) =>
      dispatch({ type: "speedometerChanged", curveId: table.curveId, index, mph }),
    onReset: () => dispatch({ type: "curveReset", curveId: table.curveId }),
    speedometerStep,
  });

  return (
    <ShiftSchedule
      upshifts={upshifts.map(toTableProps)}
      downshifts={downshifts.map(toTableProps)}
      overlaps={<ShiftOverlapAlert overlaps={selectOverlapViews(state)} />}
    />
  );
}
