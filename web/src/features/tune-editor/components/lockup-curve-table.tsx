"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
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

export interface LockupCurveRow {
  /** Position in the stored function; an edit names its row by this, never by list position. */
  pointIndex: number;
  pedalRaw: number;
  pedalPercent: number;
  isStep: boolean;
  /** Speed stored in the tune, in mph. 127 when `never`. */
  speedMph: number;
  speedRaw: number;
  speedoMph: number;
  originalSpeedMph: number;
  /** A lock curve only: the stored speed is 127 mph, so the converter never locks at this pedal. */
  never: boolean;
  changed: boolean;
}

export interface LockupCurveTableProps {
  functionId: string;
  /** "lock" shows 127 mph as "never" and has a Never button. "unlock" shows it as a number. */
  kind: "lock" | "unlock";
  title: string;
  description: string;
  /** "lock speed" or "unlock speed": names the stored column and its fields. */
  speedLabel: string;
  rows: readonly LockupCurveRow[];
  /** The most the Speedometer field takes: the speedometer value that stores 127 mph. */
  speedometerMaxMph: number;
  onSpeedChange(pointIndex: number, mph: number): void;
  onSpeedoChange(pointIndex: number, mph: number): void;
  onNever(pointIndex: number): void;
  onReset?(): void;
  /** How many mph one arrow key press changes the speedometer field by. Default 0.1. */
  speedometerStep?: number;
}

const NEVER_MPH = 127;
const DEFAULT_SPEEDOMETER_STEP_MPH = 0.1;

function speedText(mph: number, kind: "lock" | "unlock"): string {
  return kind === "lock" && mph >= NEVER_MPH ? "never" : mph.toFixed(1);
}

function spokenPedal(row: LockupCurveRow): string {
  const percent = `${Math.round(row.pedalPercent)}% pedal`;
  return row.isStep ? `${percent}, step` : percent;
}

interface LockupRowProps {
  kind: "lock" | "unlock";
  title: string;
  speedLabel: string;
  row: LockupCurveRow;
  speedometerStep: number;
  speedometerMaxMph: number;
  onSpeedChange(pointIndex: number, mph: number): void;
  onSpeedoChange(pointIndex: number, mph: number): void;
  onNever(pointIndex: number): void;
}

function LockupRow({
  kind,
  title,
  speedLabel,
  row,
  speedometerStep,
  speedometerMaxMph,
  onSpeedChange,
  onSpeedoChange,
  onNever,
}: LockupRowProps) {
  const originalId = React.useId();
  const name = `${title}, ${spokenPedal(row)}`;
  // The speedometer value of a "never" row is above 127 mph, so the row says which text to show.
  const format = (mph: number) => (row.never ? "never" : mph.toFixed(1));

  return (
    <TableRow data-changed={row.changed} className="data-[changed=true]:bg-primary/10">
      <TableHead scope="row" className="h-auto p-2 font-normal max-sm:px-1">
        {axisLabel(row.pedalRaw, row.pedalPercent)}
        {row.isStep ? (
          <>
            {" "}
            <span className="text-muted-foreground">step</span>
          </>
        ) : null}
      </TableHead>
      <TableCell className="max-sm:px-1">
        <div className="flex flex-col gap-1">
          <NumberField
            aria-label={`${name}, ${speedLabel} (mph)`}
            aria-describedby={row.changed ? originalId : undefined}
            className="w-20 max-sm:w-16"
            value={row.speedMph}
            onValueChange={(mph) => onSpeedChange(row.pointIndex, mph)}
            min={0}
            max={NEVER_MPH}
            step={0.5}
            format={format}
          />
          <div className="flex items-center gap-1.5 text-[0.625rem] leading-tight text-muted-foreground">
            {kind === "lock" ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={`${name}, set to never`}
                aria-disabled={row.never || undefined}
                className="px-1 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                onClick={() => {
                  if (!row.never) onNever(row.pointIndex);
                }}
              >
                Never
              </Button>
            ) : null}
            {row.changed ? (
              <span id={originalId} className="text-foreground">
                was {speedText(row.originalSpeedMph, kind)}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top max-sm:px-1">
        <NumberField
          aria-label={`${name}, speedometer (mph)`}
          className="w-20 max-sm:w-16"
          value={row.speedoMph}
          onValueChange={(mph) => onSpeedoChange(row.pointIndex, mph)}
          min={0}
          max={speedometerMaxMph}
          step={speedometerStep}
          format={format}
        />
      </TableCell>
    </TableRow>
  );
}

/**
 * One lockup function: the speed above which the converter locks, or below which it unlocks, at
 * each pedal position. Both speed columns edit the same stored value, as on a shift curve.
 */
export function LockupCurveTable({
  functionId,
  kind,
  title,
  description,
  speedLabel,
  rows,
  speedometerMaxMph,
  onSpeedChange,
  onSpeedoChange,
  onNever,
  onReset,
  speedometerStep = DEFAULT_SPEEDOMETER_STEP_MPH,
}: LockupCurveTableProps) {
  const heading = speedLabel.charAt(0).toUpperCase() + speedLabel.slice(1);

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
            <TableHead scope="col" className="max-sm:px-1">
              Pedal
            </TableHead>
            <TableHead scope="col" className="max-sm:px-1">
              <UnitHeading hideUnitWhenNarrow>{heading}</UnitHeading>
            </TableHead>
            <TableHead scope="col" className="max-sm:px-1">
              <UnitHeading hideUnitWhenNarrow>Speedometer</UnitHeading>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <LockupRow
              key={row.pointIndex}
              kind={kind}
              title={title}
              speedLabel={speedLabel}
              row={row}
              speedometerStep={speedometerStep}
              speedometerMaxMph={speedometerMaxMph}
              onSpeedChange={onSpeedChange}
              onSpeedoChange={onSpeedoChange}
              onNever={onNever}
            />
          ))}
        </TableBody>
      </Table>
    </CurveCard>
  );
}
