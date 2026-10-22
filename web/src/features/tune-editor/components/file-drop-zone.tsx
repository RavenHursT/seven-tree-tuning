"use client";

import * as React from "react";
import { UploadSimpleIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import { FieldDescription } from "@/components/ui/field";

export interface FileDropZoneProps {
  id: string;
  accept: string;
  onFileSelected(file: File): void;
  disabled?: boolean;
  selectedFileName?: string;
  description?: React.ReactNode;
}

const PROMPT = "Drop a file here, or click to browse";
const DRAGGING_PROMPT = "Drop the file to load it";

const DROP_TARGET_CLASS = cn(
  "group/zone relative flex flex-col items-center justify-center gap-1.5 border border-dashed border-input px-4 py-8 text-center text-xs transition-colors",
  "hover:border-ring hover:bg-muted/50",
  "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-ring/50",
  "data-[dragging=true]:border-primary data-[dragging=true]:bg-accent",
  "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[disabled=true]:hover:border-input data-[disabled=true]:hover:bg-transparent",
);

type DropEvent = React.DragEvent<HTMLDivElement>;

interface DropHandlers {
  onDragEnter(event: DropEvent): void;
  onDragOver(event: DropEvent): void;
  onDragLeave(event: DropEvent): void;
  onDrop(event: DropEvent): void;
}

function carriesFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function formatAccepted(accept: string): string {
  return accept
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean)
    .join(", ");
}

function relatedIds(id: string) {
  return {
    accepted: `${id}-accepted`,
    selected: `${id}-selected`,
    description: `${id}-description`,
  };
}

function useFileDrop(disabled: boolean, onFileSelected: (file: File) => void) {
  const [dragging, setDragging] = React.useState(false);
  const handlers: DropHandlers = {
    onDragEnter(event) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragging(!disabled);
    },
    onDragOver(event) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      setDragging(!disabled);
    },
    onDragLeave(event) {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDragging(false);
    },
    onDrop(event) {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file && !disabled) onFileSelected(file);
    },
  };
  return { dragging, handlers };
}

interface DropTargetProps {
  id: string;
  accept: string;
  dragging: boolean;
  disabled: boolean;
  describedBy: string;
  handlers: DropHandlers;
  onFileSelected(file: File): void;
}

function DropTarget({
  id,
  accept,
  dragging,
  disabled,
  describedBy,
  handlers,
  onFileSelected,
}: DropTargetProps) {
  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFileSelected(file);
  }

  return (
    <div
      data-slot="file-drop-zone"
      data-dragging={dragging}
      data-disabled={disabled}
      className={DROP_TARGET_CLASS}
      {...handlers}
    >
      <UploadSimpleIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <label
        htmlFor={id}
        className="cursor-pointer font-medium group-data-[disabled=true]/zone:cursor-not-allowed after:absolute after:inset-0"
      >
        {dragging ? DRAGGING_PROMPT : PROMPT}
      </label>
      <span id={relatedIds(id).accepted} className="text-muted-foreground">
        Accepts {formatAccepted(accept)}
      </span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={handleInputChange}
        className="sr-only"
      />
    </div>
  );
}

export function FileDropZone({
  id,
  accept,
  onFileSelected,
  disabled = false,
  selectedFileName,
  description,
}: FileDropZoneProps) {
  const { dragging, handlers } = useFileDrop(disabled, onFileSelected);
  const ids = relatedIds(id);
  const describedBy = [
    selectedFileName ? ids.selected : null,
    ids.accepted,
    description ? ids.description : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <DropTarget
        id={id}
        accept={accept}
        dragging={dragging}
        disabled={disabled}
        describedBy={describedBy}
        handlers={handlers}
        onFileSelected={onFileSelected}
      />
      {selectedFileName ? (
        <p id={ids.selected} className="text-xs">
          Selected: <span className="font-medium">{selectedFileName}</span>
        </p>
      ) : null}
      {description ? <FieldDescription id={ids.description}>{description}</FieldDescription> : null}
    </div>
  );
}
