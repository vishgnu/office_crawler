// Ground tiles and wall blocks for the open-plan theme. One self-contained function per sprite key family.
import { palette as P } from "./palette.js";
import { poly, fillPoly, shade, line, ellipse } from "../../draw/shapes.js";

const W = 64, H = 32;

const clipDiamond = (g, cx, cy, hw, hh) => { poly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]]); g.clip(); };

/**
 * Carpet / lino floor diamond. Variants 0-2 are clean: plain, inset panel, seam stripe. Variants 3-5 carry
 * baked grime: scuffs, a coffee stain, a blood smear (decals live in the static layer, never per frame).
 * 1px bleed hides seams between tiles.
 */
export function drawFloor(g, kind, v) {
  const [a, b] = P.floors[kind], cx = 33, cy = 17, hw = W / 2 + 0.5, hh = H / 2 + 0.5;
  fillPoly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], a);
  if (v === 1) {
    const s = 0.62;
    fillPoly(g, [[cx, cy - hh * s], [cx + hw * s, cy], [cx, cy + hh * s], [cx - hw * s, cy]], b);
  } else if (v === 2) {
    fillPoly(g, [[cx - hw * 0.5, cy - hh * 0.5], [cx, cy - hh], [cx + hw * 0.5, cy - hh * 0.5], [cx, cy]], b);
  } else if (v >= 3) {
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    if (v === 3) { // scuff marks
      g.strokeStyle = "rgba(6,4,16,0.5)"; g.lineWidth = 1.3; g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-14, -2, -3, 3], [-9, 4, 3, 8], [6, -5, 15, -1]]) { g.beginPath(); g.moveTo(cx + x0, cy + y0); g.lineTo(cx + x1, cy + y1); g.stroke(); }
    } else if (v === 4) { // coffee ring + splash
      ellipse(g, cx - 3, cy + 1, 11, 5.2, P.decal.coffee);
      ellipse(g, cx - 3, cy + 1, 7, 3.2, "rgba(0,0,0,0.25)");
      ellipse(g, cx + 12, cy - 4, 2.5, 1.2, P.decal.coffee); ellipse(g, cx + 16, cy - 1, 1.6, 0.8, P.decal.coffee);
    } else { // blood smear with drag marks
      ellipse(g, cx - 2, cy, 13, 5.6, P.decal.blood);
      ellipse(g, cx - 1, cy + 0.5, 7.5, 3.1, "rgba(0,0,0,0.3)");
      g.strokeStyle = P.decal.blood; g.lineWidth = 2.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(cx - 12, cy + 1); g.lineTo(cx - 24, cy + 7); g.stroke();
      ellipse(g, cx + 14, cy - 5, 1.8, 0.9, P.decal.blood);
    }
    g.restore();
  }
  // soft highlight on the tile centre and an edge line that survives the dark grade (floor value beyond the light)
  fillPoly(g, [[cx, cy - hh * 0.3], [cx + hw * 0.3, cy], [cx, cy + hh * 0.3], [cx - hw * 0.3, cy]], "rgba(255,255,255,0.03)");
  g.lineWidth = 1; g.strokeStyle = P.floorEdge;
  poly(g, [[cx, cy - hh + 0.5], [cx + hw - 1, cy], [cx, cy + hh - 0.5], [cx - hw + 1, cy]]); g.stroke();
}

export function drawMarker(g, id) {
  drawFloor(g, "corridor", 0);
  const cx = 33, cy = 17;
  if (id === "door") {
    fillPoly(g, [[cx - 9, cy - 4.5], [cx + 9, cy + 4.5], [cx + 4, cy + 7], [cx - 14, cy - 2]], "#6b4a2f", P.ink, 1.2);
    line(g, cx - 12, cy - 2.5, cx + 6, cy + 6, shade("#6b4a2f", 0.3), 1);
    return;
  }
  const up = id === "stairs-up", col = up ? "#cfa94a" : "#d9743a";
  // four steps stacked along the tile's long axis, one shade level
  for (let i = 0; i < 4; i++) {
    const t = i / 4, t2 = (i + 1) / 4, x0 = cx - 24 + 48 * t, x1 = cx - 24 + 48 * t2;
    const top = (x) => 17 - (16 - Math.abs(x - cx) * 0.5) + 4, bot = (x) => 17 + (16 - Math.abs(x - cx) * 0.5) - 4;
    fillPoly(g, [[x0, top(x0)], [x1, top(x1)], [x1, bot(x1)], [x0, bot(x0)]], i % 2 ? shade(col, -0.25) : col, P.ink, 1.2);
  }
  // arrow marker
  g.fillStyle = P.ink;
  poly(g, up ? [[cx, cy - 5], [cx + 5, cy + 2], [cx - 5, cy + 2]] : [[cx, cy + 5], [cx + 5, cy - 2], [cx - 5, cy - 2]]);
  g.fill();
}

