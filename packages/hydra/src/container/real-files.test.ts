import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EfuDecoder, HcfCodec } from "./index";
import { expectSameBytes } from "./test-support";

// Real files are never kept in the repository with their chip serial. Both groups below
// run only when the person running the tests supplies what they need:
//   HYDRA_CHIP_SERIAL  the 8 hexadecimal digits of the chip serial the tunes in tunes/ are for
//   HYDRA_EFU_DIR      a folder of Power Hungry .efu library files
const chipSerial = process.env.HYDRA_CHIP_SERIAL;
const efuFolder = process.env.HYDRA_EFU_DIR;
const tunesFolder = fileURLToPath(new URL("../../../../tunes/", import.meta.url));

/** In a TDE1 image this byte is 0xFF; the 1->2 upshift curve starts one byte later, at 0x14521. */
const UPSHIFT_CURVE_BREAKPOINT_OFFSET = 0x14520;

function namesWithExtension(folder: string | undefined, extension: string): string[] {
  if (folder === undefined || !existsSync(folder)) {
    return [];
  }
  return readdirSync(folder)
    .filter((name) => name.endsWith(extension))
    .sort();
}

function readBytes(folder: string, name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(folder, name)));
}

const tuneNames = namesWithExtension(tunesFolder, ".hcf");
const efuNames = namesWithExtension(efuFolder, ".efu");

describe.skipIf(chipSerial === undefined)(
  "every .hcf tune in tunes/ (needs HYDRA_CHIP_SERIAL)",
  () => {
    it("finds the tune files", () => {
      expect(tuneNames.length).toBeGreaterThan(0);
    });

    it.each(tuneNames)("%s decodes and encodes back to the same bytes", (name) => {
      const codec = new HcfCodec(chipSerial ?? "");
      const file = readBytes(tunesFolder, name);

      const image = codec.decode(file);

      expect(image.length).toBe(262_144);
      expectSameBytes(codec.encode(image), file);
    });

    it.each(tuneNames)("%s has 0xFF before the 1->2 upshift curve", (name) => {
      const image = new HcfCodec(chipSerial ?? "").decode(readBytes(tunesFolder, name));

      expect(image[UPSHIFT_CURVE_BREAKPOINT_OFFSET]).toBe(0xff);
    });
  },
);

describe.skipIf(efuFolder === undefined)("every .efu file in HYDRA_EFU_DIR", () => {
  it("finds the .efu files", () => {
    expect(efuNames.length).toBeGreaterThan(0);
  });

  it.each(efuNames)("%s decodes to an image with 0xFF before the 1->2 upshift curve", (name) => {
    const image = new EfuDecoder().decode(readBytes(efuFolder ?? "", name));

    expect(image.length).toBe(262_144);
    expect(image[UPSHIFT_CURVE_BREAKPOINT_OFFSET]).toBe(0xff);
  });
});
