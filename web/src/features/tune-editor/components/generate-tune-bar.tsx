"use client";

import * as React from "react";
import { ArrowCounterClockwiseIcon, DownloadSimpleIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

export interface GenerateTuneBarProps {
  fileName: string;
  onFileNameChange(value: string): void;
  changedShiftPoints: number;
  idleChanged: boolean;
  /** Cells edited in the fuel, power, timing and ICP grids. */
  changedGridCells?: number;
  changedLockupPoints?: number;
  changedFirmnessPoints?: number;
  disabledReason?: string;
  generating?: boolean;
  onGenerate(): void;
  onResetAll?(): void;
}

/**
 * Buttons that cannot be used right now use aria-disabled, not the disabled attribute: they stay
 * in the tab order and keep focus when they become unusable, and their reason can be read.
 * Their click handlers do nothing while unavailable.
 */
const UNAVAILABLE_CLASS = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

function countPhrase(count: number, singular: string, plural: string): string[] {
  if (count === 0) return [];
  return [`${count} ${count === 1 ? singular : plural} changed`];
}

interface ChangeCounts {
  changedShiftPoints: number;
  idleChanged: boolean;
  changedLockupPoints: number;
  changedFirmnessPoints: number;
  changedGridCells: number;
}

function summarizeChanges(counts: ChangeCounts): string {
  const parts = [
    ...countPhrase(counts.changedShiftPoints, "shift point", "shift points"),
    ...countPhrase(counts.changedLockupPoints, "lockup speed", "lockup speeds"),
    ...countPhrase(counts.changedFirmnessPoints, "firmness value", "firmness values"),
  ];
  if (counts.idleChanged) parts.push("idle changed");
  parts.push(...countPhrase(counts.changedGridCells, "grid cell", "grid cells"));
  if (parts.length === 0) return "No changes";
  const summary = parts.join(" · ");
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

function GeneratingLabel() {
  return (
    <>
      <Spinner
        data-icon="inline-start"
        role="presentation"
        aria-hidden="true"
        aria-label={undefined}
      />
      Generating…
    </>
  );
}

function GenerateLabel() {
  return (
    <>
      <DownloadSimpleIcon data-icon="inline-start" aria-hidden="true" />
      Generate Tune
    </>
  );
}

interface OutputFileFieldProps {
  fileName: string;
  onFileNameChange(value: string): void;
}

function OutputFileField({ fileName, onFileNameChange }: OutputFileFieldProps) {
  const baseId = React.useId();
  const inputId = `${baseId}-input`;
  const hintId = `${baseId}-hint`;

  return (
    <Field className="relative md:max-w-sm">
      <FieldLabel htmlFor={inputId}>Output file</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={inputId}
          value={fileName}
          onChange={(event) => onFileNameChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hintId}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>.hcf</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <span id={hintId} className="sr-only max-w-px">
        The .hcf extension is added for you.
      </span>
    </Field>
  );
}

interface GenerateButtonProps {
  generating: boolean;
  disabledReason?: string;
  reasonId: string;
  onGenerate(): void;
}

function GenerateButton({ generating, disabledReason, reasonId, onGenerate }: GenerateButtonProps) {
  const unavailable = generating || Boolean(disabledReason);

  return (
    <Button
      type="button"
      size="lg"
      aria-disabled={unavailable || undefined}
      aria-busy={generating || undefined}
      aria-describedby={disabledReason ? reasonId : undefined}
      className={UNAVAILABLE_CLASS}
      onClick={() => {
        if (!unavailable) onGenerate();
      }}
    >
      {generating ? <GeneratingLabel /> : <GenerateLabel />}
    </Button>
  );
}

function ResetButton({ unavailable, onClick }: { unavailable: boolean; onClick(): void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      aria-disabled={unavailable || undefined}
      className={UNAVAILABLE_CLASS}
      onClick={() => {
        if (!unavailable) onClick();
      }}
    >
      <ArrowCounterClockwiseIcon data-icon="inline-start" aria-hidden="true" />
      Reset all changes
    </Button>
  );
}

export function GenerateTuneBar({
  fileName,
  onFileNameChange,
  changedShiftPoints,
  idleChanged,
  changedGridCells = 0,
  changedLockupPoints = 0,
  changedFirmnessPoints = 0,
  disabledReason,
  generating = false,
  onGenerate,
  onResetAll,
}: GenerateTuneBarProps) {
  const reasonId = React.useId();
  const counts = {
    changedShiftPoints,
    idleChanged,
    changedLockupPoints,
    changedFirmnessPoints,
    changedGridCells,
  };
  const nothingChanged = summarizeChanges(counts) === "No changes";

  return (
    <div
      data-slot="generate-tune-bar"
      className="flex flex-col gap-4 bg-card p-4 ring-1 ring-foreground/10 md:flex-row md:items-end md:justify-between"
    >
      <OutputFileField fileName={fileName} onFileNameChange={onFileNameChange} />
      <div className="flex flex-col gap-2 md:items-end">
        <p className="text-xs text-muted-foreground">{summarizeChanges(counts)}</p>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {onResetAll ? (
            <ResetButton unavailable={generating || nothingChanged} onClick={onResetAll} />
          ) : null}
          <GenerateButton
            generating={generating}
            disabledReason={disabledReason}
            reasonId={reasonId}
            onGenerate={onGenerate}
          />
        </div>
        {disabledReason ? (
          <p id={reasonId} className="text-xs text-muted-foreground">
            {disabledReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
