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

/**
 * The status region is always in the page, so screen readers already watch it when the first
 * overlap appears. A live region that is added together with its text is often not announced.
 * While it is empty it is visually hidden and out of the layout, so it adds no gap in the parent.
 */
export function ShiftOverlapAlert({ overlaps }: ShiftOverlapAlertProps) {
  const hasOverlaps = overlaps.length > 0;

  return (
    <div role="status" className={hasOverlaps ? undefined : "sr-only"}>
      {hasOverlaps ? (
        // role is cleared: the status region announces the text, so the card must not add a second
        // live region that would read it out again.
        <Alert role={undefined} className="border-warning/50 bg-warning/10 text-warning">
          <WarningIcon />
          <AlertTitle>Possible gear hunting</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {overlaps.map((overlap) => (
                <li key={overlap.id}>
                  <span className="font-medium text-foreground">{overlap.title}</span>{" "}
                  {overlap.detail}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
