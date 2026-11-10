/**
 * Turn a thumb offset from the stick's centre into a movement vector.
 * Screen y grows downward, so pushing the thumb up gives a positive `y` (forward).
 * The result has length 0 inside the dead zone and reaches 1 at the stick's radius.
 */
export function stickVector(dxPx: number, dyPx: number, radiusPx: number, deadZone = 0.12): { x: number; y: number } {
  const len = Math.hypot(dxPx, dyPx);
  if (len === 0 || radiusPx <= 0) return { x: 0, y: 0 };
  const amount = Math.min(1, len / radiusPx);
  if (amount <= deadZone) return { x: 0, y: 0 };
  const scaled = (amount - deadZone) / (1 - deadZone);
  return { x: (dxPx / len) * scaled, y: (-dyPx / len) * scaled };
}
