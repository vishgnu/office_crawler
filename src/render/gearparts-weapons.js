// Weapon and off-hand part painters (R8-0.2, ADR-0008): 5 weapons (blade, blunt, staff, pole, heavy) and 3 off-hand items (board, binder, tray).
// Office-themed originals; silhouettes differ at ~60 px: thin blade / T-shaped head / long shaft with a plug / shaft with strands / fat cylinder.
// Painters are `(g, slot, category, tier, A)`; the hook (A.hook) says "weaponBack" (behind the body) or "weaponFront". Pure functions of their arguments.
import { INK, fillPoly, ellipse, line } from "./draw/shapes.js";
import { trimUnder, trimOver, weaponFrame, wpoly, secondHand } from "./gearkit.js";

const ink = (g, a, b, c, d, w) => line(g, a, b, c, d, INK, w);
/** Common start of a weapon painter: front/back selection, the frame, the optional second hand. Returns the frame or null when this hook draws nothing. */
function begin(A) {
  if ((A.hook === "weaponBack") !== A.behind) return null; // behind the body only for a facing away at rest; otherwise in front
  return weaponFrame(A);
}
const hand2 = (g, A) => { if (A.two) { const [x, y] = secondHand(A); ellipse(g, x, y, 2.6, 2.6, A.skin, INK, 1.1); } };
/** A straight shaft of width w from a0 to a1 along the weapon, ink-edged. */
function shaft(g, F, a0, a1, w, col, hi = null) {
  const [x0, y0] = F(a0, 0), [x1, y1] = F(a1, 0);
  ink(g, x0, y0, x1, y1, w + 2.4); line(g, x0, y0, x1, y1, col, w);
  if (hi) { const [h0, h1] = [F(a0, -w * 0.22), F(a1, -w * 0.22)]; line(g, h0[0], h0[1], h1[0], h1[1], hi, Math.max(0.8, w * 0.28)); }
}

function blade(g, slot, cat, tier, A) { // letter-opener / ruler blade: slim steel blade with ruler ticks, short grip, small guard
  const F = begin(A); if (!F) return;
  const body = wpoly(F, [[1, -3.2], [22, -2.8], [29, 0], [22, 2.8], [1, 3.2]]);
  shaft(g, F, -6, 1, 3.4, "#2b3a7a", "#5666b8");
  trimUnder(g, body, tier);
  fillPoly(g, body, "#e8eef8", INK, 1.3);
  const lo = wpoly(F, [[1, 0.4], [26, 0.2], [22, 2.8], [1, 3.2]]); fillPoly(g, lo, "#aab6cc", null); // shaded half
  for (let a = 4; a < 24; a += 3) { const [x0, y0] = F(a, -2.8), [x1, y1] = F(a, a % 6 === 4 ? -0.8 : -1.7); line(g, x0, y0, x1, y1, INK, 0.9); } // ruler ticks
  fillPoly(g, wpoly(F, [[0, -4.6], [2, -4.6], [2, 4.6], [0, 4.6]]), "#f0bc2a", INK, 1.1); // guard
  trimOver(g, body, tier);
}

function blunt(g, slot, cat, tier, A) { // stapler mace: wooden haft, a big red stapler slab as the head, staple teeth
  const F = begin(A); if (!F) return;
  shaft(g, F, -5, 14, 2.8, "#8a5a34", "#c08a56");
  const head = wpoly(F, [[11, -5.2], [25, -5.8], [27, 0], [25, 5.8], [11, 5.2]]);
  trimUnder(g, head, tier);
  fillPoly(g, head, "#d83a2c", INK, 1.4);
  fillPoly(g, wpoly(F, [[11, -5.2], [25, -5.8], [25.6, -3.6], [11, -3]]), "#ff7a66", null); // lit top plate
  fillPoly(g, wpoly(F, [[12, 1.2], [24, 1.6], [24, 3.4], [12, 3.2]]), "#8793ae", INK, 0.9); // metal strip
  for (let i = 0; i < 3; i++) { const [x, y] = F(27.6 + (i % 2) * 0.4, -3.4 + i * 3.4); ellipse(g, x, y, 1.1, 1.1, "#e8eef8", INK, 0.7); } // staples
  trimOver(g, head, tier);
}

