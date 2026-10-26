import { expect, type Download, type Locator, type Page } from "@playwright/test";

import { CHIP_SERIAL } from "./tune-files";

export type CurveColumn = "shift point" | "speedometer";

/** The closed-throttle row of a curve. Its spoken name is "0% throttle". */
export const CLOSED_THROTTLE = "0%";

/** The 3→4 upshift curve, as the page titles it. */
export const UPSHIFT_3_4 = "3→4 (overdrive)";

export interface UploadedFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

type WindowWithSaveDialog = Window & { showSaveFilePicker?: unknown };

/**
 * Finds the editor's fields by the names a screen reader gives them, and does what a person does
 * with them. It only acts and waits. The tests make the checks.
 */
export class EditorPage {
  readonly chipSerial: Locator;
  readonly fileInput: Locator;
  /** The line "Editing <file> · <format>" that shows once a tune is open. */
  readonly editingStatus: Locator;
  readonly warmIdle: Locator;
  readonly outputFile: Locator;
  readonly generateButton: Locator;
  readonly libraryTab: Locator;
  readonly libraryTunes: Locator;
  readonly libraryUnavailable: Locator;

  constructor(private readonly page: Page) {
    this.chipSerial = page.getByRole("textbox", { name: "Chip serial", exact: true });
    this.fileInput = page.getByLabel("Drop a file here, or click to browse", { exact: true });
    this.editingStatus = page.getByText(/^Editing /);
    this.warmIdle = page.getByRole("textbox", { name: "Warm idle (rpm)", exact: true });
    this.outputFile = page.getByRole("textbox", { name: "Output file", exact: true });
    this.generateButton = page.getByRole("button", { name: "Generate Tune", exact: true });
    this.libraryTab = page.getByRole("tab", { name: "PHP public library", exact: true });
    this.libraryTunes = page.getByRole("listbox", { name: "Public library tunes" });
    this.libraryUnavailable = page.getByText("PHP's library is unavailable", { exact: true });
  }

  /**
   * Chromium opens a native "Save as" dialog when `window.showSaveFilePicker` exists, and a
   * headless run cannot drive it. Without that function the app saves through a download link.
   * Call this before `open()`.
   */
  async saveByDownload(): Promise<void> {
    await this.page.addInitScript(() => {
      delete (window as WindowWithSaveDialog).showSaveFilePicker;
    });
  }

  /**
   * Opens the editor. React 19 keeps text typed and files chosen before it attaches to the
   * server-rendered fields, so the steps need no extra wait.
   */
  async open(): Promise<void> {
    await this.page.goto("/");
  }

  /** Types the serial one key at a time, as a person does. */
  async enterChipSerial(serial = CHIP_SERIAL): Promise<void> {
    await this.chipSerial.pressSequentially(serial);
  }

  async chooseFile(file: UploadedFile): Promise<void> {
    await this.fileInput.setInputFiles(file);
  }

  /** Types the serial, picks the file, and waits until the editor shows that file. */
  async openUpload(file: UploadedFile): Promise<void> {
    await this.enterChipSerial();
    await this.chooseFile(file);
    await expect(this.editingStatus).toContainText(file.name);
  }

  /** Clicks "Generate Tune" and returns the file the browser downloads. */
  async generate(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.generateButton.click(),
    ]);
    return download;
  }

  curveInput(curve: string, throttle: string, column: CurveColumn): Locator {
    return this.page.getByRole("textbox", {
      name: `${curve}, ${throttle} throttle, ${column} (mph)`,
      exact: true,
    });
  }

  /**
   * Opens a grid module such as "Fuel and power" (collapsed at the start) and chooses one of its
   * grids by tab name. Click only after a step that waits for the page to be interactive.
   */
  async openGrid(module: string, grid: string): Promise<void> {
    const toggle = this.moduleToggle(module);
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await this.page.getByRole("tab", { name: new RegExp(`^${grid}`) }).click();
  }

  /** The number fields of the open grid called `label`, row by row. */
  gridCells(label: string): Locator {
    return this.page
      .getByRole("group", { name: label, exact: true })
      .getByRole("textbox", { name: new RegExp(`^${label}, `) });
  }

  tireGroup(legend: string): Locator {
    return this.page.getByRole("group", { name: legend, exact: true });
  }

  /**
   * The button in a module's heading that collapses and expands it, for example "Idle" or
   * "Shiftpoints". Its name is the module's title alone. Click it only after a step that waits for
   * the page to be interactive, such as `openUpload`: a click before React attaches does nothing.
   */
  moduleToggle(title: string): Locator {
    return this.page.getByRole("button", { name: title, exact: true });
  }

  /**
   * Opens the Manual tab and enters a size as its Width, Height and Rim, for example
   * ["315", "75", "16"] for 315/75R16 or ["12.50", "35", "17"] for 35x12.50R17, then leaves the
   * fields the way a person tabs on.
   */
  async setTireSize(
    legend: string,
    [width, height, rim]: readonly [string, string, string],
  ): Promise<void> {
    const group = this.tireGroup(legend);
    await group.getByRole("tab", { name: "Manual tire size", exact: true }).click();
    const parts = [
      ["Width", width],
      ["Height", height],
      ["Rim", rim],
    ] as const;
    for (const [name, text] of parts) {
      await group.getByRole("textbox", { name, exact: true }).fill(text);
    }
    await group.getByRole("textbox", { name: "Rim", exact: true }).press("Tab");
  }

  /**
   * Opens the list of sizes on the Choose tab, types a search, and clicks the option with that
   * exact name. The list opens in a layer outside the group, so the search and the option are
   * found on the whole page.
   */
  async chooseTireSize(legend: string, search: string, option: string): Promise<void> {
    const group = this.tireGroup(legend);
    await group.getByRole("tab", { name: "Choose tire size", exact: true }).click();
    await group.getByRole("combobox").click();
    await this.page.getByRole("combobox", { name: "Search tire sizes", exact: true }).fill(search);
    await this.page.getByRole("option", { name: option, exact: true }).click();
  }
}
