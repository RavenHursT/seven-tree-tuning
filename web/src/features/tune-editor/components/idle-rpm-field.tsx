"use client";

import * as React from "react";
import { CaretDownIcon, WarningIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { NumberField } from "./number-field";

export interface IdleCurvePointView {
  inputRaw: number;
  rpm: number;
}

export interface IdleRpmFieldProps {
  rpm: number;
  originalRpm: number;
  onRpmChange(rpm: number): void;
  min?: number;
  max?: number;
  warning?: string;
  idleCurve?: readonly IdleCurvePointView[];
}

function formatRpm(rpm: number): string {
  return String(Number(rpm.toFixed(2)));
}

function IdleCurveSection({ points }: { points: readonly IdleCurvePointView[] }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="xs" className="[&[data-state=open]>svg]:rotate-180">
          Idle curve
          <CaretDownIcon data-icon="inline-end" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pt-2">
        <p className="text-muted-foreground">
          Only the warm idle (the first two points) is edited.
        </p>
        <Table aria-label="Idle curve points">
          <TableHeader>
            <TableRow>
              <TableHead className="h-8">Input (raw)</TableHead>
              <TableHead className="h-8">Idle (rpm)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point, index) => (
              <TableRow key={index}>
                <TableCell className="py-1">{point.inputRaw}</TableCell>
                <TableCell className="py-1">{point.rpm}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function IdleRpmField({
  rpm,
  originalRpm,
  onRpmChange,
  min = 0,
  max,
  warning,
  idleCurve,
}: IdleRpmFieldProps) {
  const fieldId = React.useId();
  const wasId = `${fieldId}-was`;
  const warningId = `${fieldId}-warning`;
  const changed = rpm !== originalRpm;
  const describedBy = [changed && wasId, warning && warningId].filter(Boolean).join(" ");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Idle</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fieldId}>Warm idle (rpm)</Label>
          <NumberField
            id={fieldId}
            className="w-40"
            value={rpm}
            onValueChange={onRpmChange}
            min={min}
            max={max}
            step={10}
            format={formatRpm}
            suffix="rpm"
            aria-describedby={describedBy || undefined}
          />
          {changed ? (
            <p id={wasId} className="text-muted-foreground">
              was {formatRpm(originalRpm)}
            </p>
          ) : null}
          {warning ? (
            <p id={warningId} className="flex items-start gap-1.5 text-warning">
              <WarningIcon className="mt-0.5 size-3.5 shrink-0" />
              {warning}
            </p>
          ) : null}
        </div>
        {idleCurve && idleCurve.length > 0 ? <IdleCurveSection points={idleCurve} /> : null}
      </CardContent>
    </Card>
  );
}
