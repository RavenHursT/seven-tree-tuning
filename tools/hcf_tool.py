#!/usr/bin/env python3
"""
hcf_tool.py - decrypt / encrypt Power Hungry Performance Hydra ".hcf" calibration files.

Reverse-engineered from HydraFlash 3 (v3.1.6.0, HydraFlashCS.dll, class
HydraFlashCS.Cryptography / HydraFlashCS.Blowfish / Calibrations.GetCalibrationData).

.hcf files are Blowfish (ECB, 64-bit block, standard pi-digit S-boxes) encrypted.
For a .hcf, the key is tied to the chip serial:

    userid = "4675636B" + <ChipSerial> + "44502D54"     # concatenated hex string
    key    = bytes.fromhex(userid)                        # = b"Fuck" + fromhex(serial) + b"DP-T"

where <ChipSerial> is the first 8 characters of the chip's USB serial number
(SerialNumber.Substring(0, 8)), i.e. 8 hex digits -> 4 bytes -> a 12-byte key.

Pipeline (decrypt):
    1. Blowfish-ECB decrypt the whole file in place.
    2. FormatCalibration: the decrypted image is 4 banks of 57344 bytes; rearrange
       them into a 256 KiB PCM image (0xFF-filled) at fixed offsets. That 256 KiB
       image is what Minotaur / TunerPro loads as a .bin.

(.efu files and downloaded calibrations instead use a fixed key, GetKeyData(0/1):
 "BDC3072769" / "BDC2051386" hex-decoded to 5 bytes. Not used for .hcf.)

Usage:
    python3 hcf_tool.py decrypt <serial8hex> in.hcf out.bin [--raw out.raw]
    python3 hcf_tool.py encrypt <serial8hex> in.bin out.hcf
    python3 hcf_tool.py selftest
"""
import sys, struct

# ---------------------------------------------------------------- Blowfish
# Standard Blowfish P-array and S-boxes (hex digits of pi), matching the
# pBase/sBase constants embedded in HydraFlashCS.dll.
from blowfish_boxes import P as _P_INIT, S as _S_INIT   # generated alongside; see selftest fallback

MASK = 0xFFFFFFFF

class Blowfish:
    def __init__(self, key):
        self.P = list(_P_INIT)
        self.S = [list(_S_INIT[i]) for i in range(4)]
        j = 0
        for i in range(18):
            d = 0
            for _ in range(4):
                d = ((d << 8) | key[j]) & MASK
                j = (j + 1) % len(key)
            self.P[i] ^= d
        L = R = 0
        for i in range(0, 18, 2):
            L, R = self._enc(L, R)
            self.P[i], self.P[i+1] = L, R
        for i in range(4):
            for k in range(0, 256, 2):
                L, R = self._enc(L, R)
                self.S[i][k], self.S[i][k+1] = L, R

    def _F(self, x):
        d = x & 0xFF; x >>= 8
        c = x & 0xFF; x >>= 8
        b = x & 0xFF; x >>= 8
        a = x & 0xFF
        return (((self.S[0][a] + self.S[1][b]) & MASK) ^ self.S[2][c]) + self.S[3][d] & MASK

    def _enc(self, L, R):
        for i in range(16):
            L ^= self.P[i]
            R ^= self._F(L)
            L, R = R, L
        L, R = R, L
        R ^= self.P[16]
        L ^= self.P[17]
        return L & MASK, R & MASK

    def _dec(self, L, R):
        for i in range(17, 1, -1):
            L ^= self.P[i]
            R ^= self._F(L)
            L, R = R, L
        L, R = R, L
        R ^= self.P[1]
        L ^= self.P[0]
        return L & MASK, R & MASK

    def decrypt_ecb(self, data):
        out = bytearray(len(data))
        for o in range(0, len(data), 8):
            L, R = struct.unpack_from(">II", data, o)
            L, R = self._dec(L, R)
            struct.pack_into(">II", out, o, L, R)
        return bytes(out)

    def encrypt_ecb(self, data):
        out = bytearray(len(data))
        for o in range(0, len(data), 8):
            L, R = struct.unpack_from(">II", data, o)
            L, R = self._enc(L, R)
            struct.pack_into(">II", out, o, L, R)
        return bytes(out)

