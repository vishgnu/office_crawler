// Direction maths without transcendental functions (core bans Math.sin / cos): rotation by degrees with a Taylor series.
// Only + - * / are used, so the result is identical on every engine.
const DEG = 0.017453292519943295; // pi / 180
/** [cos, sin] of an angle in degrees (|deg| <= 180 is accurate to ~1e-7; larger angles are folded first). */
export function cossin(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360; else if (d < -180) d += 360;
  const x = d * DEG, x2 = x * x;
  let c = 1, s = x, tc = 1, ts = x;
  for (let n = 1; n <= 9; n++) {
    tc = (-tc * x2) / ((2 * n - 1) * (2 * n)); c += tc;
    ts = (-ts * x2) / ((2 * n) * (2 * n + 1)); s += ts;
  }
  return [c, s];
}
/** Rotate the unit vector `d` by `deg` degrees. */
export function rotateDeg(d, deg) {
  const [c, s] = cossin(deg);
  return { x: d.x * c - d.y * s, y: d.x * s + d.y * c };
}
