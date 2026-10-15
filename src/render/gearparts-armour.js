// Armour part painters (R8-0.2, ADR-0008): head (cap, helmet, headset), body (knit, jacket, vest, suit), hands (brace, gloves, mitts), feet (sneaker, loafer, boot).
// They are drawn over the class outfit: head parts over hair and glasses, body parts over the class torso, hand parts over the hand circles, foot parts over the shoes.
// Painters are `(g, slot, category, tier, A)`; A.hook names the hook point. Pure functions of their arguments (no RNG, no clock).
import { INK, fillPoly, ellipse, line, limb } from "./draw/shapes.js";
import { trimUnder, trimOver, arcPts, secondHand, UNIQUE_RIM } from "./gearkit.js";
import { palette } from "./styles/vector/palette.js";

// ---------------------------------------------------------------- head
/** Dome over the top of the head: a half ellipse, closed along the hairline. */
function domePts(A, rx, ry, dy = -1.2) {
  const { x, y } = A.head, cx = x + A.fx * 0.5, cy = y + dy, pts = arcPts(cx, cy, rx, ry, Math.PI, Math.PI * 2, 14);
  pts.push([cx + rx - 0.3, cy + 2.2], [cx - rx + 0.3, cy + 2.2]);
  return { pts, cx, cy };
}
function headCap(g, slot, cat, tier, A) { // visor cap: rounded teal dome, seam and button, a bill pointing the way the hero looks
  const r = A.head.r, d = domePts(A, r + 1.1, r * 0.92, -4), s = Math.abs(A.fx);
  trimUnder(g, d.pts, tier);
  fillPoly(g, d.pts, "#2e8f9c", INK, 1.5);
  fillPoly(g, arcPts(d.cx - 2, d.cy, r * 0.8, r * 0.7, Math.PI * 1.1, Math.PI * 1.6, 6).concat([[d.cx - 2, d.cy - 1]]), "#58c0cc", null); // lit side
  if (A.front) line(g, d.cx + A.fx * 2, d.cy - r * 0.92, d.cx + A.fx * 3.4, d.cy + 1, "#1d6470", 1.1); else line(g, d.cx, d.cy - r * 0.92, d.cx, d.cy + 1.4, "#1d6470", 1.1);
  ellipse(g, d.cx + A.fx * 0.6, d.cy - r * 0.92, 1.5, 1.2, "#1d6470", INK, 0.8); // button
  if (A.front) { // bill
    const bx = d.cx + A.fx * r * 0.85, rx = r * (0.98 - 0.36 * s), by = d.cy + 1.1;
    fillPoly(g, arcPts(bx, by, rx, 2.0, 0, Math.PI, 8).concat([[bx - rx, by - 0.4], [bx + rx, by - 0.4]]), "#1f6f7c", INK, 1.3);
  } else { fillPoly(g, [[d.cx - 3.2, d.cy + 0.6], [d.cx + 3.2, d.cy + 0.6], [d.cx + 3.2, d.cy + 2.8], [d.cx - 3.2, d.cy + 2.8]], "#1f6f7c", INK, 1); ellipse(g, d.cx, d.cy + 1.7, 0.9, 0.9, "#cbd3e2"); // strap + buckle
    for (const k of [-1, 1]) { g.beginPath(); g.ellipse(d.cx, d.cy + 1.2, r * 0.45 + 1.6, r * 0.92, 0, k < 0 ? Math.PI * 1.08 : Math.PI * 1.55, k < 0 ? Math.PI * 1.45 : Math.PI * 1.92); g.lineWidth = 1; g.strokeStyle = "#1d6470"; g.stroke(); } // panel seams
    g.beginPath(); g.ellipse(d.cx, d.cy + 0.4, r + 0.6, r * 0.5, 0, Math.PI * 0.08, Math.PI * 0.92); g.lineWidth = 1.2; g.strokeStyle = "#143f48"; g.stroke(); // dark arc under the dome: cap and hair never read as one ball
  }
  trimOver(g, d.pts, tier, [d.cx, d.cy - r * 0.92 - 3.4]);
}

