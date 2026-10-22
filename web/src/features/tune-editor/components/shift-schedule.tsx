"use client";

import * as React from "react";

import { ShiftCurveTable, type ShiftCurveTableProps } from "./shift-curve-table";

export interface ShiftScheduleProps {
  upshifts: readonly ShiftCurveTableProps[];
  downshifts: readonly ShiftCurveTableProps[];
  overlaps?: React.ReactNode;
}

interface CurveSectionProps {
  title: string;
  curves: readonly ShiftCurveTableProps[];
}

function CurveSection({ title, curves }: CurveSectionProps) {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-medium">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {curves.map((curve) => (
          <ShiftCurveTable key={curve.curveId} {...curve} />
        ))}
      </div>
    </section>
  );
}

export function ShiftSchedule({ upshifts, downshifts, overlaps }: ShiftScheduleProps) {
  return (
    <div className="flex flex-col gap-6">
      {overlaps}
      <CurveSection title="Upshifts" curves={upshifts} />
      <CurveSection title="Downshifts" curves={downshifts} />
    </div>
  );
}
