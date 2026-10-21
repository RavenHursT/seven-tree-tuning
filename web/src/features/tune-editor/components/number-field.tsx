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
  /** Text shown under the field while the typed text is not accepted. Replaces the default. */
  invalidMessage?: string;
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

function formatLimit(limit: number): string {
  return limit.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** The default text for a number that is outside [min, max]. A limit of ±Infinity is left out. */
export function numberRangeMessage(min: number, max: number): string {
  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);
  if (hasMin && hasMax) return `Enter a number from ${formatLimit(min)} to ${formatLimit(max)}.`;
  if (hasMin) return `Enter a number of at least ${formatLimit(min)}.`;
  if (hasMax) return `Enter a number of at most ${formatLimit(max)}.`;
  return "Enter a number.";
}

function joinIds(...ids: (string | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
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
  invalidMessage,
  className,
  "aria-describedby": describedByProp,
  onBlur,
  onFocus,
  onKeyDown,
  ...inputProps
}: NumberFieldProps) {
  const messageId = React.useId();
  const [draft, setDraft] = React.useState<string | null>(null);
  const valueAtFocus = React.useRef<number | null>(null);
  const committedSinceFocus = React.useRef(false);
  // A draft exists only between the first keystroke and blur, Enter or Escape, so the field has
  // focus whenever the draft is not accepted and the message is shown.
  const draftIsInvalid = draft !== null && parseInRange(draft, min, max) === null;

  function commit(next: number) {
    committedSinceFocus.current = true;
    onValueChange(next);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setDraft(text);
    const parsed = parseInRange(text, min, max);
    if (parsed !== null) commit(parsed);
  }

  function stepBy(delta: number) {
    const base = parseNumber(draft ?? "") ?? parseNumber(format(value)) ?? value;
    const next = Math.min(Math.max(addExact(base, delta), min), max);
    setDraft(String(next));
    commit(next);
  }

  // Each valid keystroke is already committed, so cancelling puts the old value back. The caller
  // may not have taken the committed numbers, so "changed" also counts what this field reported.
  function cancelEdit() {
    const original = valueAtFocus.current;
    const changed = committedSinceFocus.current || original !== value;
    if (original !== null && changed) onValueChange(original);
    committedSinceFocus.current = false;
    setDraft(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.key === "Enter") {
      setDraft(null);
    } else if (event.key === "Escape") {
      cancelEdit();
    } else if (step !== undefined && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      stepBy(event.key === "ArrowUp" ? step : -step);
    }
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    valueAtFocus.current = value;
    committedSinceFocus.current = false;
    onFocus?.(event);
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    onBlur?.(event);
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-1">
      <InputGroup className={className}>
        <InputGroupInput
          inputMode="decimal"
          {...inputProps}
          value={draft ?? format(value)}
          aria-invalid={invalid || draftIsInvalid || undefined}
          aria-describedby={joinIds(describedByProp, draftIsInvalid ? messageId : undefined)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {suffix ? <InputGroupAddon align="inline-end">{suffix}</InputGroupAddon> : null}
      </InputGroup>
      {draftIsInvalid ? (
        // w-0 min-w-full: the message wraps to the width of the field and never widens the column.
        <p id={messageId} className="w-0 min-w-full text-xs whitespace-normal text-destructive">
          {invalidMessage ?? numberRangeMessage(min, max)}
        </p>
      ) : null}
    </div>
  );
}