function helmet(g, slot, cat, tier, A) { // safety helmet: tall white dome, a ridge, a lamp, a wide brim ring all around
  const r = A.head.r, d = domePts(A, r + 1.5, r * 1.1, -3);
  const brim = arcPts(d.cx, d.cy + 1.8, r + 4, 2.7, 0, Math.PI * 2, 12);
  fillPoly(g, brim, "#cfd3c4", INK, 1.4); // brim ring (behind the dome's lower edge)
  trimUnder(g, d.pts, tier);
  fillPoly(g, d.pts, "#f4f4ec", INK, 1.5);
  fillPoly(g, arcPts(d.cx - 2, d.cy, r * 0.9, r * 1.0, Math.PI * 1.1, Math.PI * 1.62, 6).concat([[d.cx - 2, d.cy - 1]]), "#ffffff", null);
  fillPoly(g, [[d.cx - 1.3, d.cy - r * 1.1 + 0.6], [d.cx + 1.3, d.cy - r * 1.1 + 0.6], [d.cx + 1.9 + A.fx, d.cy + 0.6], [d.cx - 1.9 + A.fx, d.cy + 0.6]], "#d3d6c8", INK, 0.9); // ridge
  if (A.front) { const lx = d.cx + A.fx * 3.4; fillPoly(g, [[lx - 2.6, d.cy - 4.8], [lx + 2.6, d.cy - 4.8], [lx + 2.6, d.cy - 1.4], [lx - 2.6, d.cy - 1.4]], "#ffd23a", INK, 1.1); ellipse(g, lx, d.cy - 3.1, 1, 1, "#fff8c8"); } // lamp
  const brimFront = arcPts(d.cx, d.cy + 1.8, r + 4, 2.7, 0, Math.PI, 10); // brim front lip over the dome base
  g.beginPath(); g.moveTo(brimFront[0][0], brimFront[0][1]); for (const p of brimFront) g.lineTo(p[0], p[1]); g.lineWidth = 2.2; g.strokeStyle = "#e4e7da"; g.lineJoin = "round"; g.stroke();
  trimOver(g, d.pts, tier, [d.cx, d.cy - r * 1.1 - 3.2]);
}

function headset(g, slot, cat, tier, A) { // over-ear headset: graphite band over the hair, big ear cups with a cyan glint, mic boom
  const { x, y, r } = A.head, s = Math.abs(A.fx), off = (r + 1.1) * (1 - 0.86 * s), top = y - r * 1.12 - 1.8;
  const band = arcPts(x - A.fx * 0.4, y + 0.8, off + 0.4, y + 0.8 - top, Math.PI, Math.PI * 2, 12);
  g.beginPath(); g.moveTo(band[0][0], band[0][1]); for (const p of band) g.lineTo(p[0], p[1]); g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 5.4; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3; g.strokeStyle = "#454d6e"; g.stroke(); g.lineWidth = 1; g.strokeStyle = "#8c96c0"; g.stroke();
  const cupR = [x - off - A.fx * 0.6, x + off - A.fx * 0.6], cy = y + 1.2;
  const cups = [[cupR[0], cy], [cupR[1], cy]];
  if (!A.front) cups.reverse(); // the mic side is irrelevant from behind
  for (let i = 0; i < 2; i++) {
    const [cx, cyy] = cups[i], big = s > 0.8 ? 1.15 : 1;
    const outline = arcPts(cx, cyy, 3.3 * big, 4.5 * big, 0, Math.PI * 2, 10);
    if (i === 0 || s < 0.8) { trimUnder(g, outline, tier); fillPoly(g, outline, "#2f3556", INK, 1.4); ellipse(g, cx - A.fx * 0.4, cyy, 1.9 * big, 2.8 * big, "#454d6e", null); ellipse(g, cx - 0.7, cyy - 1, 0.9, 1.1, "#33e0ff"); trimOver(g, outline, tier, i === 0 ? [cx, cyy - 8] : null); }
  }
  if (A.front) { // mic boom from the near cup to the mouth, orange ball
    const [cx] = cups[A.fx >= 0 ? 0 : 1], mx = x + A.fx * 3 + (A.fx >= 0 ? -3 : 3), my = y + r * 0.82;
    g.beginPath(); g.moveTo(cx, cy + 3.4); g.quadraticCurveTo(cx + (mx - cx) * 0.2, my + 2.4, mx, my); g.lineWidth = 3; g.strokeStyle = INK; g.lineCap = "round"; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = "#8c96c0"; g.stroke();
    ellipse(g, mx, my, 2, 1.8, "#ff8a1f", INK, 1);
  }
}