function staff(g, slot, cat, tier, A) { // long graphite shaft with a USB plug on top (two ports, a cyan LED)
  const F = begin(A); if (!F) return;
  shaft(g, F, -8, 27, 2.9, "#7f8cc0", "#c4cdf2");
  for (const a of [4, 15]) { const [x, y] = F(a, 0); ellipse(g, x, y, 2.4, 2.4, "#3a4580", INK, 0.9); } // grip rings
  const plug = wpoly(F, [[26, -3.9], [35, -3.9], [35, 3.9], [26, 3.9]]);
  trimUnder(g, plug, tier);
  fillPoly(g, plug, "#cbd3e2", INK, 1.4);
  fillPoly(g, wpoly(F, [[26, -3.9], [35, -3.9], [35, -2.4], [26, -2.4]]), "#f4f7fc", null);
  for (const b of [-1.9, 1.9]) fillPoly(g, wpoly(F, [[30.4, b - 1.1], [34.2, b - 1.1], [34.2, b + 1.1], [30.4, b + 1.1]]), "#1a1530", null);
  const [lx, ly] = F(28.4, 0); ellipse(g, lx, ly, 1.7, 1.7, "#33e0ff", INK, 0.8);
  trimOver(g, plug, tier);
}

function pole(g, slot, cat, tier, A) { // mop halberd (two-handed): long shaft, steel axe-blade and spike, a fan of mop strands
  const F = begin(A); if (!F) return;
  shaft(g, F, -8, 33, 2.8, "#b8a27a", "#e6d6aa");
  for (let i = -3; i <= 3; i++) { const [x0, y0] = F(27, i * 0.7), [x1, y1] = F(15 + Math.abs(i) * 1.1, i * 3.4); ink(g, x0, y0, x1, y1, 3.6); }
  for (let i = -3; i <= 3; i++) { const [x0, y0] = F(27, i * 0.7), [x1, y1] = F(15 + Math.abs(i) * 1.1, i * 3.4); line(g, x0, y0, x1, y1, i % 2 ? "#efe6cf" : "#d4c9a8", 2); } // strands
  fillPoly(g, wpoly(F, [[26, -3], [28.4, -3], [28.4, 3], [26, 3]]), "#8793ae", INK, 1.1); // bracket
  const axe = wpoly(F, [[29, 1], [31.4, 7.4], [38, 6], [37, 1], [35, -1]]);
  trimUnder(g, axe, tier);
  fillPoly(g, axe, "#cbd3e2", INK, 1.3);
  fillPoly(g, wpoly(F, [[34, -1.2], [37.6, 0.2], [39, 3.4], [35.6, 4.4]]), "#8793ae", null);
  fillPoly(g, wpoly(F, [[33.4, -2], [41, 0], [33.4, 2]]), "#e8eef8", INK, 1.1); // spike
  trimOver(g, axe, tier);
  hand2(g, A);
}

function heavy(g, slot, cat, tier, A) { // extinguisher club (two-handed): fat red cylinder, white label, black valve head, hose
  const F = begin(A); if (!F) return;
  const hose = wpoly(F, [[22, 1.5], [27, 6], [26, 11]]);
  g.beginPath(); g.moveTo(hose[0][0], hose[0][1]); g.quadraticCurveTo(hose[1][0], hose[1][1], hose[2][0], hose[2][1]); g.lineWidth = 3.8; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.8; g.strokeStyle = "#3a3f58"; g.stroke();
  const body = wpoly(F, [[-3, -4.8], [20, -4.8], [23, -3], [23, 3], [20, 4.8], [-3, 4.8]]);
  trimUnder(g, body, tier);
  fillPoly(g, body, "#d8362c", INK, 1.5);
  fillPoly(g, wpoly(F, [[-3, -4.8], [20, -4.8], [22, -3.4], [-3, -3.4]]), "#ff7a66", null);
  fillPoly(g, wpoly(F, [[-3, 2.4], [22, 2.4], [23, 3], [20, 4.8], [-3, 4.8]]), "#a82018", null);
  fillPoly(g, wpoly(F, [[6, -4.8], [14, -4.8], [14, 4.8], [6, 4.8]]), "#f6f1e4", INK, 1); // label
  const [fx, fy] = F(10, -0.4); ellipse(g, fx, fy, 1.5, 2, "#d8362c", INK, 0.7);
  fillPoly(g, wpoly(F, [[23, -2.4], [27, -2.4], [27, 2.4], [23, 2.4]]), "#2b2b3c", INK, 1.1); // valve
  fillPoly(g, wpoly(F, [[24, -2.4], [28, -6], [29.4, -4.8], [26, -1.8]]), "#2b2b3c", INK, 1); // lever
  const [gx, gy] = F(20, -4.4); ellipse(g, gx, gy, 1.6, 1.6, "#f6f1e4", INK, 0.8); // gauge
  trimOver(g, body, tier);
  hand2(g, A);
}

// ---- off-hand ----
/** Off-hand frame: centre of the item at the far hand, squashed a little in profile; `back` = seen from behind (plain back, strap). */
function hold(A) {
  const s = Math.abs(A.fx), cx = A.far[0] + A.fx * 2.2 + (A.fx < 0 ? 1 : -1) * 0, cy = A.far[1] - 2.6;
  return { cx, cy, k: 1 - 0.32 * s, back: !A.front };
}
const OK = 1.2; // off-hand items are drawn 20 % larger so they read at ~60 px
const P = (o, pts) => pts.map(([x, y]) => [o.cx + x * o.k * OK, o.cy + y * OK]);

