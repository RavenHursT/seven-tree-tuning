# tools — Hydra `.hcf` decryptor / encryptor

Decrypts and re-encrypts Power Hungry Performance Hydra `.hcf` calibration files. Two
implementations, identical behaviour (verified byte-for-byte on every tune in this repo):

- **`hcf.ts`** — TypeScript, the shipped tool. Compiles to a standalone native binary with Bun.
- **`hcf_tool.py`** — pure Python 3 reference implementation, no dependencies.

`blowfish-boxes.ts` / `blowfish_boxes.py` hold the standard Blowfish P-array and S-boxes.

## Node / Bun tool (shipped)

Requires [Bun](https://bun.sh) to build (`curl -fsSL https://bun.sh/install | bash`). The npm
scripts are defined in the repo-root `package.json`:

```
npm run build                                   # bun compiles tools/hcf.ts -> ./dist/hcf (gitignored)
npm run run -- decrypt <serial8> in.hcf out.bin # run the compiled binary
npm run run -- encrypt <serial8> in.bin out.hcf
npm run selftest
```

`npm run build` produces `dist/hcf`, a ~60 MB self-contained executable (bundles the Bun runtime)
that needs no Bun/Node/Python installed to run: `./dist/hcf decrypt <serial8> in.hcf out.bin`.
Cross-compile with `bun build tools/hcf.ts --compile --target=bun-linux-x64 --outfile dist/hcf-linux`
(also `bun-darwin-x64`, `bun-darwin-arm64`, `bun-windows-x64`). `dist/` is gitignored.

## Python reference

```
python3 tools/hcf_tool.py decrypt <serial8> in.hcf out.bin [--raw out.raw]
python3 tools/hcf_tool.py encrypt <serial8> in.bin out.hcf
python3 tools/hcf_tool.py selftest
```

## Notes (both tools)

- `<serial8>` — the first 8 characters of your Hydra chip's USB serial number (8 hex digits).
  HydraFlash shows the serial in its bottom-right status bar; it may also be on the chip label.
- `decrypt` produces a **256 KiB PCM image** — load it in Minotaur or in TunerPro with a 7.3L
  EEC-V definition (XDF). `--raw` (Python) also writes the pre-`FormatCalibration` decrypted banks.
- `encrypt` reverses it: edit the `.bin`, then re-encrypt to a `.hcf` HydraFlash will load. The
  round-trip is exact — re-encrypting an unmodified `.bin` reproduces the original `.hcf`
  byte-for-byte.

The chip serial is **not** stored in either tool; it is supplied per invocation.

## How it was determined

Reverse-engineered from HydraFlash 3 for macOS (v3.1.6.0), a .NET / Avalonia app. The relevant
managed code is in `HydraFlashCS.dll`:

- `HydraFlashCS.Blowfish` — textbook Blowfish: 16 rounds, big-endian block packing, F function
  `((S0[a] + S1[b]) ^ S2[c]) + S3[d]`, and the standard cyclic key schedule. The `pBase`/`sBase`
  constants are the standard hex-digits-of-pi boxes (verified: `P[0] = 0x243f6a88`,
  `S[0][0] = 0xd1310ba6`); `blowfish_boxes.py` is those constants extracted verbatim.
- `HydraFlashCS.Cryptography` — `GetKeyByUserId`, `GetKeyData`, `Decrypt`/`Encrypt`. `Decrypt`
  runs Blowfish-ECB in place (its `RemovePadding` result is discarded — dead code).
- `Calibrations.GetCalibrationData` — the loader. For a `.hcf` it builds the key as
  `GetKeyByUserId("4675636B" + ChipSerial + "44502D54")`, decrypts, then calls
  `FormatCalibration`.
- `Calibrations.FormatCalibration` — for a 229,384-byte image, copies four 57,344-byte banks into
  a `0xFF`-filled 256 KiB buffer at offsets `0x22000`, `0x12000`, `0x02000`, `0x32000`.

The two hex constants decode to ASCII `"Fuck"` and `"DP-T"`; `GetKeyByUserId` hex-decodes the whole
concatenation, so the effective key is `b"Fuck" + fromhex(serial) + b"DP-T"`.

`selftest` verifies the Blowfish core against the published Eric Young / Schneier test vectors.

## Verification

Decrypting a known tune yields the erased-flash filler (`0xFF`×8) exactly where the ciphertext had
its repeated block, entropy drops from 6.40 to 4.42 bits/byte, and the trailer is valid PKCS#7
(`08`×8). A wrong serial produces random garbage instead. `.bin → .hcf → compare` reproduces the
original file identically.