// ---------------------------------------------------------------- body
/** The class torso (same quad as heroes.js) grown by `ext` on the sides and `hem` below the hip. */
function torsoPts(A, ext, hem, shoulder = 0) {
  const { hw, lx, ly, shY, hipY, taper } = A;
  return [[-hw - ext - shoulder + lx, shY + ly - 0.6], [hw + ext + shoulder + lx, shY + ly - 0.6], [hw - taper + ext + lx * 0.5, hipY + 1 + hem], [-hw + taper - ext + lx * 0.5, hipY + 1 + hem]];
}

/** Rounded outline of the torso quad (corner radius r, arcTo), used by the unique body: rim, clip and ink line share it so the slab has round shoulders and hem. */
function roundedTorso(g, p, r) {
  const n = p.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  g.beginPath();
  const m0 = mid(p[n - 1], p[0]); g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const c = p[i], m = mid(c, p[(i + 1) % n]); g.arcTo(c[0], c[1], m[0], m[1], r); }
  g.closePath();
}
/** R8-T G-2 / G-R2: a unique body gets a light-orange rim all round the (rounded) torso; the fill is clipped to the same rounded shape until bodyOver. Tiers 0-2 use the shared trim. */
function bodyUnder(g, p, tier) {
  if (tier < 3) return trimUnder(g, p, tier);
  g.save();
  roundedTorso(g, p, 4.2); g.lineWidth = 4.4; g.lineJoin = "round"; g.strokeStyle = UNIQUE_RIM; g.stroke();
  roundedTorso(g, p, 4.2); g.clip();
}
/** Pairs with bodyUnder: tiers 3 releases the clip (the one extra save), inks the rounded edge, then the vermillion lines on shoulders and hem and the collar diamond. */
function bodyOver(g, p, tier, at) {
  if (tier < 3) return trimOver(g, p, tier, at);
  const R = palette.rarity;
  g.restore();
  g.save();
  roundedTorso(g, p, 4.2); g.lineWidth = 1.5; g.lineJoin = "round"; g.strokeStyle = INK; g.stroke();
  for (const [a, b, dy] of [[p[0], p[1], 2.1], [p[3], p[2], -1.9]]) { g.beginPath(); g.moveTo(a[0] + 2.5, a[1] + dy); g.lineTo(b[0] - 2.5, b[1] + dy); g.lineWidth = 1.5; g.lineCap = "round"; g.strokeStyle = R.unique; g.stroke(); }
  g.restore();
  const cx = (p[0][0] + p[1][0]) / 2, cy = p[0][1] + 7.4; // collar diamond, centred just below the chin on every class (the head covers the neckline itself)
  fillPoly(g, [[cx, cy - 4], [cx + 3.2, cy], [cx, cy + 4], [cx - 3.2, cy]], "#fff2c0", R.unique, 1.1);
}

