"use client";

import { GearSixIcon } from "@phosphor-icons/react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { ShiftOverlapAlert } from "../components/shift-overlap-alert";
import { ShiftSchedule } from "../components/shift-schedule";
import type { ShiftCurveTableProps } from "../components/shift-curve-table";
import {
  selectCurveTables,
  selectOverlapViews,
  selectSpeedometerFactor,
  type CurveTableView,
} from "../state/editor-selectors";
import { useTuneEditor } from "../tune-editor-provider";

export function ScheduleSection() {
  const { state, dispatch } = useTuneEditor();

  if (!state.tune) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GearSixIcon />
          </EmptyMedia>
          <EmptyTitle>No tune loaded</EmptyTitle>
          <EmptyDescription>
            Upload a .hcf or pick a PHP library tune to see its shift points and idle speed.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

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
    <section aria-label="Shift schedule" className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Shift point is the speed stored in the tune; the PCM computes it for the calibration tire
        size. Speedometer is the road speed on the tires entered, which a speedometer calibrated for
        those tires shows. If the speedometer was not recalibrated for the tires, the dash shows the
        shift point instead. Editing either column updates the other.
      </p>
      <ShiftSchedule
        upshifts={upshifts.map(toTableProps)}
        downshifts={downshifts.map(toTableProps)}
        overlaps={<ShiftOverlapAlert overlaps={selectOverlapViews(state)} />}
      />
    </section>
  );
}
