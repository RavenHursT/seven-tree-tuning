"use client";

import { FileDropZone } from "../components/file-drop-zone";
import { useTuneEditor } from "../tune-editor-provider";

export function UploadSection() {
  const { state, openFile } = useTuneEditor();
  const uploadedName =
    state.tune?.source.kind === "upload" ? state.tune.source.fileName : undefined;

  return (
    <FileDropZone
      id="tune-file"
      accept=".hcf,.efu,.bin"
      onFileSelected={(file) => void openFile(file)}
      disabled={state.loading !== null}
      selectedFileName={state.pendingFile?.fileName ?? uploadedName}
      description={
        <>
          A <code>.hcf</code> from HydraFlash (needs the chip serial), a PHP library{" "}
          <code>.efu</code>, or a decrypted <code>.bin</code>.
        </>
      }
    />
  );
}
