"use client";

import { isChipSerial } from "@seven-tree/hydra";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

import { useTuneEditor } from "../tune-editor-provider";

/**
 * What is loading or waiting, and why a load failed. The page puts it outside every module, so
 * collapsing a module never hides an alert. The open tune shows in the Base Tune module.
 */
export function TuneStatus() {
  const { state } = useTuneEditor();
  const { loading, loadError, pendingFile, chipSerial } = state;
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
    </div>
  );
}
