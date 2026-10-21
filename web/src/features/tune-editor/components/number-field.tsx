"use client";

import * as React from "react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export interface NumberFieldProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> {
  value: number;
  onValueChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  suffix?: string;
  invalid?: boolean;
}

const DECIMAL_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)$/;

function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  return DECIMAL_TEXT.test(trimmed) ? Number(trimmed) : null;
}

function parseInRange(text: string, min: number, max: number): number | null {
  const parsed = parseNumber(text);
  return parsed !== null && parsed >= min && parsed <= max ? parsed : null;
}

function decimalPlaces(n: number): number {
  return String(n).split(".")[1]?.length ?? 0;
}

function addExact(base: number, delta: number): number {
  const places = Math.max(decimalPlaces(base), decimalPlaces(delta));
  return Number((base + delta).toFixed(places));
}

export function NumberField({
  value,
  onValueChange,
  min = -Infinity,
  max = Infinity,
  step,
  format = String,
  suffix,
  invalid = false,
  className,
  onBlur,
  onKeyDown,
  ...inputProps
}: NumberFieldProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const draftIsInvalid = draft !== null && parseInRange(draft, min, max) === null;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setDraft(text);
    const parsed = parseInRange(text, min, max);
    if (parsed !== null) onValueChange(parsed);
  }

  function stepBy(delta: number) {
    const base = parseNumber(draft ?? "") ?? parseNumber(format(value)) ?? value;
    const next = Math.min(Math.max(addExact(base, delta), min), max);
    setDraft(String(next));
    onValueChange(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.key === "Enter" || event.key === "Escape") {
      setDraft(null);
    } else if (step !== undefined && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      stepBy(event.key === "ArrowUp" ? step : -step);
    }
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    onBlur?.(event);
    setDraft(null);
  }

  return (
    <InputGroup className={className}>
      <InputGroupInput
        inputMode="decimal"
        {...inputProps}
        value={draft ?? format(value)}
        aria-invalid={invalid || draftIsInvalid || undefined}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {suffix ? <InputGroupAddon align="inline-end">{suffix}</InputGroupAddon> : null}
    </InputGroup>
  );
}
