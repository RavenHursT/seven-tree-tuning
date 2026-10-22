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

/** The numbers in the Width, Height and Rim fields of the Manual tab, as typed. */
export interface TireSizeParts {
  /** Millimetres for a metric size, inches for a flotation size. */
  width: string;
  /** The aspect ratio of a metric size, the overall diameter of a flotation size. */
  height: string;
  rim: string;
}

export interface TireSizeFieldsProps {
  id: string;
  legend: string;
  description?: React.ReactNode;
  value: TireSizeValue;
  diameterIn?: number;
  options: readonly TireSizeOption[];
  /** The Width, Height and Rim numbers of a size, as the Manual tab shows them. */
  toParts(value: TireSizeValue): TireSizeParts;
  /** Reads the Width, Height and Rim numbers. Returns undefined when they are not a size. */
  fromParts(parts: TireSizeParts): TireSizeValue | undefined;
  /** Writes a size as text, for the list button when the size is not one of the options. */
  format(value: TireSizeValue): string;
  onChange(next: TireSizeValue): void;
  disabled?: boolean;
}

const PART_FIELDS: readonly { name: keyof TireSizeParts; label: string; placeholder: string }[] = [
  { name: "width", label: "Width", placeholder: "315" },
  { name: "height", label: "Height", placeholder: "75" },
  { name: "rim", label: "Rim", placeholder: "16" },
];

const PARTS_EXAMPLES =
  "For 315/75R16, enter 315, 75 and 16. For 35x12.50R17, enter 12.50, 35 and 17.";
const INVALID_PARTS_MESSAGE = "These three numbers are not a tire size.";

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
  /** The ids of the controls the diameter is computed from, separated by spaces. */
  inputIds: string;
  diameterIn: number | undefined;
}

function DiameterOutput({ id, inputIds, diameterIn }: DiameterOutputProps) {
  const labelId = `${id}-label`;

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs leading-snug">
        Diameter
      </span>
      <output
        id={id}
        htmlFor={inputIds}
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

/** The ids of the Width, Height and Rim fields of the manual fields with this id. */
function partFieldIds(id: string): string {
  return PART_FIELDS.map(({ name }) => `${id}-${name}`).join(" ");
}

interface ManualSizePartsProps {
  id: string;
  value: TireSizeValue;
  toParts(value: TireSizeValue): TireSizeParts;
  fromParts(parts: TireSizeParts): TireSizeValue | undefined;
  disabled: boolean;
  /** The diameter output, shown in line with the three fields. */
  diameter: React.ReactNode;
  onChange(next: TireSizeValue): void;
}

/**
 * Width, Height and Rim fields for a size, under the label "Tire/Rim size". While the focus is in
 * any of the three, they keep the numbers as typed, and each set of numbers that `fromParts` reads
 * is reported. When the focus leaves all three, they show the size in use again.
 */
function ManualSizeParts({
  id,
  value,
  toParts,
  fromParts,
  disabled,
  diameter,
  onChange,
}: ManualSizePartsProps) {
  const [draft, setDraft] = React.useState<TireSizeParts | null>(null);
  const shown = draft ?? toParts(value);
  const examplesId = `${id}-examples`;
  const errorId = `${id}-error`;
  const filled = draft !== null && PART_FIELDS.every(({ name }) => draft[name].trim() !== "");
  const invalid = filled && fromParts(shown) === undefined;

  function handleChange(name: keyof TireSizeParts, text: string) {
    const next = { ...shown, [name]: text };
    setDraft(next);
    const size = fromParts(next);
    if (size) onChange(size);
  }

  function handleBlur(event: React.FocusEvent<HTMLFieldSetElement>) {
    // Moving between the three fields keeps the numbers; leaving all three shows the size in use.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraft(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <SizeRow align="end" diameter={diameter}>
        <FieldSet className="gap-0" onBlur={handleBlur}>
          <FieldLegend variant="label">Tire/Rim size</FieldLegend>
          <div className="grid grid-cols-3 gap-2">
            {PART_FIELDS.map(({ name, label, placeholder }) => (
              <Field key={name} data-invalid={invalid}>
                <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
                <Input
                  id={`${id}-${name}`}
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={placeholder}
                  disabled={disabled}
                  value={shown[name]}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${errorId} ${examplesId}` : examplesId}
                  onChange={(event) => handleChange(name, event.target.value)}
                />
              </Field>
            ))}
          </div>
        </FieldSet>
      </SizeRow>
      <FieldDescription id={examplesId}>{PARTS_EXAMPLES}</FieldDescription>
      {invalid ? <FieldError id={errorId}>{INVALID_PARTS_MESSAGE}</FieldError> : null}
    </div>
  );
}

/**
 * The size of one set of tires, entered one of two ways: chosen from a searchable list of sizes
 * (Choose tire size), or entered as its width, height and rim (Manual tire size). Both ways show
 * the overall diameter. The list opens first when the size is one of its options, and the manual
 * fields open first when it is not.
 */
export function TireSizeFields({
  id,
  legend,
  description,
  value,
  diameterIn,
  options,
  toParts,
  fromParts,
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
            diameter={<DiameterOutput id={diameterId} inputIds={listId} diameterIn={diameterIn} />}
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
          <ManualSizeParts
            id={manualId}
            value={value}
            toParts={toParts}
            fromParts={fromParts}
            disabled={disabled}
            diameter={
              <DiameterOutput
                id={diameterId}
                inputIds={partFieldIds(manualId)}
                diameterIn={diameterIn}
              />
            }
            onChange={onChange}
          />
        </TabsContent>
      </Tabs>
    </FieldSet>
  );
}
