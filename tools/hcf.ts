#!/usr/bin/env bun
/**
 * hcf.ts - decrypt / encrypt Power Hungry Performance Hydra ".hcf" calibration files.
 *
 * TypeScript port of tools/hcf_tool.py. Reverse-engineered from HydraFlash 3
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
import { P as P_INIT, S as S_INIT } from "./blowfish-boxes";

// ------------------------------------------------------------------ Blowfish
// All arithmetic is on unsigned 32-bit values; `>>> 0` coerces back to uint32,
// and (a + b) >>> 0 is safe because the sum stays below 2^53 (exact in Number).
class Blowfish {
  private P: Uint32Array;
  private S: Uint32Array[];

  constructor(key: Uint8Array) {
    this.P = Uint32Array.from(P_INIT);
    this.S = S_INIT.map((row) => Uint32Array.from(row));
    let j = 0;
    for (let i = 0; i < 18; i++) {
      let d = 0;
      for (let k = 0; k < 4; k++) {
        d = ((d << 8) | key[j]) >>> 0;
        j = (j + 1) % key.length;
      }
      this.P[i] = (this.P[i] ^ d) >>> 0;
    }
    let L = 0, R = 0;
    for (let i = 0; i < 18; i += 2) {
      [L, R] = this.enc(L, R);
      this.P[i] = L; this.P[i + 1] = R;
    }
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 256; k += 2) {
        [L, R] = this.enc(L, R);
        this.S[i][k] = L; this.S[i][k + 1] = R;
      }
    }
  }

  private F(x: number): number {
    const d = x & 0xff;
    const c = (x >>> 8) & 0xff;
    const b = (x >>> 16) & 0xff;
    const a = (x >>> 24) & 0xff;
    let y = (this.S[0][a] + this.S[1][b]) >>> 0;
    y = (y ^ this.S[2][c]) >>> 0;
    y = (y + this.S[3][d]) >>> 0;
    return y;
  }

  private enc(L: number, R: number): [number, number] {
    for (let i = 0; i < 16; i++) {
      L = (L ^ this.P[i]) >>> 0;
      R = (R ^ this.F(L)) >>> 0;
      [L, R] = [R, L];
    }
    [L, R] = [R, L];
    R = (R ^ this.P[16]) >>> 0;
    L = (L ^ this.P[17]) >>> 0;
    return [L >>> 0, R >>> 0];
  }

  private dec(L: number, R: number): [number, number] {
    for (let i = 17; i > 1; i--) {
      L = (L ^ this.P[i]) >>> 0;
      R = (R ^ this.F(L)) >>> 0;
      [L, R] = [R, L];
    }
    [L, R] = [R, L];
    R = (R ^ this.P[1]) >>> 0;
    L = (L ^ this.P[0]) >>> 0;
    return [L >>> 0, R >>> 0];
  }

  private crypt(data: Uint8Array, decrypt: boolean): Uint8Array {
    if (data.length % 8 !== 0) throw new Error(`length ${data.length} not a multiple of 8`);
    const out = new Uint8Array(data.length);
    const din = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const dout = new DataView(out.buffer);
    for (let o = 0; o < data.length; o += 8) {
      let L = din.getUint32(o, false); // big-endian
      let R = din.getUint32(o + 4, false);
      [L, R] = decrypt ? this.dec(L, R) : this.enc(L, R);
      dout.setUint32(o, L, false);
      dout.setUint32(o + 4, R, false);
    }
    return out;
  }

  decryptEcb(data: Uint8Array): Uint8Array { return this.crypt(data, true); }
  encryptEcb(data: Uint8Array): Uint8Array { return this.crypt(data, false); }
}

// --------------------------------------------------------------- key + format
function hcfKey(serial8: string): Uint8Array {
  let userid = "4675636B" + serial8 + "44502D54";
  if (userid.length % 2) userid = "0" + userid;
  const out = new Uint8Array(userid.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(userid.substr(i * 2, 2), 16);
  return out; // "Fuck" + hex(serial) + "DP-T"
}

// FormatCalibration mapping for a 229376/229384-byte decrypted image:
//   [srcOff, dstOff, len] -- src = decrypted banks, dst = 256 KiB PCM image
const MAP: readonly [number, number, number][] = [
  [0,      139264, 57344],
  [57344,  73728,  57344],
  [114688, 8192,   57344],
  [172032, 204800, 57344],
];
const IMG = 262144;

function formatCalibration(dec: Uint8Array): Uint8Array {
  const out = new Uint8Array(IMG).fill(0xff);
  for (const [src, dst, ln] of MAP) out.set(dec.subarray(src, src + ln), dst);
  return out;
}

function unformatCalibration(img: Uint8Array): Uint8Array {
  const dec = new Uint8Array(229384); // 4*57344 + 8-byte trailer
  for (const [src, dst, ln] of MAP) dec.set(img.subarray(dst, dst + ln), src);
  dec.fill(0x08, 229376, 229384); // trailer (PKCS#7-style full block)
  return dec;
}

// ------------------------------------------------------------------- commands
function readFile(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}
function writeFile(p: string, d: Uint8Array): void {
  writeFileSync(p, d);
}

function cmdDecrypt(serial: string, inp: string, outp: string, raw?: string): void {
  const data = readFile(inp);
  if (data.length % 8) { console.error(`error: ${inp} length ${data.length} not a multiple of 8`); process.exit(1); }
  const dec = new Blowfish(hcfKey(serial)).decryptEcb(data);
  if (raw) writeFile(raw, dec);
  const img = formatCalibration(dec);
  writeFile(outp, img);
  let ff = 0; for (const b of dec) if (b === 0xff) ff++;
  console.log(`decrypted ${data.length} bytes -> ${outp} (${img.length} bytes)`);
  console.log(`  0xFF bytes in decrypted image: ${ff} (${(100 * ff / dec.length).toFixed(1)}%) ` +
              `-- expect a large fraction if the serial is correct`);
}

function cmdEncrypt(serial: string, inp: string, outp: string): void {
  const img = readFile(inp);
  if (img.length !== IMG) { console.error(`error: expected a ${IMG}-byte .bin, got ${img.length}`); process.exit(1); }
  const enc = new Blowfish(hcfKey(serial)).encryptEcb(unformatCalibration(img));
  writeFile(outp, enc);
  console.log(`encrypted ${inp} -> ${outp} (${enc.length} bytes)`);
}

function hex(u: Uint8Array): string { return Buffer.from(u).toString("hex"); }
function unhex(s: string): Uint8Array {
  const o = new Uint8Array(s.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16);
  return o;
}

function cmdSelftest(): void {
  const vectors: [string, string, string][] = [
    ["0000000000000000", "0000000000000000", "4ef997456198dd78"],
    ["ffffffffffffffff", "ffffffffffffffff", "51866fd5b85ecb8a"],
    ["0123456789abcdef", "1111111111111111", "61f9c3802281b096"],
  ];
  for (const [key, pt, ct] of vectors) {
    const bf = new Blowfish(unhex(key));
    const got = hex(bf.encryptEcb(unhex(pt)));
    const ok = got === ct;
    console.log(`  key=${key} pt=${pt} -> ${got} ${ok ? "OK" : "FAIL expect " + ct}`);
    if (!ok) process.exit(1);
    if (hex(bf.decryptEcb(unhex(ct))) !== pt) { console.error("  decrypt mismatch"); process.exit(1); }
  }
  console.log("Blowfish core verified against standard test vectors.");
}

function main(): void {
  const a = process.argv.slice(2);
  if (a.length === 0 || a[0] === "selftest") return cmdSelftest();
  if (a[0] === "decrypt") {
    let args = a.slice();
    let raw: string | undefined;
    const ri = args.indexOf("--raw");
    if (ri !== -1) { raw = args[ri + 1]; args = args.slice(0, ri).concat(args.slice(ri + 2)); }
    return cmdDecrypt(args[1], args[2], args[3], raw);
  }
  if (a[0] === "encrypt") return cmdEncrypt(a[1], a[2], a[3]);
  console.error("usage: hcf {decrypt|encrypt} <serial8> in out [--raw out.raw]  |  hcf selftest");
  process.exit(1);
}

main();
