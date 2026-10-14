// Props that only the Executive Suite and its fight use: the boardroom table segment, a leather chair, a trophy, the "quarterly results"
// screen on the north wall, and the temp badge that marks staff the boss summoned. Drawn like every other C2 sprite: ink outlines, one shade level.
import { palette as P } from "./palette.js";
import { INK, ellipse, fillPoly, line, box, shade, ink } from "../../draw/shapes.js";

export const TABLE_BOX = { w: 90, h: 64, ox: 45, oy: 46 };
export const SCREEN_BOX = { w: 116, h: 124, ox: 58, oy: 114 };
export const TABLE_Z = 13;

/** One segment of the long boardroom table (one tile along x, a little over a tile deep). Anchor: the tile centre on the floor. */
export function drawBoardTable(g) {
  const cx = TABLE_BOX.ox, cy = TABLE_BOX.oy;
  const b = { u0: -0.53, u1: 0.53, v0: -0.72, v1: 0.72, z0: 0, h: TABLE_Z };
  const t = box(g, cx, cy, b, { top: "#7a3426", left: "#55231a", right: "#3a170f", rim: "#ffd9a0" });
  // inlaid top: a darker field, a gold line and a long reflection
  const Pq = (u, v) => t.P(u, v, TABLE_Z);
  fillPoly(g, [Pq(-0.53, -0.6), Pq(0.53, -0.6), Pq(0.53, 0.6), Pq(-0.53, 0.6)], "#8a4030");
  fillPoly(g, [Pq(-0.53, -0.5), Pq(0.53, -0.5), Pq(0.53, 0.5), Pq(-0.53, 0.5)], "#6e2c20");
  line(g, ...Pq(-0.53, -0.6), ...Pq(0.53, -0.6), "#e0b04a", 1.1); line(g, ...Pq(-0.53, 0.6), ...Pq(0.53, 0.6), "#e0b04a", 1.1);
  fillPoly(g, [Pq(-0.4, -0.2), Pq(0.3, -0.2), Pq(0.36, -0.12), Pq(-0.34, -0.12)], "rgba(255,230,200,0.2)");
  // brass edge on the front faces
  line(g, ...t.P(-0.53, 0.72, 11), ...t.P(0.53, 0.72, 11), "#e0b04a", 1.2);
}

/** A high-backed leather chair facing the table (north); its back rises on the viewer's side of the seat. Anchor: floor under the seat centre. */
export function drawChair(g) {
  const cx = 20, cy = 40;
  ellipse(g, cx, cy + 1, 11, 5, "rgba(0,0,0,0.28)");
  for (const [u, v] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) line(g, cx + (u - v) * 32, cy + (u + v) * 16, cx, cy - 7, INK, 2.6); // star base
  line(g, cx, cy - 7, cx, cy - 12, "#9aa3b8", 3);
  const lea = { top: "#5a2636", left: "#3b1822", right: "#26101a", rim: "#ff9aa8" };
  box(g, cx, cy, { u0: -0.3, u1: 0.3, v0: -0.3, v1: 0.3, z0: 11, h: 5 }, lea);                     // seat
  box(g, cx, cy, { u0: -0.3, u1: 0.3, v0: 0.24, v1: 0.34, z0: 13, h: 25 }, lea);                  // back (on the viewer's side: the sitter faces the table)
  line(g, cx - 12, cy - 21, cx + 3, cy - 12.5, "#e0b04a", 1.1);
  for (const k of [-1, 1]) box(g, cx, cy, { u0: -0.3, u1: 0.3, v0: k * 0.3 - 0.04 + 0, v1: k * 0.3 + 0.04, z0: 16, h: 3 }, { top: "#26101a", left: "#1a0a10", right: "#12070b" }); // arms
}

/** A gilt trophy cup. Anchor: its foot at (12, 30). */
export function drawTrophy(g) {
  fillPoly(g, [[5, 30], [19, 30], [18, 27], [6, 27]], "#8a6a28", INK, 1.2);
  fillPoly(g, [[8, 27], [16, 27], [15, 24], [9, 24]], "#c9a050", INK, 1.1);
  fillPoly(g, [[11, 24], [13, 24], [13.6, 18], [10.4, 18]], "#e0b04a", INK, 1);
  for (const k of [-1, 1]) { g.beginPath(); g.moveTo(12 + k * 7, 8); g.bezierCurveTo(12 + k * 13, 8, 12 + k * 13, 16, 12 + k * 5, 16); g.lineWidth = ink(3.4); g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.7; g.strokeStyle = "#e0b04a"; g.stroke(); }
  fillPoly(g, [[3.6, 6], [20.4, 6], [18.4, 15], [14, 18.4], [10, 18.4], [5.6, 15]], "#f0c64a", INK, 1.3);
  fillPoly(g, [[5, 7.5], [9, 7.5], [8.4, 14], [6.2, 12.4]], "rgba(255,255,255,0.65)");
  ellipse(g, 12, 6, 8.4, 1.8, "#8a6a28", INK, 1);
}

