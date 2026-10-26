"use client";

import { isChipSerial, normalizeChipSerial } from "@seven-tree/hydra";
import { createContext, use, useReducer, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { libraryTuneApiPath, readLibraryApiError } from "@/features/library/api";
import { chooseSaveTarget } from "@/lib/save-file";

import { DiscardChangesDialog, type DiscardRequest } from "./components/discard-changes-dialog";
import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./state/editor-reducer";
import { selectChangeSummary, selectGenerateDisabledReason } from "./state/editor-selectors";
import type { TuneSourceKind } from "./state/loaded-tune";
import {
  buildTuneFile,
  decodeTuneFile,
  describeError,
  needsChipSerial,
  outputFileWithExtension,
  tuneFileProblem,
} from "./state/tune-files";

/** Editor state plus the actions that need more than a reducer: file reads, fetches, saving. */
export interface TuneEditor {
  readonly state: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly generating: boolean;
  setChipSerial(value: string): void;
  /** Opens a picked or dropped file; asks first when it would discard changes. */
  openFile(file: File): void;
  /** Opens a PHP library tune; asks first when it would discard changes. */
  openLibraryTune(fileName: string): void;
  resetAll(): void;
  applyTireCompensation(): void;
  generate(): Promise<void>;
}

const TuneEditorContext = createContext<TuneEditor | null>(null);

export function TuneEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [generating, startGenerating] = useTransition();
  const [discardRequest, setDiscardRequest] = useState<DiscardRequest | null>(null);

  /** Runs `proceed` now, or after the person confirms when it would discard their changes. */
  function confirmDiscard(message: string, proceed: () => void, { shiftPointsOnly = false } = {}) {
    const summary = selectChangeSummary(state);
    // Tire compensation rewrites the shift points only; every other edit survives it.
    const otherChanges =
      summary.idleChanged ||
      summary.changedLockupPoints > 0 ||
      summary.changedFirmnessPoints > 0 ||
      summary.changedGridCells > 0;
    const loses = summary.changedShiftPoints > 0 || (!shiftPointsOnly && otherChanges);
    if (loses) setDiscardRequest({ message, proceed });
    else proceed();
  }

  function openBytes(bytes: Uint8Array, fileName: string, kind: TuneSourceKind, serial: string) {
    try {
      dispatch({ type: "loadSucceeded", tune: decodeTuneFile(bytes, fileName, kind, serial) });
    } catch (error) {
      dispatch({ type: "loadFailed", message: describeError(error) });
    }
  }

  function setChipSerial(value: string) {
    dispatch({ type: "chipSerialChanged", value });
    const serial = normalizeChipSerial(value);
    const pending = state.pendingFile;
    if (pending && isChipSerial(serial)) {
      openBytes(pending.bytes, pending.fileName, "upload", serial);
    }
  }

  function openFile(file: File) {
    const problem = tuneFileProblem(file.name, file.size);
    if (problem) {
      dispatch({ type: "loadFailed", message: problem });
      return;
    }
    confirmDiscard(`Opening ${file.name} replaces the tune you are editing.`, () => {
      void readAndOpen(file);
    });
  }

  async function readAndOpen(file: File) {
    dispatch({ type: "loadStarted", kind: "upload", fileName: file.name });
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      dispatch({ type: "loadFailed", message: `Could not read ${file.name}.` });
      return;
    }
    if (needsChipSerial(file.name)) {
      // Kept until it opens, so a missing or wrong serial can be fixed without picking it again.
      dispatch({ type: "pendingFileHeld", file: { fileName: file.name, bytes } });
      if (!isChipSerial(state.chipSerial)) return;
    }
    openBytes(bytes, file.name, "upload", state.chipSerial);
  }

  function openLibraryTune(fileName: string) {
    confirmDiscard(`Opening ${fileName} replaces the tune you are editing.`, () => {
      void downloadAndOpen(fileName);
    });
  }

  async function downloadAndOpen(fileName: string) {
    dispatch({ type: "loadStarted", kind: "library", fileName });
    let bytes: Uint8Array;
    try {
      bytes = await downloadLibraryTune(fileName);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "the server did not answer.";
      dispatch({ type: "loadFailed", message: `Could not download ${fileName}: ${reason}` });
      return;
    }
    openBytes(bytes, fileName, "library", state.chipSerial);
  }

  function resetAll() {
    confirmDiscard("Reset all changes puts every value back to the base tune.", () =>
      dispatch({ type: "allReset" }),
    );
  }

  function applyTireCompensation() {
    confirmDiscard(
      "Set shift points for these tires replaces the shift points you changed.",
      () => dispatch({ type: "tireCompensationApplied" }),
      { shiftPointsOnly: true },
    );
  }

  async function generate() {
    const { tune, values, chipSerial, outputFileName } = state;
    if (!tune || !values || selectGenerateDisabledReason(state)) return;

    let bytes: Uint8Array;
    let target;
    try {
      // Build first, so a failure cannot leave an empty file behind. It is synchronous, so the
      // click still counts as a user action when the save dialog opens next.
      bytes = buildTuneFile(tune, values, chipSerial);
      target = await chooseSaveTarget(outputFileWithExtension(outputFileName));
    } catch (error) {
      toast.error(describeError(error));
      return;
    }
    if (!target) return;

    const saveTarget = target;
    startGenerating(async () => {
      try {
        await saveTarget.write(bytes);
        toast.success(`Saved ${saveTarget.fileName}`);
      } catch (error) {
        toast.error(describeError(error));
      }
    });
  }

  const editor: TuneEditor = {
    state,
    dispatch,
    generating,
    setChipSerial,
    openFile,
    openLibraryTune,
    resetAll,
    applyTireCompensation,
    generate,
  };
  return (
    <TuneEditorContext value={editor}>
      {children}
      <DiscardChangesDialog request={discardRequest} onClose={() => setDiscardRequest(null)} />
    </TuneEditorContext>
  );
}

export function useTuneEditor(): TuneEditor {
  const editor = use(TuneEditorContext);
  if (!editor) throw new Error("useTuneEditor needs a TuneEditorProvider above it.");
  return editor;
}

async function downloadLibraryTune(fileName: string): Promise<Uint8Array> {
  const response = await fetch(libraryTuneApiPath(fileName));
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(readLibraryApiError(body) ?? `the server answered HTTP ${response.status}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