function knit(g, slot, cat, tier, A) { // cardigan: soft sage knit, V-neck over a white shirt, buttons, ribbed hem band and two pockets
  const p = torsoPts(A, 1.6, 4.4, 0.4), { hw, lx, ly, shY, hipY, cx0 } = A, hemY = hipY + 4.4;
  bodyUnder(g, p, tier);
  fillPoly(g, p, "#86a878", INK, 1.6);
  fillPoly(g, [[p[0][0], p[0][1]], [p[0][0] + 5, p[0][1]], [p[3][0] + 4, p[3][1]], [p[3][0], p[3][1]]], "#a3c294", null); // lit left edge
  fillPoly(g, [[p[1][0], p[1][1]], [p[1][0] - 4.5, p[1][1]], [p[2][0] - 4, p[2][1]], [p[2][0], p[2][1]]], "#6a8a5e", null); // shade side
  fillPoly(g, [[p[3][0], hemY - 3], [p[2][0], hemY - 3], [p[2][0], hemY], [p[3][0], hemY]], "#6f9163", INK, 1); // ribbed hem
  for (let x = p[3][0] + 1.6; x < p[2][0]; x += 2.6) line(g, x, hemY - 2.6, x, hemY - 0.4, "#4f6e45", 0.9);
  if (A.front) {
    fillPoly(g, [[cx0 - 4.2, shY + ly - 0.6], [cx0 + 4.2, shY + ly - 0.6], [cx0 + 0.3, shY + ly + 9.5]], "#f6f1e4", INK, 1.1); // shirt in the V
    line(g, cx0 + 0.2, shY + ly + 9, cx0 + 0.2, hemY - 3, INK, 1.1);
    for (let i = 0; i < 3; i++) ellipse(g, cx0 + 1.6, shY + ly + 11 + i * ((hipY - shY - 13) / 2.4), 1.1, 1.1, "#f6f1e4", INK, 0.7);
    for (const sgn of [-1, 1]) fillPoly(g, [[cx0 + sgn * 4.4, hipY - 6], [cx0 + sgn * 8.4, hipY - 6], [cx0 + sgn * 8.4, hipY - 1.6], [cx0 + sgn * 4.4, hipY - 1.6]], "#6f9163", INK, 0.9);
  } else { fillPoly(g, [[cx0 - 4, shY + ly - 0.6], [cx0 + 4, shY + ly - 0.6], [cx0 + 3, shY + ly + 2.2], [cx0 - 3, shY + ly + 2.2]], "#6f9163", INK, 1); } // neck rib
  bodyOver(g, p, tier, [cx0 + hw * 0.45, shY + ly + 7]);
}

function jacket(g, slot, cat, tier, A) { // blazer: navy, square shoulder pads, white shirt V, notched lapels, breast pocket with a square
  const p = torsoPts(A, 1.8, 4.8, 1.5), { ly, shY, hipY, cx0, lx, hw } = A;
  bodyUnder(g, p, tier);
  fillPoly(g, p, "#34487e", INK, 1.6);
  fillPoly(g, [[p[0][0], p[0][1]], [p[0][0] + 4, p[0][1]], [p[3][0] + 3, p[3][1]], [p[3][0], p[3][1]]], "#4a64a4", null);
  fillPoly(g, [[p[1][0], p[1][1]], [p[1][0] - 4.5, p[1][1]], [p[2][0] - 3, p[2][1]], [p[2][0], p[2][1]]], "#26365e", null);
  if (A.front) {
    fillPoly(g, [[cx0 - 4.2, shY + ly - 0.4], [cx0 + 4.2, shY + ly - 0.4], [cx0, hipY - 3]], "#f6f1e4", INK, 1);
    fillPoly(g, [[cx0 - 4.2, shY + ly - 0.4], [cx0 - 8.2, shY + ly - 0.4], [cx0 - 6.4, shY + ly + 3.2], [cx0 - 8.8, shY + ly + 4.6], [cx0 - 1.6, hipY - 7], [cx0 - 0.4, hipY - 3]], "#5a76b8", INK, 1.1); // lapels
    fillPoly(g, [[cx0 + 4.2, shY + ly - 0.4], [cx0 + 8.2, shY + ly - 0.4], [cx0 + 6.4, shY + ly + 3.2], [cx0 + 8.8, shY + ly + 4.6], [cx0 + 1.6, hipY - 7], [cx0 + 0.4, hipY - 3]], "#4a64a4", INK, 1.1);
    ellipse(g, cx0, hipY - 2, 1.2, 1.2, "#e8eef8", INK, 0.7);
    const px = cx0 - hw * 0.55; fillPoly(g, [[px - 2.6, shY + ly + 6.4], [px + 2.6, shY + ly + 6.4], [px + 2.6, shY + ly + 7.6], [px - 2.6, shY + ly + 7.6]], "#26365e", INK, 0.8);
    fillPoly(g, [[px - 1.6, shY + ly + 4.4], [px + 0.2, shY + ly + 4.4], [px + 1.4, shY + ly + 6.6], [px - 1.6, shY + ly + 6.6]], "#fff6dc", INK, 0.7);
  } else { line(g, cx0, shY + ly + 3, cx0, p[2][1], "#1f2c50", 1.4); fillPoly(g, [[cx0 - 5, shY + ly - 0.4], [cx0 + 5, shY + ly - 0.4], [cx0 + 3, shY + ly + 2.4], [cx0 - 3, shY + ly + 2.4]], "#5a76b8", INK, 1); }
  bodyOver(g, p, tier, [cx0 + hw * 0.5, shY + ly + 6]);
}

