#!/usr/bin/env bun
/**
 * tirecomp.ts - scale the automatic upshift-speed schedule in a decrypted TDE1
 * 256 KiB PCM image by a tire-size factor, so shift points occur at the correct
 * road speed on non-stock tires.
 *
 * Works on the decrypted .bin (use tools/hcf.ts to decrypt first and encrypt after):
 *     bun tools/hcf.ts decrypt <serial8> tunes/<base>.hcf base.bin
 *     bun tools/tirecomp.ts base.bin out.bin 0.9147
 *     bun tools/hcf.ts encrypt <serial8> out.bin tunes/<base>-TIRECOMP.hcf
 *
 * The three upshift curves each hold 19 bytes of interleaved (MPH, throttle) pairs.
 * The even bytes are the shift speed (MPH x 2); the odd bytes are the throttle-position
 * breakpoints. Only the even bytes are scaled; axes, torque-converter lockup (0x14649),
 * fueling, and timing are left byte-identical.
 *
 * Factor 0.9147 = stock tire diameter 31.6496" / actual 34.6024" (LT265/75R16 -> 315/75R16).
 */
import { readFileSync, writeFileSync } from "node:fs";

const CURVES: Record<string, number> = { "1->2": 0x14521, "2->3": 0x14579, "3->4/OD": 0x145d1 };
const LEN = 19;

function main() {
  const [inPath, outPath, factorArg] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("usage: bun tools/tirecomp.ts <in.bin> <out.bin> [factor=0.9147]");
    process.exit(1);
  }
  const factor = Number(factorArg ?? "0.9147");
  const base = new Uint8Array(readFileSync(inPath));
  if (base.length !== 262144) { console.error(`error: expected a 262144-byte .bin, got ${base.length}`); process.exit(1); }
  const out = new Uint8Array(base);

  const expected = new Set<number>();
  for (const off of Object.values(CURVES)) for (let i = 0; i < LEN; i += 2) expected.add(off + i);

  for (const [name, off] of Object.entries(CURVES)) {
    const before: number[] = [], after: number[] = [];
    for (let i = 0; i < LEN; i += 2) {
      const v = base[off + i];
      const nv = Math.min(255, Math.max(0, Math.round(v * factor)));
      before.push(v / 2); after.push(nv / 2);
      out[off + i] = nv;
    }
    console.log(`  ${name.padEnd(7)} @0x${off.toString(16)}  MPH ${before.join(",")}  ->  ${after.join(",")}`);
  }

  // Safety: nothing outside the three curves' even indices may change.
  let outside = 0;
  for (let i = 0; i < out.length; i++) if (out[i] !== base[i] && !expected.has(i)) outside++;
  if (outside !== 0) { console.error(`error: ${outside} bytes changed outside the upshift curves`); process.exit(1); }

  writeFileSync(outPath, out);
  console.log(`factor=${factor} -> ${outPath}`);
}

main();
