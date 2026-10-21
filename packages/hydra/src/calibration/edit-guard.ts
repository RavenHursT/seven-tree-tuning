import { speedByteOffset } from "./shift-curve";
import { TDE1 } from "./tde1";
import type { StrategyDefinition } from "./tde1";

const MAX_LISTED_OFFSETS = 8;

function formatOffset(offset: number): string {
  return `0x${offset.toString(16).padStart(5, "0")}`;
}

function describeOffsets(offsets: readonly number[]): string {
  const listed = offsets.slice(0, MAX_LISTED_OFFSETS).map(formatOffset).join(", ");
  const hidden = offsets.length - MAX_LISTED_OFFSETS;
  return hidden > 0 ? `${listed}, and ${hidden} more` : listed;
}

/**
 * Image offsets an edit may change: every shift-speed byte of every curve (60 for TDE1, padding
 * included) and both bytes of both warm-idle values (4).
 */
export function editableOffsets(strategy: StrategyDefinition = TDE1): ReadonlySet<number> {
  const offsets = new Set<number>();
  for (const definition of strategy.shiftCurves) {
    for (let index = 0; index < strategy.breakpointsPerCurve; index++) {
      offsets.add(speedByteOffset(definition, index));
    }
  }
  for (const start of strategy.idle.warmIdleOffsets) {
    offsets.add(start);
    offsets.add(start + 1);
  }
  return offsets;
}

/** Ascending offsets at which two images of the same size differ. Throws RangeError on a size mismatch. */
export function changedOffsets(a: Uint8Array, b: Uint8Array): number[] {
  if (a.length !== b.length) {
    throw new RangeError(`images differ in size: ${a.length} and ${b.length} bytes`);
  }
  const offsets: number[] = [];
  for (let offset = 0; offset < a.length; offset++) {
    if (a[offset] !== b[offset]) offsets.push(offset);
  }
  return offsets;
}

/** Thrown when an edited image differs from its base outside the editable bytes. */
export class UnexpectedImageChangeError extends Error {
  readonly offsets: readonly number[];

  constructor(offsets: readonly number[]) {
    const count = `${offsets.length} byte${offsets.length === 1 ? "" : "s"}`;
    super(
      `The edit changed ${count} outside the shift speeds and warm idle: ${describeOffsets(offsets)}.`,
    );
    this.name = "UnexpectedImageChangeError";
    this.offsets = offsets;
  }
}

/** Throws UnexpectedImageChangeError unless every byte that differs is an editable offset. */
export function assertOnlyEditableChanges(
  baseImage: Uint8Array,
  editedImage: Uint8Array,
  strategy: StrategyDefinition = TDE1,
): void {
  const editable = editableOffsets(strategy);
  const unexpected = changedOffsets(baseImage, editedImage).filter(
    (offset) => !editable.has(offset),
  );
  if (unexpected.length > 0) throw new UnexpectedImageChangeError(unexpected);
}
