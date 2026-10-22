import { readFile } from "node:fs/promises";

import type { Request as PageRequest } from "@playwright/test";
import { assertOnlyEditableChanges, HcfCodec, readTuneValues } from "@seven-tree/hydra";

import { CLOSED_THROTTLE, UPSHIFT_3_4, type UploadedFile } from "./support/editor-page";
import { expect, test } from "./support/fixtures";
import { buildEfuFile, buildHcfFile, buildUploadedImage, CHIP_SERIAL } from "./support/tune-files";

const UPLOAD_NAME = "synthetic-tune.hcf";
const LIBRARY_FILE = "VCAB0_02_0S.efu";
const FITTED_TIRES = "Tires on the truck";

/** The 3→4 closed-throttle shift point of the synthetic tune, in mph. */
const SHIFT_POINT_3_4_CLOSED = "38.0";

function hcfUpload(): UploadedFile {
  return { name: UPLOAD_NAME, mimeType: "application/octet-stream", buffer: buildHcfFile() };
}

function carriesChipSerial(request: PageRequest): boolean {
  const serial = CHIP_SERIAL.toLowerCase();
  return [request.url(), request.postData() ?? ""].some((text) =>
    text.toLowerCase().includes(serial),
  );
}

test.describe("tune editor", () => {
  test("opens an uploaded .hcf when the chip serial is typed first", async ({ editor }) => {
    await editor.open();
    await editor.enterChipSerial();
    await editor.chooseFile(hcfUpload());

    await expect(editor.editingStatus).toHaveText(`Editing ${UPLOAD_NAME} · Hydra .hcf`);
    const shiftPoint = editor.curveInput(UPSHIFT_3_4, CLOSED_THROTTLE, "shift point");
    await expect(shiftPoint).toHaveValue(SHIFT_POINT_3_4_CLOSED);
  });

  test("holds a .hcf chosen before the chip serial, then opens it when the serial is typed", async ({
    page,
    editor,
  }) => {
    await editor.open();
    await editor.chooseFile(hcfUpload());

    await expect(page.getByText(`Enter the chip serial to open ${UPLOAD_NAME}.`)).toBeVisible();
    await expect(editor.editingStatus).toHaveCount(0);

    await editor.enterChipSerial();

    await expect(editor.editingStatus).toHaveText(`Editing ${UPLOAD_NAME} · Hydra .hcf`);
    await expect(page.getByText("Chip serial needed", { exact: true })).toHaveCount(0);
    const shiftPoint = editor.curveInput(UPSHIFT_3_4, CLOSED_THROTTLE, "shift point");
    await expect(shiftPoint).toHaveValue(SHIFT_POINT_3_4_CLOSED);
  });

  test("converts between shift point and speedometer mph for the tires on the truck", async ({
    page,
    editor,
  }) => {
    await editor.open();
    await editor.openUpload(hcfUpload());
    const shiftPoint = editor.curveInput(UPSHIFT_3_4, CLOSED_THROTTLE, "shift point");
    const speedometer = editor.curveInput(UPSHIFT_3_4, CLOSED_THROTTLE, "speedometer");

    await editor.setTireSize(FITTED_TIRES, "315/75R16");

    await expect(editor.tireGroup(FITTED_TIRES).locator("output")).toHaveText("34.60 in");
    await expect(speedometer).toHaveValue("41.4");
    await expect(shiftPoint).toHaveValue(SHIFT_POINT_3_4_CLOSED);

    await speedometer.fill("40");

    // 40 mph on 34.60 in tires is 36.68 mph on the 31.73 in tires the tune is calibrated for.
    // The tune stores whole half-mph steps, so that becomes 36.5.
    await expect(shiftPoint).toHaveValue("36.5");
    await expect(page.getByText("was 38.0", { exact: true })).toBeVisible();
    await expect(page.getByText("1 shift point changed", { exact: true })).toBeVisible();
  });

  test("chooses a tire size from the searchable list, flotation sizes included", async ({
    editor,
  }) => {
    await editor.open();
    await editor.openUpload(hcfUpload());
    const speedometer = editor.curveInput(UPSHIFT_3_4, CLOSED_THROTTLE, "speedometer");
    const diameter = editor.tireGroup(FITTED_TIRES).locator("output");

    await editor.chooseTireSize(FITTED_TIRES, "315/75", "315/75R16");

    await expect(diameter).toHaveText("34.60 in");
    await expect(speedometer).toHaveValue("41.4");

    // A flotation size names its diameter: 38.0 mph on the 31.73 in tires is 41.9 mph on 35 in.
    await editor.chooseTireSize(FITTED_TIRES, "35x", "35x12.50R17");

    await expect(diameter).toHaveText("35.00 in");
    await expect(speedometer).toHaveValue("41.9");
  });

  test("saves a .hcf that has the new warm idle and no other change", async ({ page, editor }) => {
    await editor.saveByDownload();
    await editor.open();
    await editor.openUpload(hcfUpload());
    // With the native "Save as" dialog available, the click below would open it and nothing
    // would download.
    expect(await page.evaluate(() => "showSaveFilePicker" in window)).toBe(false);

    await editor.warmIdle.fill("700");
    await expect(page.getByText("Idle changed", { exact: true })).toBeVisible();
    await expect(editor.outputFile).toHaveValue("synthetic-tune-CUSTOM");
    const download = await editor.generate();

    expect(download.suggestedFilename()).toBe("synthetic-tune-CUSTOM.hcf");
    await expect(page.getByText("Saved synthetic-tune-CUSTOM.hcf", { exact: true })).toBeVisible();
    const saved = new HcfCodec(CHIP_SERIAL).decode(await readFile(await download.path()));
    const uploaded = buildUploadedImage();
    // 700 rpm is stored times four, in both copies of the warm idle.
    expect(readTuneValues(saved).warmIdleRaw).toEqual([2800, 2800]);
    expect(readTuneValues(saved).shiftSpeedsRaw).toEqual(readTuneValues(uploaded).shiftSpeedsRaw);
    expect(() => assertOnlyEditableChanges(uploaded, saved)).not.toThrow();
  });

  test("loads a tune from PHP's public library", async ({ page, editor }) => {
    test.setTimeout(60_000);
    const requestedPaths: string[] = [];
    await page.route("**/api/library/*", async (route) => {
      requestedPaths.push(new URL(route.request().url()).pathname);
      await route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        body: buildEfuFile(),
      });
    });
    await editor.open();
    await editor.libraryTab.click();
    // The list comes from PHP's live index, so give a slow or unreachable PHP time to answer.
    await expect(editor.libraryTunes.or(editor.libraryUnavailable)).toBeVisible({
      timeout: 20_000,
    });
    test.skip(
      !(await editor.libraryTunes.isVisible()),
      "PHP's tune list is unavailable to the server right now, so there is no tune to pick.",
    );

    await editor.libraryTunes.getByRole("option", { name: "Stock 0S", exact: true }).click();

    await expect(editor.editingStatus).toHaveText(`Editing ${LIBRARY_FILE} · PHP library .efu`);
    expect(requestedPaths).toEqual([`/api/library/${LIBRARY_FILE}`]);
    const shiftPoint = editor.curveInput(UPSHIFT_3_4, CLOSED_THROTTLE, "shift point");
    await expect(shiftPoint).toHaveValue(SHIFT_POINT_3_4_CLOSED);
    // A library tune is not keyed to a chip, so saving waits for a serial.
    await expect(editor.generateButton).toBeDisabled();
    await expect(page.getByText("Enter the 8-digit chip serial.", { exact: true })).toBeVisible();
    await editor.enterChipSerial();
    await expect(editor.generateButton).toBeEnabled();
  });

  test("keeps the chip serial in the browser", async ({ page, editor }) => {
    const requests: PageRequest[] = [];
    page.on("request", (request) => requests.push(request));
    await editor.saveByDownload();
    await editor.open();
    await editor.openUpload(hcfUpload());
    await editor.generate();

    expect(requests.filter(carriesChipSerial).map((request) => request.url())).toEqual([]);
    // A page that sent nothing would also pass the check above, so show that it saw requests.
    expect(requests.length).toBeGreaterThan(0);
  });
});
