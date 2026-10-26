"use client";

import * as React from "react";
import { WarningIcon } from "@phosphor-icons/react";

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

export interface ShiftCurveRow {
  breakpointIndex: number;
  throttleRaw: number;
  throttlePercent: number;
  isStep: boolean;
  shiftPointMph: number;
  shiftPointRaw: number;
  speedoMph: number;
  originalShiftPointMph: number;
  changed: boolean;
}

export interface ShiftCurveTableProps {
  curveId: string;
  title: string;
  kind: "upshift" | "downshift";
  rows: readonly ShiftCurveRow[];
  onShiftPointChange(breakpointIndex: number, mph: number): void;
  onSpeedoChange(breakpointIndex: number, mph: number): void;
  onReset?(): void;
  warning?: string;
  /** How many mph one arrow key press changes the speedometer field by. Default 0.1. */
  speedometerStep?: number;
}

const MAX_SHIFT_POINT_MPH = 127.5;
const DEFAULT_SPEEDOMETER_STEP_MPH = 0.1;

function oneDecimal(value: number): string {
  return value.toFixed(1);
}

function hexByte(raw: number): string {
  return `0x${raw.toString(16).toUpperCase().padStart(2, "0")}`;
}

function spokenThrottle(row: ShiftCurveRow): string {
  const percent = `${Math.round(row.throttlePercent)}% throttle`;
  return row.isStep ? `${percent}, step` : percent;
}

interface CurveRowProps {
  title: string;
  row: ShiftCurveRow;
  speedometerStep: number;
  onShiftPointChange(breakpointIndex: number, mph: number): void;
  onSpeedoChange(breakpointIndex: number, mph: number): void;
}

function CurveRow({
  title,
  row,
  speedometerStep,
  onShiftPointChange,
  onSpeedoChange,
}: CurveRowProps) {
  const originalId = React.useId();
  const name = `${title}, ${spokenThrottle(row)}`;

  return (
    <TableRow data-changed={row.changed} className="data-[changed=true]:bg-primary/10">
      <TableHead scope="row" className="h-auto p-2 font-normal">
        {axisLabel(row.throttleRaw, row.throttlePercent)}
        {row.isStep ? (
          <>
            {" "}
            <span className="text-muted-foreground">step</span>
          </>
        ) : null}
      </TableHead>
      <TableCell>
        <div className="flex items-center gap-2">
          {/* w-20, not wider: three curve cards share a row inside the Shiftpoints module from
              1280 px up, and a wider field makes each table scroll sideways in its card. */}
          <NumberField
            aria-label={`${name}, shift point (mph)`}
            aria-describedby={row.changed ? originalId : undefined}
            className="w-20"
            value={row.shiftPointMph}
            onValueChange={(mph) => onShiftPointChange(row.breakpointIndex, mph)}
            min={0}
            max={MAX_SHIFT_POINT_MPH}
            step={0.5}
            format={oneDecimal}
          />
          <div className="flex min-w-14 flex-col text-[0.625rem] leading-tight text-muted-foreground">
            <span>{hexByte(row.shiftPointRaw)}</span>
            {row.changed ? (
              <span id={originalId} className="text-foreground">
                was {oneDecimal(row.originalShiftPointMph)}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <NumberField
          aria-label={`${name}, speedometer (mph)`}
          className="w-20"
          value={row.speedoMph}
          onValueChange={(mph) => onSpeedoChange(row.breakpointIndex, mph)}
          min={0}
          step={speedometerStep}
          format={oneDecimal}
        />
      </TableCell>
    </TableRow>
  );
}

export function ShiftCurveTable({
  curveId,
  title,
  kind,
  rows,
  onShiftPointChange,
  onSpeedoChange,
  onReset,
  warning,
  speedometerStep = DEFAULT_SPEEDOMETER_STEP_MPH,
}: ShiftCurveTableProps) {
  const anyChanged = rows.some((row) => row.changed);

  return (
    <CurveCard
      curveId={curveId}
      title={title}
      description={kind === "upshift" ? "Upshift" : "Downshift"}
      anyChanged={anyChanged}
      onReset={onReset}
    >
      <Table aria-label={title}>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Throttle</TableHead>
            <TableHead scope="col">
              <UnitHeading>Shift point</UnitHeading>
            </TableHead>
            <TableHead scope="col">
              <UnitHeading>Speedometer</UnitHeading>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <CurveRow
              key={row.breakpointIndex}
              title={title}
              row={row}
              speedometerStep={speedometerStep}
              onShiftPointChange={onShiftPointChange}
              onSpeedoChange={onSpeedoChange}
            />
          ))}
        </TableBody>
      </Table>
      {warning ? (
        <p className="flex items-start gap-1.5 text-warning">
          <WarningIcon className="mt-0.5 size-3.5 shrink-0" />
          {warning}
        </p>
      ) : null}
    </CurveCard>
  );
}
