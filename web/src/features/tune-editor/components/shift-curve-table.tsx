"use client";

import * as React from "react";
import { ArrowCounterClockwiseIcon, WarningIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const WIDE_OPEN_THROTTLE_RAW = 255;
const MAX_SHIFT_POINT_MPH = 127.5;
const DEFAULT_SPEEDOMETER_STEP_MPH = 0.1;

function oneDecimal(value: number): string {
  return value.toFixed(1);
}

function hexByte(raw: number): string {
  return `0x${raw.toString(16).toUpperCase().padStart(2, "0")}`;
}

function throttleLabel(row: ShiftCurveRow): string {
  if (row.throttleRaw === WIDE_OPEN_THROTTLE_RAW) return "WOT";
  if (row.throttleRaw === 0) return "Closed";
  return `${Math.round(row.throttlePercent)}%`;
}

function spokenThrottle(row: ShiftCurveRow): string {
  const percent = `${Math.round(row.throttlePercent)}% throttle`;
  return row.isStep ? `${percent}, step` : percent;
}

function UnitHeading({ children }: { children: string }) {
  return (
    <>
      {children}{" "}
      <span aria-hidden="true" className="font-normal text-muted-foreground">
        mph
      </span>
    </>
  );
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
        {throttleLabel(row)}
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
            aria-label={`${name}, shift point (mph)`}
            aria-describedby={row.changed ? originalId : undefined}
            className="w-24"
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
          className="w-24"
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

interface ResetCurveButtonProps {
  title: string;
  unavailable: boolean;
  onReset(): void;
}

/**
 * Stays in the page and in the tab order when there is nothing to reset, so that focus is not lost
 * when a reset removes the last change. The name includes the curve because six of these buttons
 * are on one page.
 */
function ResetCurveButton({ title, unavailable, onReset }: ResetCurveButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      aria-label={`Reset ${title}`}
      aria-disabled={unavailable || undefined}
      className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
      onClick={() => {
        if (!unavailable) onReset();
      }}
    >
      <ArrowCounterClockwiseIcon data-icon="inline-start" />
      Reset
    </Button>
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
    <Card size="sm" className="min-w-0" data-curve-id={curveId}>
      <CardHeader>
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        <CardDescription>{kind === "upshift" ? "Upshift" : "Downshift"}</CardDescription>
        {onReset ? (
          <CardAction>
            <ResetCurveButton title={title} unavailable={!anyChanged} onReset={onReset} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
      </CardContent>
    </Card>
  );
}
