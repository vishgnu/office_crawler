// Ground tiles and wall blocks for the open-plan theme. One self-contained function per sprite key family.
import { palette as P } from "./palette.js";
import { poly, fillPoly, shade, line } from "../../draw/shapes.js";

const W = 64, H = 32;

/** Carpet / lino floor diamond, 3 variants: plain, inset panel, seam stripe. 1px bleed hides seams. */
export function drawFloor(g, kind, v) {
  const [a, b] = P.floors[kind], cx = 33, cy = 17, hw = W / 2 + 0.5, hh = H / 2 + 0.5;
  fillPoly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], a);
  if (v === 1) {
    const s = 0.62;
    fillPoly(g, [[cx, cy - hh * s], [cx + hw * s, cy], [cx, cy + hh * s], [cx - hw * s, cy]], b);
  } else if (v === 2) {
    fillPoly(g, [[cx - hw * 0.5, cy - hh * 0.5], [cx, cy - hh], [cx + hw * 0.5, cy - hh * 0.5], [cx, cy]], b);
  }
  // soft tile edge (not an ink outline: the floor must not read as a grid of boxes)
  g.lineWidth = 1; g.strokeStyle = "rgba(5,7,12,0.28)";
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

export function drawWall(g, mask) {
  const w = P.wall, cx = 32, cy = WALL_CY, hw = 32, hh = 16, h = WALL_H;
  const T = [cx, cy - hh], R = [cx + hw, cy], B = [cx, cy + hh], L = [cx - hw, cy];
  const up = (p, z = h) => [p[0], p[1] - z];
  const faceLeft = !(mask & 4), faceRight = !(mask & 2);
  // point on a face: u along the face (0..1), v up the face (0..1)
  const lf = (u, v) => [L[0] + (B[0] - L[0]) * u, L[1] + (B[1] - L[1]) * u - h * v];
  const rf = (u, v) => [R[0] + (B[0] - R[0]) * u, R[1] + (B[1] - R[1]) * u - h * v];
  const band = (pt, fill) => fillPoly(g, [pt(0, 0.0), pt(1, 0.0), pt(1, 0.14), pt(0, 0.14)], fill);
  const rail = (pt, fill) => fillPoly(g, [pt(0, 0.5), pt(1, 0.5), pt(1, 0.58), pt(0, 0.58)], fill);
  if (faceRight) {
    fillPoly(g, [R, B, up(B), up(R)], w.right);
    band(rf, w.base); rail(rf, shade(w.right, 0.12));
    fillPoly(g, [R, B, up(B), up(R)], null, P.ink, 1.6);
  }
  if (faceLeft) {
    fillPoly(g, [L, B, up(B), up(L)], w.left);
    band(lf, w.base); rail(lf, shade(w.left, 0.12));
    fillPoly(g, [L, B, up(B), up(L)], null, P.ink, 1.6);
  }
  fillPoly(g, [up(T), up(R), up(B), up(L)], w.top);
  // outline + rim only on top edges that border open floor
  const edges = [[mask & 1, up(T), up(R), false], [mask & 2, up(R), up(B), false], [mask & 4, up(B), up(L), false], [mask & 8, up(L), up(T), true]];
  g.lineCap = "round";
  for (const [wall, a, b] of edges) {
    if (wall) continue;
    line(g, a[0], a[1], b[0], b[1], P.ink, 2.4);
  }
  // rim light on the two upper-left-facing edges (N and W) when they are open
  g.lineWidth = 1.2;
  for (const [wall, a, b] of [edges[0], edges[3]]) {
    if (wall) continue;
    line(g, a[0], a[1] + 1.3, b[0], b[1] + 1.3, w.rim, 1.2);
  }
}
