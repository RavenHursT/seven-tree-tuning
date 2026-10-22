/** Where a generated tune file goes once its bytes are ready. */
export interface SaveTarget {
  readonly fileName: string;
  write(bytes: Uint8Array): Promise<void>;
}

interface SaveFilePickerOptions {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}

interface WritableFile {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

/** How long a download link's file stays available. Firefox and Safari need more than 0 ms. */
const LINK_FILE_LIFETIME_MS = 60_000;

interface SaveFileHandle {
  readonly name: string;
  createWritable(): Promise<WritableFile>;
}

/** Chromium browsers expose the File System Access "Save as" dialog; others do not. */
type WindowWithSaveDialog = Window & {
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<SaveFileHandle>;
};

/**
 * Asks where to save a .hcf file. Call it first in the click handler, before other awaited
 * work: browsers open the "Save as" dialog only during the click's user activation.
 *
 * Uses the File System Access save dialog when the browser has it. Otherwise the returned
 * target downloads through a temporary link. Returns null when the person cancels the dialog.
 */
export async function chooseSaveTarget(suggestedName: string): Promise<SaveTarget | null> {
  const showSaveFilePicker = (window as WindowWithSaveDialog).showSaveFilePicker;
  if (!showSaveFilePicker) {
    return { fileName: suggestedName, write: (bytes) => downloadThroughLink(bytes, suggestedName) };
  }

  let handle: SaveFileHandle;
  try {
    handle = await showSaveFilePicker.call(window, {
      suggestedName,
      types: [{ description: "Hydra tune file", accept: { "application/octet-stream": [".hcf"] } }],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }

  return {
    fileName: handle.name,
    write: async (bytes) => {
      const writable = await handle.createWritable();
      try {
        await writable.write(bytes);
      } catch (error) {
        // Discards the partly written file instead of leaving it on disk.
        await writable.abort(error);
        throw error;
      }
      await writable.close();
    },
  };
}

async function downloadThroughLink(bytes: Uint8Array, fileName: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), LINK_FILE_LIFETIME_MS);
}
