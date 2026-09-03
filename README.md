# seven-tree-tuning

Tune files and file-format notes for a 1996 Ford F-350 7.3L Power Stroke Diesel running a
[Power Hungry Performance Hydra chip](https://gopowerhungry.com/pages/hydra-chip).

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
| `tunes/` | 9 tunes, dated 2025-08-16 to 2025-08-28, including revisions B–E of Daily Driver |

File contents are unmodified — byte-for-byte copies, verified by SHA-256.

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

Measured across all 15 files in this repo:

- **229,384 bytes each** (`0x38008` = 4 banks of 57,344 bytes + an 8-byte PKCS#7 trailer).
- **Blowfish-ECB encrypted.** Non-padding data measures **7.9747 bits/byte of entropy**.
- **A single 8-byte value repeats 14,271 times**, always on an 8-byte boundary — the ECB encryption
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

## Chip positions

Position `00` is Bypass Mode and the final position `nS` is No Start; both require a key cycle. The
other 15 of the 17 positions switch live while driving.

## References

- [Hydra Chip](https://gopowerhungry.com/pages/hydra-chip) — product page, tune library
- [Minotaur User's Guide (PDF, 89pp)](https://minotaur.appdata.powerhungrytechnologies.com/minotaur/Minotaur_User_Guide.pdf) — William Cohron, Power Hungry Performance
- [JeliBuilt Hydra tech help](https://www.jelibuiltperformance.com/pages/hydra-help) — loading custom tunes with HydraFlash
- [TDE1 PCM code discussion](https://www.thedieselstop.com/threads/tde1-pcm.38091/)
- [EECtuning — 7.3 diesel XDF definitions](https://eectuning.org/forums/viewtopic.php?t=22148)