# ---------------------------------------------------------------- key + format
def hcf_key(serial8):
    userid = "4675636B" + serial8 + "44502D54"
    if len(userid) % 2:
        userid = "0" + userid
    return bytes.fromhex(userid)          # b"Fuck" + fromhex(serial) + b"DP-T"

# FormatCalibration mapping for a 229376/229384-byte decrypted image:
#   (src_off, dst_off, length)  -- src is decrypted banks, dst is the 256 KiB PCM image
_MAP_229K = [
    (0,      139264, 57344),
    (57344,  73728,  57344),
    (114688, 8192,   57344),
    (172032, 204800, 57344),
]
IMG = 262144

def format_calibration(dec):
    out = bytearray(b"\xFF" * IMG)
    for src, dst, ln in _MAP_229K:
        out[dst:dst+ln] = dec[src:src+ln]
    return bytes(out)

def unformat_calibration(img):
    dec = bytearray(229384)            # 4*57344 + 8-byte trailer
    for src, dst, ln in _MAP_229K:
        dec[src:src+ln] = img[dst:dst+ln]
    dec[229376:229384] = b"\x08" * 8   # trailer (PKCS#7-style full block)
    return bytes(dec)

# ---------------------------------------------------------------- commands
def cmd_decrypt(serial, inp, outp, raw=None):
    data = open(inp, "rb").read()
    if len(data) % 8:
        sys.exit(f"error: {inp} length {len(data)} not a multiple of 8")
    dec = Blowfish(hcf_key(serial)).decrypt_ecb(data)
    if raw:
        open(raw, "wb").write(dec)
    img = format_calibration(dec)
    open(outp, "wb").write(img)
    # sanity signal
    filler = dec.count(b"\xFF")
    print(f"decrypted {len(data)} bytes -> {outp} ({len(img)} bytes)")
    print(f"  0xFF bytes in decrypted image: {filler} ({100*filler/len(dec):.1f}%) "
          f"-- expect a large fraction if the serial is correct")

def cmd_encrypt(serial, inp, outp):
    img = open(inp, "rb").read()
    if len(img) != IMG:
        sys.exit(f"error: expected a {IMG}-byte .bin, got {len(img)}")
    dec = unformat_calibration(img)
    enc = Blowfish(hcf_key(serial)).encrypt_ecb(dec)
    open(outp, "wb").write(enc)
    print(f"encrypted {inp} -> {outp} ({len(enc)} bytes)")

def cmd_selftest():
    for key, pt, ct in [
        ("0000000000000000", "0000000000000000", "4ef997456198dd78"),
        ("ffffffffffffffff", "ffffffffffffffff", "51866fd5b85ecb8a"),
        ("0123456789abcdef", "1111111111111111", "61f9c3802281b096"),
    ]:
        bf = Blowfish(bytes.fromhex(key))
        got = bf.encrypt_ecb(bytes.fromhex(pt)).hex()
        ok = got == ct
        print(f"  key={key} pt={pt} -> {got} {'OK' if ok else 'FAIL expect '+ct}")
        assert ok
        assert bf.decrypt_ecb(bytes.fromhex(ct)).hex() == pt
    print("Blowfish core verified against standard test vectors.")

def main():
    a = sys.argv[1:]
    if not a or a[0] == "selftest":
        return cmd_selftest()
    if a[0] == "decrypt":
        raw = None
        if "--raw" in a:
            i = a.index("--raw"); raw = a[i+1]; a = a[:i] + a[i+2:]
        return cmd_decrypt(a[1], a[2], a[3], raw)
    if a[0] == "encrypt":
        return cmd_encrypt(a[1], a[2], a[3])
    sys.exit(__doc__)

if __name__ == "__main__":
    main()
