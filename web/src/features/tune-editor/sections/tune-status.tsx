"use client";

import { isChipSerial, type ContainerFormat } from "@seven-tree/hydra";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

import { useTuneEditor } from "../tune-editor-provider";

const FORMAT_LABELS: Readonly<Record<ContainerFormat, string>> = {
  hcf: "Hydra .hcf",
  efu: "PHP library .efu",
  bin: "decrypted .bin",
};

/** What is loaded, loading or waiting, and why a load failed. */
export function TuneStatus() {
  const { state } = useTuneEditor();
  const { loading, loadError, pendingFile, tune, chipSerial } = state;
  const needsSerial = pendingFile !== null && loadError === null && !isChipSerial(chipSerial);

  return (
    <div className="space-y-3" aria-live="polite">
      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> {`Opening ${loading.fileName}…`}
        </p>
      )}
      {needsSerial && (
        <Alert>
          <AlertTitle>Chip serial needed</AlertTitle>
          <AlertDescription>
            {`Enter the chip serial to open ${pendingFile.fileName}. A .hcf file is encrypted with it.`}
          </AlertDescription>
        </Alert>
      )}
      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>Could not open the tune</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {tune && (
        <p className="text-sm">
          Editing <span className="font-semibold">{tune.source.fileName}</span>
          {` · ${FORMAT_LABELS[tune.source.format]}`}
        </p>
      )}
    </div>
  );
}
