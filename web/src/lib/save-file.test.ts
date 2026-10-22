import { afterEach, describe, expect, it, vi } from "vitest";

import { chooseSaveTarget } from "./save-file";

type PickerWindow = Window & { showSaveFilePicker?: unknown };

function fakeHandle(name: string, write: (data: Uint8Array) => Promise<void> = async () => {}) {
  const writable = {
    write: vi.fn(write),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  };
  return { handle: { name, createWritable: vi.fn(async () => writable) }, writable };
}

afterEach(() => {
  delete (window as PickerWindow).showSaveFilePicker;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("chooseSaveTarget with the File System Access save dialog", () => {
  it("opens the dialog with the suggested .hcf name and writes the bytes to the chosen file", async () => {
    const { handle, writable } = fakeHandle("my-tune.hcf");
    const picker = vi.fn(async () => handle);
    (window as PickerWindow).showSaveFilePicker = picker;

    const target = await chooseSaveTarget("TDE1_TUNE-CUSTOM.hcf");
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: "TDE1_TUNE-CUSTOM.hcf",
        types: [expect.objectContaining({ accept: { "application/octet-stream": [".hcf"] } })],
      }),
    );
    expect(target?.fileName).toBe("my-tune.hcf");

    const bytes = new Uint8Array([1, 2, 3]);
    await target?.write(bytes);
    expect(writable.write).toHaveBeenCalledWith(bytes);
    expect(writable.close).toHaveBeenCalled();
    expect(writable.abort).not.toHaveBeenCalled();
  });

  it("aborts the chosen file when writing fails, so no partial file is kept", async () => {
    const { handle, writable } = fakeHandle("my-tune.hcf", async () => {
      throw new DOMException("Disk full", "QuotaExceededError");
    });
    (window as PickerWindow).showSaveFilePicker = vi.fn(async () => handle);

    const target = await chooseSaveTarget("a.hcf");

    await expect(target?.write(new Uint8Array([1]))).rejects.toThrow("Disk full");
    expect(writable.abort).toHaveBeenCalled();
    expect(writable.close).not.toHaveBeenCalled();
  });

  it("returns null when the person cancels the dialog", async () => {
    (window as PickerWindow).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });

    await expect(chooseSaveTarget("a.hcf")).resolves.toBeNull();
  });

  it("passes on any other error from the dialog", async () => {
    (window as PickerWindow).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException("Blocked", "SecurityError");
    });

    await expect(chooseSaveTarget("a.hcf")).rejects.toThrow("Blocked");
  });
});

describe("chooseSaveTarget without the save dialog", () => {
  it("downloads through a temporary link and frees the file a minute later", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:tune");
    const revokeObjectURL = vi.fn();
    // A subclass keeps the real URL global untouched.
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const clicked: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ download: this.download, href: this.href });
    });

    const target = await chooseSaveTarget("TDE1_TUNE-CUSTOM.hcf");
    expect(target?.fileName).toBe("TDE1_TUNE-CUSTOM.hcf");
    await target?.write(new Uint8Array([9]));

    expect(clicked).toEqual([{ download: "TDE1_TUNE-CUSTOM.hcf", href: "blob:tune" }]);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(document.querySelector("a[download]")).toBeNull();

    // Firefox and Safari can cancel a download whose URL is freed straight away.
    vi.advanceTimersByTime(59_000);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tune");
  });
});
