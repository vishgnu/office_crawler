// Gear part painters (ADR-0008 section 1). R8-0.1 ships the pipeline with STUB painters: one labelled block per category (colour per category, pips = index in
// the slot's list) so cache, budget, layering and fallbacks are testable; the real art of the 21 categories replaces PART_PAINTERS entries in R8-0.2.
// A painter is `(g, slot, category, tier, A)`: `A` is the anchor set the class painter computes (see heroes.js), the same function serves all three classes.
// Painters are pure functions of (category, tier, anchors, pose): no Math.random, no Date, no core RNG (AC-R-262-1 scans this file).
import { INK, fillPoly, ellipse, line } from "./draw/shapes.js";
import { palette } from "./styles/vector/palette.js";
import { LOOK_CATEGORIES, parseSignature, gearSignature } from "./gearlooks.js";

/** Which slot a hook point of the class painter belongs to. */
export const HOOK_SLOT = { legs: "feet", feet: "feet", torso: "body", head: "head", hands: "hands", weaponBack: "weapon", weaponFront: "weapon", offhand: "offhand" };
export const HOOKS = Object.keys(HOOK_SLOT);

const UNIQUE_RIM = "#e69f00"; // light-orange outer rim of a unique part (Okabe-Ito orange; the vermillion edge is palette.rarity.unique)

const centroid = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };
const scaled = (pts, k) => { const [cx, cy] = centroid(pts); return pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]); };
const edge = (g, pts, colour, w) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.lineWidth = w; g.strokeStyle = colour; g.lineJoin = "round"; g.stroke(); };

/**
 * The one rarity helper every part uses, so every category reads the same way and never by colour alone (NFR-A03):
 * tier 0 normal = ink outline only; 1 magic = one sky-blue edge line; 2 rare = double yellow edge plus two studs;
 * 3 unique = vermillion edge, a bright diamond accent and a thin light-orange outer rim. `pts` is the part's outline polygon [[x, y], ...].
 */
export function trim(g, pts, tier, fill = "#8793ae") {
  const R = palette.rarity;
  if (tier >= 3) edge(g, pts, UNIQUE_RIM, 3.6); // outer rim under the part
  fillPoly(g, pts, fill, INK, 1.3);
  if (tier === 1) edge(g, scaled(pts, 0.8), R.magic, 1.1);
  else if (tier === 2) {
    edge(g, scaled(pts, 0.86), R.rare, 1); edge(g, scaled(pts, 0.64), R.rare, 1);
    for (let i = 0; i < 2; i++) { const p = scaled(pts, 0.8)[i]; ellipse(g, p[0], p[1], 1.1, 1.1, R.rare, INK, 0.5); }
  } else if (tier >= 3) {
    edge(g, scaled(pts, 0.8), R.unique, 1.4);
    const [cx, cy] = centroid(pts), top = Math.min(...pts.map((p) => p[1]));
    fillPoly(g, [[cx, top - 3.6], [cx + 2.2, top - 1.4], [cx, top + 0.8], [cx - 2.2, top - 1.4]], "#fff2c0", R.unique, 0.9); // the unique accent: one small bright diamond
  }
}

const BLOCK_FILL = ["#8793ae", "#7a9a78", "#a9856a", "#8f7fb3", "#b39a5a"];
const rectPts = (cx, cy, w, h) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
/** Stub block: category colour, pips = category number (so the categories of a slot differ in shape detail as well as colour). */
function block(g, cx, cy, w, h, idx, tier) {
  trim(g, rectPts(cx, cy, w, h), tier, BLOCK_FILL[idx % BLOCK_FILL.length]);
  for (let i = 0; i <= idx && i < 5; i++) ellipse(g, cx - w / 2 + 2 + i * 2.2, cy, 0.7, 0.7, INK);
}

