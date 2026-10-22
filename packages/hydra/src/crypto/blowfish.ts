import { P as INITIAL_SUBKEYS, S as INITIAL_BOXES } from "./blowfish-boxes";

const BLOCK_BYTES = 8;
const ROUNDS = 16;
const SUBKEY_COUNT = 18;
const BOX_COUNT = 4;
const BOX_WORDS = 256;
const MAX_KEY_BYTES = 56;

/**
 * Blowfish in ECB mode, as HydraFlash implements it: 8-byte blocks, 16 rounds, big-endian
 * 32-bit halves, the standard pi-digit initial values. The key is 1 to 56 bytes long. Every
 * 8-byte block is encrypted on its own, so equal plaintext blocks give equal ciphertext blocks.
 */
export class Blowfish {
  /** The 18 subkeys (the P-array), in encryption order. */
  private readonly subkeys = new Uint32Array(SUBKEY_COUNT);
  /** The same 18 subkeys in reverse order. Decryption is encryption in this order. */
  private readonly reversedSubkeys = new Uint32Array(SUBKEY_COUNT);
  /** The 4 S-boxes of 256 words each, stored one after the other. */
  private readonly boxes = new Uint32Array(BOX_COUNT * BOX_WORDS);

  /** @throws RangeError when the key is empty or longer than 56 bytes. */
  constructor(key: Uint8Array) {
    if (key.length < 1 || key.length > MAX_KEY_BYTES) {
      throw new RangeError(
        `A Blowfish key must be 1 to ${MAX_KEY_BYTES} bytes long; got ${key.length} bytes.`,
      );
    }
    this.subkeys.set(INITIAL_SUBKEYS);
    INITIAL_BOXES.forEach((box, index) => this.boxes.set(box, index * BOX_WORDS));
    this.mixKeyIntoSubkeys(key);
    this.replaceSubkeysAndBoxes();
    this.reversedSubkeys.set(Array.from(this.subkeys).reverse());
  }

  /**
   * Encrypts `data` block by block.
   * @param data Plaintext; its length must be a multiple of 8 bytes.
   * @returns A new array of the same length.
   * @throws RangeError when the length is not a multiple of 8.
   */
  encryptEcb(data: Uint8Array): Uint8Array {
    return this.processEcb(data, this.subkeys);
  }

  /**
   * Decrypts `data` block by block.
   * @param data Ciphertext; its length must be a multiple of 8 bytes.
   * @returns A new array of the same length.
   * @throws RangeError when the length is not a multiple of 8.
   */
  decryptEcb(data: Uint8Array): Uint8Array {
    return this.processEcb(data, this.reversedSubkeys);
  }

  private mixKeyIntoSubkeys(key: Uint8Array): void {
    let position = 0;
    for (let index = 0; index < SUBKEY_COUNT; index++) {
      let word = 0;
      for (let byte = 0; byte < 4; byte++) {
        word = (word << 8) | key[position]!;
        position = (position + 1) % key.length;
      }
      this.subkeys[index] = this.subkeys[index]! ^ word;
    }
  }

  /** Overwrites the subkeys, then the S-boxes, with a chain of encrypted blocks from zero. */
  private replaceSubkeysAndBoxes(): void {
    const block = new Uint32Array(2);
    for (let index = 0; index < SUBKEY_COUNT; index += 2) {
      this.encryptBlock(block, this.subkeys);
      this.subkeys.set(block, index);
    }
    for (let index = 0; index < this.boxes.length; index += 2) {
      this.encryptBlock(block, this.subkeys);
      this.boxes.set(block, index);
    }
  }

  private processEcb(data: Uint8Array, subkeys: Uint32Array): Uint8Array {
    if (data.length % BLOCK_BYTES !== 0) {
      throw new RangeError(
        `Blowfish data must be a multiple of ${BLOCK_BYTES} bytes long; got ${data.length} bytes.`,
      );
    }
    const output = new Uint8Array(data.length);
    const source = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const target = new DataView(output.buffer);
    const block = new Uint32Array(2);
    for (let offset = 0; offset < data.length; offset += BLOCK_BYTES) {
      block[0] = source.getUint32(offset);
      block[1] = source.getUint32(offset + 4);
      this.encryptBlock(block, subkeys);
      target.setUint32(offset, block[0]!);
      target.setUint32(offset + 4, block[1]!);
    }
    return output;
  }

  /** Runs the 16 rounds on `block` (left word, right word) in place, using `subkeys` in order. */
  private encryptBlock(block: Uint32Array, subkeys: Uint32Array): void {
    let left = block[0]!;
    let right = block[1]!;
    for (let round = 0; round < ROUNDS; round += 2) {
      left ^= subkeys[round]!;
      right ^= this.roundFunction(left);
      right ^= subkeys[round + 1]!;
      left ^= this.roundFunction(right);
    }
    block[0] = right ^ subkeys[17]!;
    block[1] = left ^ subkeys[16]!;
  }

  /** F(x) = ((S0[a] + S1[b]) ^ S2[c]) + S3[d] mod 2^32; a to d are the bytes of x, high first. */
  private roundFunction(word: number): number {
    const boxes = this.boxes;
    const high = boxes[word >>> 24]! + boxes[BOX_WORDS + ((word >>> 16) & 0xff)]!;
    const mixed = (high >>> 0) ^ boxes[2 * BOX_WORDS + ((word >>> 8) & 0xff)]!;
    return (mixed + boxes[3 * BOX_WORDS + (word & 0xff)]!) >>> 0;
  }
}
