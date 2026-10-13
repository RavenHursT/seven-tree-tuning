# Tune reference

Every tune in [`tunes/`](../tunes), what it is for, and its full shift schedule. The shift-speed
numbers are decoded from the tune bytes and are exact. The power and fuelling notes are what the byte
comparison can prove without the licensed definition file; where a value's exact meaning is not known
yet, this says so.

All tunes target one truck — a 1996 F-350 7.3L, PCM strategy `TDE1`, 30% injector nozzles, 34" tires.
See the [README](../README.md) for the vehicle build, the `.hcf` format, and the filename convention.

## Reading the shift numbers

- Every speed is **miles per hour on the speedometer**, which is what the PCM computes.
- The 34" tires turn about 9.3% slower than the size the PCM assumes, so **true road speed is about
  9.3% higher** than these numbers. The speedometer reads low by the same amount; the tune files do
  not correct it.
- Each cell is written **WOT – closed**: the shift speed at wide-open throttle, then at a closed
  throttle (foot off). An upshift at WOT happens late (high speed); at closed throttle it happens
  early. A downshift at WOT (kickdown) happens at high speed; at closed throttle (coasting) it
  happens low.

## All tunes

The three variants of each application:

- **base** — the tuner's file, unmodified.
- **TIRECOMP** — the base with the three **upshift** curves scaled by 0.9147 for the 34" tires.
- **TIRECOMP-UPDOWN** — the TIRECOMP file with the three **downshift** curves scaled by the same
  0.9147. **For the 34" tires this is the one to flash** — it keeps every downshift below its matching
  upshift, which the upshift-only version does not.

| File | Application | Variant | Tire comp |
|---|---|---|---|
| [DAILYDRIVER-REVB](../tunes/TDE1_30N_DAILYDRIVER-REVB.hcf) | Daily Driver | base, revision B | none |
| [DAILYDRIVER-REVC](../tunes/TDE1_30N_DAILYDRIVER-REVC.hcf) | Daily Driver | base, revision C | none |
| [DAILYDRIVER-REVD](../tunes/TDE1_30N_DAILYDRIVER-REVD.hcf) | Daily Driver | base, revision D | none |
| [DAILYDRIVER-REVD-DOWNSHIFTCHG](../tunes/TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG.hcf) | Daily Driver | base, revision D + downshift change | none |
| [DAILYDRIVER-REVD-DOWNSHIFTCHG-TIRECOMP](../tunes/TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG-TIRECOMP.hcf) | Daily Driver | tire comp, upshift only | upshift |
| [DAILYDRIVER-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN](../tunes/TDE1_30N_DAILYDRIVER-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN.hcf) | Daily Driver | tire comp, up + down | up + down |
| [DAILYDRIVER-REVE](../tunes/TDE1_30N_DAILYDRIVER-REVE.hcf) | Daily Driver | base, revision E | none |
| [HOTSTREET-REVD-DOWNSHIFTCHG](../tunes/TDE1_30N_HOTSTREET-REVD-DOWNSHIFTCHG.hcf) | Hot Street | base | none |
| [HOTSTREET-REVD-DOWNSHIFTCHG-TIRECOMP](../tunes/TDE1_30N_HOTSTREET-REVD-DOWNSHIFTCHG-TIRECOMP.hcf) | Hot Street | tire comp, upshift only | upshift |
| [HOTSTREET-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN](../tunes/TDE1_30N_HOTSTREET-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN.hcf) | Hot Street | tire comp, up + down | up + down |
| [EXTREMESTREET-REVD-DOWNSHIFTCHG](../tunes/TDE1_30N_EXTREMESTREET-REVD-DOWNSHIFTCHG.hcf) | Extreme Street | base | none |
| [EXTREMESTREET-REVD-DOWNSHIFTCHG-TIRECOMP](../tunes/TDE1_30N_EXTREMESTREET-REVD-DOWNSHIFTCHG-TIRECOMP.hcf) | Extreme Street | tire comp, upshift only | upshift |
| [EXTREMESTREET-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN](../tunes/TDE1_30N_EXTREMESTREET-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN.hcf) | Extreme Street | tire comp, up + down | up + down |
| [STRENUOUSTOW-REVD-DOWNSHIFTCHG](../tunes/TDE1_30N_STRENUOUSTOW-REVD-DOWNSHIFTCHG.hcf) | Strenuous Tow | base | none |
| [STRENUOUSTOW-REVD-DOWNSHIFTCHG-TIRECOMP](../tunes/TDE1_30N_STRENUOUSTOW-REVD-DOWNSHIFTCHG-TIRECOMP.hcf) | Strenuous Tow | tire comp, upshift only | upshift |
| [STRENUOUSTOW-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN](../tunes/TDE1_30N_STRENUOUSTOW-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN.hcf) | Strenuous Tow | tire comp, up + down | up + down |
| [TOWPERFORMANCE-REVD-DOWNSHIFTCHG](../tunes/TDE1_30N_TOWPERFORMANCE-REVD-DOWNSHIFTCHG.hcf) | Tow Performance | base | none |
| [TOWPERFORMANCE-REVD-DOWNSHIFTCHG-TIRECOMP](../tunes/TDE1_30N_TOWPERFORMANCE-REVD-DOWNSHIFTCHG-TIRECOMP.hcf) | Tow Performance | tire comp, upshift only | upshift |
| [TOWPERFORMANCE-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN](../tunes/TDE1_30N_TOWPERFORMANCE-REVD-DOWNSHIFTCHG-TIRECOMP-UPDOWN.hcf) | Tow Performance | tire comp, up + down | up + down |

