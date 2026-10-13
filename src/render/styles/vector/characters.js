// Hero and monsters: one small skeleton rig, two painters. Feet are at the origin, up is negative y.
// Canvas is 88x96 with the feet at (44, 76). The contact shadow and the rim ring are NOT drawn here:
// the atlas bakes the rim around this drawing, the renderer draws a light-tinted shadow under every actor.
import { palette as P } from "./palette.js";
import { INK, limb, ellipse, fillPoly, line, box, shade } from "../../draw/shapes.js";
import { DIR_VEC, ANIMS } from "../../keys.js";

export const FIG_W = 88, FIG_H = 96, FIG_FX = 44, FIG_FY = 76;

/** Per-type metrics in logical px: head top above the feet (plates, floaters), contact shadow half-width. */
export const FIG_DIM = {
  clerk: { head: 58, shadowR: 15 },
  "zombie-intern": { head: 52, shadowR: 13 },
  "printer-imp": { head: 52, shadowR: 11 },
};

// Per-character look. `kind` picks the painter. Colours follow C2 (docs/product/variants/art-direction).
const LOOKS = {
  clerk: { kind: "human", skin: "#f6c49c", hair: "#2a1a26", shirt: "#fdf6e4", suit: "#3b6cf0", pants: "#232a58", shoe: "#161425", tie: "#ffb81f", sc: 1.1, head: 1.32, arms: "weapon", lanyard: true, headset: true },
  "zombie-intern": { kind: "human", skin: "#6cae6c", hair: "#34401f", shirt: "#5f7aa3", suit: null, pants: "#403f60", shoe: "#161425", tie: "#8a3a3a", sc: 1, head: 1.32, arms: "reach", torn: true, zombie: true },
  "printer-imp": { kind: "imp", body: "#e4dcc8", lid: "#f2ebd8", wing: "#fff0d6", eye: "#ff4c3a", mouth: "#2b1226", cable: "#46467a" },
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
  const { fx, fy, bob, swing, lunge, a } = o, sc = L.sc, front = fy > -0.2;
  const legH = 15 * sc, torsoH = 19 * sc, hr = 7.2 * sc * L.head;
  const lx = fx * lunge * 5, ly = fy * lunge * 2.5;
  const hipY = -legH + bob * 0.4, shY = hipY - torsoH;
  // legs (far leg one shade darker)
  for (const k of [-1, 1]) {
    const ph = swing * k, ftx = k * 3.6 * sc + fx * 6 * ph, fty = fy * 3 * ph - Math.max(0, ph) * 2;
    limb(g, k * 3.4 * sc + lx * 0.2, hipY, ftx, fty - 1, k < 0 ? shade(L.pants, -0.25) : L.pants, 5.2 * sc);
    ellipse(g, ftx + fx * 1.2, fty, 3.8 * sc, 2.3 * sc, L.shoe, INK, 1.3);
  }
  // far arm (behind the torso)
  const side = fx >= 0 ? -1 : 1, sleeve = L.suit ?? L.shirt;
  const armTo = (hx, hy) => limb(g, side * 7.5 * sc + lx, shY + 3 + ly, hx, hy, shade(sleeve, -0.2), 4.2);
  if (L.arms === "reach") armTo(fx * 11 + lx, shY + 6 + fy * 3 + ly + bob * 0.3);
  else armTo(side * 8.5 * sc + lx - fx * 1, hipY - 4 + ly + swing * 2 * -side);
  // torso: shirt, jacket panels, shade level on the right half
  const tl = -7.5 * sc, tr = 7.5 * sc;
  fillPoly(g, [[tl + lx, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [tl + 1 + lx * 0.5, hipY + 1]], L.shirt, INK, 1.7);
  if (L.suit) {
    const cx0 = lx + fx * 1.5;
    if (front) {
      fillPoly(g, [[tl + lx, shY + ly], [cx0 - 2.6, shY + ly], [cx0 - 0.6, hipY + 1], [tl + 1 + lx * 0.5, hipY + 1]], L.suit, INK, 1.2);
      fillPoly(g, [[cx0 + 2.6, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [cx0 + 0.6, hipY + 1]], shade(L.suit, -0.25), INK, 1.2);
    } else fillPoly(g, [[tl + lx, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [tl + 1 + lx * 0.5, hipY + 1]], L.suit, INK, 1.7);
    fillPoly(g, [[lx + 1.5, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [lx * 0.7 + 1.5, hipY + 1]], "rgba(20,10,50,0.18)");
  } else fillPoly(g, [[lx + 1.5, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [lx * 0.7 + 1.5, hipY + 1]], shade(L.shirt, -0.22));
  line(g, tl + lx + 1, shY + ly + 1.2, tr + lx - 1, shY + ly + 1.2, shade(L.suit ?? L.shirt, 0.4), 1.2); // rim on the shoulder line
  if (front) {
    const tx = lx + fx * 2;
    fillPoly(g, [[tx - 1.7, shY + ly + 1], [tx + 1.7, shY + ly + 1], [tx + 1.3, shY + ly + 10 * sc], [tx, shY + ly + 12.5 * sc], [tx - 1.3, shY + ly + 10 * sc]], L.tie, INK, 1);
    if (L.lanyard) {
      line(g, tx - 4.2, shY + ly + 0.5, tx - 3.4, shY + ly + 10 * sc, "#33e0ff", 1.3);
      fillPoly(g, [[tx - 6, shY + ly + 10 * sc], [tx - 1.6, shY + ly + 10 * sc], [tx - 1.6, shY + ly + 15 * sc], [tx - 6, shY + ly + 15 * sc]], "#ffffff", INK, 1);
    }
  }
  if (L.torn) { // ragged hem
    fillPoly(g, [[tl + lx, hipY - 5], [tl + lx + 2, hipY + 3], [tl + lx + 4, hipY - 1], [tl + lx + 6, hipY + 4], [tl + lx + 8, hipY - 3]], L.shirt, INK, 1);
    fillPoly(g, [[tr + lx - 8, hipY - 3], [tr + lx - 5, hipY + 3.5], [tr + lx - 3, hipY - 1], [tr + lx - 1, hipY + 3], [tr + lx, hipY - 5]], shade(L.shirt, -0.22), INK, 1);
  }
  // head
  const hx = lx + fx * 2.2, hy = shY - hr + 3 + ly + bob * 0.5 + fy * 0.8;
  limb(g, lx + fx * 1.2, shY + 2 + ly, hx, hy + hr * 0.6, L.skin, 4); // neck
  ellipse(g, hx, hy, hr, hr * 1.05, L.skin, INK, 1.8);
  if (L.headset && !front) { ellipse(g, hx - hr * 0.95, hy + 0.5, 2.6, 3.4, "#c4ecff", INK, 1.2); ellipse(g, hx + hr * 0.95, hy + 0.5, 2.6, 3.4, "#c4ecff", INK, 1.2); }
  if (front) {
    const ex = hx + fx * 3.2, ey = hy + 0.8;
    if (L.zombie) {
      ellipse(g, ex - 3, ey, 2.6, 2.6, "#1f2e24", INK, 1); ellipse(g, ex - 3, ey, 1.2, 1.2, "#f5ff80");
      ellipse(g, ex + 3.4, ey - 0.3, 2.9, 2.9, "#1f2e24", INK, 1); ellipse(g, ex + 3.4, ey - 0.3, 1.4, 1.4, "#f5ff80");
      ellipse(g, ex + 0.4, ey + 5.2, 3.3, 2, "#4d1b2e", INK, 1);
    } else {
      ellipse(g, ex - 2.8, ey, 1.2, 1.7, INK); ellipse(g, ex + 2.8, ey, 1.2, 1.7, INK);
      line(g, ex - 1.5, ey + 4.6, ex + 1.8, ey + 4.4, INK, 1.1);
    }
    g.beginPath(); g.ellipse(hx, hy - 1.5, hr + 0.4, hr * 0.78, 0, Math.PI, 0); g.fillStyle = L.hair; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
    if (L.zombie) fillPoly(g, [[hx - hr, hy - hr * 0.5], [hx - hr * 0.8, hy - hr * 1.5], [hx - hr * 0.3, hy - hr * 0.8], [hx + hr * 0.1, hy - hr * 1.6], [hx + hr * 0.5, hy - hr * 0.8], [hx + hr * 0.95, hy - hr * 1.3], [hx + hr, hy - hr * 0.5]], L.hair, INK, 1.2);
    if (L.headset) { // earcup on the near side and a mic boom to the cheek
      const sx = hx - fx * 1 - hr * 0.98;
      ellipse(g, sx, hy + 0.5, 2.5, 3.4, "#c4ecff", INK, 1.2);
      g.beginPath(); g.moveTo(sx, hy + 3.5); g.quadraticCurveTo(sx + 1, hy + hr * 0.95, ex - 0.5, hy + hr * 0.78); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
      ellipse(g, ex - 0.5, hy + hr * 0.78, 1.3, 1.1, INK);
    }
  } else {
    ellipse(g, hx, hy - 0.5, hr + 0.4, hr * 1.02, L.hair, INK, 1.8);
  }
  g.beginPath(); g.arc(hx, hy, hr - 1, Math.PI * 1.05, Math.PI * 1.55); g.lineWidth = 1.2; g.strokeStyle = shade(L.skin, 0.45); g.stroke(); // rim light
  // near arm (+ weapon or reach)
  const nx = -side * 7.5 * sc + lx, ny = shY + 3 + ly;
  if (L.arms === "reach") {
    const hx2 = fx * 12 + lx + 2, hy2 = shY + 7 + fy * 3 + ly + bob * 0.3 + 2;
    limb(g, nx, ny, hx2, hy2, L.shirt, 4.2); ellipse(g, hx2, hy2, 2.6, 2.6, L.skin, INK, 1.2);
    fillPoly(g, [[hx2 + 1, hy2 - 6], [hx2 + 5, hy2 - 6], [hx2 + 5, hy2 - 1], [hx2 + 1, hy2 - 1]], "#fff3d8", INK, 1); // coffee mug
  } else {
    // keyboard sword. idle: held low; attack: raise, strike toward facing, recover
    const hxx = -side * 9 * sc + lx, hyy = hipY - 6 + ly;
    let tx, ty;
    if (o.anim === "attack") {
      if (a < 0.34) { const t = a / 0.34; tx = hxx + (-side) * 3 + fx * -2 * t; ty = hyy - 6 - 14 * t; }
      else if (a < 0.75) { const t = (a - 0.34) / 0.41; tx = hxx + fx * 17 * t - side * 2; ty = hyy - 20 + 20 * t + fy * 9 * t; }
      else { const t = (a - 0.75) / 0.25; tx = hxx + fx * 17 * (1 - t) * 0.6; ty = hyy - 2 + 6 * t; }
    } else { tx = hxx - side * 4 + fx * 3; ty = hyy + 11 + (o.anim === "walk" ? swing * 1.5 : 0); }
    tx = hxx + (tx - hxx) * 1.3; ty = hyy + (ty - hyy) * 1.3;
    limb(g, nx, ny, hxx, hyy, sleeve, 4.2);
    line(g, hxx, hyy, tx, ty, INK, 6.4); line(g, hxx, hyy, tx, ty, "#d3dcea", 4);
    for (let i = 1; i <= 4; i++) { const t = 0.2 + i * 0.18; ellipse(g, hxx + (tx - hxx) * t, hyy + (ty - hyy) * t, 1.1, 1.1, i & 1 ? "#4c5280" : "#6a72b0"); }
    ellipse(g, hxx, hyy, 2.6, 2.6, L.skin, INK, 1.2);
  }
}

/** The Printer Imp: a hovering printer with a lid, angry red eyes, a paper-feed mouth, paper wings and dangling cables. */
function imp(g, L, o) {
  const { fx, fy, bob, lunge, S } = o, atk = o.anim === "attack";
  const lx = fx * lunge * 6, ly = fy * lunge * 3, hov = 15 + bob * 0.8 + (atk ? -lunge * 2 : 0);
  const fl = atk ? 0.9 - lunge * 1.6 : S; // wing flap
  const b = { u0: -0.25, u1: 0.25, v0: -0.22, v1: 0.22, z0: hov, h: 17 };
  const Pt = (u, v, z) => [lx + (u - v) * 32, -2 + ly + (u + v) * 16 - z];
  // wings behind the body
  const by = Pt(0, 0, hov + 12)[1];
  for (const sp of [-1, 1]) {
    const bx = lx + sp * 7;
    const pts = [[bx, by], [bx + sp * 22, by - 15 - fl * 8], [bx + sp * 31, by - 3 - fl * 6], [bx + sp * 25, by + 7 + fl * 3], [bx + sp * 9, by + 6]];
    fillPoly(g, pts, sp > 0 ? shade(L.wing, -0.2) : L.wing, INK, 1.4);
    line(g, pts[0][0], pts[0][1], pts[1][0], pts[1][1], "rgba(13,10,28,0.5)", 0.9); line(g, pts[0][0], pts[0][1], pts[3][0], pts[3][1], "rgba(13,10,28,0.5)", 0.9);
  }
  // dangling cables
  for (let i = 0; i < 4; i++) {
    const x0 = lx - 7 + i * 4.6, y0 = -2 + ly - hov + 3 + (i & 1) * 2, sw = Math.sin(o.f / o.n * Math.PI * 2 + i * 1.4) * 2.2;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + sw, y0 + 7 + hov * 0.35, x0 + sw * 1.6, y0 + 10 + hov * 0.7);
    g.lineCap = "round"; g.strokeStyle = INK; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = L.cable; g.lineWidth = 1.5; g.stroke();
  }
  // body, lid, paper sheet
  const side = fx > 0.3 ? "right" : "left";
  const bodyMat = { top: L.lid, left: L.body, right: shade(L.body, -0.28), rim: "#ffffff" };
  box(g, lx, -2 + ly, b, bodyMat);
  box(g, lx, -2 + ly, { u0: b.u0 - 0.03, u1: b.u1 + 0.03, v0: b.v0 - 0.03, v1: b.v1 + 0.03, z0: b.z0 + b.h, h: 4 }, { top: shade(L.lid, 0.1), left: L.lid, right: shade(L.lid, -0.25), rim: "#ffffff" });
  const [sx, sy] = Pt(0.02, 0, hov + b.h + 4);
  fillPoly(g, [[sx - 6, sy], [sx + 5, sy - 2], [sx + 7, sy - 9], [sx - 4, sy - 7]], P.paper, INK, 1.1);
  line(g, sx - 3, sy - 3.2, sx + 3, sy - 4.2, "rgba(13,10,28,0.55)", 0.9); line(g, sx - 3, sy - 5.2, sx + 2, sy - 6, "rgba(13,10,28,0.55)", 0.9);
  // face on the lit side; skipped when facing away
  if (fy > -0.2) {
    const fp = side === "right" ? (t, v) => Pt(b.u1, b.v0 + t * (b.v1 - b.v0), hov + v * b.h) : (t, v) => Pt(b.u0 + t * (b.u1 - b.u0), b.v1, hov + v * b.h);
    const quad = (pts, fill, st) => fillPoly(g, pts.map(([t, v]) => fp(t, v)), fill, st, 1);
    quad([[0.1, 0.9], [0.44, 0.76], [0.44, 0.56], [0.1, 0.64]], L.eye, INK);
    quad([[0.9, 0.9], [0.56, 0.76], [0.56, 0.56], [0.9, 0.64]], L.eye, INK);
    const open = 0.14 + 0.2 * lunge, m0 = 0.44;
    quad([[0.1, m0], [0.9, m0], [0.9, m0 - open * 1.6], [0.1, m0 - open * 1.6]], L.mouth, INK);
    for (let k = 0; k < 5; k++) { const u0 = 0.1 + k * 0.16, a = fp(u0, m0), c = fp(u0 + 0.16, m0), d = fp(u0 + 0.08, m0 - open * 0.9); fillPoly(g, [a, c, d], P.paper, null); }
  }
}

/** Draw one character frame at the origin. type: 'clerk' | monster id. */
export function drawFigure(g, type, anim, dir, f) {
  const L = LOOKS[type], o = pose(anim, dir, f);
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
