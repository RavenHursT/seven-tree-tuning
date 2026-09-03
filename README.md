# seven-tree-tuning

Tune files and file-format notes for a 1996 Ford F-350 7.3L Power Stroke Diesel running a
[Power Hungry Performance Hydra chip](https://gopowerhungry.com/pages/hydra-chip).

Calibrations authored by [JeliBuilt Performance](https://www.jelibuiltperformance.com/).

## What's here

| Path | Contents |
|---|---|
| `tunes/version-1/` | 6 tunes, dated 2025-01-28 |
| `tunes/version-2/` | 9 tunes, dated 2025-08-16 to 2025-08-28, including revisions B–E of Daily Driver |

Directory names use hyphens (`version-1`) where the source folders used spaces (`version 1`).
File contents are unmodified — byte-for-byte copies, verified by SHA-256.

## Filename convention

Power Hungry's naming is *PCM hex code + horsepower over stock + usage application*:

```
TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf
└┬─┘ └┬┘ └────┬─────┘ └─┬──┘ └────┬─────┘
 │    │       │         │         └─ tuner's note on what changed
 │    │       │         └─ revision letter
 │    │       └─ usage application
 │    └─ 30 hp over stock ("N" appears to denote stock nozzles/injectors — unconfirmed)
 └─ Ford PCM code
```

`TDE1` is the factory PCM code for a 1994½–1996 7.3L with an automatic transmission. It holds
torque-converter lockup down to 20 mph or brake application, shifts into overdrive at 38 mph, and
has its own glow-plug cycling pattern.

## The `.hcf` format

`.hcf` is a **Hydra Custom File** — Power Hungry's proprietary *encrypted* calibration container.
HydraFlash also accepts unencrypted `.bin`; `.pcm` is not supported. These files are not XML or any
text format, despite what some editors guess.

Measured across all 15 files in this repo:

- **229,384 bytes each** (`0x38008` = 224 KiB + 8 bytes), every file identical in size.
- **Encrypted with an 8-byte-block cipher in ECB mode** (DES/3DES/Blowfish class).
- Non-padding data measures **7.9747 bits/byte of entropy** — indistinguishable from random.
- **A single 8-byte value repeats 14,271 times**, always on an 8-byte boundary. That is a constant
  filler block encrypted under ECB. Compression cannot produce this; ECB does exactly this.
- **A constant 16-byte header and 8-byte trailer are identical across every file**, regardless of
  which tune it is — constant plaintext encrypting to constant ciphertext.

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

Across the whole version-2 set, relative to `DAILYDRIVER-REVB`:

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