## Shift schedules

Each cell is **WOT – closed** mph on the speedometer. The three upshift curves are at image offsets
`0x14521` (1→2), `0x14579` (2→3), `0x145d1` (3→4/overdrive); the three downshift curves are at
`0x145f9` (2→1), `0x14621` (3→2), `0x14649` (4→3).

### Daily Driver — base revisions

| Variant | 1→2 | 2→3 | 3→4 | 2→1 | 3→2 | 4→3 |
|---|---|---|---|---|---|---|
| REVB | 27 – 7 | 43 – 18 | 64.5 – 35 | 21 – 5.5 | 37 – 17.5 | 59.5 – 31.5 |
| REVC | 27 – 7 | 43 – 18 | 64.5 – 38 | 21 – 5.5 | 37 – 17.5 | 59.5 – 31.5 |
| REVD | 27 – 7 | 43 – 18 | 64.5 – 38 | 21 – 5.5 | 37 – 17.5 | 59.5 – 31.5 |
| REVD-DOWNSHIFTCHG | 27 – 7 | 43 – 18 | 64.5 – 38 | 21 – 5.5 | 37 – 17.5 | 63 – 36 |
| REVE | 27 – 7 | 43 – 18 | 64.5 – 38 | 21 – 5.5 | 37 – 17.5 | 59.5 – 31.5 |

What changed, revision to revision:

- **REVB → REVC:** light-throttle overdrive engagement raised from 35 to 38 mph (the stock point).
  No other shift speed moved.
- **REVC → REVD:** shift speeds unchanged; the differences are in other fuelling and transmission
  values.
- **REVD → REVD-DOWNSHIFTCHG:** the 4→3 downshift curve raised (closed 31.5 → 36, WOT 59.5 → 63),
  plus a mid-throttle reshape of the 3→4 upshift. This is the tuner's "downshift change" — it keeps
  the transmission from dropping out of overdrive too low and hunting near the 3→4 point.
- **REVE:** a later Daily Driver that does **not** carry the downshift change; its 4→3 curve is back
  at 59.5 – 31.5, the same as REVB–REVD. The tire-comp tunes are built from REVD-DOWNSHIFTCHG, not
  REVE.

### Daily Driver — tire comp (from REVD-DOWNSHIFTCHG)

| Variant | 1→2 | 2→3 | 3→4 | 2→1 | 3→2 | 4→3 |
|---|---|---|---|---|---|---|
| REVD-DOWNSHIFTCHG | 27 – 7 | 43 – 18 | 64.5 – 38 | 21 – 5.5 | 37 – 17.5 | 63 – 36 |
| TIRECOMP (up only) | 24.5 – 6.5 | 39.5 – 16.5 | 59 – 35 | 21 – 5.5 | 37 – 17.5 | 63 – 36 |
| TIRECOMP-UPDOWN | 24.5 – 6.5 | 39.5 – 16.5 | 59 – 35 | 19 – 5 | 34 – 16 | 57.5 – 33 |

### Hot Street

| Variant | 1→2 | 2→3 | 3→4 | 2→1 | 3→2 | 4→3 |
|---|---|---|---|---|---|---|
| REVD-DOWNSHIFTCHG | 25 – 7.5 | 41 – 19 | 64.5 – 38.5 | 21 – 5.5 | 37 – 17.5 | 62.5 – 35.5 |
| TIRECOMP (up only) | 23 – 7 | 37.5 – 17.5 | 59 – 35 | 21 – 5.5 | 37 – 17.5 | 62.5 – 35.5 |
| TIRECOMP-UPDOWN | 23 – 7 | 37.5 – 17.5 | 59 – 35 | 19 – 5 | 34 – 16 | 57 – 32.5 |

### Extreme Street

| Variant | 1→2 | 2→3 | 3→4 | 2→1 | 3→2 | 4→3 |
|---|---|---|---|---|---|---|
| REVD-DOWNSHIFTCHG | 25 – 7.5 | 41 – 19 | 64.5 – 39 | 21 – 5.5 | 37 – 17.5 | 62.5 – 36 |
| TIRECOMP (up only) | 23 – 7 | 37.5 – 17.5 | 59 – 35.5 | 21 – 5.5 | 37 – 17.5 | 62.5 – 36 |
| TIRECOMP-UPDOWN | 23 – 7 | 37.5 – 17.5 | 59 – 35.5 | 19 – 5 | 34 – 16 | 57 – 33 |

