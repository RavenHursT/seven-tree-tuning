#!/usr/bin/env bun
/**
 * hcf.ts - decrypt / encrypt Power Hungry Performance Hydra ".hcf" calibration files.
 *
 * Command-line wrapper around the hydra library in packages/hydra, which holds the Blowfish
 * cipher and the file formats. The library is imported by relative path, so this file runs in a
 * checkout that has not run `npm install`. Reverse-engineered from HydraFlash 3
 * (v3.1.6.0, HydraFlashCS.dll). .hcf files are Blowfish (ECB, 64-bit block,
 * standard pi-digit S-boxes) encrypted. For a .hcf the key is tied to the chip
 * serial:
 *
 *     userid = "4675636B" + <ChipSerial> + "44502D54"   // concatenated hex string
 *     key    = hexDecode(userid)                         // = "Fuck" + hex(serial) + "DP-T"
 *
 * where <ChipSerial> is the first 8 characters of the chip's USB serial number
 * (8 hex digits -> 4 bytes -> a 12-byte key).
 *
 * Decrypt: Blowfish-ECB over the whole file, then FormatCalibration reassembles
 * the four 57344-byte banks into a 256 KiB PCM image (the .bin Minotaur/TunerPro
 * loads). Encrypt reverses it exactly (round-trip reproduces the original .hcf).
 *
 * Usage:
 *     hcf decrypt <serial8> in.hcf out.bin [--raw out.raw]
 *     hcf encrypt <serial8> in.bin out.hcf
 *     hcf selftest
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  Blowfish,
  CALIBRATION_IMAGE_SIZE,
  formatCalibration,
  hcfKey,
  HCF_FILE_SIZE,
  HydraFileError,
  unformatCalibration,
} from "../packages/hydra/src";

const USAGE = "usage: hcf {decrypt|encrypt} <serial8> in out [--raw out.raw]  |  hcf selftest";
const TRAILER_SIZE = 8;
const TRAILER_VALUE = 0x08;

// ------------------------------------------------------------------- helpers
function fail(message: string): never {
  console.error(`error: ${message}`);
  return process.exit(1);
}

function usageError(): never {
  console.error(USAGE);
  return process.exit(1);
}

function readFile(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path));
}

function writeFile(path: string, data: Uint8Array): void {
  writeFileSync(path, data);
}

function countByte(data: Uint8Array, value: number): number {
  let count = 0;
  for (const byte of data) if (byte === value) count++;
  return count;
}

/** A full-size .hcf decrypts to a trailer of eight 0x08 bytes only under the right serial. */
function hasWrongTrailer(decrypted: Uint8Array): boolean {
  if (decrypted.length !== HCF_FILE_SIZE) return false;
  return !decrypted.subarray(decrypted.length - TRAILER_SIZE).every((b) => b === TRAILER_VALUE);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

// ------------------------------------------------------------------- commands
function cmdDecrypt(serial: string, inp: string, outp: string, raw?: string): void {
  const data = readFile(inp);
  if (data.length % 8) fail(`${inp} length ${data.length} not a multiple of 8`);
  const dec = new Blowfish(hcfKey(serial)).decryptEcb(data);
  if (raw) writeFile(raw, dec);
  const img = formatCalibration(dec);
  writeFile(outp, img);
  const ff = countByte(dec, 0xff);
  console.log(`decrypted ${data.length} bytes -> ${outp} (${img.length} bytes)`);
  console.log(
    `  0xFF bytes in decrypted image: ${ff} (${((100 * ff) / dec.length).toFixed(1)}%) ` +
      `-- expect a large fraction if the serial is correct`,
  );
  if (hasWrongTrailer(dec)) {
    console.error("warning: the decrypted trailer is not 08 x 8, so the serial is probably wrong");
  }
}

function cmdEncrypt(serial: string, inp: string, outp: string): void {
  const img = readFile(inp);
  if (img.length !== CALIBRATION_IMAGE_SIZE) {
    fail(`expected a ${CALIBRATION_IMAGE_SIZE}-byte .bin, got ${img.length}`);
  }
  const enc = new Blowfish(hcfKey(serial)).encryptEcb(unformatCalibration(img));
  writeFile(outp, enc);
  console.log(`encrypted ${inp} -> ${outp} (${enc.length} bytes)`);
}

/** Published Blowfish test vectors: [key, plaintext, ciphertext], each as hex. */
const SELFTEST_VECTORS: readonly [string, string, string][] = [
  ["0000000000000000", "0000000000000000", "4ef997456198dd78"],
  ["ffffffffffffffff", "ffffffffffffffff", "51866fd5b85ecb8a"],
  ["0123456789abcdef", "1111111111111111", "61f9c3802281b096"],
];

function checkVector([key, pt, ct]: readonly [string, string, string]): void {
  const bf = new Blowfish(fromHex(key));
  const got = toHex(bf.encryptEcb(fromHex(pt)));
  const ok = got === ct;
  console.log(`  key=${key} pt=${pt} -> ${got} ${ok ? "OK" : "FAIL expect " + ct}`);
  if (!ok) process.exit(1);
  if (toHex(bf.decryptEcb(fromHex(ct))) !== pt) {
    console.error("  decrypt mismatch");
    process.exit(1);
  }
}

function cmdSelftest(): void {
  SELFTEST_VECTORS.forEach(checkVector);
  console.log("Blowfish core verified against standard test vectors.");
}

// ------------------------------------------------------------------- arguments
/** Removes "--raw <file>" from the arguments and returns the file name. */
function takeRawOption(args: string[]): { rest: string[]; raw?: string } {
  const index = args.indexOf("--raw");
  if (index === -1) return { rest: args };
  const raw = args[index + 1];
  if (raw === undefined) return usageError();
  return { rest: [...args.slice(0, index), ...args.slice(index + 2)], raw };
}

function run(args: string[]): void {
  const [command, ...operands] = args;
  if (command === undefined || command === "selftest") return cmdSelftest();
  if (command === "decrypt") {
    const { rest, raw } = takeRawOption(operands);
    const [serial, inp, outp] = rest;
    if (!serial || !inp || !outp) return usageError();
    return cmdDecrypt(serial, inp, outp, raw);
  }
  if (command === "encrypt") {
    const [serial, inp, outp] = operands;
    if (!serial || !inp || !outp) return usageError();
    return cmdEncrypt(serial, inp, outp);
  }
  return usageError();
}

function main(): void {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    // The library rejects a serial that is not 8 hex digits and a .hcf of the wrong size.
    if (error instanceof HydraFileError || error instanceof RangeError) fail(error.message);
    throw error;
  }
}

main();