function vest(g, slot, cat, tier, A) { // hi-vis vest: lime, two silver reflective bands, straps over the shoulders, zip; sleeves stay the class shirt
  const p = torsoPts(A, 0.8, 2.2, 0.3), { ly, shY, hipY, cx0, hw, lx } = A;
  bodyUnder(g, p, tier);
  fillPoly(g, p, "#c9e63a", INK, 1.6);
  fillPoly(g, [[p[1][0], p[1][1]], [p[1][0] - 4, p[1][1]], [p[2][0] - 3, p[2][1]], [p[2][0], p[2][1]]], "#a6c22a", null);
  const y1 = shY + ly + 6.4, y2 = shY + ly + 12.6;
  for (const y of [y1, y2]) { fillPoly(g, [[p[0][0] + 0.4, y], [p[1][0] - 0.4, y], [p[1][0] - 0.4, y + 2.6], [p[0][0] + 0.4, y + 2.6]], "#e8eef8", INK, 0.9); line(g, p[0][0] + 1.2, y + 1.3, p[1][0] - 1.2, y + 1.3, "#aab6cc", 0.8); }
  for (const sgn of [-1, 1]) fillPoly(g, [[cx0 + sgn * hw * 0.62, shY + ly - 0.6], [cx0 + sgn * hw * 0.98, shY + ly - 0.6], [cx0 + sgn * hw * 0.98, y1], [cx0 + sgn * hw * 0.66, y1]], "#e8eef8", INK, 0.8); // reflective straps
  if (A.front) { fillPoly(g, [[cx0 - 3, shY + ly - 0.6], [cx0 + 3, shY + ly - 0.6], [cx0, shY + ly + 3]], "#3a3f58", INK, 0.9); line(g, cx0, shY + ly + 3, cx0, p[2][1] - 0.4, INK, 1.2); }
  bodyOver(g, p, tier, [cx0 - hw * 0.55, shY + ly + 14.6]);
}

function suit(g, slot, cat, tier, A) { // pinstripe suit: charcoal with light pinstripes, long jacket, white shirt, red tie, lapels
  const p = torsoPts(A, 1.6, 5.8, 1.0), { ly, shY, hipY, cx0, hw } = A;
  bodyUnder(g, p, tier);
  fillPoly(g, p, "#3a3b50", INK, 1.6);
  g.save(); g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (const q of p) g.lineTo(q[0], q[1]); g.closePath(); g.clip();
  for (let x = p[0][0] + 2.4; x < p[1][0]; x += 3.2) line(g, x, shY + ly, x - 0.4, hipY + 8, "#9a9cc0", 0.9);
  g.restore();
  fillPoly(g, [[p[1][0], p[1][1]], [p[1][0] - 4, p[1][1]], [p[2][0] - 3, p[2][1]], [p[2][0], p[2][1]]], "rgba(10,8,30,0.35)", null);
  if (A.front) {
    fillPoly(g, [[cx0 - 3.4, shY + ly - 0.4], [cx0 + 3.4, shY + ly - 0.4], [cx0, hipY - 4]], "#f6f1e4", INK, 1);
    fillPoly(g, [[cx0 - 0.2, shY + ly + 0.4], [cx0 + 1.8, shY + ly + 1.6], [cx0 + 1.4, hipY - 7], [cx0 + 0.1, hipY - 3.6], [cx0 - 1.2, hipY - 7], [cx0 - 1.6, shY + ly + 1.6]], "#d83a3a", INK, 0.9); // tie
    fillPoly(g, [[cx0 - 3.4, shY + ly - 0.4], [cx0 - 7, shY + ly - 0.4], [cx0 - 1.2, hipY - 6]], "#2a2b3e", INK, 1);
    fillPoly(g, [[cx0 + 3.4, shY + ly - 0.4], [cx0 + 7, shY + ly - 0.4], [cx0 + 1.2, hipY - 6]], "#2a2b3e", INK, 1);
    ellipse(g, cx0 - 0.5, hipY - 1, 1.1, 1.1, "#9a9cc0", INK, 0.7);
  } else line(g, cx0, shY + ly + 2, cx0, p[2][1], "#23243a", 1.3);
  bodyOver(g, p, tier, [cx0 + hw * 0.5, shY + ly + 6]);
}

