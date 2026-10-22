<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/seven-tree-logo-dark.png">
  <img src="assets/seven-tree-logo.png" alt="Seven-Tree logo" width="400">
</picture>

</div>

# seven-tree-tuning

Tune files and file-format notes for a 1996 Ford F-350 7.3L Power Stroke Diesel running a
[Power Hungry Performance Hydra chip](https://gopowerhungry.com/pages/hydra-chip).

> **[Full tune reference → `docs/tunes.md`](docs/tunes.md)** — every tune in `tunes/`, what it is for,
> and its complete up- and down-shift schedule.
>
> **[Web tune editor → `web/`](#web-tune-editor)** — load a tune, edit its shift points and idle speed,
> and save a new `.hcf`.

## Vehicle

The base tunes were built for this specific truck:

- 1996 Ford F-350, 7.3L Power Stroke Diesel, crew cab, long bed, single rear wheel.
- E4OD automatic transmission. Ford PCM code `TDE1`.

Stock except for:

- **34" tires.** Stock is LT235/85R16 ≈ 31.7". 34" is about 7% larger in diameter, so actual road
  speed runs ~7% above the speed the PCM computes, and speed-based shift points arrive later on the
  road than the tables say.
- **Billet torque converter**, plus a towing shift-kit manifold in the transmission.
- **Full Force Diesel Stage 1.5 injectors — 180cc / 30% nozzles**
  (<https://www.fullforcediesel.com/73-powerstroke-stage-1-5-injectors-ffdst15>). This 30% nozzle
  size is the `30N` field in the filenames.
- **Full DiamondBack 4" straight-pipe exhaust, catalytic converter deleted.**
- 193,000 miles on the engine. Transmission rebuilt in 2025 (a few thousand miles since).

Tuning impact: the 30% nozzles change fueling headroom, the converter and shift kit change shift
feel and lockup behaviour, and the larger tires shift the vehicle-speed and shift-schedule tables.

## What's here

| Path | Contents |
|---|---|
| `tunes/*.hcf` (base) | 9 base tunes, dated 2025-08-16 to 2025-08-28, including revisions B–E of Daily Driver. Byte-for-byte unmodified copies. |
| `tunes/*-TIRECOMP-UPDOWN.hcf` | 5 tunes derived from the `REVD-DOWNSHIFTCHG` bases, with every **upshift and downshift** speed scaled for 34" tires — the ones to flash on the 34" tires. |
| `docs/tunes.md` | Per-tune reference: purpose, variants, and the full up/down shift schedule of every tune. |
| `tools/` | Decryptor/encryptor, the tire-compensation script, and format notes. |
| `web/` | The web tune editor (Next.js). See [Web tune editor](#web-tune-editor). |
| `packages/hydra/` | `@seven-tree/hydra`: the `.hcf` / `.efu` codecs, the TDE1 shift curves and idle, and the tire math. `tools/` and `web/` both use it. |

The base files are unmodified byte-for-byte copies, verified by SHA-256. Each `-TIRECOMP-UPDOWN` file
differs from its base by exactly 60 bytes: 30 upshift-speed bytes and 30 downshift-speed bytes. Full
numbers are in
[`docs/tunes.md`](docs/tunes.md).

An earlier set of 6 tunes dated 2025-01-28 — including a `TDE1_30N_HI-IDLE_1100RPM` calibration not
present in the current set — is retained in git history at
[`b0b084c`](https://github.com/RavenHursT/seven-tree-tuning/commit/b0b084ce4eb5eb31917aa8f6d56e55fa5ad87a0c).

## Filename convention

These files are named *PCM code + injector nozzle size + usage application*:

```
TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf
└┬─┘ └┬┘ └────┬─────┘ └─┬──┘ └────┬─────┘
 │    │       │         │         └─ tuner's note on what changed
 │    │       │         └─ revision letter
 │    │       └─ usage application (Daily Driver, Hot Street, Tow Performance, ...)
 │    └─ 30% nozzles — the tune targets the truck's 30% injectors (Full Force Diesel Stage 1.5)
 └─ Ford PCM code
```

Power Hungry's generic convention is *hex code + horsepower-over-stock + usage*. The tunes for this
truck instead put the injector nozzle size in the middle field: `30N` = 30% nozzles, which matches
the installed Full Force Diesel Stage 1.5 (180cc / 30%) injectors (see Vehicle above).

`TDE1` is the factory PCM code for a 1994½–1996 7.3L with an automatic transmission. It holds
torque-converter lockup down to 20 mph or brake application, shifts into overdrive at 38 mph, and
has its own glow-plug cycling pattern.

## The `.hcf` format

`.hcf` is a **Hydra Custom File** — Power Hungry's proprietary *encrypted* calibration container.
HydraFlash also accepts unencrypted `.bin`; `.pcm` is not supported. These files are not XML or any
text format, despite what some editors guess.

The encryption is **Blowfish** (64-bit block, ECB mode, standard pi-digit S-boxes), confirmed by
reverse-engineering HydraFlash 3 (`HydraFlashCS.dll`, v3.1.6.0). See
[`tools/README.md`](tools/README.md) for the full scheme and a working decryptor/encryptor.

Measured across all 19 `.hcf` files in this repo:

- **229,384 bytes each** (`0x38008` = 4 banks of 57,344 bytes + an 8-byte PKCS#7 trailer).
- **Blowfish-ECB encrypted.** Non-padding data measures **7.9747 bits/byte of entropy**.
- **A single 8-byte value repeats 14,271 times per file**, always on an 8-byte boundary — the ECB encryption
  of an erased-flash filler block (`0xFF`×8 in plaintext). ECB reveals this; a chaining mode would not.
- **A constant 16-byte header and 8-byte trailer are identical across every file** — constant
  plaintext under ECB.

### Key derivation

For a `.hcf`, the Blowfish key is tied to the chip's serial number:

```
userid = "4675636B" + <ChipSerial> + "44502D54"   # concatenated hex string
key    = bytes.fromhex(userid)                     # = b"Fuck" + fromhex(serial) + b"DP-T"
```

`<ChipSerial>` is the first 8 characters of the chip's USB serial number, i.e. 8 hex digits → a
12-byte key. Decrypt = Blowfish-ECB over the whole file, then reassemble the four 57,344-byte banks
into a 256 KiB PCM image (the `.bin` Minotaur / TunerPro loads). `.efu` and downloaded files instead
use a fixed key (`BDC3072769` / `BDC2051386`, hex-decoded to 5 bytes).

### Layout

Plaintext structure survives on round boundaries, which is only possible without cipher chaining:

```
0x000000 - 0x009d20   data     (40,224 bytes)
0x009d20 - 0x00e000   filler
0x00e000 - 0x012380   data     (17,280 bytes)   <- tune parameters live in here
0x012380 - 0x015f00   filler
0x015f00 - 0x016000   data     (3 small blocks)
0x016000 - 0x01c000   filler
0x01c000 - 0x038000   ...      entire layout above repeats
0x038000 - 0x038008   8-byte trailer
```

The two 112 KiB (`0x1c000`) halves are **96.6% byte-identical** — two calibration banks.

### Where the parameters are

Because ECB encrypts each block independently, a change to one plaintext byte alters only its own
8-byte block. Diffing the tunes therefore locates the parameters without decrypting anything.

`DAILYDRIVER-REVD` vs `DAILYDRIVER-REVD-DOWNSHIFTCHG` differ in **exactly 4 blocks**:
`0x105d0`, `0x10648`, `0x10650`, `0x10658`. A shift-behaviour change touched four blocks, nothing else.

Across the whole set, relative to `DAILYDRIVER-REVB`:

| File | 8-byte blocks differing | Range |
|---|---|---|
| `DAILYDRIVER-REVC` | 2 | `0x105d8`–`0x105e0` |
| `DAILYDRIVER-REVD` | 5 | `0x105d8`–`0x10870` |
| `DAILYDRIVER-REVD-DOWNSHIFTCHG` | 9 | `0x105d0`–`0x10870` |
| `DAILYDRIVER-REVE` | 10 | `0x105d8`–`0x10870` |
| `STRENUOUSTOW-REVD-DOWNSHIFTCHG` | 134 | `0x0e628`–`0x10870` |
| `TOWPERFORMANCE-REVD-DOWNSHIFTCHG` | 135 | `0x0e628`–`0x10870` |
| `HOTSTREET-REVD-DOWNSHIFTCHG` | 157 | `0x0e4a0`–`0x10870` |
| `EXTREMESTREET-REVD-DOWNSHIFTCHG` | 157 | `0x0e4a0`–`0x10870` |

Every difference falls inside `0x00e4a0`–`0x010870`, under 0.6% of the file.

## How values are encoded

Ford PCM calibration values, per the
[Minotaur User's Guide](https://minotaur.appdata.powerhungrytechnologies.com/minotaur/Minotaur_User_Guide.pdf)
(chapter 7):

- Stored as Byte / Word / DWord / Float, signed or unsigned, little- or big-endian.
- Scaled by **binary shift** — successive multiply or divide by 2. RPM uses a 2-bit shift:
  `0x2710` = 10,000 decimal, 10,000 / 4 = **2,500 RPM**.
- Conversion forms: `X * Scale + Offset`, `X / Scale + Offset`, `Scale / X + Offset`,
  `Offset - (X * Scale)`.
- Maps are defined by column/row count and byte step. **Normalizers** are Ford-specific functions
  generating map axis pointers, allowing non-uniform axis resolution.

Which parameter sits at which address is held in a separate **Resource Definition** file, not in the
calibration. Power Hungry's definitions are encrypted and licensed per user.

## Shift schedule

The automatic transmission's speed-based shift points live in the decrypted 256 KiB image as six
curves — three upshift, three downshift (values shown for `DAILYDRIVER-REVD-DOWNSHIFTCHG`):

| Shift | Image offset | WOT … closed throttle |
|---|---|---|
| 1→2 upshift | `0x14521` | 27 … 7 mph |
| 2→3 upshift | `0x14579` | 43 … 18 mph |
| 3→4 upshift (overdrive) | `0x145d1` | 64.5 … 38 mph |
| 2→1 downshift | `0x145f9` | 21 … 5.5 mph |
| 3→2 downshift | `0x14621` | 37 … 17.5 mph |
| 4→3 downshift (out of overdrive) | `0x14649` | 63 … 36 mph |

Each curve is 19 bytes of interleaved `(MPH, throttle)` pairs. The **even** bytes are the shift speed,
stored as MPH × 2; the **odd** bytes are the throttle-position breakpoints. (An earlier note here
called `0x14649` the torque-converter lockup curve; it is the 4→3 downshift. The lockup schedule has
not been located.) The downshift addresses were confirmed on the truck on 2026-10-21. The full schedule of every tune is in [`docs/tunes.md`](docs/tunes.md).

These offsets were found by decrypting Power Hungry's public calibration library — the `VCAB0_02_*.efu`
files for this PCM strategy, which use a fixed key rather than the chip serial — and comparing the
same-horsepower Tow and Daily variants, which differ only in the transmission schedule. The 3→4 offset
was then confirmed on the truck: scaling it by itself moved the 3→overdrive shift to 38 mph on the
speedometer.

### Tire-size compensation (`-TIRECOMP-UPDOWN` tunes)

34" tires turn about 9.3% slower than the stock size the PCM assumes, so the truck reaches each shift's
real road speed later than the tables intend. The `-TIRECOMP-UPDOWN` tunes scale the MPH (even) bytes
of all three upshift curves and all three downshift curves by **0.9147** — stock 31.6496″ / actual
34.6024″ — so every shift lands at the correct road speed. Fuelling and timing are untouched; only
those 60 bytes change per tune.

Rebuild from a base tune with [`tools/tirecomp.ts`](tools/tirecomp.ts):

```
bun tools/hcf.ts decrypt <serial8> tunes/TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf base.bin
bun tools/tirecomp.ts base.bin out.bin 0.9147
bun tools/hcf.ts encrypt <serial8> out.bin tunes/TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN.hcf
```

Scale the upshifts and downshifts together. An earlier upshift-only set (`-TIRECOMP`) left the
downshift speeds where they were, which put some downshift points at or above their matching upshift —
up to 4 mph at the 3→4 / 4→3 pair — and the transmission hunted between 3rd and overdrive at 36–38 mph.
That set was removed on 2026-10-21; it is in git history at
[`bdab89b`](https://github.com/RavenHursT/seven-tree-tuning/commit/bdab89b953e54db0a995a5d3fce2ccd8ebe6ad7c).
See [`docs/tunes.md`](docs/tunes.md) for the before/after numbers.

## Web tune editor

`web/` is a Next.js app that edits the shift schedule and the warm idle of a TDE1 tune, then saves a
new `.hcf` for the chip.

### Run it

```
nvm use              # Node 24, from .nvmrc
npm install
npm run dev          # http://localhost:3000
```

For a production build, run `npm run build:web`, then `npm start`.

### Use it

1. Load a base tune in the **Base Tune** module:
   - For one of your own tunes, enter the chip serial on the **Upload a file** tab, then upload a
     `.hcf`, a PHP library `.efu` or a decrypted `.bin`. The serial is the first 8 characters of
     the chip's USB serial. HydraFlash shows it in its status bar.
   - For a public tune, pick one of the 35 TDE1 tunes on the **PHP public library** tab. A PHP
     tune opens without the serial. The tab asks for the serial once the tune is open, because
     **Generate Tune** writes a `.hcf`, and a `.hcf` is encrypted with the serial.
2. Enter the tires on the truck in the **Tires** module. The module stays disabled until a tune is
   loaded. The default is the factory size, LT235/85R16. Pick a size from the list, or enter its
   width, height and rim on the **Manual tire size** tab: 315, 75 and 16 for 315/75R16, or
   12.50, 35 and 17 for 35x12.50R17.
3. Edit any shift point or speedometer value in the **Shiftpoints** module. Each one updates the
   other as you type. The **?** button next to the title explains the two columns.
4. Edit the warm idle in the **Idle** module.
5. Click **Generate Tune** and save the `.hcf`. Load it into a chip position with HydraFlash.

All modules are open when the page loads. Click the title of a module to collapse it to a smaller
card that shows only the values that are set, for example the tune and the serial, or the tire size.

A `.hcf` picked before the serial is entered is kept, and opens when the serial is valid. A wrong
serial shows "The chip serial does not match this file."

### What the numbers mean

- **Shift point:** the speed stored in the tune, in 0.5 mph steps. The PCM computes speed for the
  calibration tire size. Set that size under **Speedometer calibration**; the default is LT235/85R16.
- **Speedometer:** the road speed on the fitted tires. It equals the shift point × fitted diameter ÷
  calibration diameter. A speedometer calibrated for the fitted tires shows this value.
- **Set shift points for these tires:** replaces every shift point with the base tune's value ×
  calibration diameter ÷ fitted diameter. With LT265/75R16 as the calibration size and 315/75R16
  fitted, the five `REVD-DOWNSHIFTCHG` tunes become the shipped `-TIRECOMP-UPDOWN` tunes, byte for
  byte. With the default LT235/85R16, 12 to 18 shift points per tune land 0.5 mph higher.
- **Possible gear hunting:** a throttle range where a downshift speed is above its matching upshift.
  Equal speeds are not flagged, because Power Hungry's own library has them. The six curves are
  described in [Shift schedule](#shift-schedule).
- **Warm idle:** the rpm of the first two points of the idle curve, stored as rpm × 4 at `0x124a6` and
  `0x124aa`. The editor shows the other idle-curve points and does not change them.

In the PCM image, the editor changes only those 60 shift-speed bytes and 4 idle bytes, and it
refuses to write any other byte. A `.hcf` holds only the four 56 KiB banks, so the 8 KiB gaps
between them always read back as `0xFF`. PHP's library files hold one byte in a gap (at `0x00000`),
which a `.hcf` cannot carry.

### Privacy

- Decryption and encryption run in the browser. The chip serial never goes to the server.
- The page's Content-Security-Policy (`connect-src 'self'`) makes the browser refuse any request to
  another site.
- The server fetches only files named in Power Hungry's library index, through
  `/api/library/<file>`. The browser cannot fetch them directly, because PHP's site sends no CORS
  headers.

### Tests

```
npm test                                   # unit and component tests (Vitest)
HYDRA_CHIP_SERIAL=<serial8> npm test       # also checks every tune in tunes/
npm run test:e2e                           # Playwright, against a production build
```

With `HYDRA_CHIP_SERIAL` set, the tests decode every tune in `tunes/` and check that:

- each schedule matches `docs/tunes.md`, and no tune has a gear-hunting overlap;
- decode then encode gives the same file, byte for byte;
- the tire compensation rebuilds each `-TIRECOMP-UPDOWN` tune byte for byte.

`HYDRA_EFU_DIR=<folder>` adds the same decode check for a folder of PHP library `.efu` files. Do not
commit the serial, decrypted images or PHP's files.

GitHub Actions runs these checks on every pull request (`.github/workflows/ci.yml`). Job `unit` runs
`npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test`. Job `e2e` runs
`npm run test:e2e` in Chromium and, when it fails, attaches the Playwright report to the run for 7
days. CI does not set `HYDRA_CHIP_SERIAL` or `HYDRA_EFU_DIR`, so the tests that need them skip.

### Deployment (Vercel)

The Vercel project `seven-tree-tuning` is linked to this repository through the Vercel GitHub App.

- **Production:** every push to `main` deploys to <https://seven-tree-tuning.vercel.app>.
- **Previews:** every push to a pull request branch deploys a preview, and Vercel comments the link
  on the pull request. Previews need a Vercel login (Vercel's Standard Protection); production is
  public.
- **Settings:** framework Next.js, root directory `web`, Node 24.x, and "include files outside the
  root directory" on, because the app imports `packages/hydra`. The app needs no environment
  variables.

### Code layout

| Path | Contents |
|---|---|
| `packages/hydra/src/container`, `crypto` | Blowfish, `HcfCodec`, `EfuDecoder`, `BinCodec` |
| `packages/hydra/src/calibration` | TDE1 curve and idle offsets, edits, tire math, gear-hunting check |
| `packages/hydra/src/library` | Power Hungry's library index and tune names |
| `web/src/features/tune-editor/components` | Components that take props only |
| `web/src/features/tune-editor/sections` | Components that connect the editor state to them |
| `web/src/features/tune-editor/state` | Reducer, selectors, file decode and build |
| `web/src/features/library`, `web/src/app/api/library` | Server-only access to PHP's library |

## Chip positions

Position `00` is Bypass Mode and the final position `nS` is No Start; both require a key cycle. The
other 15 of the 17 positions switch live while driving.

## References

- [Hydra Chip](https://gopowerhungry.com/pages/hydra-chip) — product page, tune library
- [Minotaur User's Guide (PDF, 89pp)](https://minotaur.appdata.powerhungrytechnologies.com/minotaur/Minotaur_User_Guide.pdf) — William Cohron, Power Hungry Performance
- [JeliBuilt Hydra tech help](https://www.jelibuiltperformance.com/pages/hydra-help) — loading custom tunes with HydraFlash
- [TDE1 PCM code discussion](https://www.thedieselstop.com/threads/tde1-pcm.38091/)
- [EECtuning — 7.3 diesel XDF definitions](https://eectuning.org/forums/viewtopic.php?t=22148)
