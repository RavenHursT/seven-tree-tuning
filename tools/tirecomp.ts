#!/usr/bin/env bun
/**
 * tirecomp.ts - scale the automatic shift-speed schedule (all three upshift curves
 * and all three downshift curves) in a decrypted TDE1 256 KiB PCM image by a
 * tire-size factor, so shift points occur at the correct road speed on non-stock tires.
 *
 * Command-line wrapper around the @seven-tree/hydra library (packages/hydra), which holds the
 * curve offsets, the layout check and the scaling. The web editor uses the same code.
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
 *
 * The tool refuses a file that does not have the TDE1 shift-curve layout, and a factor that is
 * not a number above zero.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  changedOffsets,
  findLayoutIssues,
  readTuneValues,
  scaleShiftSpeeds,
  speedRawToMph,
  TDE1,
  writeTuneValues,
} from "@seven-tree/hydra";
import type { ShiftCurveId, TuneValues } from "@seven-tree/hydra";

const CURVE_NAMES: Record<ShiftCurveId, string> = {
  "up-1-2": "1->2 up",
  "up-2-3": "2->3 up",
  "up-3-4": "3->4/OD up",
  "down-2-1": "2->1 down",
  "down-3-2": "3->2 down",
  "down-4-3": "4/OD->3 down",
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function printCurves(before: TuneValues, after: TuneValues): void {
  for (const { id, speedOffset } of TDE1.shiftCurves) {
    const beforeMph = before.shiftSpeedsRaw[id].map(speedRawToMph);
    const afterMph = after.shiftSpeedsRaw[id].map(speedRawToMph);
    const name = CURVE_NAMES[id].padEnd(12);
    console.log(
      `  ${name} @0x${speedOffset.toString(16)}  MPH ${beforeMph.join(",")}  ->  ${afterMph.join(",")}`,
    );
  }
}

/** Offsets of the 60 shift-speed bytes: the only bytes this tool may change. */
function shiftSpeedOffsets(): Set<number> {
  const offsets = new Set<number>();
  for (const { speedOffset } of TDE1.shiftCurves) {
    for (let index = 0; index < TDE1.breakpointsPerCurve; index++) {
      offsets.add(speedOffset + 2 * index);
    }
  }
  return offsets;
}

function main(): void {
  const [inPath, outPath, factorArg] = process.argv.slice(2);
  if (!inPath || !outPath) fail("usage: bun tools/tirecomp.ts <in.bin> <out.bin> [factor=0.9147]");
  const factor = Number(factorArg ?? "0.9147");
  if (!Number.isFinite(factor) || factor <= 0) {
    fail(`error: the factor must be a number above zero, got ${factorArg}`);
  }
  const base = new Uint8Array(readFileSync(inPath));
  if (base.length !== 262144) fail(`error: expected a 262144-byte .bin, got ${base.length}`);
  const issues = findLayoutIssues(base);
  if (issues.length > 0) {
    fail(`error: not a TDE1 shift-curve layout: ${issues.map((issue) => issue.message).join(" ")}`);
  }

  const before = readTuneValues(base);
  const after = scaleShiftSpeeds(before, factor);
  const out = writeTuneValues(base, after);
  printCurves(before, after);

  // Safety: nothing outside the six curves' even indices may change.
  const allowed = shiftSpeedOffsets();
  const outside = changedOffsets(base, out).filter((offset) => !allowed.has(offset)).length;
  if (outside !== 0) fail(`error: ${outside} bytes changed outside the shift curves`);

  writeFileSync(outPath, out);
  console.log(`factor=${factor} -> ${outPath}`);
}

main();
