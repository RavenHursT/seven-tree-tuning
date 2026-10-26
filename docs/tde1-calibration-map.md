# TDE1 calibration map

This file lists every decoded item of the TDE1 calibration (Ford strategy TDE1, 1996 F-350 7.3L):
where it is in the 256 KiB image, how it is laid out, how its values are encoded, which code reads
it, and how it was checked. It also says which items the [web tune editor](../README.md#web-tune-editor)
edits.

The items were found by reading the engine controller code with the Ghidra 8065 module and by
running the code in its emulator. See [Calibration map and the Ghidra 8065 fork](../README.md#calibration-map-and-the-ghidra-8065-fork)
for the module, and [How the items were checked](#how-the-items-were-checked) below. This file holds
addresses, layouts and value encodings. It holds no image bytes except single values that explain
an encoding.

## Addresses

The tools in this repository work on a 256 KiB image. It has four 64 KiB blocks, in the order bank
0, bank 1, bank 8, bank 9. The bytes of each bank start 0x2000 bytes into its block.

- **Image address:** the offset in the 256 KiB image. Every address in this file is an image address
  unless it is marked "CPU".
- **CPU address:** bank × 0x10000 + a 16-bit address. The CPU is an Intel 8065. Bank 8 holds the
  code. Bank 0 is a copy of bank 8. The code reads calibration values through data bank 1, so bank 1
  is the live calibration. Bank 9 also holds calibration data. The sources do not say what reads it.
- **Bank 1 addresses are the same number in both forms.** Image address 0x14521 is CPU address
  0x14521, which is address 0x4521 in bank 1. Bank 8 code addresses differ: image address 0x2xxxx
  is CPU address 0x8xxxx. Every code address in this file is a CPU address, for example 0x89e10.
- **Base registers:** the code adds an offset to a base register to reach a calibration value. The
  register Rfc holds 0x4020, so `AD3W R36, Rfc, #0x500` reads the 16-bit address 0x4520, which is
  image address 0x14520. Rf0 holds 0x2000.
- **`.hcf` offsets:** the [README](../README.md#where-the-parameters-are) lists offsets in the
  encrypted `.hcf` file. For the live calibration (`.hcf` offsets 0x0e000 to 0x1bfff), add 0x4000 to
  get the image address. Example: the `.hcf` offset 0x105d0 is image address 0x145d0.

## Value encodings

- A function is a list of (x, y) byte pairs. The code finds the pair whose x is next below the
  input, then interpolates between that pair and the next pair. Two pairs with the same x make a
  step. The x values go down to 0 (to 0x80 when x is signed). The code never reads past the first
  pair whose x is 0.
- A 2-D map is read by one of four routines: unsigned word 0x88062, signed word 0x8805f, unsigned
  byte 0x87ff1, signed byte 0x87fee. Two axis functions give a row position and a column position
  as index plus fraction, and the routine interpolates.
- A word function is read by routine 0x87e52. Its x and y are words.
- A multiplier such as 0x1000 or 0x4000 stands for 1.0. A scale byte such as 0x80 stands for 1.0.
- Timer tick: 5.333 µs. Angle: 1/64 crank degree.
- Speed: mph × 2. Engine speed: rpm × 4 (the value 0x2710 is 2,500 rpm).

## RAM inputs

The calibration functions take these RAM values as inputs. Addresses are CPU addresses in the
unbanked range 0x0000 to 0x1fff.

| RAM | Value | Encoding |
|---|---|---|
| 0x0b6 | engine speed | rpm × 4 |
| 0x84a | engine speed, copy used by the transmission task | rpm × 4 |
| 0x7b1 | accelerator pedal position (byte) | the x of the shift, lockup and firmness functions |
| 0x7b0 | accelerator pedal position (word) | the x of the two word functions in the shift routine |
| 0x78c | vehicle speed | mph × 2 |
| 0x116 | engine oil temperature | °C × 4 (probable) |
| 0x11c | injection control pressure (ICP) | A/D channel 4, converted by 0x1334c |
| 0x11e | ICP set point | output of the PI loop at 0x84028 |
| 0x108 | barometric pressure | not recorded |
| 0x138 | manifold pressure | HSI input 2 |
| 0x16e | boost | not recorded |
| 0x158 | fuel mass (fuel request) | not recorded |
| 0x194 | fuel volume | fuel request 0x158 divided by density (0x13132 = 218, which is 0.85 × 256) |
| 0x10e | desired injection timing | angle, 1/64 crank degree |
| 0x18e | row input of the maximum-fuel grid | the code that writes it is not found |
| 0x260 | row input of the pulse-width multiplier | see [Fuel and power](#fuel-and-power) |
| 0x842 | shift adjustment scale | 0x80 is 1.0 |
| 0x8ad | shift speed scale | 0x80 is 1.0 |
| 0x847 | desired gear | gear × 2 |
| 0x8ee | current gear | not recorded |
| 0x874 | converter speed ratio | 0x4000 is 1.0 |
| 0x7ac | transmission oil temperature | not recorded |
| 0x7af | pressure | inHg × 8 (probably barometric) |

## Items the web editor edits

| Item | State |
|---|---|
| Shift speeds of the six shift curves (60 bytes) | Edited now |
| Warm idle (4 bytes) | Edited now |
| Converter lockup speeds: lock and unlock, 2nd, 3rd and 4th gear (48 bytes) | Edited now |
| Shift firmness: the 1→2, 2→3 and 3→4 upshift adders (30 bytes) | Edited now |
| Fuel and power grids: 0x125cc, 0x1262c, 0x1277e, 0x12a5e, 0x12c3e, 0x12cac | Edited now |
| Injection timing and ICP grids: 0x12d1a, 0x12df6, 0x12ed2, 0x13032, 0x13094, 0x13974 | Edited now |

The editor refuses to write any byte outside the edited items: the pedal axes, the axis
functions, the lockup adjustment functions and the unused zero functions stay as they are.

## Shift schedule

One shift routine at 0x89e10 (called at 0x89d9d) reads all six shift curves. For each shift it does
these steps:

1. It reads the pedal byte at RAM 0x7b1 as x.
2. It reads the shift curve with the byte lookup 0x87dd2.
3. It reads the adjustment function for the same shift, with signed y.
4. It scales the adjustment by RAM 0x842 and adds it to the curve value.
5. 0x8a04a scales the sum by RAM 0x8ad and compares it with the vehicle speed at RAM 0x78c. The
   carry of the compare decides the shift.

| Image address | Layout | Meaning | Read at | Editor |
|---|---|---|---|---|
| 0x14520 | 10 (x, y) byte pairs | 1→2 upshift curve | 0x89f32 | speeds edited |
| 0x14578 | 10 (x, y) byte pairs | 2→3 upshift curve | 0x89f02 | speeds edited |
| 0x145d0 | 10 (x, y) byte pairs | 3→4 upshift curve | 0x89ecc | speeds edited |
| 0x145f8 | 10 (x, y) byte pairs | 2→1 downshift curve | 0x89f4c | speeds edited |
| 0x14620 | 10 (x, y) byte pairs | 3→2 downshift curve | 0x89f6c | speeds edited |
| 0x14648 | 10 (x, y) byte pairs | 4→3 downshift curve | 0x89f8f | speeds edited |
| 0x1450c | byte pairs, signed y | 1→2 adjustment | 0x89f3c | not edited |
| 0x14534 | byte pairs, signed y | 2→3 adjustment | 0x89f0c | not edited |
| 0x1458c | byte pairs, signed y | 3→4 adjustment | 0x89ed6 | not edited |
| 0x145e4 | byte pairs, signed y | 2→1 adjustment | 0x89f56 | not edited |
| 0x1460c | byte pairs, signed y | 3→2 adjustment | 0x89f76 | not edited |
| 0x14634 | byte pairs, signed y | 4→3 adjustment | 0x89f99 | not edited |
| 0x14548 | word pairs | 2→3 extra function, x = word at RAM 0x7b0 | 0x87e52 | not edited |
| 0x145a0 | word pairs | 3→4 extra function, x = word at RAM 0x7b0 | 0x87e52 | not edited |

Notes:

- **x** is the pedal position (RAM 0x7b1). **y** of a curve is the shift speed, mph × 2. The curve
  values in [`docs/tunes.md`](tunes.md) are these y values divided by 2.
- The first x of a curve is one byte before the first speed byte. The README and the editor give
  the address of the first speed byte (0x14521, 0x14579, 0x145d1, 0x145f9, 0x14621, 0x14649).
- The shift routine reaches each curve as Rfc + 0x500, 0x558, 0x5b0, 0x5d8, 0x600 and 0x628. No
  other code reads the curves. A search for references found no other reader.
- **Breakpoints after the first x of 0 are never read.** Each curve stores 10 breakpoints. Changing
  all 40 bytes of the unused breakpoints changed none of 3,072 results. Changing the speed of the
  last breakpoint that the routine reads changed 796 of the 3,072 results.
- The sources do not give the length of the adjustment functions and the two word functions. The
  1→2, 2→1, 3→2 and 4→3 adjustment functions lie 0x14 bytes before the matching curve.
- The units of the y of the two word functions are not recorded (unknown).

Evidence: emulator-checked in the fork. All 7,708 lookups of the check match an independent
calculation. This includes the six curves, the six adjustment functions and the two word functions.

## Converter lockup

The code turns the converter clutch on and off with high-speed output pin 6 (writes at
0x83220 to 0x83237, from bit 3 of RAM 0xc3). The decision routine is 0x8b0b2. The transmission
task at 0x899fd calls it at 0x89a1b. The schedule routine 0x8b556 reads 12 byte functions through
0x89d14. For each, x is the pedal byte at RAM 0x7b1 and y is a speed, mph × 2, compared with the
vehicle speed at RAM 0x78c.

| Image address | Layout | Meaning | Editor |
|---|---|---|---|
| 0x1468c | byte pairs | lock speed, 2nd gear | edited |
| 0x146a0 | byte pairs | lock speed, 3rd gear | edited |
| 0x146b4 | 8 bytes | lock speed, 4th gear | edited |
| 0x146bc, 0x146d0, 0x146e4 | byte pairs, signed y | lock speed adjustment, 2nd, 3rd, 4th | not edited |
| 0x146ec, 0x14700, 0x14714 | byte pairs | unlock speed, 2nd, 3rd, 4th | edited |
| 0x1471c, 0x14730, 0x14744 | byte pairs, signed y | unlock speed adjustment, 2nd, 3rd, 4th | not edited |

The schedule routine reaches the four groups as Rfc + 0x66c, 0x69c, 0x6cc and 0x6fc (the `AD3W`
instructions at 0x8b5ab to 0x8b5c6). The sources give the length only for 0x146b4 (8 bytes). The
spacing of the addresses gives 20 bytes for the 2nd and 3rd gear functions and 8 bytes for the 4th
gear functions. The adjustment functions have no effect in the checked tunes, because the
multiplier function 0x144d4 is 0.

Values of the tune `REVD`: the 2nd gear locks at 32 mph with the pedal at 60% or more, and at 20
mph at 40%. It does not lock below 40%. The 3rd gear locks at 31 and 27 mph. The 4th gear locks at
30 mph. The unlock speeds are 15, 17 and 28 mph. Power Hungry's library tunes lock the 4th gear
above 22 mph and unlock it below 19 mph. The tune `REVE` disables the 2nd and 3rd gear lockup (about
100 mph).

Other items that decide lockup:

| Image address | Meaning |
|---|---|
| 0x14166, 0x14168, 0x1416a | minimum converter speed ratio before lock, three words (0x4000 is 1.0). The gear of each word is not recorded. |
| 0x14150 to 0x14194 | gating values. Hold times are in 0.125 s units. |
| 0x1420d (enable), 0x14184 (pedal limit) | brake input |
| 0x142e0 | coast input |
| 0x14188 to 0x14190 | tip-in and tip-out |
| 0x14152 | low engine speed limit (the value is 600) |
| 0x1416c | mode byte. Bit 0 is always on. The value 2 inhibits lockup. |
| 0x14178 | lock at wide-open throttle (the value is 78%) |
| 0x14026, 0x1480c, 0x14028 | lock on sensor failure |
| 0x147f4 | wait before the release on a downshift |
| 0x1474c to 0x147d8 | word functions, shift-time supervision for each upshift |
| 0x14196, 0x141ae | lists of values for the shift-time supervision |

The sources do not record the units of most gating values. Treat them as unknown unless the row says
a unit.

Other output pins in the same task: pin 4 is shift solenoid 1, pin 5 is shift solenoid 2, pin 7 is
the coast clutch, and pin 3 is a lamp. The notes give low confidence for this list.

Evidence: emulator-checked. 8,736 of 8,736 lookups match an independent calculation, using the
`EecRunCode.java` script of the fork.

## Shift firmness

Block B holds six byte functions with signed y. Each adds line pressure to the shift, for the
pedal position in RAM 0x7b1.

| Image address | Layout | Meaning | Editor |
|---|---|---|---|
| 0x14820 | 8 bytes | 1st gear (the notes mark it 0) | not edited |
| 0x14828 | 20 bytes | 1→2 upshift adder | edited |
| 0x1483c | 8 bytes | 3→2 downshift (the notes mark it 0) | not edited |
| 0x14844 | 20 bytes | 2→3 upshift adder | edited |
| 0x14858 | 8 bytes | 4→3 downshift (the notes mark it 0) | not edited |
| 0x14860 | 20 bytes | 3→4 upshift adder | edited |

The block runs from 0x14820 to 0x14873. The lengths come from the address spacing. The unit of y is
not recorded (unknown). The result feeds the pressure request.

How the value reaches the transmission:

1. The line-pressure routine 0x8a6ff calls 0x8aec1 at 0x8add0.
2. 0x8aec1 gets the offset of the function from the list at 0x16294 (offsets 0x800 to 0x840) and
   adds Rfc (0x4020). It reads the function through 0x87dd2 at 0x8af10.
3. The result goes to RAM 0x88e. The pressure request in RAM 0x88c is 0x8d9 + 2 × 0x88e during a
   shift.
4. The inverse function 0x14928 turns the request into the electronic pressure control duty in RAM
   0x8a9. The duty goes to 0xf6f.

Tune differences: `REVD` against `REVC` changed the 3→4 function by +18 to +35, which is a firmer
3→4 shift. The `HI-IDLE` tune has all three adders negative.

Evidence: emulator-checked. 104 of 104 and 48 of 48 chains match.

## Fuel and power

Tasks run from the list at 0x1567c: 0x839b8 (fuel limit), 0x83ab5 (final fuel and pulse width),
0x83c1e (desired ICP and IPR duty) and 0x840b8 (injection timing). IPR is the injection pressure
regulator.

| Image address | Layout | Meaning | Editor |
|---|---|---|---|
| 0x125cc to 0x1262b | one 3 × 16 word grid | maximum fuel against engine speed. The three rows are equal. | edited |
| 0x1262c to 0x1277d | 13 × 13 words | block A: base injector pulse width, in timer ticks, against ICP and fuel volume | edited |
| 0x1277e to 0x128dd | 11 × 16 words | pulse-width multiplier, 0x1000 is 1.0 | edited |
| 0x128de to 0x12a3d | 11 × 16 signed words | cold correction of the multiplier, against boost and engine speed (0 in the owner's tunes) | not edited |
| 0x12a3e to 0x12a5d | 16 words, all 0 | not referenced. Perhaps an unused twelfth row. | not edited |
| 0x12a5e to 0x12c3d | 15 × 16 signed words | fuel demand against pedal position and engine speed | edited |
| 0x12c3e | 10 × 11 bytes | fuel limit against boost and engine speed, sea level | edited |
| 0x12cac | 10 × 11 bytes | the same, altitude | edited |

Notes on each item:

- **Maximum fuel (0x125cc).** One 3 × 16 grid, not three copies of a curve. It is read at 0x839f6.
  The columns are engine speed (RAM 0xb6, through function 0x120a0). The rows are RAM 0x18e
  (through function 0x120e0). Earlier notes in this repository called it a power curve.
- **Block A (0x1262c).** The cell for row r and column c is at 0x1262c + 2 × (13 × r + c). In the
  owner's tunes only rows and columns 0 to 10 are used, because the axis functions stop at index
  10: changing rows 11 and 12 or columns 11 and 12 has no effect (0 of 1,260 emulator runs
  changed). In 34 of the 35 library tunes the axis functions reach index 12, so all 13 × 13 cells
  are read there. The editor shows all 13 × 13 cells and dims the rows and columns a tune does not
  reach. Library tunes that are
  not stock extend the axes instead (axis bytes 0x121ab, 0x121af, 0x121b3, 0x121b7, 0x121df and
  0x121e3). The routine 0x83ab5 reads the block through the 2-D routine 0x88062 (call at 0x83bf6,
  address Rf0 + 0x62c). The row is RAM 0x124, which is function 0x121dc of ICP (RAM 0x11c). The
  column is RAM 0x196, which is function 0x121a8 of fuel volume (RAM 0x194). The output is RAM
  0x310 = T × RAM 0x25a ÷ 4096. It is limited to the range from 80 (0x133dc) up to RAM 0x24e. RAM
  0x24e is the smaller of 0x7df600 ÷ RAM 0xb6 and 6003. A per-cylinder trim (RAM 0x572 + 2 × cylinder)
  then applies, and the result goes to the fuel pulse of high-speed output channel 0 (0x82bc8 to
  0x82c05).
- **Pulse-width multiplier (0x1277e).** Earlier notes in this repository called the start of this
  structure the power block and gave the address 0x12798. The structure starts at 0x1277e. The
  columns are function 0x12164 of the temperature in RAM 0x116 (probably engine oil). One summary
  note gives RAM 0x118, but the same notes' read descriptors give 0x116. The rows are function
  0x12244 of RAM 0x260, which one note names ICP; the other ICP grids use RAM 0x11c.
- **Cold correction (0x128de).** Signed words. The sources name it a cold correction of the
  multiplier and give the axes as boost and engine speed.
- **Fuel limit (0x12c3e and 0x12cac).** Byte grids for sea level and for altitude. The sources
  do not record the unit or how the code chooses between them.

Units of this group: pulse width in timer ticks (5.333 µs). Other units are unknown, unless the
items above or the notes say one.

Evidence: emulator-checked. 89,456 lookups of the structures in this group and in the timing group
match their models. Edits
to the grids move the outputs as predicted. Block A: 1,260 of 1,260 runs match. The ICP scale (psi ×
2 or MPa × 256) is still open.

## Injection timing and ICP

| Image address | Layout | Meaning | Editor |
|---|---|---|---|
| 0x12d1a | 10 × 11 signed words | base injection timing against fuel and engine speed, sea level | edited |
| 0x12df6 | 10 × 11 signed words | the same, altitude. The code blends the two with barometric pressure. | edited |
| 0x12ed2 to 0x13031 | 11 × 16 words | time added to the timing, against ICP and oil temperature (injector delay, an inference) | edited |
| 0x13032 to 0x13093 | 7 × 7 signed words | timing correction against oil temperature and engine speed, 0 to 12 degrees, larger when cold | edited |
| 0x13094 to 0x1312d | 7 × 11 words | desired ICP against fuel and engine speed | edited |
| 0x13974 | 11 × 11 words | IPR duty feed-forward map, against desired ICP and an oil-flow value (Rf6 + 0x146) | edited |

Notes:

- **Timing** is an angle, 1/64 crank degree. Task 0x840b8 handles injection timing. RAM 0x10e holds the desired timing.
- **Desired ICP and IPR duty** come from task 0x83c1e. The feed-forward map at 0x13974 is the IPR
  duty map. It is not a power map.
- **Extent of the IPR map.** The notes give the end of the structure as 0x13a5d. The bytes settle
  it: the grid is 11 × 11 words and ends at 0x13a65. The rows rise smoothly through the last cell,
  and the word at 0x13a66 belongs to something else.

Evidence: emulator-checked, in the same run as [Fuel and power](#fuel-and-power) (89,456 lookups).
The writer of RAM 0x18e is still not found.

## Idle

| Image address | Layout | Meaning | Editor |
|---|---|---|---|
| 0x124a4 | 6 points | idle control curve | the editor shows it and does not change it |
| 0x124a6, 0x124aa | 2 words | warm idle, rpm × 4, the first two points of the curve | edited |

The routine that reads the idle curve is not recorded. No emulator check of the idle curve is
recorded. The idle words were found again by code match in an image of another strategy (TNAA5),
together with the shift curves.

## How the items were checked

- **Language.** The 8065 language of the fork decodes every one of the 12,144 code rows that the
  SAD disassembler finds in bank 8, with the same address, length, mnemonic, jump and call targets
  and operands.
- **Emulator.** The p-code emulator of Ghidra runs the lookup routines on the image. An
  independent Python calculation of the same lookup gives the expected result. Every checked row
  matches. One language fix was needed: the N flag after an overflow.
- **Public results.** The fork documents the check of the shift schedule
  ([docs/emulator-check.md](https://github.com/RavenHursT/Ghidra-EEC-806x/blob/8c748015063a471cf09c139571d456ece81c52fb/docs/emulator-check.md)).
  The scripts that produced the counts for the other groups are in the fork
  ([`test/ghidra`](https://github.com/RavenHursT/Ghidra-EEC-806x/tree/8c748015063a471cf09c139571d456ece81c52fb/test/ghidra):
  `EecRunCode.java`, `EecTrace.java`, `EecAccessMap.java`, `EecCalRefs.java`). The result files of
  those groups are on the local machine of the author and are not in the fork. Treat those counts as
  recorded results that you cannot yet reproduce from the fork alone.
- **Names of the items.** A definition file for another strategy (TNAA5) lists 78 items. 43 of them
  have a TDE1 counterpart by matching code. Most of their titles say which tune changed bytes, for
  example "Fuel7 Change", and not what the item does. Use the code-based names in this file.
