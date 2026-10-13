// Hero and monsters: one small skeleton rig, three painters. Feet are at the origin, up is negative y.
// Canvas is 88x96 with the feet at (44, 76).
import { palette as P } from "./palette.js";
import { INK, limb, ellipse, fillPoly, line, box, shade } from "../../draw/shapes.js";
import { DIR_VEC, ANIMS } from "../../keys.js";

export const FIG_W = 88, FIG_H = 96, FIG_FX = 44, FIG_FY = 76;

// Per-character look. `kind` picks the painter.
const LOOKS = {
  clerk: { kind: "human", skin: P.skin, hair: "#3a2b24", shirt: "#d8dce6", pants: "#2c3550", shoe: "#15171e", tie: "#b8252f", sc: 1, arms: "weapon" },
  "zombie-intern": { kind: "human", skin: P.zombie, hair: "#2a3326", shirt: "#8e9aa8", pants: "#3b3f4d", shoe: "#15171e", tie: "#57606b", sc: 0.94, arms: "reach", torn: true },
  "printer-imp": { kind: "imp", body: "#8f98a8", tray: P.paper, eye: "#ff4b4b", sc: 0.8 },
};

/** Compute the pose scalars shared by all painters. */
function pose(anim, dir, f) {
  const n = ANIMS[anim], ph = f / n, S = Math.sin(ph * Math.PI * 2), [fx, fy] = DIR_VEC[dir];
  const a = anim === "attack" ? f / (n - 1) : 0;
  return {
    fx, fy, anim, f, n, S,
    bob: anim === "idle" ? S * 0.9 : anim === "walk" ? -Math.abs(S) * 2.2 : 0,
    swing: anim === "walk" ? S : 0,
    a, lunge: anim === "attack" ? Math.sin(a * Math.PI) : 0,
    p: anim === "death" ? f / (n - 1) : 0,
  };
}

