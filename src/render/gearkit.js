// Shared kit of the gear part painters (R8-0.2): the rarity trim and the small geometry helpers. Pure drawing, no state, no RNG, no clock.
// Rarity (AC-R-261-1) differs by SHAPE as well as hue: tier 0 ink only; 1 one sky-blue edge; 2 a double yellow edge plus two studs;
// 3 a vermillion edge, a light-orange outer rim and one bright diamond accent (the same diamond on every unique, whatever the base).
import { INK, fillPoly, ellipse } from "./draw/shapes.js";
import { palette } from "./styles/vector/palette.js";

export const UNIQUE_RIM = palette.rarityRim; // light-orange outer rim of a unique part (Okabe-Ito orange; the vermillion edge is palette.rarity.unique)

export const centroid = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };
export const scaled = (pts, k) => { const [cx, cy] = centroid(pts); return pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]); };
export const edge = (g, pts, colour, w) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.lineWidth = w; g.strokeStyle = colour; g.lineJoin = "round"; g.stroke(); };

/** Tier 3 only: the light-orange outer rim, drawn UNDER the part. */
export function trimUnder(g, pts, tier) { if (tier >= 3) edge(g, pts, UNIQUE_RIM, 4.2); }

/** The tier marks, drawn OVER the finished part. `at` = [x, y] where the unique diamond sits (default: just above the top of the outline). */
export function trimOver(g, pts, tier, at = null) {
  const R = palette.rarity;
  if (tier === 1) { // R8-T G-1: the blue edge carries a hue-free highlight (dark flank + bright core), so magic differs from normal in greyscale too
    const s = scaled(pts, 0.8);
    edge(g, s, "rgba(20,16,40,0.7)", 3); edge(g, s, R.magic, 1.7); edge(g, s, "#ffffff", 0.8);
  }
  else if (tier === 2) {
    edge(g, scaled(pts, 0.9), R.rare, 1.1); edge(g, scaled(pts, 0.66), R.rare, 1.1);
    const s = scaled(pts, 0.78);
    for (let i = 0; i < 2; i++) ellipse(g, s[i][0], s[i][1], 1.5, 1.5, R.rare, INK, 0.6);
  } else if (tier >= 3) {
    edge(g, scaled(pts, 0.8), R.unique, 1.7);
    const [cx, cy] = at ?? [centroid(pts)[0], Math.min(...pts.map((p) => p[1])) - 1.4];
    fillPoly(g, [[cx, cy - 3.6], [cx + 2.8, cy], [cx, cy + 3.6], [cx - 2.8, cy]], "#fff2c0", R.unique, 1);
  }
}

/** The one rarity helper for a plain filled outline: rim under, fill + ink, marks over. `pts` = [[x, y], ...]. */
export function trim(g, pts, tier, fill = "#8793ae", at = null) {
  trimUnder(g, pts, tier);
  fillPoly(g, pts, fill, INK, 1.3);
  trimOver(g, pts, tier, at);
}

const reach = (A) => (A.anim === "cast" ? 0.72 : A.anim === "attack" ? (A.two ? 0.7 : 0.84) : 1);
/** Coordinates along the weapon: (a, b) = a px along the weapon direction from the hand, b px sideways. */
export function weaponFrame(A) {
  const [ux, uy] = A.wdir, px = -uy, py = ux, [hx, hy] = A.near, k = reach(A); // shorter along the axis in the big poses (the 104 x 96 cell)
  return (a, b) => [hx + ux * a * k + px * b, hy + uy * a * k + py * b];
}
/** Polygon through the (a, b) pairs of a weapon frame. */
export const wpoly = (F, pairs) => pairs.map(([a, b]) => F(a, b));
/** Position of the second hand of a two-handed weapon (the far arm reaches there, heroes.js). */
export const secondHand = (A) => { const k = reach(A); return [A.near[0] + A.wdir[0] * 9 * k, A.near[1] + A.wdir[1] * 9 * k]; };

/** Points of an elliptical arc [t0, t1] (radians, screen y down). */
export function arcPts(cx, cy, rx, ry, t0, t1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = t0 + ((t1 - t0) * i) / n; out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); }
  return out;
}