const idxOf = (slot, cat) => Math.max(0, LOOK_CATEGORIES[slot].indexOf(cat));
/** Stub painters by slot; `A.hook` says which hook point of the class painter is calling. */
const STUB = {
  feet(g, slot, cat, tier, A) {
    const i = idxOf(slot, cat);
    if (A.hook === "legs") { const l = A.leg; block(g, l.x, l.y + 4, 4.4 * A.sc, 5, i, tier); } // shaft on the lower leg
    else { const l = A.leg; block(g, l.x + A.fx * 1.4, l.y, (A.shoeW + 1) * 2 * A.sc, 4, i, tier); }
  },
  body(g, slot, cat, tier, A) { block(g, A.lx + A.fx * 0.8, (A.shY + A.hipY) / 2 + A.ly * 0.5, A.hw * 1.5, (A.hipY - A.shY) * 0.6, idxOf(slot, cat), tier); },
  head(g, slot, cat, tier, A) { block(g, A.head.x, A.head.y - A.head.r * 0.95, A.head.r * 1.7, 4.2, idxOf(slot, cat), tier); },
  hands(g, slot, cat, tier, A) { const i = idxOf(slot, cat); block(g, A.near[0], A.near[1], 5.6, 5.6, i, tier); block(g, A.far[0], A.far[1], 5.6, 5.6, i, tier); },
  weapon(g, slot, cat, tier, A) {
    if ((A.hook === "weaponBack") !== A.behind) return; // behind the body only for a facing away at rest; otherwise in front
    const [hx, hy] = A.near, [tx, ty] = A.tip, i = idxOf(slot, cat), dx = tx - hx, dy = ty - hy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const L = A.two ? 30 : 22, px = -uy * 2.6, py = ux * 2.6, ex = hx + ux * L, ey = hy + uy * L;
    line(g, hx, hy, ex, ey, INK, 5.6);
    trim(g, [[hx + px, hy + py], [ex + px, ey + py], [ex - px, ey - py], [hx - px, hy - py]], tier, BLOCK_FILL[i % BLOCK_FILL.length]);
    ellipse(g, ex, ey, 1 + i * 0.5, 1 + i * 0.5, INK);
    if (A.two) ellipse(g, hx + ux * 9, hy + uy * 9, 2.4, 2.4, A.skin, INK, 1); // the second hand on the shaft
  },
  offhand(g, slot, cat, tier, A) { block(g, A.far[0] + A.fx * 2, A.far[1] - 3, 9, 11, idxOf(slot, cat), tier); },
};

/** Category -> painter. R8-0.2 replaces entries with the real art; a missing entry falls back to the slot stub. */
export const PART_PAINTERS = {};
for (const slot of Object.keys(LOOK_CATEGORIES)) for (const cat of LOOK_CATEGORIES[slot]) PART_PAINTERS[cat] = STUB[slot];

/**
 * Per-draw gear state for the class painters: `looks` = { head, body, hands, feet, weapon, offhand } (look | null), `dead` = slots whose painter threw,
 * `failed` = slots that threw during the current draw (the baker redraws the frame without them), `onError(slot, err)` is told once per throw.
 */
export function makeGear(input, onError) {
  const looks = parseSignature(typeof input === "string" ? input : gearSignature(input));
  if (!looks) return null;
  for (const k of Object.keys(looks)) if (looks[k]) return { looks, dead: {}, failed: [], onError };
  return null;
}

/** The look worn in a slot, or null (empty, painter failed earlier, or no gear at all). */
export const worn = (G, slot) => (G && !G.dead[slot] ? G.looks[slot] : null);

/**
 * Paint the part for one hook point. No gear, nothing worn in the slot or a dead slot: returns false and draws nothing (the class painter keeps its own look).
 * A painter that throws is caught: the slot is marked dead for the rest of the signature, the error is reported once, the frame carries on.
 */
export function gearHook(g, hook, G, A) {
  if (!G) return false;
  const slot = HOOK_SLOT[hook], look = G.looks[slot];
  if (!look || G.dead[slot]) return false;
  A.hook = hook;
  g.save();
  try {
    (PART_PAINTERS[look.cat] ?? STUB[slot])(g, slot, look.cat, look.tier, A);
    g.restore();
    return true;
  } catch (err) {
    try { g.restore(); } catch { /* a broken context state is the baker's problem, not the frame's */ }
    G.dead[slot] = true; G.failed.push(slot); G.onError?.(slot, err);
    return false;
  }
}
