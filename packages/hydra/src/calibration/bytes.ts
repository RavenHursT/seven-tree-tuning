function assertOffset(bytes: Uint8Array, offset: number, width: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + width > bytes.length) {
    throw new RangeError(`cannot access ${width} byte(s) at offset ${offset} of ${bytes.length}`);
  }
}

/** One byte at `offset`. Throws RangeError when the offset is outside the array. */
export function readByte(bytes: Uint8Array, offset: number): number {
  assertOffset(bytes, offset, 1);
  return bytes[offset] as number;
}

/** Unsigned 16-bit little-endian value at `offset`. */
export function readUint16Le(bytes: Uint8Array, offset: number): number {
  assertOffset(bytes, offset, 2);
  return (bytes[offset] as number) | ((bytes[offset + 1] as number) << 8);
}

/** Signed 16-bit little-endian value at `offset`. */
export function readInt16Le(bytes: Uint8Array, offset: number): number {
  return (readUint16Le(bytes, offset) << 16) >> 16;
}

/** Writes an unsigned 16-bit little-endian value at `offset`. Throws unless value is 0..65535. */
export function writeUint16Le(bytes: Uint8Array, offset: number, value: number): void {
  assertOffset(bytes, offset, 2);
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${value} does not fit in an unsigned 16-bit value`);
  }
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = value >> 8;
}
