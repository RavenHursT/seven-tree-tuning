"use client";

import type * as React from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface ChipSerialFieldProps {
  id: string;
  value: string;
  onChange(value: string): void;
  error?: string;
  description?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}

const DEFAULT_DESCRIPTION =
  "The first 8 characters of the chip's USB serial. HydraFlash shows it in its status bar. It is the key for .hcf files and never leaves this browser.";

const SERIAL_INPUT_PROPS = {
  maxLength: 8,
  autoComplete: "off",
  autoCapitalize: "characters",
  spellCheck: false,
  placeholder: "8 hex digits",
  className:
    "font-mono tracking-widest uppercase placeholder:tracking-normal placeholder:normal-case",
} as const;

function joinIds(...ids: (string | false | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
}

export function ChipSerialField({
  id,
  value,
  onChange,
  error,
  description = DEFAULT_DESCRIPTION,
  required,
  disabled,
}: ChipSerialFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasDescription = Boolean(description);

  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled}>
      <FieldLabel htmlFor={id}>Chip serial</FieldLabel>
      <Input
        id={id}
        value={value.toUpperCase()}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={joinIds(hasDescription && descriptionId, error && errorId)}
        {...SERIAL_INPUT_PROPS}
      />
      {hasDescription ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}