function human(g, L, o) {
  const { fx, fy, bob, swing, lunge, a } = o, sc = L.sc;
  const legH = 15 * sc, torsoH = 19 * sc, hr = 7.2 * sc;
  const lx = fx * lunge * 5, ly = fy * lunge * 2.5;
  const hipY = -legH + bob * 0.4, shY = hipY - torsoH;
  // legs
  for (const k of [-1, 1]) {
    const ph = swing * k, ftx = k * 3.6 * sc + fx * 6 * ph, fty = fy * 3 * ph - Math.max(0, ph) * 2;
    limb(g, k * 3.4 * sc + lx * 0.2, hipY, ftx, fty - 1, L.pants, 5 * sc);
    ellipse(g, ftx + fx * 1.2, fty, 3.6 * sc, 2.2 * sc, L.shoe, INK, 1.2);
  }
  // far arm (behind the torso)
  const side = fx >= 0 ? -1 : 1;
  const armTo = (hx, hy) => limb(g, side * 7.5 * sc + lx, shY + 3 + ly, hx, hy, L.shirt, 4);
  if (L.arms === "reach") armTo(fx * 11 + lx, shY + 6 + fy * 3 + ly + bob * 0.3);
  else armTo(side * 8.5 * sc + lx - fx * 1, hipY - 4 + ly + swing * 2 * -side);
  // torso
  const tl = -7.5 * sc, tr = 7.5 * sc;
  const torso = [[tl + lx, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [tl + 1 + lx * 0.5, hipY + 1]];
  fillPoly(g, torso, L.shirt, INK, 1.8);
  fillPoly(g, [[lx + 1.5, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [lx * 0.7 + 1.5, hipY + 1]], shade(L.shirt, -0.2)); // shade level
  line(g, tl + lx + 1, shY + ly + 1.2, tr + lx - 1, shY + ly + 1.2, shade(L.shirt, 0.35), 1.2); // rim on the shoulder line
  if (fy > -0.2) fillPoly(g, [[lx + fx * 2 - 1.6, shY + ly + 1], [lx + fx * 2 + 1.6, shY + ly + 1], [lx + fx * 2 + 1.2, shY + ly + 10 * sc], [lx + fx * 2, shY + ly + 12 * sc], [lx + fx * 2 - 1.2, shY + ly + 10 * sc]], L.tie, INK, 1);
  if (L.torn) { fillPoly(g, [[tl + lx, hipY - 5], [tl + lx + 4, hipY + 1], [tl + lx + 6, hipY - 4]], P.zombie); fillPoly(g, [[tr + lx - 6, hipY - 3], [tr + lx - 2, hipY + 2], [tr + lx, hipY - 5]], P.zombie); }
  // head
  const hx = lx + fx * 2.2, hy = shY - hr + 2 + ly + bob * 0.5 + fy * 0.8;
  ellipse(g, hx, hy, hr, hr * 1.05, L.skin, INK, 1.8);
  if (fy > 0.1) {
    ellipse(g, hx + fx * 3.2 - 2.1, hy + 0.5, 1.1, 1.5, INK); ellipse(g, hx + fx * 3.2 + 2.1, hy + 0.5, 1.1, 1.5, INK);
    g.beginPath(); g.ellipse(hx, hy - 1.5, hr + 0.4, hr * 0.78, 0, Math.PI, 0); g.fillStyle = L.hair; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
  } else {
    ellipse(g, hx, hy - 0.5, hr + 0.4, hr * 1.02, L.hair, INK, 1.8);
  }
  g.beginPath(); g.arc(hx, hy, hr - 1, Math.PI * 1.05, Math.PI * 1.55); g.lineWidth = 1.2; g.strokeStyle = shade(L.skin, 0.4); g.stroke(); // rim light
  // near arm (+ weapon or reach)
  const nx = -side * 7.5 * sc + lx, ny = shY + 3 + ly;
  if (L.arms === "reach") {
    const hx2 = fx * 12 + lx + 2, hy2 = shY + 7 + fy * 3 + ly + bob * 0.3 + 2;
    limb(g, nx, ny, hx2, hy2, L.shirt, 4); ellipse(g, hx2, hy2, 2.4, 2.4, L.skin, INK, 1.2);
  } else {
    // weapon: a long metal ruler. idle: held low; attack: raise, strike toward facing, recover
    const hxx = -side * 9 * sc + lx, hyy = hipY - 6 + ly;
    let tx, ty;
    if (o.anim === "attack") {
      if (a < 0.34) { const t = a / 0.34; tx = hxx + (-side) * 3 + fx * -2 * t; ty = hyy - 6 - 14 * t; }
      else if (a < 0.75) { const t = (a - 0.34) / 0.41; tx = hxx + fx * 17 * t - side * 2; ty = hyy - 20 + 20 * t + fy * 9 * t; }
      else { const t = (a - 0.75) / 0.25; tx = hxx + fx * 17 * (1 - t) * 0.6; ty = hyy - 2 + 6 * t; }
    } else { tx = hxx - side * 4 + fx * 3; ty = hyy + 11 + (o.anim === "walk" ? swing * 1.5 : 0); }
    limb(g, nx, ny, hxx, hyy, L.shirt, 4);
    line(g, hxx, hyy, tx, ty, INK, 5); line(g, hxx, hyy, tx, ty, "#cfd5e2", 2.4);
    ellipse(g, hxx, hyy, 2.4, 2.4, L.skin, INK, 1.2);
  }
}

function imp(g, L, o) {
  const { fx, fy, bob, swing, lunge } = o, sc = L.sc;
  const lx = fx * lunge * 6, ly = fy * lunge * 3;
  for (const k of [-1, 1]) {
    const ph = swing * k;
    limb(g, k * 5 + lx * 0.3, -9 + bob * 0.3, k * 5 + fx * 5 * ph, -1 - Math.max(0, ph) * 2, "#3c4350", 4.5);
  }
  const body = { top: shade(L.body, 0.14), left: L.body, right: shade(L.body, -0.28), rim: P.rim };
  box(g, lx, -2 + ly + bob, { u0: -0.24, u1: 0.24, v0: -0.2, v1: 0.2, z0: 8, h: 15 }, body);
  // paper tray on top that tilts out toward the facing side, and a sheet of paper
  box(g, lx + fx * 3, -2 + ly + bob, { u0: -0.2, u1: 0.2, v0: -0.16, v1: 0.16, z0: 23, h: 2 }, { top: L.tray, left: shade(L.tray, -0.2), right: shade(L.tray, -0.4), rim: "#fff" });
  // face on the lit face (left face when facing away from the right), eyes shift with facing
  if (fy > -0.2) {
    const ex = lx + (fx > 0.3 ? 5 : fx < -0.3 ? -9 : -3), ey = 10 + ly + bob - 21;
    ellipse(g, ex, ey, 2.2, 2.6, L.eye, INK, 1); ellipse(g, ex + 6, ey + (fx > 0.3 ? 2 : 0), 2.2, 2.6, L.eye, INK, 1);
  }
  // horns
  fillPoly(g, [[lx - 6, -16 + ly + bob], [lx - 9, -27 + ly + bob], [lx - 2, -18 + ly + bob]], "#d9e0ee", INK, 1.4);
  fillPoly(g, [[lx + 6, -16 + ly + bob], [lx + 9, -27 + ly + bob], [lx + 2, -18 + ly + bob]], "#d9e0ee", INK, 1.4);
  // little arms that flail in attack
  const sw = o.anim === "attack" ? -lunge * 9 : 0;
  limb(g, lx - 10, -13 + ly + bob, lx - 14 + fx * 3, -7 + ly + sw, L.body, 3.5);
  limb(g, lx + 10, -13 + ly + bob, lx + 14 + fx * 3, -7 + ly + sw, L.body, 3.5);
}

/** Draw one character frame at the origin. type: 'clerk' | monster id. */
export function drawFigure(g, type, anim, dir, f) {
  const L = LOOKS[type], o = pose(anim, dir, f);
  ellipse(g, 0, 1, 13 * L.sc, 5.5 * L.sc, "rgba(0,0,0,0.38)");
  g.save();
  if (anim === "death") {
    // fall over sideways, pivoting on the feet
    const s = o.fx >= 0 ? 1 : -1;
    g.rotate(s * o.p * 1.5); g.translate(0, o.p * 3);
    o.anim = "idle"; o.bob = 0; o.swing = 0; o.lunge = 0;
  }
  (L.kind === "imp" ? imp : human)(g, L, o);
  g.restore();
}
