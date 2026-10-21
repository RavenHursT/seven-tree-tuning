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
  disabledReason?: string;
  generating?: boolean;
  onGenerate(): void;
  onResetAll?(): void;
}

function summarizeChanges(changedShiftPoints: number, idleChanged: boolean): string {
  const parts: string[] = [];
  if (changedShiftPoints > 0) {
    const noun = changedShiftPoints === 1 ? "shift point" : "shift points";
    parts.push(`${changedShiftPoints} ${noun} changed`);
  }
  if (idleChanged) parts.push("idle changed");
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
    <Field className="md:max-w-sm">
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
      <span id={hintId} className="sr-only">
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
  return (
    <Button
      type="button"
      size="lg"
      disabled={generating || Boolean(disabledReason)}
      aria-busy={generating || undefined}
      aria-describedby={disabledReason ? reasonId : undefined}
      onClick={onGenerate}
    >
      {generating ? <GeneratingLabel /> : <GenerateLabel />}
    </Button>
  );
}

function ResetButton({ disabled, onClick }: { disabled: boolean; onClick(): void }) {
  return (
    <Button type="button" variant="outline" size="lg" disabled={disabled} onClick={onClick}>
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
  disabledReason,
  generating = false,
  onGenerate,
  onResetAll,
}: GenerateTuneBarProps) {
  const reasonId = React.useId();
  const showReset = Boolean(onResetAll) && (changedShiftPoints > 0 || idleChanged);

  return (
    <div
      data-slot="generate-tune-bar"
      className="flex flex-col gap-4 bg-card p-4 ring-1 ring-foreground/10 md:flex-row md:items-end md:justify-between"
    >
      <OutputFileField fileName={fileName} onFileNameChange={onFileNameChange} />
      <div className="flex flex-col gap-2 md:items-end">
        <p className="text-xs text-muted-foreground">
          {summarizeChanges(changedShiftPoints, idleChanged)}
        </p>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {showReset ? <ResetButton disabled={generating} onClick={() => onResetAll?.()} /> : null}
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
