"use client";

import { WarningIcon } from "@phosphor-icons/react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface ShiftOverlapView {
  id: string;
  title: string;
  detail: string;
}

export interface ShiftOverlapAlertProps {
  overlaps: readonly ShiftOverlapView[];
}

export function ShiftOverlapAlert({ overlaps }: ShiftOverlapAlertProps) {
  if (overlaps.length === 0) return null;

  return (
    <Alert role="status" className="border-warning/50 bg-warning/10 text-warning">
      <WarningIcon />
      <AlertTitle>Possible gear hunting</AlertTitle>
      <AlertDescription>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {overlaps.map((overlap) => (
            <li key={overlap.id}>
              <span className="font-medium text-foreground">{overlap.title}</span> {overlap.detail}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
