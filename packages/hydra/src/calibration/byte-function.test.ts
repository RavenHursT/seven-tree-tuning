import { describe, expect, it } from "vitest";

import { CALIBRATION_IMAGE_SIZE } from "../image";
import {
  closedPedalIndex,
  findByteFunctionIssues,
  functionXOffset,
  functionYFromByte,
  functionYOffset,
  functionYRange,
  LOCKUP_NEVER_SPEED_RAW,
  readByteFunction,
  readEpcFunctions,
  readLockupFunctions,
} from "./byte-function";
import type { ByteFunctionDefinition } from "./byte-function";
import { buildTde1Image, hexBytes } from "./test-images";
import { TDE1_EPC_FUNCTIONS, TDE1_LOCKUP_FUNCTIONS } from "./tde1-items";

function definitionOf(list: readonly ByteFunctionDefinition[], id: string): ByteFunctionDefinition {
  const definition = list.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`no function ${id}`);
  return definition;
}

const lock2 = definitionOf(TDE1_LOCKUP_FUNCTIONS, "lock-2");
const lock4 = definitionOf(TDE1_LOCKUP_FUNCTIONS, "lock-4");
const epc34 = definitionOf(TDE1_EPC_FUNCTIONS, "epc-3-4");

/** Daily Driver (REVD) bytes of 2nd gear lock: 32 mph at 60% pedal and up, 20 mph at 40%, then never. */
const LOCK_2_BYTES = hexBytes("ff 40 9a 40 66 28 66 fe 00 fe 00 fe 00 fe 00 fe 00 fe 00 fe");

function imageWith(definition: ByteFunctionDefinition, bytes: readonly number[]): Uint8Array {
  const image = new Uint8Array(CALIBRATION_IMAGE_SIZE);
  image.set(bytes, definition.address);
  return image;
}

describe("function offsets", () => {
  it("puts pair i at address + 2i, with the pedal byte first and the y byte second", () => {
    expect(functionXOffset(lock2, 0)).toBe(0x1468c);
    expect(functionYOffset(lock2, 0)).toBe(0x1468d);
    expect(functionXOffset(lock2, 3)).toBe(0x14692);
    expect(functionYOffset(lock2, 3)).toBe(0x14693);
  });

  it("names the byte one after the address, where the shift curves name their first speed byte", () => {
    expect(functionYOffset(lock2, 0)).toBe(lock2.address + 1);
  });
});

describe("y values", () => {
  it("reads an unsigned function byte as itself", () => {
    expect(functionYFromByte(lock2, 0xfe)).toBe(254);
    expect(functionYFromByte(lock2, 0)).toBe(0);
  });

  it("reads a signed function byte as two's complement", () => {
    expect(functionYFromByte(epc34, 0xe7)).toBe(-25);
    expect(functionYFromByte(epc34, 0x7f)).toBe(127);
    expect(functionYFromByte(epc34, 0x80)).toBe(-128);
  });

  it("gives the range of a byte, signed or not", () => {
    expect(functionYRange(lock2)).toEqual([0, 255]);
    expect(functionYRange(epc34)).toEqual([-128, 127]);
  });

  it("marks 0xFE as the lockup speed that means never", () => {
    expect(LOCKUP_NEVER_SPEED_RAW).toBe(254);
  });
});

describe("readByteFunction", () => {
  it("reads every pair of the function, padding included", () => {
    const fn = readByteFunction(imageWith(lock2, LOCK_2_BYTES), lock2);
    expect(fn.definition).toBe(lock2);
    expect(fn.points).toHaveLength(10);
    expect(fn.points.slice(0, 4)).toEqual([
      { index: 0, xRaw: 255, yRaw: 64 },
      { index: 1, xRaw: 154, yRaw: 64 },
      { index: 2, xRaw: 102, yRaw: 40 },
      { index: 3, xRaw: 102, yRaw: 254 },
    ]);
    expect(fn.points[9]).toEqual({ index: 9, xRaw: 0, yRaw: 254 });
  });

  it("reads only four pairs of 4th gear", () => {
    const fn = readByteFunction(imageWith(lock4, hexBytes("ff 3c b3 3c 00 3c 00 3c")), lock4);
    expect(fn.points.map((point) => point.yRaw)).toEqual([60, 60, 60, 60]);
  });

  it("reads signed y values of a line-pressure adder", () => {
    const fn = readByteFunction(imageWith(epc34, hexBytes("ff 26 80 e7 00 fb")), epc34);
    expect(fn.points.slice(0, 3).map((point) => point.yRaw)).toEqual([38, -25, -5]);
  });

  it("rejects an image that is not 256 KiB", () => {
    expect(() => readByteFunction(new Uint8Array(100), lock2)).toThrow(RangeError);
  });
});

