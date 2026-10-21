"use client";

import * as React from "react";
import { CheckIcon, FilesIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export interface LibraryTuneOption {
  fileName: string;
  code: string;
  label: string;
  description?: string;
  category: string;
  categoryLabel: string;
  valveBody: boolean;
}

export interface LibraryTunePickerProps {
  tunes: readonly LibraryTuneOption[];
  selectedFileName?: string;
  loadingFileName?: string;
  onSelect(fileName: string): void;
  sourceUrl?: string;
  disabled?: boolean;
}

interface TuneGroup {
  label: string;
  tunes: LibraryTuneOption[];
}

const OPTION_CLASS = cn(
  "flex w-full cursor-pointer items-start gap-3 border border-transparent px-3 py-2.5 text-left text-xs transition-colors outline-none",
  "hover:bg-muted focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
  "aria-selected:border-primary/50 aria-selected:bg-accent",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent",
);

function groupByCategoryLabel(tunes: readonly LibraryTuneOption[]): TuneGroup[] {
  const groups = new Map<string, LibraryTuneOption[]>();
  for (const tune of tunes) {
    const group = groups.get(tune.categoryLabel);
    if (group) group.push(tune);
    else groups.set(tune.categoryLabel, [tune]);
  }
  return Array.from(groups, ([label, items]) => ({ label, tunes: items }));
}

function pickTabStop(
  tunes: readonly LibraryTuneOption[],
  ...candidates: (string | undefined)[]
): string | undefined {
  const known = candidates.find((name) => tunes.some((tune) => tune.fileName === name));
  return known ?? tunes[0]?.fileName;
}

function nextFocusIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case "ArrowDown":
      return Math.min(current + 1, count - 1);
    case "ArrowUp":
      return Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

function moveFocusWithKeys(event: React.KeyboardEvent<HTMLDivElement>) {
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
  const index = nextFocusIndex(
    event.key,
    options.indexOf(event.target as HTMLElement),
    options.length,
  );
  if (index === null) return;
  event.preventDefault();
  options[index]?.focus();
}

function TuneOptionText({ tune }: { tune: LibraryTuneOption }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{tune.label}</span>
        {tune.valveBody ? <Badge variant="outline">valve body</Badge> : null}
      </div>
      <span className="font-mono text-xs text-muted-foreground">{tune.code}</span>
      {tune.description ? (
        <p className="text-xs/relaxed text-muted-foreground">{tune.description}</p>
      ) : null}
    </div>
  );
}

function TuneOptionStatus({ loading, selected }: { loading: boolean; selected: boolean }) {
  return (
    <div className="flex size-4 shrink-0 items-center justify-center">
      {loading ? (
        <Spinner role="presentation" aria-hidden="true" aria-label={undefined} />
      ) : selected ? (
        <CheckIcon aria-hidden="true" className="size-4 text-primary" />
      ) : null}
    </div>
  );
}

interface TuneOptionProps {
  tune: LibraryTuneOption;
  selected: boolean;
  loading: boolean;
  disabled: boolean;
  tabStop: boolean;
  onChoose(fileName: string): void;
  onFocusOption(fileName: string): void;
}

function TuneOption({
  tune,
  selected,
  loading,
  disabled,
  tabStop,
  onChoose,
  onFocusOption,
}: TuneOptionProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onChoose(tune.fileName);
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      tabIndex={tabStop ? 0 : -1}
      onClick={() => onChoose(tune.fileName)}
      onKeyDown={handleKeyDown}
      onFocus={() => onFocusOption(tune.fileName)}
      className={OPTION_CLASS}
    >
      <TuneOptionText tune={tune} />
      <TuneOptionStatus loading={loading} selected={selected} />
    </div>
  );
}

interface TuneGroupSectionProps {
  label: string;
  headingId: string;
  children: React.ReactNode;
}

function TuneGroupSection({ label, headingId, children }: TuneGroupSectionProps) {
  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-1">
      <div id={headingId} className="px-3 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

interface TuneListboxProps {
  tunes: readonly LibraryTuneOption[];
  selectedFileName?: string;
  loadingFileName?: string;
  tabStopFileName?: string;
  disabled: boolean;
  onChoose(fileName: string): void;
  onFocusOption(fileName: string): void;
}

function TuneListbox({
  tunes,
  selectedFileName,
  loadingFileName,
  tabStopFileName,
  disabled,
  onChoose,
  onFocusOption,
}: TuneListboxProps) {
  const baseId = React.useId();

  return (
    <div
      role="listbox"
      aria-label="Public library tunes"
      onKeyDown={moveFocusWithKeys}
      className="flex flex-col gap-4"
    >
      {groupByCategoryLabel(tunes).map((group, index) => (
        <TuneGroupSection
          key={group.label}
          label={group.label}
          headingId={`${baseId}-group-${index}`}
        >
          {group.tunes.map((tune) => (
            <TuneOption
              key={tune.fileName}
              tune={tune}
              selected={tune.fileName === selectedFileName}
              loading={tune.fileName === loadingFileName}
              disabled={disabled}
              tabStop={tune.fileName === tabStopFileName}
              onChoose={onChoose}
              onFocusOption={onFocusOption}
            />
          ))}
        </TuneGroupSection>
      ))}
    </div>
  );
}

function LoadingAnnouncement({ label }: { label?: string }) {
  return (
    <div role="status" className="sr-only">
      {label ? `Loading ${label}…` : null}
    </div>
  );
}

function SourceFootnote({ sourceUrl }: { sourceUrl: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Source:{" "}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4 hover:text-primary"
      >
        Power Hungry Performance public library
      </a>
    </p>
  );
}

function NoTunes() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FilesIcon />
        </EmptyMedia>
        <EmptyTitle>No library tunes</EmptyTitle>
        <EmptyDescription>
          No tunes are available from the public library right now.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function LibraryTunePicker({
  tunes,
  selectedFileName,
  loadingFileName,
  onSelect,
  sourceUrl,
  disabled = false,
}: LibraryTunePickerProps) {
  const [activeFileName, setActiveFileName] = React.useState<string | undefined>();
  const loadingTune = tunes.find((tune) => tune.fileName === loadingFileName);

  function handleChoose(fileName: string) {
    if (!disabled) onSelect(fileName);
  }

  return (
    <div data-slot="library-tune-picker" className="flex flex-col gap-4">
      {tunes.length === 0 ? (
        <NoTunes />
      ) : (
        <>
          <TuneListbox
            tunes={tunes}
            selectedFileName={selectedFileName}
            loadingFileName={loadingFileName}
            tabStopFileName={pickTabStop(tunes, activeFileName, selectedFileName)}
            disabled={disabled}
            onChoose={handleChoose}
            onFocusOption={setActiveFileName}
          />
          <LoadingAnnouncement label={loadingTune?.label} />
        </>
      )}
      {sourceUrl ? <SourceFootnote sourceUrl={sourceUrl} /> : null}
    </div>
  );
}
