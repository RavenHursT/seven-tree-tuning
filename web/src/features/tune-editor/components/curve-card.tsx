"use client";

import type * as React from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const WIDE_OPEN_RAW = 255;

/** "Closed", "WOT" or a rounded percent: the label of a row on a throttle or pedal axis. */
export function axisLabel(raw: number, percent: number): string {
  if (raw === WIDE_OPEN_RAW) return "WOT";
  if (raw === 0) return "Closed";
  return `${Math.round(percent)}%`;
}

/** A column heading with a unit that screen readers skip, because each field names its unit. */
export function UnitHeading({
  children,
  unit = "mph",
  hideUnitWhenNarrow = false,
}: {
  children: string;
  unit?: string;
  /** Leaves the unit out below 640 px, where a table of three columns has no room for it. */
  hideUnitWhenNarrow?: boolean;
}) {
  return (
    <>
      {children}{" "}
      <span
        aria-hidden="true"
        className={cn("font-normal text-muted-foreground", hideUnitWhenNarrow && "max-sm:hidden")}
      >
        {unit}
      </span>
    </>
  );
}

interface ResetCurveButtonProps {
  title: string;
  unavailable: boolean;
  onReset(): void;
}

/**
 * Stays in the page and in the tab order when there is nothing to reset, so that focus is not lost
 * when a reset removes the last change. The name includes the curve because many of these buttons
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

export interface CurveCardProps {
  /** Becomes `data-curve-id`, which the tests and the end-to-end tests find a curve by. */
  curveId: string;
  title: string;
  description: string;
  /** True when a value of the curve differs from the loaded tune: the Reset button is usable. */
  anyChanged: boolean;
  onReset?(): void;
  children: React.ReactNode;
}

/** The card around one curve table: its title, what kind of curve it is, and a Reset button. */
export function CurveCard({
  curveId,
  title,
  description,
  anyChanged,
  onReset,
  children,
}: CurveCardProps) {
  return (
    <Card size="sm" className="min-w-0" data-curve-id={curveId}>
      <CardHeader>
        <CardTitle>
          <h4>{title}</h4>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {onReset ? (
          <CardAction>
            <ResetCurveButton title={title} unavailable={!anyChanged} onReset={onReset} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}