// ---------------------------------------------------------------- hands
/** [x, y, dirx, diry] of the hand circles: near hand, and the far hand (on the shaft for a two-handed weapon). */
function handSpots(A) {
  const mk = (h, s) => { const dx = h[0] - s[0], dy = h[1] - s[1], l = Math.hypot(dx, dy) || 1; return [h[0], h[1], dx / l, dy / l]; };
  const far = A.two ? secondHand(A) : A.far;
  return [mk(A.near, A.ns), mk(far, A.fs)];
}
const HK = 1.2; // hand parts are drawn 20 % larger than the bare hand so they read at ~60 px
const rot = (pts, cx, cy, ux, uy) => pts.map(([a, b]) => [cx + ux * a * HK - uy * b * HK, cy + uy * a * HK + ux * b * HK]); // a along the arm (towards the hand), b across

function brace(g, slot, cat, tier, A) { // wrist brace (R8-T G-3): a slim navy band across the wrist with a white edge and one yellow stud; the hand stays bare and clear of the face
  for (const [x, y, ux, uy] of handSpots(A)) {
    const band = rot([[-5.6, -3.2], [-2.2, -3.2], [-2.2, 3.2], [-5.6, 3.2]], x, y, ux, uy); // R8-T L-4: 3 px along the arm (HK-scaled), dark 1.6 px outline, light-blue body so it reads at 1x
    trimUnder(g, band, tier);
    fillPoly(g, band, "#3f6ad0", INK, 1.7);
    fillPoly(g, rot([[-3.4, -2.4], [-2.8, -2.4], [-2.8, 2.4], [-3.4, 2.4]], x, y, ux, uy), "#a9c4ff", null);
    const [sx, sy] = rot([[-4.6, 0]], x, y, ux, uy)[0]; ellipse(g, sx, sy, 0.8, 0.8, "#ffd23a", INK, 0.5);
    trimOver(g, band, tier, [x - ux * 3.4, y - uy * 3.4 - 4.6]);
  }
}
function gloves(g, slot, cat, tier, A) { // rubber gloves: mint, flared cuff, a thumb and three finger bumps
  for (const [x, y, ux, uy] of handSpots(A)) {
    const cuff = rot([[-7, -3.8], [-3, -2.8], [-3, 2.8], [-7, 3.8]], x, y, ux, uy);
    trimUnder(g, cuff, tier);
    fillPoly(g, cuff, "#7fe0c0", INK, 1.2);
    const palm = rot([[-3.4, -2.8], [1.6, -3.4], [4.6, -2.6], [4.6, 2.6], [1.6, 3.4], [-3.4, 2.8]], x, y, ux, uy);
    fillPoly(g, palm, "#5fd0b0", INK, 1.3);
    for (const b of [-2.2, 0, 2.2]) { const [fx, fy] = rot([[5.4, b]], x, y, ux, uy)[0]; ellipse(g, fx, fy, 1.5, 1.5, "#5fd0b0", INK, 0.9); }
    const [tx, ty] = rot([[0.6, -4.6]], x, y, ux, uy)[0]; ellipse(g, tx, ty, 1.7, 1.7, "#5fd0b0", INK, 0.9);
    const [hx, hy] = rot([[-1, -1.4]], x, y, ux, uy)[0]; ellipse(g, hx, hy, 1, 0.8, "#c8f5e6");
    trimOver(g, cuff, tier, [x - ux * 5 - 6, y - uy * 5 - 4]);
  }
}
function mitts(g, slot, cat, tier, A) { // typing mitts: plum knit, ribbed cuff, fingertips left bare
  for (const [x, y, ux, uy] of handSpots(A)) {
    const cuff = rot([[-6.2, -3.2], [-2.4, -3.2], [-2.4, 3.2], [-6.2, 3.2]], x, y, ux, uy);
    trimUnder(g, cuff, tier);
    fillPoly(g, cuff, "#7a4a96", INK, 1.2);
    for (let b = -2.2; b <= 2.4; b += 1.6) { const [a0, a1] = [rot([[-5.8, b]], x, y, ux, uy)[0], rot([[-2.8, b]], x, y, ux, uy)[0]]; line(g, a0[0], a0[1], a1[0], a1[1], "#4f2d68", 0.8); }
    fillPoly(g, rot([[-2.4, -3.4], [1.6, -3.6], [2.6, -2], [2.6, 2], [1.6, 3.6], [-2.4, 3.4]], x, y, ux, uy), "#9a68b8", INK, 1.3);
    for (const b of [-2.2, 0, 2.2]) { const [fx, fy] = rot([[3.6, b]], x, y, ux, uy)[0]; ellipse(g, fx, fy, 1.2, 1.2, A.skin, INK, 0.8); }
    trimOver(g, cuff, tier, [x - ux * 4 - 6, y - uy * 4 - 4]);
  }
}

