"use client";

import * as React from "react";
import { CaretUpDownIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TireSizeValue =
  | { kind: "metric"; widthMm: number; aspectRatio: number; rimDiameterIn: number }
  | { kind: "flotation"; diameterIn: number; widthIn: number; rimDiameterIn: number };

export interface TireSizeOption {
  id: string;
  /** The size as printed on a tire, such as "315/75R16" or "35x12.50R17". */
  label: string;
  /** The heading the option is listed under. Options of one group are listed together. */
  group: string;
  note?: string;
  value: TireSizeValue;
}

export interface TireSizeFieldsProps {
  id: string;
  legend: string;
  description?: React.ReactNode;
  value: TireSizeValue;
  diameterIn?: number;
  options: readonly TireSizeOption[];
  /** Reads the text a person typed. Returns undefined when it is not a size. */
  parse(text: string): TireSizeValue | undefined;
  /** Writes a size as text, in the form `parse` reads. */
  format(value: TireSizeValue): string;
  onChange(next: TireSizeValue): void;
  disabled?: boolean;
}

const INVALID_SIZE_MESSAGE = "Enter a size like 315/75R16 or 35x12.50R17.";

function isSameSize(a: TireSizeValue, b: TireSizeValue): boolean {
  if (a.kind === "flotation") {
    return (
      b.kind === "flotation" &&
      a.diameterIn === b.diameterIn &&
      a.widthIn === b.widthIn &&
      a.rimDiameterIn === b.rimDiameterIn
    );
  }
  return (
    b.kind === "metric" &&
    a.widthMm === b.widthMm &&
    a.aspectRatio === b.aspectRatio &&
    a.rimDiameterIn === b.rimDiameterIn
  );
}

function formatDiameter(diameterIn: number | undefined): string {
  return diameterIn === undefined ? "—" : `${diameterIn.toFixed(2)} in`;
}

interface OptionGroup {
  group: string;
  options: TireSizeOption[];
}

/** Gathers the options under their group, with the groups in the order the options first name them. */
function groupOptions(options: readonly TireSizeOption[]): OptionGroup[] {
  const groups = new Map<string, TireSizeOption[]>();
  for (const option of options) {
    const members = groups.get(option.group);
    if (members) members.push(option);
    else groups.set(option.group, [option]);
  }
  return Array.from(groups, ([group, members]) => ({ group, options: members }));
}

/** Lower case, no spaces, no zeros after the last decimal digit: "35X12.50 R17" gives "35x12.5r17". */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/(\.\d*?)0+(?!\d)/g, "$1")
    .replace(/\.(?!\d)/g, "");
}

/** Like `normalizeText`, and without a leading LT, P or ST: "LT 315/75" finds 315/75R16. */
function normalizeSearch(text: string): string {
  return normalizeText(text).replace(/^(?:lt|st|p)(?=\d)/, "");
}

/**
 * Whether an option stays in the list for what was typed: 1 when the typed text is inside its
 * label or its note, 0 when it is not. The list keeps its order, so there is no ranking.
 */
function filterOption(value: string, search: string, keywords: string[] = []): number {
  const wanted = normalizeSearch(search);
  const texts = keywords.length > 0 ? keywords : [value];
  return texts.some((text) => normalizeText(text).includes(wanted)) ? 1 : 0;
}

function searchTexts(option: TireSizeOption): string[] {
  return option.note === undefined ? [option.label] : [option.label, option.note];
}

interface DiameterOutputProps {
  id: string;
  /** The id of the control the diameter is computed from. */
  inputId: string;
  diameterIn: number | undefined;
}

function DiameterOutput({ id, inputId, diameterIn }: DiameterOutputProps) {
  const labelId = `${id}-label`;

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs leading-none">
        Diameter
      </span>
      <output
        id={id}
        htmlFor={inputId}
        aria-labelledby={labelId}
        aria-live="off"
        className="flex h-8 min-w-24 items-center justify-end bg-muted/50 px-2.5 text-xs font-medium tabular-nums"
      >
        {formatDiameter(diameterIn)}
      </output>
    </div>
  );
}

interface SizeRowProps {
  /** Which edge the control and the diameter line up on when they have different heights. */
  align: "start" | "end";
  diameter: React.ReactNode;
  children: React.ReactNode;
}

function SizeRow({ align, diameter, children }: SizeRowProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]",
        align === "end" ? "sm:items-end" : "sm:items-start",
      )}
    >
      {children}
      {diameter}
    </div>
  );
}

interface SizeItemProps {
  option: TireSizeOption;
  checked: boolean;
  onChoose(option: TireSizeOption): void;
}

/**
 * One size in the list: its label, and its note when it has one. The space between the two is
 * not drawn in the flex row, and it makes the name that a screen reader speaks two words.
 */
function SizeItem({ option, checked, onChoose }: SizeItemProps) {
  return (
    <CommandItem
      value={option.id}
      keywords={searchTexts(option)}
      data-checked={checked}
      onSelect={() => onChoose(option)}
    >
      <span>{option.label}</span>
      {option.note ? (
        <>
          {" "}
          <span className="text-muted-foreground">{option.note}</span>
        </>
      ) : null}
    </CommandItem>
  );
}

