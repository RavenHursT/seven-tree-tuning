#!/usr/bin/env bun
/**
 * tirecomp.ts - scale the automatic shift-speed schedule (all three upshift curves
 * and all three downshift curves) in a decrypted TDE1 256 KiB PCM image by a
 * tire-size factor, so shift points occur at the correct road speed on non-stock tires.
 *
 * Works on the decrypted .bin (use tools/hcf.ts to decrypt first and encrypt after):
 *     bun tools/hcf.ts decrypt <serial8> tunes/<base>.hcf base.bin
 *     bun tools/tirecomp.ts base.bin out.bin 0.9147
 *     bun tools/hcf.ts encrypt <serial8> out.bin tunes/<base>-TIRECOMP-UPDOWN.hcf
 *
 * Each curve holds 19 bytes of interleaved (MPH, throttle) pairs, starting one byte after
 * the 0xFF (throttle 255) breakpoint. The even bytes from the listed address are the shift
 * speed (MPH x 2); the odd bytes are the throttle-position breakpoints. Only the even bytes
 * are scaled; axes, fueling, and timing are left byte-identical.
 *
 * Upshifts and downshifts must be scaled together. Scaling only the upshifts leaves some
 * downshift points at or above their matching upshift (e.g. 4->3 above 3->4 at cruise),
 * and the transmission hunts between gears. Confirmed on the truck 2026-10-21.
 *
 * Factor 0.9147 = stock tire diameter 31.6496" / actual 34.6024" (LT265/75R16 -> 315/75R16).
 */
import { readFileSync, writeFileSync } from "node:fs";

const CURVES: Record<string, number> = {
  "1->2 up": 0x14521, "2->3 up": 0x14579, "3->4/OD up": 0x145d1,
  "2->1 down": 0x145f9, "3->2 down": 0x14621, "4/OD->3 down": 0x14649,
};
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
    console.log(`  ${name.padEnd(12)} @0x${off.toString(16)}  MPH ${before.join(",")}  ->  ${after.join(",")}`);
  }

  // Safety: nothing outside the six curves' even indices may change.
  let outside = 0;
  for (let i = 0; i < out.length; i++) if (out[i] !== base[i] && !expected.has(i)) outside++;
  if (outside !== 0) { console.error(`error: ${outside} bytes changed outside the shift curves`); process.exit(1); }

  writeFileSync(outPath, out);
  console.log(`factor=${factor} -> ${outPath}`);
}

main();