function board(g, slot, cat, tier, A) { // clipboard shield: tall wooden board, paper sheet, steel clip
  const o = hold(A), body = P(o, [[-6.4, -9], [6.4, -9], [6.4, 9.6], [-6.4, 9.6]]);
  trimUnder(g, body, tier);
  fillPoly(g, body, "#b8844e", INK, 1.5);
  if (o.back) { fillPoly(g, P(o, [[-4, -7], [4, -7], [4, 3], [-4, 3]]), "#8a5e34", null); }
  else {
    fillPoly(g, P(o, [[-4.9, -6.4], [4.9, -6.4], [4.9, 8], [-4.9, 8]]), "#f6f1e4", INK, 0.9);
    for (let i = 0; i < 4; i++) { const y = -3.4 + i * 3, a = P(o, [[-3.4, y], [3.4 - (i === 3 ? 2.2 : 0), y]]); line(g, a[0][0], a[0][1], a[1][0], a[1][1], "#6a7aa0", 1); }
  }
  fillPoly(g, P(o, [[-3.4, -10.8], [3.4, -10.8], [3.4, -6.6], [-3.4, -6.6]]), "#cbd3e2", INK, 1.2); // clip
  const c = P(o, [[0, -9.2]])[0]; ellipse(g, c[0], c[1], 1, 1, "#6a7194", INK, 0.6);
  trimOver(g, body, tier, [o.cx, o.cy - 13.4]);
}

function binder(g, slot, cat, tier, A) { // binder buckler: navy spine-ring binder, index tabs down the edge, a label
  const o = hold(A), body = P(o, [[-5.8, -8], [5.8, -8], [7, -6.8], [7, 7.8], [-5.8, 7.8]]);
  trimUnder(g, body, tier);
  fillPoly(g, body, "#2f4b9c", INK, 1.5);
  fillPoly(g, P(o, [[-5.8, -8], [-3.4, -8], [-3.4, 7.8], [-5.8, 7.8]]), "#1f3478", null); // spine
  for (let i = 0; i < 3; i++) { const p = P(o, [[-4.6, -5 + i * 5.2]])[0]; ellipse(g, p[0], p[1], 1.5, 1.5, "#cbd3e2", INK, 0.9); } // rings
  if (!o.back) {
    fillPoly(g, P(o, [[-1.6, -4.4], [4.6, -4.4], [4.6, 0.6], [-1.6, 0.6]]), "#f6f1e4", INK, 0.9); // label
    line(g, P(o, [[-0.6, -2.6]])[0][0], o.cy - 2.6, P(o, [[3.4, -2.6]])[0][0], o.cy - 2.6, "#6a7aa0", 1);
  }
  for (const [i, col] of [[0, "#ff8a1f"], [1, "#e0457b"], [2, "#33c8a0"]]) fillPoly(g, P(o, [[7, -5.6 + i * 4.8], [9.4, -5.6 + i * 4.8], [9.4, -2.8 + i * 4.8], [7, -2.8 + i * 4.8]]), col, INK, 0.9); // tabs
  trimOver(g, body, tier, [o.cx, o.cy - 11.4]);
}

function tray(g, slot, cat, tier, A) { // serving-tray aegis: big round steel tray, raised rim, a glint and a small dome
  const o = hold(A), pts = [];
  for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; pts.push([o.cx + Math.cos(t) * 9.6 * o.k * OK, o.cy + 0.6 + Math.sin(t) * 9.8 * OK]); }
  trimUnder(g, pts, tier);
  fillPoly(g, pts, "#9aa6bf", INK, 1.6);
  ellipse(g, o.cx, o.cy + 0.6, 7.4 * o.k * OK, 7.6 * OK, o.back ? "#7d89a6" : "#d3dcea", INK, 1);
  if (!o.back) {
    ellipse(g, o.cx, o.cy + 0.6, 3.6 * o.k * OK, 3.8 * OK, "#eef3fa", INK, 0.9); // dome
    g.beginPath(); g.ellipse(o.cx, o.cy + 0.6, 8.4 * o.k * OK, 8.6 * OK, 0, Math.PI * 1.15, Math.PI * 1.6); g.lineWidth = 1.6; g.strokeStyle = "#ffffff"; g.stroke(); // glint
  } else { line(g, o.cx - 5 * o.k * OK, o.cy + 0.6, o.cx + 5 * o.k * OK, o.cy + 0.6, INK, 2.2); }
  trimOver(g, pts, tier, [o.cx, o.cy - 14]);
}

export const WEAPON_PAINTERS = { blade, blunt, staff, pole, heavy };
export const OFFHAND_PAINTERS = { board, binder, tray };
