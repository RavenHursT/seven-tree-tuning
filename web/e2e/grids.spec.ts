import { readFile } from "node:fs/promises";

import { assertOnlyEditableChanges, HcfCodec, readTuneValues } from "@seven-tree/hydra";

import type { UploadedFile } from "./support/editor-page";
import { expect, test } from "./support/fixtures";
import { buildHcfFile, buildUploadedImage, CHIP_SERIAL } from "./support/tune-files";

const UPLOAD_NAME = "synthetic-tune.hcf";
const FUEL = "Fuel and power";
const TIMING = "Timing and ICP";
const FUEL_GRIDS = [
  "Maximum fuel",
  "Base injector pulse width",
  "Pulse width multiplier",
  "Fuel demand",
  "Fuel limit, sea level",
  "Fuel limit, altitude",
];
const TIMING_GRIDS = [
  "Base injection timing, sea level",
  "Base injection timing, altitude",
  "Time added to timing",
  "Timing correction",
  "Desired ICP",
  "IPR duty feed-forward",
];

function hcfUpload(): UploadedFile {
  return { name: UPLOAD_NAME, mimeType: "application/octet-stream", buffer: buildHcfFile() };
}

test.describe("fuel, power, timing and ICP grids", () => {
  test("saves a .hcf with an edited pulse width multiplier cell and no other change", async ({
    page,
    editor,
  }) => {
    await editor.saveByDownload();
    await editor.open();
    await editor.openUpload(hcfUpload());
    await expect(editor.moduleToggle(FUEL)).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.locator("#fuel-power").getByText("No changes", { exact: true }),
    ).toBeVisible();

    await editor.openGrid(FUEL, "Pulse width multiplier");
    // 1.5 is stored as 1.5 x 4096 = 6144. Row 1, column 1 of the 16-column grid is cell 17.
    const cell = editor.gridCells("Pulse width multiplier").nth(17);
    await cell.fill("1.5");
    await cell.press("Tab");

    await expect(page.getByText("1 grid cell changed", { exact: true })).toBeVisible();
    await expect(cell).toHaveAccessibleDescription(/^was /);
    const download = await editor.generate();

    const saved = new HcfCodec(CHIP_SERIAL).decode(await readFile(await download.path()));
    const uploaded = buildUploadedImage();
    const savedValues = readTuneValues(saved);
    const uploadedValues = readTuneValues(uploaded);
    expect(savedValues.gridsRaw["pulse-width-multiplier"][17]).toBe(6144);
    expect(savedValues.gridsRaw["pulse-width-multiplier"].filter((_, at) => at !== 17)).toEqual(
      uploadedValues.gridsRaw["pulse-width-multiplier"].filter((_, at) => at !== 17),
    );
    expect(savedValues.shiftSpeedsRaw).toEqual(uploadedValues.shiftSpeedsRaw);
    expect(() => assertOnlyEditableChanges(uploaded, saved)).not.toThrow();
  });

  test("keeps every grid inside its own box at 1280 px, so the page never scrolls sideways", async ({
    page,
    editor,
  }) => {
    await editor.open();
    await editor.openUpload(hcfUpload());
    const overflows: string[] = [];

    for (const [module, grids] of [
      [FUEL, FUEL_GRIDS],
      [TIMING, TIMING_GRIDS],
    ] as const) {
      for (const grid of grids) {
        await editor.openGrid(module, grid);
        await expect(editor.gridCells(grid).first()).toBeVisible();
        const wider = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (wider > 0) overflows.push(`${grid}: page is ${wider} px wider than the window`);
      }
    }

    expect(overflows).toEqual([]);
  });

  test("keeps the page from scrolling sideways at 390 px, with the grid scrolling in its own box", async ({
    page,
    editor,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await editor.open();
    await editor.openUpload(hcfUpload());

    await editor.openGrid(FUEL, "Fuel demand");

    await expect(editor.gridCells("Fuel demand").first()).toBeVisible();
    const sizes = await page.evaluate(() => {
      const box = document.querySelector('#fuel-power [data-slot="table-container"]');
      return {
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        gridScrollsInside: box ? box.scrollWidth > box.clientWidth : false,
      };
    });
    expect(sizes).toEqual({ page: 0, gridScrollsInside: true });
  });

  test("scrolls a focused cell clear of the sticky Generate bar", async ({ page, editor }) => {
    await editor.open();
    await editor.openUpload(hcfUpload());
    await editor.openGrid(FUEL, "Fuel demand");
    const cells = editor.gridCells("Fuel demand");
    const last = cells.last();

    await last.focus();

    const bar = await page.getByRole("region", { name: "Generate tune" }).boundingBox();
    const cell = await last.boundingBox();
    if (!bar || !cell) throw new Error("the cell or the Generate bar has no box");
    expect(cell.y + cell.height).toBeLessThanOrEqual(bar.y);
  });
});
