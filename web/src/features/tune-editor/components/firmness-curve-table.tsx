"use client";

import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { axisLabel, CurveCard, UnitHeading } from "./curve-card";
import { NumberField } from "./number-field";

export interface FirmnessCurveRow {
  /** Position in the stored function; an edit names its row by this, never by list position. */
  pointIndex: number;
  pedalRaw: number;
  pedalPercent: number;
  isStep: boolean;
  /** Signed line-pressure adder, in PCM units. */
  value: number;
  originalValue: number;
  changed: boolean;
}

export interface FirmnessCurveTableProps {
  functionId: string;
  title: string;
  description: string;
  /** Smallest and largest adder the stored byte holds. */
  min: number;
  max: number;
  rows: readonly FirmnessCurveRow[];
  onValueChange(pointIndex: number, value: number): void;
  onReset?(): void;
}

function wholeNumber(value: number): string {
  return String(Math.round(value));
}

function spokenPedal(row: FirmnessCurveRow): string {
  const percent = `${Math.round(row.pedalPercent)}% pedal`;
  return row.isStep ? `${percent}, step` : percent;
}

interface FirmnessRowProps {
  title: string;
  row: FirmnessCurveRow;
  min: number;
  max: number;
  onValueChange(pointIndex: number, value: number): void;
}

function FirmnessRow({ title, row, min, max, onValueChange }: FirmnessRowProps) {
  const originalId = React.useId();

  return (
    <TableRow data-changed={row.changed} className="data-[changed=true]:bg-primary/10">
      <TableHead scope="row" className="h-auto p-2 font-normal">
        {axisLabel(row.pedalRaw, row.pedalPercent)}
        {row.isStep ? (
          <>
            {" "}
            <span className="text-muted-foreground">step</span>
          </>
        ) : null}
      </TableHead>
      <TableCell>
        <div className="flex items-center gap-2">
          <NumberField
            aria-label={`${title}, ${spokenPedal(row)}, adder (PCM units)`}
            aria-describedby={row.changed ? originalId : undefined}
            className="w-20"
            value={row.value}
            onValueChange={(value) => onValueChange(row.pointIndex, value)}
            min={min}
            max={max}
            step={1}
            format={wholeNumber}
          />
          {row.changed ? (
            <span id={originalId} className="text-[0.625rem] leading-tight text-foreground">
              was {wholeNumber(row.originalValue)}
            </span>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** One upshift line-pressure function: the signed adder at each pedal position. */
export function FirmnessCurveTable({
  functionId,
  title,
  description,
  min,
  max,
  rows,
  onValueChange,
  onReset,
}: FirmnessCurveTableProps) {
  return (
    <CurveCard
      curveId={functionId}
      title={title}
      description={description}
      anyChanged={rows.some((row) => row.changed)}
      onReset={onReset}
    >
      <Table aria-label={title}>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Pedal</TableHead>
            <TableHead scope="col">
              <UnitHeading unit="PCM units">Adder</UnitHeading>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <FirmnessRow
              key={row.pointIndex}
              title={title}
              row={row}
              min={min}
              max={max}
              onValueChange={onValueChange}
            />
          ))}
        </TableBody>
      </Table>
    </CurveCard>
  );
}