/** Wall block, drawn per neighbour mask (bit 1 = wall to N, 2 = E, 4 = S, 8 = W). */
export const WALL_H = 44;
export const WALL_W = 64, WALL_CANVAS_H = 80, WALL_CY = 62;

export function drawWall(g, mask, variant = 0) {
  const w = P.wall, cx = 32, cy = WALL_CY, hw = 32, hh = 16, h = WALL_H;
  const T = [cx, cy - hh], R = [cx + hw, cy], B = [cx, cy + hh], L = [cx - hw, cy];
  const up = (p, z = h) => [p[0], p[1] - z];
  const faceLeft = !(mask & 4), faceRight = !(mask & 2);
  // point on a face: u along the face (0..1), v up the face (0..1)
  const lf = (u, v) => [L[0] + (B[0] - L[0]) * u, L[1] + (B[1] - L[1]) * u - h * v];
  const rf = (u, v) => [R[0] + (B[0] - R[0]) * u, R[1] + (B[1] - R[1]) * u - h * v];
  const quad = (pt, u0, v0, u1, v1, fill, stroke, lw) => fillPoly(g, [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)], fill, stroke, lw);
  // blob in face space (smears, splatters): a polygon around (u, v) with radii (ru, rv)
  const blob = (pt, u, v, ru, rv, fill) => {
    const pts = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, k = 1 + 0.18 * Math.sin(i * 2.7 + u * 9); pts.push(pt(Math.min(1, Math.max(0, u + Math.cos(a) * ru * k)), Math.min(0.96, Math.max(0.04, v + Math.sin(a) * rv * k)))); }
    fillPoly(g, pts, fill);
  };
  const face = (pt, base, edgeSide) => {
    quad(pt, 0, 0, 1, 1, base);
    quad(pt, 0, 0, 1, 0.13, w.base);                         // skirting
    quad(pt, 0.07, 0.2, 0.93, 0.74, shade(base, 0.1), shade(base, -0.28), 1); // wall panel
    quad(pt, 0, 0.9, 1, 1, w.trim); quad(pt, 0, 0.9, 1, 0.93, w.trimDark); // orange trim
    if (variant === 1) { blob(pt, 0.36, 0.5, 0.17, 0.13, "rgba(8,6,20,0.3)"); blob(pt, 0.8, 0.3, 0.07, 0.07, "rgba(8,6,20,0.25)"); }
    if (variant === 2 && edgeSide) { blob(pt, 0.55, 0.55, 0.14, 0.17, "rgba(120,24,48,0.85)"); blob(pt, 0.62, 0.22, 0.04, 0.12, "rgba(120,24,48,0.85)"); blob(pt, 0.4, 0.4, 0.05, 0.06, "rgba(120,24,48,0.85)"); }
    fillPoly(g, [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)], null, P.ink, 1.6);
  };
  if (faceRight) face(rf, w.right, true);
  if (faceLeft) face(lf, w.left, false);
  fillPoly(g, [up(T), up(R), up(B), up(L)], w.top);
  // outline + rim only on top edges that border open floor
  const edges = [[mask & 1, up(T), up(R)], [mask & 2, up(R), up(B)], [mask & 4, up(B), up(L)], [mask & 8, up(L), up(T)]];
  g.lineCap = "round";
  for (const [wall, a, b] of edges) {
    if (wall) continue;
    line(g, a[0], a[1], b[0], b[1], P.ink, 2.4);
  }
  // rim light on the two upper-left-facing edges (N and W) when they are open
  for (const [wall, a, b] of [edges[0], edges[3]]) {
    if (wall) continue;
    line(g, a[0], a[1] + 1.3, b[0], b[1] + 1.3, w.rim, 1.2);
  }
}
