// Style-neutral drawing helpers (paths, colour maths, an isometric box). No game knowledge.
import { fillTex } from "./textures.js";
export const INK = "#0d0a1c";

// Outline weight (G round, item 1): on-screen outline = clamp(2.0 * zoom, 1.6, 4.2) px. Sprites are baked in logical px, so the atlas build sets
// a factor K = that width / (1.8 * zoom) (1.8 logical px is the standard ink line); every INK stroke below is multiplied by it.
let K = 1;
export const inkWidth = (zoom) => Math.min(4.2, Math.max(1.6, 2.0 * zoom));
export const setInkScale = (zoom) => { K = zoom > 0 ? inkWidth(zoom) / (1.8 * zoom) : 1; return K; };
export const inkScale = () => K;
/** Put a factor read from inkScale() back (a lazy draw restores what the running build had set). */
export const restoreInkScale = (k) => { K = k; };
/** An outline width in logical px, scaled by the current factor. */
export const ink = (w) => w * K;

export function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

export function fillPoly(g, pts, fill, stroke, lw = 1.5) {
  poly(g, pts);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = stroke === INK ? lw * K : lw; g.strokeStyle = stroke; g.lineJoin = "round"; g.stroke(); }
}

export function ellipse(g, cx, cy, rx, ry, fill, stroke, lw = 1.5) {
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = stroke === INK ? lw * K : lw; g.strokeStyle = stroke; g.stroke(); }
}

export function line(g, x0, y0, x1, y1, color, w, cap = "round") {
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
  g.lineWidth = color === INK ? w * K : w; g.strokeStyle = color; g.lineCap = cap; g.stroke();
}

/** A limb with a bold outline: dark thick line under a coloured one. */
export function limb(g, x0, y0, x1, y1, color, w) {
  line(g, x0, y0, x1, y1, INK, (w + 3 * K) / K); // outline = body + 1.5 px (scaled) each side
  line(g, x0, y0, x1, y1, color, w);
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (a) => "#" + a.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
/** t > 0 lightens, t < 0 darkens. */
export const shade = (c, t) => (t >= 0 ? mix(c, "#ffffff", t) : mix(c, "#000000", -t));

/**
 * Isometric box in tile units relative to a tile centre (cx, cy on screen). u runs to the lower right,
 * v to the lower left, z up in pixels. b = { u0, u1, v0, v1, z0 = 0, h }. c = { top, left, right, line, rim }.
 * Light comes from the upper left: left face mid, right face dark, rim on the upper-left top edge.
 */
export function box(g, cx, cy, b, c) {
  const z0 = b.z0 ?? 0, z1 = z0 + b.h, ink = c.line ?? INK;
  const P = (u, v, z) => [cx + (u - v) * 32, cy + (u + v) * 16 - z];
  const top = [P(b.u0, b.v0, z1), P(b.u1, b.v0, z1), P(b.u1, b.v1, z1), P(b.u0, b.v1, z1)];
  const left = [P(b.u0, b.v1, z0), P(b.u1, b.v1, z0), P(b.u1, b.v1, z1), P(b.u0, b.v1, z1)];
  const right = [P(b.u1, b.v0, z0), P(b.u1, b.v1, z0), P(b.u1, b.v1, z1), P(b.u1, b.v0, z1)];
  fillPoly(g, right, c.right, ink);
  fillPoly(g, left, c.left, ink);
  fillPoly(g, top, c.top, ink);
  if (c.tex) { // material overlay (textures.js): top = flat iso plane, left / right = the two wall planes; origin at each face's top vertex
    const [name, a] = c.tex;
    poly(g, top); fillTex(g, name, "T", top[0][0], top[0][1], a);
    poly(g, left); fillTex(g, name, "L", left[3][0], left[3][1], a);
    poly(g, right); fillTex(g, name, "R", right[3][0], right[3][1], a);
  }
  if (c.rim) {
    g.beginPath();
    const a = P(b.u0, b.v1, z1), t = P(b.u0, b.v0, z1);
    g.moveTo(a[0] + 1, a[1] - 0.5); g.lineTo(t[0] + 0.5, t[1] + 1); g.lineTo(P(b.u1, b.v0, z1)[0] - 1, P(b.u1, b.v0, z1)[1] + 0.6);
    g.lineWidth = 1.2; g.strokeStyle = c.rim; g.lineCap = "round"; g.stroke();
  }
  return { P, top, left, right };
}