interface SizeListProps {
  options: readonly TireSizeOption[];
  selectedId: string | undefined;
  onChoose(option: TireSizeOption): void;
}

/** The search field and the grouped list of sizes. It opens with the size in use highlighted. */
function SizeList({ options, selectedId, onChoose }: SizeListProps) {
  return (
    <Command label="Search tire sizes" filter={filterOption} defaultValue={selectedId}>
      <CommandInput placeholder="Search, for example 315 or 35x" />
      <CommandList label="Tire sizes">
        <CommandEmpty>No tire size found.</CommandEmpty>
        {groupOptions(options).map(({ group, options: members }) => (
          <CommandGroup key={group} heading={group}>
            {members.map((option) => (
              <SizeItem
                key={option.id}
                option={option}
                checked={option.id === selectedId}
                onChoose={onChoose}
              />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

interface SizeComboboxProps {
  id: string;
  legendId: string;
  options: readonly TireSizeOption[];
  value: TireSizeValue;
  format(value: TireSizeValue): string;
  disabled: boolean;
  onChange(next: TireSizeValue): void;
}

/** A button that shows the size in use and opens a searchable list of sizes. */
function SizeCombobox({
  id,
  legendId,
  options,
  value,
  format,
  disabled,
  onChange,
}: SizeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => isSameSize(option.value, value));
  const isOpen = open && !disabled;
  const valueId = `${id}-value`;

  function handleChoose(option: TireSizeOption) {
    onChange(option.value);
    setOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-labelledby={`${legendId} ${valueId}`}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span id={valueId} className="truncate">
            {selected?.label ?? format(value)}
          </span>
          <CaretUpDownIcon aria-hidden="true" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-64 gap-0 p-0"
      >
        <SizeList options={options} selectedId={selected?.id} onChoose={handleChoose} />
      </PopoverContent>
    </Popover>
  );
}

interface ManualSizeFieldProps {
  id: string;
  value: TireSizeValue;
  parse(text: string): TireSizeValue | undefined;
  format(value: TireSizeValue): string;
  disabled: boolean;
  onChange(next: TireSizeValue): void;
}

/**
 * A text field for a size. While it has focus it keeps the text as typed, and each text that
 * `parse` reads is reported. When it loses focus it shows the size in its standard form again.
 */
function ManualSizeField({ id, value, parse, format, disabled, onChange }: ManualSizeFieldProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const errorId = `${id}-error`;
  const invalid = draft !== null && draft.trim() !== "" && parse(draft) === undefined;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setDraft(text);
    const parsed = parse(text);
    if (parsed) onChange(parsed);
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>Tire size</FieldLabel>
      <Input
        id={id}
        placeholder="LT315/75R16 or 35x12.50R17"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={draft ?? format(value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={handleChange}
        onBlur={() => setDraft(null)}
      />
      {invalid ? <FieldError id={errorId}>{INVALID_SIZE_MESSAGE}</FieldError> : null}
    </Field>
  );
}

/**
 * The size of one set of tires, entered one of two ways: chosen from a searchable list of sizes
 * (Choose tire size), or typed as text (Manual tire size). Both ways show the overall diameter.
 * The list opens first when the size is one of its options, and the text field opens first when
 * it is not.
 */
export function TireSizeFields({
  id,
  legend,
  description,
  value,
  diameterIn,
  options,
  parse,
  format,
  onChange,
  disabled = false,
}: TireSizeFieldsProps) {
  const legendId = `${id}-legend`;
  const descriptionId = `${id}-description`;
  const listId = `${id}-list`;
  const manualId = `${id}-manual`;
  const diameterId = `${id}-diameter`;
  const startsOnList = options.some((option) => isSameSize(option.value, value));

  return (
    <FieldSet disabled={disabled} aria-describedby={description ? descriptionId : undefined}>
      <FieldLegend id={legendId}>{legend}</FieldLegend>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      <Tabs defaultValue={startsOnList ? "choose" : "manual"}>
        <TabsList className="group-data-horizontal/tabs:h-7">
          <TabsTrigger value="choose" disabled={disabled}>
            Choose tire size
          </TabsTrigger>
          <TabsTrigger value="manual" disabled={disabled}>
            Manual tire size
          </TabsTrigger>
        </TabsList>
        <TabsContent value="choose">
          <SizeRow
            align="end"
            diameter={<DiameterOutput id={diameterId} inputId={listId} diameterIn={diameterIn} />}
          >
            <SizeCombobox
              id={listId}
              legendId={legendId}
              options={options}
              value={value}
              format={format}
              disabled={disabled}
              onChange={onChange}
            />
          </SizeRow>
        </TabsContent>
        <TabsContent value="manual">
          <SizeRow
            align="start"
            diameter={<DiameterOutput id={diameterId} inputId={manualId} diameterIn={diameterIn} />}
          >
            <ManualSizeField
              id={manualId}
              value={value}
              parse={parse}
              format={format}
              disabled={disabled}
              onChange={onChange}
            />
          </SizeRow>
        </TabsContent>
      </Tabs>
    </FieldSet>
  );
}
