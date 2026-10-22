const MAX_BYTE = 255;
const MAX_UINT16 = 65_535;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Shift speed byte (0..255, half-mph steps) to mph. 0..127.5 mph. */
export function speedRawToMph(raw: number): number {
  return raw / 2;
}

/** mph to the nearest shift speed byte, clamped to 0..255 (127.5 mph at most). */
export function mphToSpeedRaw(mph: number): number {
  return clamp(Math.round(mph * 2), 0, MAX_BYTE);
}

/** Idle value (uint16, rpm x 4) to rpm. */
export function idleRawToRpm(raw: number): number {
  return raw / 4;
}

/** rpm to the nearest idle value (uint16, rpm x 4), clamped to 0..65535. */
export function rpmToIdleRaw(rpm: number): number {
  return clamp(Math.round(rpm * 4), 0, MAX_UINT16);
}

/** Throttle byte (0 closed .. 255 wide open) to percent. */
export function throttleRawToPercent(raw: number): number {
  return (raw / MAX_BYTE) * 100;
}
