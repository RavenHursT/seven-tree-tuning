"use client";

import { createContext, use, useReducer, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { chooseSaveTarget } from "@/lib/save-file";

import {
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from "./state/editor-reducer";
import { isValidChipSerial, selectGenerateDisabledReason } from "./state/editor-selectors";
import type { TuneSourceKind } from "./state/loaded-tune";
import {
  buildTuneFile,
  decodeTuneFile,
  describeError,
  needsChipSerial,
  outputFileWithExtension,
} from "./state/tune-files";

/** Editor state plus the actions that need more than a reducer: file reads, fetches, saving. */
export interface TuneEditor {
  readonly state: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly generating: boolean;
  setChipSerial(value: string): void;
  openFile(file: File): Promise<void>;
  openLibraryTune(fileName: string): Promise<void>;
  generate(): Promise<void>;
}

const TuneEditorContext = createContext<TuneEditor | null>(null);

export function TuneEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [generating, startGenerating] = useTransition();

  function openBytes(bytes: Uint8Array, fileName: string, kind: TuneSourceKind, serial: string) {
    try {
      dispatch({ type: "loadSucceeded", tune: decodeTuneFile(bytes, fileName, kind, serial) });
    } catch (error) {
      dispatch({ type: "loadFailed", message: describeError(error) });
    }
  }

  function setChipSerial(value: string) {
    dispatch({ type: "chipSerialChanged", value });
    const serial = value.trim().toUpperCase();
    const pending = state.pendingFile;
    if (pending && isValidChipSerial(serial)) {
      openBytes(pending.bytes, pending.fileName, "upload", serial);
    }
  }

  async function openFile(file: File) {
    dispatch({ type: "loadStarted", kind: "upload", fileName: file.name });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (needsChipSerial(file.name)) {
      // Kept until it opens, so a missing or wrong serial can be fixed without picking it again.
      dispatch({ type: "pendingFileHeld", file: { fileName: file.name, bytes } });
      if (!isValidChipSerial(state.chipSerial)) return;
    }
    openBytes(bytes, file.name, "upload", state.chipSerial);
  }

  async function openLibraryTune(fileName: string) {
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

  async function generate() {
    const { tune, values, chipSerial, outputFileName } = state;
    if (!tune || !values || selectGenerateDisabledReason(state)) return;

    let target;
    try {
      // First, while the click still counts as a user action: the save dialog needs one.
      target = await chooseSaveTarget(outputFileWithExtension(outputFileName));
    } catch (error) {
      toast.error(describeError(error));
      return;
    }
    if (!target) return;

    const saveTarget = target;
    startGenerating(async () => {
      try {
        await saveTarget.write(buildTuneFile(tune, values, chipSerial));
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
    generate,
  };
  return <TuneEditorContext value={editor}>{children}</TuneEditorContext>;
}

export function useTuneEditor(): TuneEditor {
  const editor = use(TuneEditorContext);
  if (!editor) throw new Error("useTuneEditor needs a TuneEditorProvider above it.");
  return editor;
}

async function downloadLibraryTune(fileName: string): Promise<Uint8Array> {
  const response = await fetch(`/api/library/${encodeURIComponent(fileName)}`);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `the server answered HTTP ${response.status}.`;
    throw new Error(message);
  }
  return new Uint8Array(await response.arrayBuffer());
}
