import { readFile } from "node:fs/promises";

import { changedOffsets, HcfCodec, readTuneValues } from "@seven-tree/hydra";

import { expect, test } from "./support/fixtures";
import { buildHcfFile, buildUploadedImage, CHIP_SERIAL } from "./support/tune-files";

const UPLOAD = {
  name: "synthetic-tune.hcf",
  mimeType: "application/octet-stream",
  buffer: buildHcfFile(),
};

test.describe("converter lockup and shift firmness", () => {
  test("saves a .hcf with a new 4th gear lock speed and a new 3→4 adder, and no other change", async ({
    page,
    editor,
  }) => {
    await editor.saveByDownload();
    await editor.open();
    await editor.openUpload(UPLOAD);

    const lockSpeed = page.getByRole("textbox", {
      name: "4th gear lock, 100% pedal, lock speed (mph)",
      exact: true,
    });
    const adder = page.getByRole("textbox", {
      name: "3→4 line pressure, 100% pedal, adder (PCM units)",
      exact: true,
    });
    await expect(lockSpeed).toHaveValue("30.0");
    await expect(adder).toHaveValue("38");

    await lockSpeed.fill("33");
    await adder.fill("45");
    await expect(page.getByText("1 lockup speed changed · 1 firmness value changed")).toBeVisible();
    const download = await editor.generate();

    const saved = new HcfCodec(CHIP_SERIAL).decode(await readFile(await download.path()));
    const uploaded = buildUploadedImage();
    // 33 mph is stored times two. The y bytes are at 0x146b4 + 1 (4th gear lock, first pair) and
    // 0x14860 + 1 (3→4 line pressure, first pair).
    expect(readTuneValues(saved).lockupSpeedsRaw["lock-4"][0]).toBe(66);
    expect(readTuneValues(saved).epcAddersRaw["epc-3-4"][0]).toBe(45);
    expect(changedOffsets(uploaded, saved)).toEqual([0x146b5, 0x14861]);
  });

  for (const width of [1280, 390]) {
    test(`fits every table of the two modules in its card at ${width} px, with no sideways scroll`, async ({
      page,
      editor,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await editor.open();
      await editor.openUpload(UPLOAD);
      const tables = page.locator(
        '#converter-lockup [data-slot="table-container"], #shift-firmness [data-slot="table-container"]',
      );
      await expect(tables).toHaveCount(9);

      const overflows = await tables.evaluateAll((elements) =>
        elements.map((element) => element.scrollWidth - element.clientWidth),
      );
      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflows).toEqual(Array(9).fill(0));
      expect(pageOverflow).toBe(0);
    });
  }
});