/** The temp badge pinned to summoned staff: a white card with a hazard stripe on a lanyard. Anchor: the middle of the card. */
export function drawBadge(g) {
  line(g, 2.5, 0, 6.4, 5, INK, 2.6); line(g, 11.5, 0, 7.6, 5, INK, 2.6); line(g, 2.5, 0, 6.4, 5, "#e8e4d6", 1.2); line(g, 11.5, 0, 7.6, 5, "#e8e4d6", 1.2);
  fillPoly(g, [[2, 5], [12, 5], [12, 15], [2, 15]], "#f7f4ea", INK, 1.3);
  fillPoly(g, [[2.6, 5.6], [11.4, 5.6], [11.4, 8.4], [2.6, 8.4]], "#e0363f");
  for (let i = 0; i < 3; i++) fillPoly(g, [[3 + i * 3, 5.6], [4.4 + i * 3, 5.6], [3.4 + i * 3, 8.4], [2 + i * 3, 8.4]], "#f7f4ea");
  line(g, 3.6, 11, 10.4, 11, "rgba(13,10,28,0.65)", 1); line(g, 3.6, 13, 8.4, 13, "rgba(13,10,28,0.65)", 1);
}

/** The big "quarterly results" screen: three tiles wide, standing against the north wall, its face glowing blue-white. Anchor: the tile centre on the floor. */
export function drawScreen(g) {
  const cx = SCREEN_BOX.ox, cy = SCREEN_BOX.oy, z0 = 22, h = 64, u = 1.5, v = 0.07;
  const t = box(g, cx, cy, { u0: -u, u1: u, v0: -v, v1: v, z0, h }, { top: "#1b1624", left: "#14101c", right: "#0e0a14", rim: "#8ab4ff" });
  // legs
  for (const uu of [-1.2, 1.2]) { const a = t.P(uu, 0, 0), b = t.P(uu, 0, z0 + 2); line(g, a[0], a[1], b[0], b[1], INK, 4.2); line(g, a[0], a[1], b[0], b[1], "#46506a", 2.2); }
  // the face (the +v side): origin at its top-left corner, x runs along the wall (1 px = (1, 0.5) on screen), y runs down
  const [ox, oy] = t.P(-u, v, z0 + h), FW = 96, FH = h;
  g.save(); g.transform(1, 0.5, 0, 1, ox, oy);
  g.fillStyle = "#0a1630"; g.fillRect(2.5, 2.5, FW - 5, FH - 5);
  const gr = g.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, "rgba(90,170,255,0.45)"); gr.addColorStop(1, "rgba(30,60,140,0.2)"); g.fillStyle = gr; g.fillRect(2.5, 2.5, FW - 5, FH - 5);
  g.fillStyle = "#ffffff"; g.font = "900 8.5px 'Trebuchet MS','Segoe UI',system-ui,sans-serif"; g.textAlign = "left"; g.fillText("QUARTERLY RESULTS", 7, 14);
  g.fillStyle = "#ffd24a"; g.fillRect(7, 17, 34, 1.6);
  // bars rising to the right, an up-arrow, one absurd number
  const bars = [14, 19, 17, 26, 31, 38, 47];
  bars.forEach((bh, i) => { g.fillStyle = i === bars.length - 1 ? "#6fe08a" : "#3f8cf0"; g.fillRect(8 + i * 9.4, FH - 8 - bh, 7, bh); g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(8 + i * 9.4, FH - 8 - bh, 2, bh); });
  g.strokeStyle = "#ffb35a"; g.lineWidth = 1.6; g.beginPath(); bars.forEach((bh, i) => g.lineTo(11.5 + i * 9.4, FH - 12 - bh * 1.15)); g.stroke();
  g.fillStyle = "#6fe08a"; g.font = "900 13px 'Trebuchet MS','Segoe UI',system-ui,sans-serif"; g.fillText("+340%", 62, 34);
  g.fillStyle = "#c9d6f5"; g.font = "700 5.2px 'Trebuchet MS','Segoe UI',system-ui,sans-serif"; g.fillText("HEADCOUNT  -12%", 62, 42);
  g.restore();
  // frame and a soft bloom
  const c0 = t.P(-u, v, z0 + h), c1 = t.P(u, v, z0 + h), c2 = t.P(u, v, z0), c3 = t.P(-u, v, z0);
  fillPoly(g, [c0, c1, c2, c3], null, INK, 1.6);
  g.save(); g.globalAlpha = 0.18; fillPoly(g, [c0, c1, c2, c3], "#8ac8ff"); g.restore();
  line(g, c0[0], c0[1] + 1, c1[0], c1[1] + 1, "#9fc6ff", 1.1);
}
