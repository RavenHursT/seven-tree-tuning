"use client";

import * as React from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TireSizeValue {
  widthMm: number;
  aspectRatio: number;
  rimDiameterIn: number;
}

export interface TireSizePresetOption {
  id: string;
  label: string;
  value: TireSizeValue;
  note?: string;
}

export interface TireSizeFieldsProps {
  id: string;
  legend: string;
  description?: React.ReactNode;
  value: TireSizeValue;
  diameterIn?: number;
  presets: readonly TireSizePresetOption[];
  onChange(next: TireSizeValue): void;
}

interface SizeInputDefinition {
  key: keyof TireSizeValue;
  slug: string;
  label: string;
}

const SIZE_INPUTS: readonly SizeInputDefinition[] = [
  { key: "widthMm", slug: "width", label: "Width (mm)" },
  { key: "aspectRatio", slug: "aspect", label: "Aspect (%)" },
  { key: "rimDiameterIn", slug: "rim", label: "Rim (in)" },
];

const POSITIVE_DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

function parsePositiveNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!POSITIVE_DECIMAL.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isSameSize(a: TireSizeValue, b: TireSizeValue): boolean {
  return (
    a.widthMm === b.widthMm &&
    a.aspectRatio === b.aspectRatio &&
    a.rimDiameterIn === b.rimDiameterIn
  );
}

function formatDiameter(diameterIn: number | undefined): string {
  return diameterIn === undefined ? "—" : `${diameterIn.toFixed(2)} in`;
}

interface SizeInputProps {
  id: string;
  label: string;
  value: number;
  onValueChange(next: number): void;
}

function useDraftNumber(value: number, onValueChange: (next: number) => void) {
  const [draft, setDraft] = React.useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setDraft(text);
    const parsed = parsePositiveNumber(text);
    if (parsed !== null) onValueChange(parsed);
  }

  return {
    text: draft ?? String(value),
    invalid: draft !== null && draft.trim() !== "" && parsePositiveNumber(draft) === null,
    handleChange,
    handleBlur: () => setDraft(null),
  };
}

function SizeInput({ id, label, value, onValueChange }: SizeInputProps) {
  const { text, invalid, handleChange, handleBlur } = useDraftNumber(value, onValueChange);
  const errorId = `${id}-error`;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {invalid ? <FieldError id={errorId}>Enter a number greater than 0.</FieldError> : null}
    </Field>
  );
}

interface SizeInputRowProps {
  id: string;
  value: TireSizeValue;
  onChange(next: TireSizeValue): void;
}

function SizeInputRow({ id, value, onChange }: SizeInputRowProps) {
  return (
    <div className="grid grid-cols-3 items-start gap-3">
      {SIZE_INPUTS.map(({ key, slug, label }) => (
        <SizeInput
          key={key}
          id={`${id}-${slug}`}
          label={label}
          value={value[key]}
          onValueChange={(next) => onChange({ ...value, [key]: next })}
        />
      ))}
    </div>
  );
}

interface PresetSelectProps {
  id: string;
  presets: readonly TireSizePresetOption[];
  selected: TireSizePresetOption | undefined;
  onChange(next: TireSizeValue): void;
}

function PresetSelect({ id, presets, selected, onChange }: PresetSelectProps) {
  function handleValueChange(presetId: string) {
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (preset) onChange(preset.value);
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Preset</FieldLabel>
      <Select value={selected?.id ?? ""} onValueChange={handleValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Custom size">{selected?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id} textValue={preset.label}>
              <span>{preset.label}</span>
              {preset.note ? <span className="text-muted-foreground">{preset.note}</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

interface DiameterOutputProps {
  id: string;
  inputIds: string;
  diameterIn: number | undefined;
}

function DiameterOutput({ id, inputIds, diameterIn }: DiameterOutputProps) {
  const labelId = `${id}-label`;

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs leading-none">
        Diameter
      </span>
      <output
        id={id}
        htmlFor={inputIds}
        aria-labelledby={labelId}
        className="flex h-8 min-w-24 items-center justify-end bg-muted/50 px-2.5 text-xs font-medium tabular-nums"
      >
        {formatDiameter(diameterIn)}
      </output>
    </div>
  );
}

export function TireSizeFields({
  id,
  legend,
  description,
  value,
  diameterIn,
  presets,
  onChange,
}: TireSizeFieldsProps) {
  const descriptionId = `${id}-description`;
  const selectedPreset = presets.find((preset) => isSameSize(preset.value, value));
  const inputIds = SIZE_INPUTS.map(({ slug }) => `${id}-${slug}`).join(" ");

  return (
    <FieldSet aria-describedby={description ? descriptionId : undefined}>
      <FieldLegend>{legend}</FieldLegend>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <SizeInputRow id={id} value={value} onChange={onChange} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <PresetSelect
          id={`${id}-preset`}
          presets={presets}
          selected={selectedPreset}
          onChange={onChange}
        />
        <DiameterOutput id={`${id}-diameter`} inputIds={inputIds} diameterIn={diameterIn} />
      </div>
    </FieldSet>
  );
}