### Strenuous Tow

| Variant | 1→2 | 2→3 | 3→4 | 2→1 | 3→2 | 4→3 |
|---|---|---|---|---|---|---|
| REVD-DOWNSHIFTCHG | 27 – 10 | 43 – 22 | 65 – 39 | 21 – 9 | 37 – 17.5 | 62.5 – 37 |
| TIRECOMP (up only) | 24.5 – 9 | 39.5 – 20 | 59.5 – 35.5 | 21 – 9 | 37 – 17.5 | 62.5 – 37 |
| TIRECOMP-UPDOWN | 24.5 – 9 | 39.5 – 20 | 59.5 – 35.5 | 19 – 8 | 34 – 16 | 57 – 34 |

### Tow Performance

| Variant | 1→2 | 2→3 | 3→4 | 2→1 | 3→2 | 4→3 |
|---|---|---|---|---|---|---|
| REVD-DOWNSHIFTCHG | 27 – 10 | 43 – 22 | 64 – 39 | 21 – 9 | 37 – 17.5 | 62.5 – 37 |
| TIRECOMP (up only) | 24.5 – 9 | 39.5 – 20 | 58.5 – 35.5 | 21 – 9 | 37 – 17.5 | 62.5 – 37 |
| TIRECOMP-UPDOWN | 24.5 – 9 | 39.5 – 20 | 58.5 – 35.5 | 19 – 8 | 34 – 16 | 57 – 34 |

### Why the up + down version exists

The upshift-only tire comp lowers the upshift speeds but leaves the downshift speeds where they were.
That pushes some downshift speeds **above** their matching upshift speed — up to 4 mph above at the
3→4 / 4→3 pair — which can make the transmission shift up and down repeatedly near that speed. Scaling
the downshift curves by the same 0.9147 puts every downshift back below its upshift, with the same
margins the tuner's base files had (0.5 to 4 mph). Road-tested good.

## Power and fuelling

What the tune-to-tune byte comparison shows. The exact engineering meaning of each fuel and timing
value needs Power Hungry's licensed definition file; those claims are marked.

- **Shift and power are separate.** The tire-comp and up+down variants change only the shift curves.
  Within one application, the base, TIRECOMP, and UPDOWN files have identical power and fuelling.
- **Power curve (`0x125cc`):** identical in all 19 tunes.
- **Power map (`0x13974`, an 11 × 11 map):**
  - Daily Driver, Strenuous Tow, and Tow Performance share one version.
  - **Hot Street and Extreme Street each raise the top two columns** (the high-load / high-rpm
    corner) well above that shared version. They are close to each other; Hot Street is marginally
    higher in the top column. These are the two higher-power street tunes.
- **Power block (`0x12798`):** the street tunes (Daily Driver, Hot Street, Extreme Street) share one
  version; the tow tunes (Strenuous Tow, Tow Performance) share a different one. This is the main
  street-versus-tow fuelling difference. Its exact function needs the definition file.
- **Tow tunes hold the lower gears longer.** Strenuous Tow and Tow Performance raise the
  closed-throttle upshift points (1→2 at 10 vs 7 mph, 2→3 at 22 vs 18) and the 2→1 coast-down
  downshift (9 vs 5.5), so the transmission stays in a lower gear under load.
- **Strenuous Tow vs Tow Performance** differ in only 189 bytes: the two custom blocks below, a
  one-mph 3→4 upshift difference (65 vs 64 at WOT), and one transmission value. Same power map, same
  power block.

## Not decoded yet

- **Two tuner-custom blocks**, at `0x12630` (block A) and `0x14829` (block B), differ between several
  tunes but are the same across Power Hungry's whole public library, so the library cannot name them.
  Their function is unknown. Identifying them needs either the licensed definition file or a
  single-change road test.
- **Torque-converter lockup** has not been located. The curve at `0x14649`, once thought to be
  lockup, is the 4→3 downshift (see the correction below).
- Several other fuel and timing values differ between applications (for example the group of
  structures around `0x12ed2`–`0x13122`); their exact meanings need the definition file.

## Shift-curve format and build method

Each curve is 19 bytes: ten shift-speed values interleaved with nine throttle breakpoints. The
shift-speed bytes are stored as **mph × 2**. The tire comp scales only those speed bytes, by 0.9147
(stock rolling diameter 31.6496″ ÷ actual 34.6024″), and leaves the throttle breakpoints alone.

- **Upshift tire comp** scales the speed bytes of the three upshift curves (`0x14521`, `0x14579`,
  `0x145d1`) — 30 bytes. Rebuild with [`tools/tirecomp.ts`](../tools/tirecomp.ts); see the
  [README](../README.md#tire-size-compensation--tirecomp-tunes).
- **Up + down tire comp** additionally scales the speed bytes of the three downshift curves
  (`0x145f9`, `0x14621`, `0x14649`) — 30 more bytes, 60 in total. Each `-TIRECOMP-UPDOWN` file differs
  from its `-TIRECOMP` file by exactly those 30 downshift bytes and nothing else.
