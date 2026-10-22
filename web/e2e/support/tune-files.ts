import { Blowfish, EFU_FILE_SIZE, HcfCodec } from "@seven-tree/hydra";
import { buildTde1Image } from "@seven-tree/hydra/testing";

/** A made-up chip serial. A real serial never goes into this repository. */
export const CHIP_SERIAL = "0A1B2C3D";

/** The fixed key of Power Hungry's public .efu files. */
const EFU_KEY = Uint8Array.of(0xbd, 0xc3, 0x07, 0x27, 0x69);

/** Every .efu file ends in eight bytes of 0x08, which the decoder checks after decrypting. */
const EFU_TRAILER_BYTE = 0x08;

/** A .hcf file for `CHIP_SERIAL` that holds the synthetic Daily Driver tune. */
export function buildHcfFile(): Buffer {
  return Buffer.from(new HcfCodec(CHIP_SERIAL).encode(buildTde1Image()));
}

/** A library .efu file that holds the same synthetic tune. */
export function buildEfuFile(): Buffer {
  const plain = new Uint8Array(EFU_FILE_SIZE).fill(EFU_TRAILER_BYTE);
  plain.set(buildTde1Image());
  return Buffer.from(new Blowfish(EFU_KEY).encryptEcb(plain));
}

/**
 * The image the editor reads from `buildHcfFile()`. A .hcf holds only four banks, so the 8 KiB
 * gaps between them decode to 0xFF and differ from the raw synthetic image.
 */
export function buildUploadedImage(): Uint8Array {
  const codec = new HcfCodec(CHIP_SERIAL);
  return codec.decode(codec.encode(buildTde1Image()));
}