// ---------------------------------------------------------------- feet
/** Footprint of the shoe the class painter drew: centre, half length, half height, toe direction (-1, 0, 1). */
function shoe(A) {
  const sc = A.sc, rx = A.shoeW * sc * 1.25, ry = 3.1 * sc, s = Math.abs(A.fx);
  return { x: A.leg.x + A.fx * 1.4, y: A.leg.y, rx: rx * (0.82 + 0.3 * s), ry, toe: Math.abs(A.fx) < 0.3 ? 0 : Math.sign(A.fx), front: A.fy > -0.2 };
}
const shoePts = (o, k = 1) => arcPts(o.x, o.y, o.rx * k, o.ry * k, 0, Math.PI * 2, 14);

function sneaker(g, slot, cat, tier, A) { // sneaker: coral upper, thick white sole, laces, white sock cuff at the ankle
  const o = shoe(A);
  if (A.hook === "legs") { const L = A.leg, w = A.legW + 1.2; limb(g, L.x - (L.x - L.hx) * 0.08, L.y - 4.4, L.x, L.y - 1.2, "#f6f1e4", w); return; }
  const sole = shoePts({ ...o, y: o.y + 1 }, 1.08);
  trimUnder(g, sole, tier);
  fillPoly(g, sole, "#f6f1e4", INK, 1.4);
  const up = shoePts({ ...o, y: o.y - 0.5 }, 0.94);
  fillPoly(g, up, "#f2788c", INK, 1.1);
  fillPoly(g, arcPts(o.x - o.toe * 0.6, o.y - 1.1, o.rx * 0.62, o.ry * 0.5, Math.PI, Math.PI * 2, 6), "#ffa8b6", null);
  if (o.front) { for (let i = -1; i <= 1; i++) line(g, o.x - 2 + o.toe * 0.8, o.y - 1.2 + i * 0.1, o.x + 2 + o.toe * 0.8, o.y - 1.8 + i * 0.1 - 0.0, "#ffffff", 0.9); line(g, o.x - o.rx * 0.5 * (o.toe || 1) , o.y - 0.2, o.x + o.rx * 0.5 * (o.toe || 1), o.y - 0.2, "#c8445a", 0.8); }
  line(g, o.x - o.rx * 0.95, o.y + 1.6, o.x + o.rx * 0.95, o.y + 1.6, "#c9c4b0", 0.8);
  trimOver(g, sole, tier, [o.x, o.y - 6.5]);
}
function loafer(g, slot, cat, tier, A) { // loafer: slim brown leather, glossy highlight, penny strap, thin dark sole
  const o = shoe(A);
  if (A.hook === "legs") return;
  const sole = shoePts({ ...o, y: o.y + 0.8 }, 1.04);
  trimUnder(g, sole, tier);
  fillPoly(g, sole, "#2b1d17", INK, 1.3);
  const up = shoePts({ ...o, y: o.y - 0.3, ry: o.ry * 0.9, rx: o.rx * 1.02 }, 0.96);
  fillPoly(g, up, "#8a4f2a", INK, 1.1);
  g.beginPath(); g.ellipse(o.x - o.toe * 0.8, o.y - 1.4, o.rx * 0.5, o.ry * 0.38, 0, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 1.3; g.strokeStyle = "#e0a070"; g.stroke(); // gloss
  if (o.front || o.toe) { const sx = o.x + o.toe * o.rx * 0.18; fillPoly(g, [[sx - 2.6, o.y - 1.6], [sx + 2.6, o.y - 1.6], [sx + 2.6, o.y - 0.2], [sx - 2.6, o.y - 0.2]], "#5a3018", INK, 0.7); ellipse(g, sx, o.y - 0.9, 0.75, 0.75, "#ffd23a"); } // penny strap + coin
  trimOver(g, sole, tier, [o.x, o.y - 6.5]);
}
function boot(g, slot, cat, tier, A) { // steel-toe boot: tall dark shaft, silver toe cap, yellow stitching, thick sole
  const o = shoe(A);
  if (A.hook === "legs") {
    const L = A.leg, w = A.legW + 2.4, top = [L.hx + (L.x - L.hx) * 0.2, L.y - 10], bot = [L.x, L.y - 1];
    const sh = [[top[0] - w / 2, top[1]], [top[0] + w / 2, top[1]], [bot[0] + w / 2 + 0.6, bot[1]], [bot[0] - w / 2 - 0.6, bot[1]]];
    trimUnder(g, sh, tier);
    fillPoly(g, sh, "#4a3f3a", INK, 1.4);
    fillPoly(g, [[top[0] - w / 2, top[1]], [top[0] - w / 2 + 2, top[1]], [bot[0] - w / 2 + 1.4, bot[1]], [bot[0] - w / 2 - 0.6, bot[1]]], "#6a5a52", null);
    fillPoly(g, [[top[0] - w / 2 - 0.5, top[1] - 0.6], [top[0] + w / 2 + 0.5, top[1] - 0.6], [top[0] + w / 2 + 0.5, top[1] + 2], [top[0] - w / 2 - 0.5, top[1] + 2]], "#2b2522", INK, 1); // collar
    line(g, top[0] - w / 2 + 1, top[1] + 4.4, top[0] + w / 2 - 1, top[1] + 4.4, "#ffd23a", 0.9);
    trimOver(g, sh, tier, [top[0], top[1] - 4.4]);
    return;
  }
  const sole = shoePts({ ...o, y: o.y + 1.2 }, 1.1);
  fillPoly(g, sole, "#1a1520", INK, 1.4);
  const up = shoePts({ ...o, y: o.y - 0.4 }, 1.0);
  fillPoly(g, up, "#4a3f3a", INK, 1.1);
  const tx = o.x + o.toe * o.rx * 0.45;
  if (o.front || o.toe) fillPoly(g, arcPts(tx, o.y + 0.2, o.rx * (o.toe ? 0.5 : 0.8), o.ry * 0.7, o.toe >= 0 ? -Math.PI / 2 : Math.PI / 2, o.toe >= 0 ? Math.PI / 2 : Math.PI * 1.5, 8), "#cbd3e2", INK, 0.9); // steel toe cap
  line(g, o.x - o.rx * 0.8, o.y + 1.7, o.x + o.rx * 0.8, o.y + 1.7, "#ffd23a", 0.8);
}

export const HEAD_PAINTERS = { cap: headCap, helmet, headset };
export const BODY_PAINTERS = { knit, jacket, vest, suit };
export const HANDS_PAINTERS = { brace, gloves, mitts };
export const FEET_PAINTERS = { sneaker, loafer, boot };
/** Sleeve colour of a worn body part (the near and far arm follow the garment); null = the class sleeve stays (vest, no body part). */
export const SLEEVES = { knit: "#6f9163", jacket: "#2a3b6e", vest: null, suit: "#2e2f44" };