describe("readLockupFunctions and readEpcFunctions", () => {
  const image = buildTde1Image();

  it("read every function of the strategy, in its order", () => {
    expect(readLockupFunctions(image).map((fn) => fn.definition.id)).toEqual([
      "lock-2",
      "lock-3",
      "lock-4",
      "unlock-2",
      "unlock-3",
      "unlock-4",
    ]);
    expect(readEpcFunctions(image).map((fn) => fn.definition.id)).toEqual([
      "epc-1-2",
      "epc-2-3",
      "epc-3-4",
    ]);
  });

  it("read one point per pair, so 4th gear has four and the others ten", () => {
    expect(readLockupFunctions(image).map((fn) => fn.points.length)).toEqual([
      10, 10, 4, 10, 10, 4,
    ]);
    expect(readEpcFunctions(image).map((fn) => fn.points.length)).toEqual([10, 10, 10]);
  });
});

describe("closedPedalIndex", () => {
  it("is the first pair with pedal byte 0: later pairs are padding", () => {
    const fn = readByteFunction(imageWith(lock2, hexBytes("ff 40 9a 40 66 28 00 fe 00 fe")), lock2);
    expect(closedPedalIndex(fn)).toBe(3);
  });

  it("is the last index when no pair has pedal byte 0", () => {
    const fn = readByteFunction(imageWith(lock2, new Array(20).fill(0x55)), lock2);
    expect(closedPedalIndex(fn)).toBe(9);
  });
});

describe("findByteFunctionIssues", () => {
  const validImage = (): Uint8Array => {
    const image = new Uint8Array(CALIBRATION_IMAGE_SIZE);
    for (const definition of [...TDE1_LOCKUP_FUNCTIONS, ...TDE1_EPC_FUNCTIONS]) {
      image[definition.address] = 0xff;
      image[definition.address + 2] = 0x80;
      image[definition.address + 2 * (definition.pairCount - 1)] = 0;
    }
    return image;
  };

  it("finds nothing when every function starts at 255, never rises and ends at 0", () => {
    expect(findByteFunctionIssues(validImage())).toEqual([]);
  });

  it("reports a first pedal value that is not 255", () => {
    const image = validImage();
    image[lock2.address] = 0xfe;
    const issues = findByteFunctionIssues(image);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe("2nd gear lock: the first pedal value is 254, not 255.");
  });

  it("reports pedal values that go up before the first 0", () => {
    const image = validImage();
    image[epc34.address + 4] = 0x90;
    const issues = findByteFunctionIssues(image);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe(
      "3→4 line pressure: the pedal values go up from 128 to 144. They can only stay the same or go down.",
    );
  });

  it("ignores values that go up after the first 0, which is padding", () => {
    const image = validImage();
    for (const pair of [2, 3, 4]) image[lock2.address + 2 * pair] = 0x40;
    image[lock2.address + 2 * 6] = 0x90;
    expect(findByteFunctionIssues(image)).toEqual([]);
  });

  it("reports a function that has no pedal value 0", () => {
    const image = validImage();
    image[lock4.address + 2 * 2] = 0x20;
    image[lock4.address + 2 * 3] = 0x10;
    const issues = findByteFunctionIssues(image);
    expect(issues.map((issue) => issue.message)).toEqual([
      "4th gear lock: no pedal value is 0, so the PCM never finds the end.",
    ]);
  });

  it("gives one issue for an image that is not 256 KiB and checks nothing else", () => {
    const issues = findByteFunctionIssues(new Uint8Array(1000));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("262144");
  });
});
