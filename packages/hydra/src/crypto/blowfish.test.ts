import { describe, expect, it } from "vitest";

import { Blowfish } from "./blowfish";

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function patternedBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 37 + (index >> 3)) & 0xff);
}

describe("Blowfish standard test vectors", () => {
  const vectors = [
    { key: "0000000000000000", plain: "0000000000000000", cipher: "4ef997456198dd78" },
    { key: "ffffffffffffffff", plain: "ffffffffffffffff", cipher: "51866fd5b85ecb8a" },
    { key: "0123456789abcdef", plain: "1111111111111111", cipher: "61f9c3802281b096" },
    { key: "3000000000000000", plain: "1000000000000001", cipher: "7d856f9a613063f2" },
    { key: "1111111111111111", plain: "0123456789abcdef", cipher: "7d0cc630afda1ec7" },
    { key: "fedcba9876543210", plain: "0123456789abcdef", cipher: "0aceab0fc6a0a28d" },
  ];

  it.each(vectors)("encrypts $plain under key $key to $cipher", ({ key, plain, cipher }) => {
    const encrypted = new Blowfish(fromHex(key)).encryptEcb(fromHex(plain));

    expect(toHex(encrypted)).toBe(cipher);
  });

  it.each(vectors)("decrypts $cipher under key $key to $plain", ({ key, plain, cipher }) => {
    const decrypted = new Blowfish(fromHex(key)).decryptEcb(fromHex(cipher));

    expect(toHex(decrypted)).toBe(plain);
  });
});

describe("Blowfish key lengths", () => {
  // Key: the first N bytes of F0E1D2C3B4A5968778695A4B3C2D1E0F0011223344556677.
  // Plaintext: FEDCBA9876543210.
  const longKey = "f0e1d2c3b4a5968778695a4b3c2d1e0f0011223344556677";
  const ciphers = `
    f9ad597c49db005e e91d21c1d961a6d6 e9c2b70a1bc65cf3 be1e639408640f05
    b39e44481bdb1e6e 9457aa83b1928c0d 8bb77032f960629d e87a244e2cc85e82
    15750e7a4f4ec577 122ba70b3ab64ae0 3a833c9affc537f6 9409da87a90f6bf2
    884f80625060b8b4 1f85031c19e11968 79d9373a714ca34f 93142887ee3be15c
    03429e838ce2d14b a4299e27469ff67b afd5aed1c1bc96a8 10851c0e3858da9f
    e6f51ed79b9db21f 64a6e14afd36b46f 80c7d7d45a5479ad 05044b62fa52d080
  `
    .trim()
    .split(/\s+/);
  const cases = ciphers.map((cipher, index) => ({ keyBytes: index + 1, cipher }));

  it.each(cases)("encrypts correctly with a $keyBytes-byte key", ({ keyBytes, cipher }) => {
    const key = fromHex(longKey.slice(0, keyBytes * 2));
    const blowfish = new Blowfish(key);

    expect(toHex(blowfish.encryptEcb(fromHex("fedcba9876543210")))).toBe(cipher);
    expect(toHex(blowfish.decryptEcb(fromHex(cipher)))).toBe("fedcba9876543210");
  });

  it("accepts a key of 1 byte and a key of 56 bytes", () => {
    expect(() => new Blowfish(new Uint8Array(1))).not.toThrow();
    expect(() => new Blowfish(new Uint8Array(56))).not.toThrow();
  });

  it("rejects an empty key with a RangeError", () => {
    expect(() => new Blowfish(new Uint8Array(0))).toThrow(RangeError);
  });

  it("rejects a key longer than 56 bytes with a RangeError", () => {
    expect(() => new Blowfish(new Uint8Array(57))).toThrow(RangeError);
  });
});

describe("Blowfish ECB mode", () => {
  const key = fromHex("4675636b0a1b2c3d44502d54");

  it("round-trips data of many blocks", () => {
    const blowfish = new Blowfish(key);
    const plain = patternedBytes(1024);

    expect(blowfish.decryptEcb(blowfish.encryptEcb(plain))).toEqual(plain);
  });

  it("encrypts each 8-byte block on its own", () => {
    const blowfish = new Blowfish(key);
    const plain = patternedBytes(24);
    const whole = blowfish.encryptEcb(plain);

    for (let offset = 0; offset < plain.length; offset += 8) {
      const single = blowfish.encryptEcb(plain.slice(offset, offset + 8));
      expect(whole.slice(offset, offset + 8)).toEqual(single);
    }
  });

  it("gives equal blocks of ciphertext for equal blocks of plaintext", () => {
    const encrypted = new Blowfish(key).encryptEcb(new Uint8Array(16).fill(0xff));

    expect(encrypted.slice(0, 8)).toEqual(encrypted.slice(8, 16));
  });

  it("returns an empty array for empty input", () => {
    expect(new Blowfish(key).encryptEcb(new Uint8Array(0))).toEqual(new Uint8Array(0));
  });

  it("returns new arrays and leaves the input unchanged", () => {
    const blowfish = new Blowfish(key);
    const plain = patternedBytes(16);
    const copy = plain.slice();

    const encrypted = blowfish.encryptEcb(plain);
    const decrypted = blowfish.decryptEcb(encrypted);

    expect(plain).toEqual(copy);
    expect(encrypted.buffer).not.toBe(plain.buffer);
    expect(decrypted.buffer).not.toBe(encrypted.buffer);
  });

  it("reads only the viewed part of a larger buffer", () => {
    const blowfish = new Blowfish(key);
    const backing = patternedBytes(40);
    const view = backing.subarray(8, 24);

    expect(blowfish.encryptEcb(view)).toEqual(blowfish.encryptEcb(backing.slice(8, 24)));
  });

  it.each([1, 7, 9, 15])("rejects %i bytes of data with a RangeError", (length) => {
    const blowfish = new Blowfish(key);

    expect(() => blowfish.encryptEcb(new Uint8Array(length))).toThrow(RangeError);
    expect(() => blowfish.decryptEcb(new Uint8Array(length))).toThrow(RangeError);
  });

  it("names the data length in the error message", () => {
    expect(() => new Blowfish(key).encryptEcb(new Uint8Array(7))).toThrow(
      "Blowfish data must be a multiple of 8 bytes long; got 7 bytes.",
    );
  });
});
