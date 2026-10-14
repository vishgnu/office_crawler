// Hero and monsters: one small skeleton rig, two painters. Feet are at the origin, up is negative y.
// Canvas is 104x96 with the feet at (52, 76) (wide enough for the tallest monster to lie down). The contact shadow and the rim ring are NOT drawn here:
// the atlas bakes the rim around this drawing, the renderer draws a light-tinted shadow under every actor.
import { palette as P } from "./palette.js";
import { INK, limb, ellipse, fillPoly, line, box, shade, ink } from "../../draw/shapes.js";
import { DIR_VEC, PLAYER_ANIMS, BOSS_ANIMS } from "../../keys.js";
import { hero, ally, HERO_IDS, HERO_DIM } from "./heroes.js";

export const FIG_W = 104, FIG_H = 96, FIG_FX = 52, FIG_FY = 76;
/** Bosses are bigger (the Regional Director stands about 1.5x the middle manager and swings a gavel overhead). */
export const BOSS_W = 188, BOSS_H = 196, BOSS_FX = 94, BOSS_FY = 164;

/** Per-type metrics in logical px: head top above the feet (plates, floaters), contact shadow half-width. */
export const FIG_DIM = {
  clerk: { head: 58, shadowR: 15 },
  "zombie-intern": { head: 52, shadowR: 13 },
  "printer-imp": { head: 52, shadowR: 11 },
  "temp-worker": { head: 52, shadowR: 13 },
  "printer-demon": { head: 60, shadowR: 14 },
  "middle-manager": { head: 70, shadowR: 18 },
  "vending-machine": { head: 62, shadowR: 18 },
  consultant: { head: 58, shadowR: 13 },
  auditor: { head: 66, shadowR: 14 },
  "regional-director": { head: 104, shadowR: 26 },
  "regional-director-rage": { head: 104, shadowR: 26 },
  "npc-vendor": { head: 54, shadowR: 13 },
  "npc-healer": { head: 56, shadowR: 13 },
  "npc-potions": { head: 54, shadowR: 13 },
  "npc-stash": { head: 56, shadowR: 15 },
  ...HERO_DIM, // R5 classes and allies (heroes.js)
};

// Per-character look. `kind` picks the painter. Colours follow C2 (docs/product/variants/art-direction).
const LOOKS = {
  clerk: { kind: "human", skin: "#f6c49c", hair: "#2a1a26", shirt: "#fdf6e4", suit: "#3b6cf0", pants: "#232a58", shoe: "#eceae4", tie: "#ffb81f", sc: 1.1, head: 1.32, arms: "weapon", lanyard: true, headset: true, breath: 2 },
  "zombie-intern": { kind: "human", skin: "#6cae6c", skin2: "#4a9150", hair: "#34401f", shirt: "#5f7aa3", suit: null, pants: "#7a7396", shoe: "#161425", tie: "#8a3a3a", sc: 1, head: 1.32, arms: "reach", torn: true, zombie: true },
  "printer-imp": { kind: "imp", body: "#e4dcc8", lid: "#f2ebd8", wing: "#fff0d6", eye: "#ff4c3a", mouth: "#2b1226", cable: "#46467a" },
  // S2 monsters
  "temp-worker": { kind: "human", skin: "#e8b48a", hair: "#5a3a22", shirt: "#e8e4d6", suit: null, pants: "#8a7a52", shoe: "#3a2a22", tie: null, sc: 0.95, head: 1.32, arms: "weapon", held: "clipboard", vest: "#ff8c2a", cap: "#ff8c2a" },
  "printer-demon": { kind: "imp", demon: true, size: 0.31, bh: 21, body: "#443a60", lid: "#5a4e7c", wing: "#6a2a58", wingEdge: "#ff3d6e", eye: "#ff3d6e", mouth: "#1a0f1c", cable: "#ff3d6e" },
  "middle-manager": { kind: "human", skin: "#e8a888", hair: "#8a8a96", shirt: "#f4efe0", suit: "#6a6f86", lapel: "#c8cef0", edge: "#e6ebff", pants: "#3a3f58", shoe: "#161425", tie: "#d83a3a", sc: 1.22, head: 1.12, wide: 1.32, arms: "weapon", held: "binder", bald: true, brute: true, pin: true, breath: 2 },
  "vending-machine": { kind: "machine", style: "vending", body: "#2f6fd8", trim: "#f0e6d0", glass: "#1a2a4a", eye: "#ffe45a" },
  consultant: { kind: "human", skin: "#f3d2b6", hair: "#1c1626", shirt: "#2fd3bd", suit: "#2a2f50", pants: "#232846", shoe: "#0e0e1c", tie: "#fff6e8", edge: "#a8b4ff", sc: 1.04, head: 1.28, arms: "weapon", held: "slides", glasses: true },
  auditor: { kind: "human", skin: "#e4c0a0", hair: "#6a6a72", shirt: "#e8e4d8", suit: "#7a6a4c", pants: "#2f5a3c", edge: "#e8dca8", shoe: "#161425", tie: "#2f6b3b", sc: 1.16, head: 1.2, wide: 0.92, arms: "weapon", held: "ledger", glasses: true, visor: "#52b86a" },
  // S3 boss: its own painter. `rage` is the phase-2 look (jacket off, tie loosened, red glow).
  "regional-director": { kind: "director", rage: false },
  "regional-director-rage": { kind: "director", rage: true },
  // Lobby NPCs (idle only)
  "npc-vendor": { kind: "human", skin: "#e8b48a", hair: "#3a2a1c", shirt: "#f4efe0", suit: "#8a5a34", pants: "#3a3f58", shoe: "#161425", tie: "#ffd04a", sc: 1.04, head: 1.3, arms: "weapon", held: "crate", raise: true, cap: "#8a5a34" },
  "npc-healer": { kind: "human", skin: "#f3d2b6", hair: "#e4e0f0", shirt: "#ffffff", suit: "#f4fff8", pants: "#9ad8c4", shoe: "#161425", tie: null, sc: 1.04, head: 1.3, arms: "weapon", held: "medkit", raise: true, cross: true, headband: true },
  "npc-potions": { kind: "human", skin: "#c88e68", hair: "#2a1a26", shirt: "#f4efe0", suit: "#3c8a58", pants: "#2a3a4a", shoe: "#161425", tie: null, sc: 1.02, head: 1.3, arms: "weapon", held: "flask", raise: true },
  "npc-stash": { kind: "machine", style: "locker", body: "#5b6f94", trim: "#c4d0ea", glass: "#1a2a4a", eye: "#5af0a0" },
};

/** Compute the pose scalars shared by all painters. */
function pose(anim, dir, f) {
  const n = PLAYER_ANIMS[anim] ?? BOSS_ANIMS[anim], ph = f / n, S = Math.sin(ph * Math.PI * 2), [fx, fy] = DIR_VEC[dir];
  const a = anim === "attack" || anim === "cast" ? f / (n - 1) : 0;
  return {
    fx, fy, anim, f, n, S,
    bob: anim === "idle" ? S * 1.5 : anim === "walk" ? -Math.abs(S) * 2.2 : 0,
    swing: anim === "walk" ? S : 0,
    a, lunge: anim === "attack" ? Math.sin(a * Math.PI) : 0, cast: anim === "cast" ? Math.sin((f / (n - 1)) * Math.PI) : 0,
    p: anim === "death" ? f / (n - 1) : 0,
    w: anim === "windup" ? f / (n - 1) : 0,
  };
}

function human(g, L, o) {
  const { fx, fy, bob, swing, lunge, a } = o, sc = L.sc, front = fy > -0.2, wide = L.wide ?? 1;
  const legH = 15 * sc, torsoH = 19 * sc, hr = 7.2 * sc * L.head * 1.12; // round G fix: heads ~12 % bigger, features ~40 % bigger (readable at 1x)
  const lx = fx * lunge * 5, ly = fy * lunge * 2.5;
  const hipY = -legH + bob * 0.4, shY = hipY - torsoH;
  // legs (far leg one shade darker)
  for (const k of [-1, 1]) {
    const ph = swing * k, ftx = k * 3.6 * sc + fx * 6 * ph, fty = fy * 3 * ph - Math.max(0, ph) * 2;
    limb(g, k * 3.4 * sc + lx * 0.2, hipY, ftx, fty - 1, k < 0 ? shade(L.pants, -0.36) : L.pants, 5.2 * sc);
    ellipse(g, ftx + fx * 1.2, fty, 3.8 * sc, 2.3 * sc, L.shoe, INK, 1.3);
  }
  // far arm (behind the torso)
  const side = fx >= 0 ? -1 : 1, sleeve = L.suit ?? L.shirt;
  const armTo = (hx, hy) => limb(g, side * 7.5 * sc * wide + lx, shY + 3 + ly, hx, hy, shade(sleeve, -0.2), 4.2);
  if (L.arms === "reach") armTo(fx * 11 + lx, shY + 6 + fy * 3 + ly + bob * 0.3);
  else if (o.anim === "cast") armTo(fx * 9 + lx + side * 3, shY - 3 - 7 * o.cast + ly);
  else armTo(side * 8.5 * sc * wide + lx - fx * 1, hipY - 4 + ly + swing * 2 * -side);
  // torso: shirt, jacket panels, shade level on the right half
  const tl = -7.5 * sc * wide, tr = 7.5 * sc * wide;
  fillPoly(g, [[tl + lx, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [tl + 1 + lx * 0.5, hipY + 1]], L.shirt, INK, 1.7);
  if (L.suit) {
    const cx0 = lx + fx * 1.5;
    if (front) {
      fillPoly(g, [[tl + lx, shY + ly], [cx0 - 4.2, shY + ly], [cx0 - 1.4, hipY + 1], [tl + 1 + lx * 0.5, hipY + 1]], L.suit, INK, 1.2); // jacket, light side (the shirt panel between the halves is a big colour block)
      fillPoly(g, [[cx0 + 4.2, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [cx0 + 1.4, hipY + 1]], shade(L.suit, -0.4), INK, 1.2); // shadow side
      if (L.lapel) fillPoly(g, [[cx0 - 4.2, shY + ly], [cx0 - 8, shY + ly], [cx0 - 3.6, shY + ly + torsoH * 0.62], [cx0 - 1.9, shY + ly + torsoH * 0.62]], L.lapel, INK, 1.1); // lighter lapel
      if (L.pin) { for (let i = 0; i < 4; i++) { const x = tl + 2.4 + i * 3.3 * wide; line(g, x + lx, shY + ly + 3, x + 0.6 + lx * 0.5, hipY - 1, "rgba(200,205,235,0.4)", 0.9); } for (let i = 0; i < 4; i++) { const x = tr - 2.2 - i * 3.3 * wide; line(g, x + lx, shY + ly + 3, x - 0.6 + lx * 0.5, hipY - 1, "rgba(200,205,235,0.28)", 0.9); } } // pinstripes
      if (L.pin) { for (const yy of [hipY - 4.5, hipY - 9.5]) { ellipse(g, cx0 - 3.2, yy, 1.35, 1.35, "#e8d890", INK, 0.8); } } // buttons
    } else fillPoly(g, [[tl + lx, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [tl + 1 + lx * 0.5, hipY + 1]], L.suit, INK, 1.7);
    fillPoly(g, [[lx + 1.5, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [lx * 0.7 + 1.5, hipY + 1]], "rgba(20,10,50,0.3)");
  } else fillPoly(g, [[lx + 1.5, shY + ly], [tr + lx, shY + ly], [tr - 1 + lx * 0.5, hipY + 1], [lx * 0.7 + 1.5, hipY + 1]], shade(L.shirt, -0.36));
  if (L.vest) { // hi-vis vest: two panels with reflective stripes
    const vt = shY + ly + 0.5, vb = hipY - 1;
    if (front) {
      fillPoly(g, [[tl + lx, vt], [lx - 2, vt], [lx - 3, vb], [tl + 1 + lx * 0.5, vb]], L.vest, INK, 1.2);
      fillPoly(g, [[lx + 2, vt], [tr + lx, vt], [tr - 1 + lx * 0.5, vb], [lx + 3, vb]], shade(L.vest, -0.22), INK, 1.2);
      for (const yy of [vt + 8 * sc, vt + 12 * sc]) { line(g, tl + 1 + lx, yy, lx - 3, yy, "#f4f1d0", 1.4); line(g, lx + 3, yy, tr - 1 + lx, yy, "#cfcca8", 1.4); }
    } else {
      fillPoly(g, [[tl + lx, vt], [tr + lx, vt], [tr - 1 + lx * 0.5, vb], [tl + 1 + lx * 0.5, vb]], L.vest, INK, 1.4);
      for (const yy of [vt + 8 * sc, vt + 12 * sc]) line(g, tl + 1 + lx, yy, tr - 1 + lx, yy, "#f4f1d0", 1.4);
    }
  }
  if (L.cross && front) { const cx0 = lx + fx * 2 + 3.4, cy0 = shY + ly + 9 * sc; fillPoly(g, [[cx0 - 1.2, cy0 - 3.5], [cx0 + 1.2, cy0 - 3.5], [cx0 + 1.2, cy0 - 1.2], [cx0 + 3.5, cy0 - 1.2], [cx0 + 3.5, cy0 + 1.2], [cx0 + 1.2, cy0 + 1.2], [cx0 + 1.2, cy0 + 3.5], [cx0 - 1.2, cy0 + 3.5], [cx0 - 1.2, cy0 + 1.2], [cx0 - 3.5, cy0 + 1.2], [cx0 - 3.5, cy0 - 1.2], [cx0 - 1.2, cy0 - 1.2]], "#e0363f", INK, 0.9); }
  line(g, tl + lx + 1, shY + ly + 1.2, tr + lx - 1, shY + ly + 1.2, shade(L.suit ?? L.shirt, 0.4), 1.2); // rim on the shoulder line
  if (L.edge) { // dark suits: a thin light ink down the lit shoulder / flank and the far leg, so they stand off dark concrete (round G fix)
    line(g, tl + lx + 1.2, shY + ly + 1.6, tl + 1.8 + lx * 0.5, hipY - 0.5, L.edge, 1.9);
    line(g, tl + lx + 1, shY + ly + 1.2, tr + lx - 1, shY + ly + 1.2, L.edge, 1.9);
    line(g, -4.4 * sc + lx * 0.2, hipY + 2, -3.9 * sc, -3, shade(L.edge, -0.25), 1.5);
  }
  if (front && L.tie) {
    const tx = lx + fx * 2, tw = Math.sin((o.f / o.n) * Math.PI * 2 + 0.8) * (o.anim === "walk" ? 3.6 : o.anim === "idle" ? 3.4 : 1.2) * sc; // tie sway, 2-3x the old (none): baked per frame
    fillPoly(g, [[tx - 2.2, shY + ly + 1], [tx + 2.2, shY + ly + 1], [tx + 1.7 + tw * 0.6, shY + ly + 10 * sc], [tx + tw, shY + ly + 13 * sc], [tx - 1.7 + tw * 0.6, shY + ly + 10 * sc]], L.tie, INK, 1);
    line(g, tx - 0.6 + tw * 0.2, shY + ly + 3, tx + 0.4 + tw * 0.5, shY + ly + 9 * sc, shade(L.tie, -0.3), 1.1); // tie stripe
    if (L.lanyard) {
      line(g, tx - 5, shY + ly + 0.5, tx - 4, shY + ly + 10 * sc, "#33e0ff", 2.2);
      fillPoly(g, [[tx - 7.4, shY + ly + 10 * sc], [tx - 1.6, shY + ly + 10 * sc], [tx - 1.6, shY + ly + 16.5 * sc], [tx - 7.4, shY + ly + 16.5 * sc]], "#ffffff", INK, 1);
      fillPoly(g, [[tx - 6.4, shY + ly + 11.2 * sc], [tx - 2.6, shY + ly + 11.2 * sc], [tx - 2.6, shY + ly + 14 * sc], [tx - 6.4, shY + ly + 14 * sc]], "#4a90e0"); // photo
    }
  }
  if (front && !L.tie && L.lanyard) { /* no tie */ }
  if (!front && L.lanyard) { // back view: lanyard strap in a V across the shoulders and the tie tail swinging out behind
    const bx = lx + fx * 2, y0 = shY + ly;
    fillPoly(g, [[bx - 1.6, y0 + 6], [bx + 1.6, y0 + 6], [bx + 1.3, y0 + 13 * sc], [bx, y0 + 15.5 * sc], [bx - 1.3, y0 + 13 * sc]], L.tie, INK, 1);
    line(g, bx - 5.6, y0 + 0.5, bx - 0.4, y0 + 9.5, INK, 3); line(g, bx + 5.6, y0 + 0.5, bx + 0.4, y0 + 9.5, INK, 3);
    line(g, bx - 5.6, y0 + 0.5, bx - 0.4, y0 + 9.5, "#33e0ff", 1.6); line(g, bx + 5.6, y0 + 0.5, bx + 0.4, y0 + 9.5, "#33e0ff", 1.6);
    ellipse(g, bx, y0 + 10, 1.8, 1.4, "#ffffff", INK, 1);
  }
  if (L.torn) { // ragged hem
    fillPoly(g, [[tl + lx, hipY - 5], [tl + lx + 2, hipY + 3], [tl + lx + 4, hipY - 1], [tl + lx + 6, hipY + 4], [tl + lx + 8, hipY - 3]], L.shirt, INK, 1);
    fillPoly(g, [[tr + lx - 8, hipY - 3], [tr + lx - 5, hipY + 3.5], [tr + lx - 3, hipY - 1], [tr + lx - 1, hipY + 3], [tr + lx, hipY - 5]], shade(L.shirt, -0.22), INK, 1);
  }
  // head
  const hx = lx + fx * 2.2, hy = shY - hr + 3 + ly + bob * 0.9 + fy * 0.8;
  limb(g, lx + fx * 1.2, shY + 2 + ly, hx, hy + hr * 0.6, L.skin, 4); // neck
  ellipse(g, hx, hy, hr, hr * 1.05, L.skin, INK, 1.8);
  if (L.headset && !front) { ellipse(g, hx - hr * 0.95, hy + 0.5, 2.6, 3.4, "#c4ecff", INK, 1.2); ellipse(g, hx + hr * 0.95, hy + 0.5, 2.6, 3.4, "#c4ecff", INK, 1.2); }
  if (front) {
    const ex = hx + fx * 3.2, ey = hy + 0.8;
    if (L.zombie) {
      ellipse(g, ex - 3.6, ey, 3.7, 3.7, "#10190f", INK, 1.1); ellipse(g, ex - 3.6, ey, 1.9, 1.9, "#f5ff80");
      ellipse(g, ex + 4.1, ey - 0.3, 4.1, 4.1, "#10190f", INK, 1.1); ellipse(g, ex + 4.1, ey - 0.3, 2.2, 2.2, "#f5ff80");
      ellipse(g, ex + 0.2, ey + 6.6, 5.8, 4.2, "#2a0818", INK, 1.3); // one big mouth, two fangs
      fillPoly(g, [[ex - 3.4, ey + 3.9], [ex - 0.8, ey + 3.9], [ex - 2.1, ey + 7.6]], "#f4efe0", INK, 0.9); fillPoly(g, [[ex + 1.8, ey + 3.9], [ex + 4.6, ey + 3.9], [ex + 3.2, ey + 7.6]], "#f4efe0", INK, 0.9);
    } else { // faces 1.5x larger and darker: bigger eyes, a longer mouth line
      ellipse(g, ex - 4.1, ey, 2.5, 3.5, INK); ellipse(g, ex + 4.1, ey, 2.5, 3.5, INK);
      ellipse(g, ex - 4.7, ey - 1.4, 0.95, 1.1, "rgba(255,255,255,0.95)"); ellipse(g, ex + 3.5, ey - 1.4, 0.95, 1.1, "rgba(255,255,255,0.95)"); // eye glints
      if (L.brute) line(g, ex - 4.8, ey + 6.4, ex + 4.8, ey + 6.4, INK, 2.8); // the manager's flat mouth bar
      else { g.beginPath(); g.moveTo(ex - 3.6, ey + 5.4); g.quadraticCurveTo(ex, ey + 8, ex + 3.8, ey + 5.3); g.lineWidth = 2.2; g.lineCap = "round"; g.strokeStyle = INK; g.stroke(); }
    }
    if (L.glasses) {
      ellipse(g, ex - 4.1, ey, 4.3, 3.9, "rgba(210,236,255,0.32)", INK, 1.5); ellipse(g, ex + 4.1, ey, 4.3, 3.9, "rgba(210,236,255,0.32)", INK, 1.5);
      line(g, ex - 0.4, ey - 0.2, ex + 0.4, ey - 0.2, INK, 1.4);
    }
    if (L.bald) { // side tufts only, a shiny scalp and a frown
      ellipse(g, hx - hr * 0.96, hy - 1, 2, 3, L.hair, INK, 1.2); ellipse(g, hx + hr * 0.96, hy - 1, 2, 3, L.hair, INK, 1.2);
      line(g, hx - 4, hy - hr * 0.78, hx - 1.2, hy - hr * 0.92, "rgba(255,255,255,0.55)", 1.4);
      line(g, ex - 6.2, ey - 4.6, ex - 1, ey - 2.4, INK, 2.3); line(g, ex + 6.2, ey - 4.6, ex + 1, ey - 2.4, INK, 2.3); // angry brows
    } else { g.beginPath(); g.ellipse(hx, hy - 1.5, hr + 0.4, hr * 0.78, 0, Math.PI, 0); g.fillStyle = L.hair; g.fill(); g.lineWidth = ink(1.6); g.strokeStyle = INK; g.stroke(); }
    if (L.cap) { // hard cap
      g.beginPath(); g.ellipse(hx, hy - 2, hr + 0.8, hr * 0.8, 0, Math.PI, 0); g.closePath(); g.fillStyle = L.cap; g.fill(); g.lineWidth = ink(1.6); g.strokeStyle = INK; g.stroke();
      fillPoly(g, [[hx - hr - 1, hy - 2], [hx + hr + 1, hy - 2], [hx + hr * 0.8 + fx * 3, hy + 0.6], [hx - hr * 0.8 + fx * 3, hy + 0.6]], shade(L.cap, -0.25), INK, 1.1);
    }
    if (L.visor) { // accountant's eyeshade
      fillPoly(g, [[hx - hr - 0.6, hy - hr * 0.55], [hx + hr + 0.6, hy - hr * 0.55], [hx + hr + 0.6, hy - hr * 0.12], [hx - hr - 0.6, hy - hr * 0.12]], L.visor, INK, 1.3);
      fillPoly(g, [[hx - hr - 0.6, hy - hr * 0.12], [hx + hr + 0.6, hy - hr * 0.12], [hx + hr * 0.7 + fx * 3, hy + hr * 0.18], [hx - hr * 0.7 + fx * 3, hy + hr * 0.18]], "rgba(82,184,106,0.55)", INK, 1);
    }
    if (L.headband) ellipse(g, hx + fx * 1.5, hy - hr * 0.62, 2.4, 2.4, "#e6f4ff", INK, 1.1);
    if (L.zombie) fillPoly(g, [[hx - hr, hy - hr * 0.5], [hx - hr * 0.8, hy - hr * 1.5], [hx - hr * 0.3, hy - hr * 0.8], [hx + hr * 0.1, hy - hr * 1.6], [hx + hr * 0.5, hy - hr * 0.8], [hx + hr * 0.95, hy - hr * 1.3], [hx + hr, hy - hr * 0.5]], L.hair, INK, 1.2);
    if (L.headset) { // earcup on the near side and a mic boom to the cheek
      const sx = hx - fx * 1 - hr * 0.98;
      ellipse(g, sx, hy + 0.5, 2.5, 3.4, "#c4ecff", INK, 1.2);
      g.beginPath(); g.moveTo(sx, hy + 3.5); g.quadraticCurveTo(sx + 1, hy + hr * 0.95, ex - 0.5, hy + hr * 0.78); g.lineWidth = ink(1.2); g.strokeStyle = INK; g.stroke();
      ellipse(g, ex - 0.5, hy + hr * 0.78, 1.3, 1.1, INK);
    }
  } else {
    ellipse(g, hx, hy - 0.5, hr + 0.4, hr * 1.02, L.bald ? L.skin : L.hair, INK, 1.8);
    if (L.bald) { ellipse(g, hx - hr * 0.96, hy - 1, 2, 3, L.hair, INK, 1.2); ellipse(g, hx + hr * 0.96, hy - 1, 2, 3, L.hair, INK, 1.2); }
    if (L.cap) { g.beginPath(); g.ellipse(hx, hy - 1.5, hr + 0.8, hr * 0.95, 0, Math.PI, 0); g.closePath(); g.fillStyle = L.cap; g.fill(); g.lineWidth = ink(1.6); g.strokeStyle = INK; g.stroke(); }
    if (L.visor) fillPoly(g, [[hx - hr - 0.6, hy - hr * 0.55], [hx + hr + 0.6, hy - hr * 0.55], [hx + hr + 0.6, hy - hr * 0.12], [hx - hr - 0.6, hy - hr * 0.12]], L.visor, INK, 1.3);
    if (L.headset) { // headband over the crown and both earcups, so the hero still reads as the headset clerk from behind
      g.beginPath(); g.arc(hx, hy + 0.5, hr + 0.9, Math.PI * 1.04, Math.PI * 1.96); g.lineCap = "round"; g.lineWidth = ink(3.8); g.strokeStyle = INK; g.stroke(); g.lineWidth = 2; g.strokeStyle = "#c4ecff"; g.stroke();
      ellipse(g, hx - hr * 1.0, hy + 1.2, 2.8, 3.6, "#c4ecff", INK, 1.2); ellipse(g, hx + hr * 1.0, hy + 1.2, 2.8, 3.6, "#c4ecff", INK, 1.2);
    }
  }
  g.save(); g.beginPath(); g.ellipse(hx, hy - 0.5, hr + 0.2, hr * 1.04, 0, 0, Math.PI * 2); g.clip(); // two-tone head: the shadow side (right, away from the light)
  g.fillStyle = "rgba(34,10,56,0.36)"; g.beginPath(); g.ellipse(hx + hr * 0.9, hy + hr * 0.1, hr * 0.95, hr * 1.35, 0, 0, Math.PI * 2); g.fill(); g.restore();
  g.beginPath(); g.arc(hx, hy, hr - 1, Math.PI * 1.05, Math.PI * 1.55); g.lineWidth = 1.8; g.strokeStyle = shade(L.skin, 0.5); g.stroke(); // rim light
  // near arm (+ weapon or reach)
  const nx = -side * 7.5 * sc * wide + lx, ny = shY + 3 + ly;
  if (L.arms === "reach") {
    const hx2 = fx * 12 + lx + 2, hy2 = shY + 7 + fy * 3 + ly + bob * 0.3 + 2;
    limb(g, nx, ny, hx2, hy2, L.shirt, 4.2);
    if (L.skin2) { const mx = nx + (hx2 - nx) * 0.5, my = ny + (hy2 - ny) * 0.5; limb(g, mx, my, hx2, hy2, L.skin2, 4.2); fillPoly(g, [[mx - 3, my - 2], [mx - 1, my + 2.6], [mx + 0.6, my - 1.2], [mx + 2.6, my + 2.4], [mx + 3.6, my - 2.4]], L.shirt, INK, 1); } // sleeve torn off at the elbow, bare second-green forearm
    ellipse(g, hx2, hy2, 2.8, 2.8, L.skin2 ?? L.skin, INK, 1.2);
    fillPoly(g, [[hx2 + 0.5, hy2 - 7], [hx2 + 5.5, hy2 - 7], [hx2 + 5.5, hy2 - 1], [hx2 + 0.5, hy2 - 1]], "#fff3d8", INK, 1); // coffee mug
    for (const k of [0, 1]) { const ph = (o.f / o.n) * Math.PI * 2 + k * 2.2, x0 = hx2 + 1.8 + k * 2.4; g.beginPath(); g.moveTo(x0, hy2 - 8); g.bezierCurveTo(x0 + Math.sin(ph) * 3, hy2 - 11, x0 - Math.sin(ph) * 3, hy2 - 13, x0 + Math.cos(ph) * 2, hy2 - 16.5); g.lineWidth = 1.7; g.lineCap = "round"; g.strokeStyle = "rgba(235,240,255,0.85)"; g.stroke(); } // mug steam: baked per frame, so the wisps curl as the idle loop plays
  } else {
    // held item. idle: held low (raised for NPCs); attack: raise, strike toward facing, recover; cast: raised overhead
    const hxx = -side * 9 * sc * wide + lx, hyy = hipY - 6 + ly, held = L.held ?? "sword";
    let tx, ty, hx3 = hxx, hy3 = hyy;
    if (o.anim === "cast") { hx3 = hxx + fx * 7; hy3 = shY - 2 - 8 * o.cast + ly; tx = hx3 + fx * 2; ty = hy3 - 11 - 3 * o.cast; }
    else if (o.anim === "attack") {
      if (a < 0.34) { const t = a / 0.34; tx = hxx + (-side) * 3 + fx * -2 * t; ty = hyy - 6 - 14 * t; }
      else if (a < 0.75) { const t = (a - 0.34) / 0.41; tx = hxx + fx * 17 * t - side * 2; ty = hyy - 20 + 20 * t + fy * 9 * t; }
      else { const t = (a - 0.75) / 0.25; tx = hxx + fx * 17 * (1 - t) * 0.6; ty = hyy - 2 + 6 * t; }
    } else if (L.raise) { tx = hxx + fx * 4 - side * 2; ty = hyy - 3 + o.bob * 0.4; }
    else { tx = hxx - side * 4 + fx * 3; ty = hyy + 11 + (o.anim === "walk" ? swing * 1.5 : 0); }
    if (held === "sword" || held === "binder") { tx = hx3 + (tx - hx3) * 1.3; ty = hy3 + (ty - hy3) * 1.3; }
    limb(g, nx, ny, hx3, hy3, sleeve, 4.2);
    heldItem(g, held, hx3, hy3, tx, ty, L);
    ellipse(g, hx3, hy3, 2.6, 2.6, L.skin, INK, 1.2);
    if (o.anim === "cast") { g.save(); g.globalAlpha = 0.5 + 0.4 * o.cast; ellipse(g, tx, ty, 3 + 4 * o.cast, 3 + 4 * o.cast, "#8ff3ff"); g.restore(); }
  }
}

/** The thing in the near hand: the clerk's keyboard sword, or a monster's / NPC's prop. (hx, hy) hand, (tx, ty) the far end. */
function heldItem(g, kind, hx, hy, tx, ty, L) {
  const rect = (cx, cy, w, h, fill, st = INK, lw = 1.1) => fillPoly(g, [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]], fill, st, lw);
  if (kind === "sword") {
    line(g, hx, hy, tx, ty, INK, 6.4); line(g, hx, hy, tx, ty, "#d3dcea", 4);
    for (let i = 1; i <= 4; i++) { const t = 0.2 + i * 0.18; ellipse(g, hx + (tx - hx) * t, hy + (ty - hy) * t, 1.1, 1.1, i & 1 ? "#4c5280" : "#6a72b0"); }
  } else if (kind === "binder") { // rolled-up binder club
    line(g, hx, hy, tx, ty, INK, 9); line(g, hx, hy, tx, ty, "#f0ead8", 6);
    line(g, hx + (tx - hx) * 0.55, hy + (ty - hy) * 0.55, hx + (tx - hx) * 0.7, hy + (ty - hy) * 0.7, "#3b6cf0", 6.2);
    ellipse(g, tx, ty, 3.4, 3.4, "#e4dcc4", INK, 1.2);
  } else if (kind === "clipboard") {
    rect(tx, ty, 10, 13, "#8a5a34"); rect(tx, ty + 0.6, 7.6, 10, "#f4efe0", null);
    line(g, tx - 2.4, ty - 1.5, tx + 2.4, ty - 1.5, "rgba(13,10,28,0.5)", 0.9); line(g, tx - 2.4, ty + 1.2, tx + 2.4, ty + 1.2, "rgba(13,10,28,0.5)", 0.9);
    rect(tx, ty - 6.4, 4, 2, "#c4ccd8");
  } else if (kind === "slides") { // a presentation slide with a bar chart
    rect(tx, ty, 15, 10.5, "#fffaf0"); rect(tx, ty, 15, 2.6, "#5b8cff", null);
    ty += 1.5;
    for (let i = 0; i < 3; i++) rect(tx - 4 + i * 4, ty + 2 - i * 0.9, 2.6, 3 + i * 1.8, i === 2 ? "#e0363f" : "#35a0e0", null);
  } else if (kind === "ledger") {
    rect(tx, ty, 11, 14, "#7a2030"); rect(tx + 0.6, ty, 9, 12, "#f4efe0", null);
    line(g, tx - 4.4, ty - 6.6, tx - 4.4, ty + 6.6, "#d4a64a", 1.6); line(g, tx - 2, ty - 2, tx + 3.6, ty - 2, "rgba(13,10,28,0.5)", 0.9); line(g, tx - 2, ty + 1, tx + 3.6, ty + 1, "rgba(13,10,28,0.5)", 0.9);
    line(g, tx + 5, ty + 5, tx + 8.5, ty - 2.5, "#e0363f", 1.8);
  } else if (kind === "crate") {
    rect(tx, ty, 13, 10, "#9a7648"); line(g, tx - 6.5, ty, tx + 6.5, ty, "#c9b48a", 1.6); line(g, tx, ty - 5, tx, ty + 5, "#c9b48a", 1.6);
  } else if (kind === "medkit") {
    rect(tx, ty, 12, 9.5, "#ffffff"); fillPoly(g, [[tx - 1, ty - 3.6], [tx + 1, ty - 3.6], [tx + 1, ty - 1], [tx + 3.6, ty - 1], [tx + 3.6, ty + 1], [tx + 1, ty + 1], [tx + 1, ty + 3.6], [tx - 1, ty + 3.6], [tx - 1, ty + 1], [tx - 3.6, ty + 1], [tx - 3.6, ty - 1], [tx - 1, ty - 1]], "#e0363f");
  } else if (kind === "flask") {
    rect(tx, ty - 5.5, 3.6, 4, "#d8e8f0"); ellipse(g, tx, ty, 6, 5.6, "#58d68d", INK, 1.2); ellipse(g, tx - 1.6, ty - 1.4, 1.6, 1.6, "rgba(255,255,255,0.7)");
  }
}


/** The Printer Imp: a hovering printer with a lid, angry red eyes, a paper-feed mouth, paper wings and dangling cables. */
function imp(g, L, o) {
  const { fx, fy, bob, lunge, S } = o, atk = o.anim === "attack";
  const lx = fx * lunge * 6, ly = fy * lunge * 3, hov = 15 + bob * 0.8 + (atk ? -lunge * 2 : 0);
  const fl = atk ? 0.9 - lunge * 1.6 : S; // wing flap
  const sz = L.size ?? 0.25, b = { u0: -sz, u1: sz, v0: -sz * 0.88, v1: sz * 0.88, z0: hov, h: L.bh ?? 17 };
  const Pt = (u, v, z) => [lx + (u - v) * 32, -2 + ly + (u + v) * 16 - z];
  // wings behind the body
  const by = Pt(0, 0, hov + b.h * 0.7)[1];
  for (const sp of [-1, 1]) {
    const bx = lx + sp * 7;
    const pts = [[bx, by], [bx + sp * 22, by - 15 - fl * 8], [bx + sp * 31, by - 3 - fl * 6], [bx + sp * 25, by + 7 + fl * 3], [bx + sp * 9, by + 6]];
    fillPoly(g, pts, sp > 0 ? shade(L.wing, -0.2) : L.wing, INK, 1.4);
    if (L.wingEdge) { line(g, pts[1][0], pts[1][1], pts[2][0], pts[2][1], L.wingEdge, 1.6); line(g, pts[2][0], pts[2][1], pts[3][0], pts[3][1], L.wingEdge, 1.6); }
    line(g, pts[0][0], pts[0][1], pts[1][0], pts[1][1], "rgba(13,10,28,0.5)", 0.9); line(g, pts[0][0], pts[0][1], pts[3][0], pts[3][1], "rgba(13,10,28,0.5)", 0.9);
  }
  // dangling cables
  for (let i = 0; i < 4; i++) {
    const x0 = lx - 7 + i * 4.6, y0 = -2 + ly - hov + 3 + (i & 1) * 2, sw = Math.sin(o.f / o.n * Math.PI * 2 + i * 1.4) * 2.2;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + sw, y0 + 7 + hov * 0.35, x0 + sw * 1.6, y0 + 10 + hov * 0.7);
    g.lineCap = "round"; g.strokeStyle = INK; g.lineWidth = ink(3.4); g.stroke(); g.strokeStyle = L.cable; g.lineWidth = 1.5; g.stroke();
  }
  // body, lid, paper sheet
  const side = fx > 0.3 ? "right" : "left";
  const bodyMat = { top: L.lid, left: L.body, right: shade(L.body, -0.28), rim: "#ffffff" };
  box(g, lx, -2 + ly, b, bodyMat);
  box(g, lx, -2 + ly, { u0: b.u0 - 0.03, u1: b.u1 + 0.03, v0: b.v0 - 0.03, v1: b.v1 + 0.03, z0: b.z0 + b.h, h: 4 }, { top: shade(L.lid, 0.1), left: L.lid, right: shade(L.lid, -0.25), rim: "#ffffff" });
  const [sx, sy] = Pt(0.02, 0, hov + b.h + 4);
  if (L.demon) { // two horns and a toner cartridge on the lid
    for (const k of [-1, 1]) {
      const hx0 = sx + k * 11;
      fillPoly(g, [[hx0 - k * 3, sy + 1], [hx0 + k * 2, sy + 1], [hx0 + k * 7, sy - 16], [hx0 + k * 1, sy - 6]], "#241a30", INK, 1.3);
      line(g, hx0 + k * 0.5, sy - 2, hx0 + k * 5, sy - 13, "rgba(255,120,150,0.55)", 1);
    }
    fillPoly(g, [[sx - 8, sy - 2], [sx + 7, sy - 5], [sx + 8, sy - 10], [sx - 7, sy - 7]], "#1c1830", INK, 1.2);
    fillPoly(g, [[sx - 2, sy - 3.2], [sx + 2.5, sy - 4], [sx + 3, sy - 9], [sx - 1.5, sy - 8]], L.eye, null);
    ellipse(g, sx + 8, sy - 7.5, 2.6, 3.2, "#2b2540", INK, 1.1);
    ellipse(g, sx + 8, sy - 7.5, 1.2, 1.5, L.eye);
  } else {
    fillPoly(g, [[sx - 6, sy], [sx + 5, sy - 2], [sx + 7, sy - 9], [sx - 4, sy - 7]], P.paper, INK, 1.1);
    line(g, sx - 3, sy - 3.2, sx + 3, sy - 4.2, "rgba(13,10,28,0.55)", 0.9); line(g, sx - 3, sy - 5.2, sx + 2, sy - 6, "rgba(13,10,28,0.55)", 0.9);
  }
  // face on the lit side; skipped when facing away
  if (fy > -0.2) {
    const fp = side === "right" ? (t, v) => Pt(b.u1, b.v0 + t * (b.v1 - b.v0), hov + v * b.h) : (t, v) => Pt(b.u0 + t * (b.u1 - b.u0), b.v1, hov + v * b.h);
    const quad = (pts, fill, st) => fillPoly(g, pts.map(([t, v]) => fp(t, v)), fill, st, 1);
    quad([[0.1, 0.9], [0.44, 0.76], [0.44, 0.56], [0.1, 0.64]], L.eye, INK);
    quad([[0.9, 0.9], [0.56, 0.76], [0.56, 0.56], [0.9, 0.64]], L.eye, INK);
    const open = 0.14 + 0.2 * lunge, m0 = 0.44;
    quad([[0.1, m0], [0.9, m0], [0.9, m0 - open * 1.6], [0.1, m0 - open * 1.6]], L.mouth, INK);
    for (let k = 0; k < 5; k++) { const u0 = 0.1 + k * 0.16, a = fp(u0, m0), c = fp(u0 + 0.16, m0), d = fp(u0 + 0.08, m0 - open * 0.9); fillPoly(g, [a, c, d], L.demon ? "#ff3d6e" : P.paper, null); }
    if (L.demon) { // the other flank: a CMY stripe and an LCD readout (G round)
      const ot = side === "right" ? (t, v) => Pt(b.u0 + t * (b.u1 - b.u0), b.v1, hov + v * b.h) : (t, v) => Pt(b.u1, b.v0 + t * (b.v1 - b.v0), hov + v * b.h);
      const oq = (t0, v0, t1, v1, fill, st, lw = 0.9) => fillPoly(g, [ot(t0, v0), ot(t1, v0), ot(t1, v1), ot(t0, v1)], fill, st, lw);
      ["#19d3ff", "#ff3da8", "#ffe030"].forEach((c, i) => oq(0.08 + i * 0.28, 0.06, 0.08 + (i + 1) * 0.28, 0.26, c, INK));
      oq(0.14, 0.42, 0.86, 0.86, "#0a1a24", INK, 1);
      oq(0.2, 0.62, 0.62, 0.7, "#5af0d4"); oq(0.2, 0.74, 0.46, 0.8, "#5af0d4");
      const [lx0, ly0] = ot(0.74, 0.58); ellipse(g, lx0, ly0, 1.3, 1.3, o.f % 2 ? "#ff3d6e" : "#5af0d4");
    }
    if (L.demon && lunge > 0.15) { const [mx, my] = fp(0.5, m0 - open * 0.8); g.save(); g.globalAlpha = Math.min(1, lunge * 1.4); ellipse(g, mx + fx * 5, my + fy * 2, 5 + lunge * 4, 4 + lunge * 3, "#1c1830", L.eye, 1.4); g.restore(); }
  }
}


/** Vending Machine (elite) and the Lobby stash locker: a steel box on stubby feet; the lit face is drawn on the side facing the light. */
function machine(g, L, o) {
  const { fx, fy, lunge, S } = o, locker = L.style === "locker", atk = o.anim === "attack";
  const lx = fx * lunge * 7, ly = fy * lunge * 3.5;
  const hop = locker ? 0 : o.anim === "walk" ? -Math.abs(S) * 3.2 : o.anim === "idle" ? S * 0.6 : 0;
  const base = -2 + ly + hop, u = locker ? 0.3 : 0.32, v = locker ? 0.24 : 0.27, h = locker ? 44 : 50, z0 = 4;
  const Pt = (uu, vv, z) => [lx + (uu - vv) * 32, base + (uu + vv) * 16 - z];
  // spindly arms behind the body (vending machine only)
  if (!locker) {
    const sw = o.anim === "walk" ? S * 4 : 0;
    for (const k of [-1, 1]) {
      const sx = lx + k * 18, sy = base - 26, hx = lx + k * (23 + (atk ? 3 : 0)) + fx * lunge * 9, hy = base - 8 - (atk ? lunge * 12 : 0) + sw * k;
      line(g, sx, sy, hx, hy, INK, 6.4); line(g, sx, sy, hx, hy, "#9aa3b8", 3.6);
      ellipse(g, hx, hy, 3.4, 3.4, "#c8d0e0", INK, 1.2);
    }
  }
  for (const k of [-1, 1]) { const [fx0, fy0] = Pt(k * 0.2, 0.14, 2); ellipse(g, fx0, fy0, 5, 3, "#161425", INK, 1.2); }
  const mat = { top: shade(L.body, 0.22), left: L.body, right: shade(L.body, -0.32), rim: "#ffffff" };
  box(g, lx, base, { u0: -u, u1: u, v0: -v, v1: v, z0, h }, mat);
  const right = fx > 0.3, face = right ? (t, z) => Pt(u, -v + t * 2 * v, z0 + z) : (t, z) => Pt(-u + t * 2 * u, v, z0 + z);
  const quad = (pts, fill, st, lw = 1) => fillPoly(g, pts.map(([t, z]) => face(t, z)), fill, st, lw);
  if (locker) {
    quad([[0.08, 4], [0.92, 4], [0.92, h - 6], [0.08, h - 6]], shade(L.body, 0.1), INK, 1.2); // door
    quad([[0.12, h - 18], [0.88, h - 18], [0.88, h - 9], [0.12, h - 9]], "#0f1a2a", INK, 1); // slot display
    quad([[0.18, h - 15], [0.5, h - 15], [0.5, h - 12], [0.18, h - 12]], L.eye);
    quad([[0.74, 12], [0.84, 12], [0.84, 22], [0.74, 22]], L.trim, INK, 1); // handle
    const d = face(0.4, 24); ellipse(g, d[0], d[1], 4.2, 4.2, "#c4d0ea", INK, 1.2); line(g, d[0], d[1], d[0] + 2, d[1] - 2.4, INK, 1.2);
    for (let i = 0; i < 3; i++) { const p = face(0.2 + i * 0.12, 12); ellipse(g, p[0], p[1], 1.4, 1.4, i === 1 ? L.eye : "#46506a", INK, 0.8); }
    return;
  }
  quad([[0.06, h - 8], [0.94, h - 8], [0.94, h - 2], [0.06, h - 2]], L.trim, INK, 1);   // sign strip
  quad([[0.08, 18], [0.7, 18], [0.7, h - 11], [0.08, h - 11]], L.glass, INK, 1.4);      // glass window
  const cans = ["#e0363f", "#ffc93a", "#35a0e0", "#6fe08a"];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const t0 = 0.12 + c * 0.14, z = 21 + r * 8;
    quad([[t0, z], [t0 + 0.1, z], [t0 + 0.1, z + 5.5], [t0, z + 5.5]], cans[(r + c) % 4], INK, 0.8);
  }
  // angry eyes glowing in the window
  for (const [t, k] of [[0.22, 1], [0.5, -1]]) {
    quad([[t - 0.08, h - 18], [t + 0.08, h - 18 + (k > 0 ? 0 : 2)], [t + 0.08, h - 15 + (k > 0 ? 2 : 0)], [t - 0.08, h - 15]], L.eye, INK, 0.8);
  }
  quad([[0.76, 24], [0.92, 24], [0.92, h - 11], [0.76, h - 11]], shade(L.body, -0.18), INK, 1); // keypad column
  for (let i = 0; i < 6; i++) { const p = face(0.84, 27 + i * 3.4); ellipse(g, p[0], p[1], 1, 1, i % 2 ? "#ffc93a" : L.trim); }
  quad([[0.08, 4], [0.7, 4], [0.7, 14], [0.08, 14]], atk ? "#0a0814" : "#1a1428", INK, 1.2);  // dispenser flap (gapes when it attacks)
  if (atk && lunge > 0.2) for (let i = 0; i < 3; i++) { const p = face(0.2 + i * 0.18, 4 + lunge * 3); ellipse(g, p[0], p[1], 2.4, 3, cans[i], INK, 0.9); }
  quad([[0.76, 6], [0.92, 6], [0.92, 20], [0.76, 20]], "#161425", INK, 1); // coin return
}

/**
 * The Regional Director: an original, imposing silhouette. Broad padded shoulders, slicked silver-black hair, a stern jaw and a
 * giant gavel-stapler (a mallet whose head is an oversized desk stapler) as the weapon. Phase 1 (`rage` false): a charcoal pinstripe
 * power suit, gold pocket square, crimson tie with a pin. Phase 2: jacket off, sleeves rolled, suspenders, tie loosened, hair
 * fallen forward and the eyes burning red. Pose scalars as for the humans, plus `w` (0..1) for the raised-gavel wind-up.
 */
function director(g, L, o) {
  const { fx, fy, bob, swing, lunge, a, w } = o, rage = L.rage, front = fy > -0.2, sc = 1.8, wide = 1.36;
  const suit = "#352d4c", suitL = "#493f68", suitD = "#241d34", shirt = "#f4efe0", skin = "#e8b896", gold = "#e0b04a", crim = "#b3242f";
  const legH = 15 * sc, torsoH = 20 * sc, hr = 7.2 * sc * 1.0;
  const lx = fx * lunge * 7, ly = fy * lunge * 3.5;
  const hipY = -legH + bob * 0.5, shY = hipY - torsoH, side = fx >= 0 ? -1 : 1;
  const tl = -7.8 * sc * wide * 0.78, tr = 7.8 * sc * wide * 0.78;
  // legs
  for (const k of [-1, 1]) {
    const ph = swing * k, ftx = k * 5 * sc + fx * 8 * ph, fty = fy * 4 * ph - Math.max(0, ph) * 3;
    limb(g, k * 4.2 * sc + lx * 0.2, hipY, ftx, fty - 1, k < 0 ? shade(suitD, -0.1) : suitD, 7.4 * sc * 0.8);
    ellipse(g, ftx + fx * 1.6, fty, 5.4 * sc * 0.8, 3.2 * sc * 0.8, "#120e18", INK, 1.4);
    ellipse(g, ftx + fx * 1.6 - 1, fty - 1, 2.4, 0.9, "rgba(255,255,255,0.4)");
  }
  // gavel position first: the far arm is drawn behind the torso, the weapon arm in front
  const hxx = -side * 12 * sc * 0.78 + lx, hyy = hipY - 4 + ly;
  let hx3 = hxx, hy3 = hyy, tx, ty; // hand and gavel head
  if (o.anim === "windup") { hx3 = hxx - side * 1 + fx * 3; hy3 = hipY - 6 - w * 36 + ly; tx = hx3 + fx * 2 + (-side) * 1; ty = hy3 - 16 - w * 3; }
  else if (o.anim === "attack") {
    if (a < 0.34) { const t = a / 0.34; tx = hxx - side * 3 - fx * 2 * t; ty = hyy - 16 - 22 * t; hy3 = hyy - 14 * t; }
    else if (a < 0.75) { const t = (a - 0.34) / 0.41; tx = hxx + fx * 24 * t - side * 2; ty = hyy - 38 + 40 * t + fy * 10 * t; hx3 = hxx + fx * 6 * t; hy3 = hyy - 14 + 12 * t; }
    else { const t = (a - 0.75) / 0.25; tx = hxx + fx * 24 * (1 - t) * 0.6; ty = hyy + 2 - 4 * t; }
  } else { tx = hxx - side * 5 + fx * 4; ty = hyy + 9 + (o.anim === "walk" ? swing * 2 : 0); }
  // far arm: a clenched fist at the hip (raised and pointing in the wind-up: "you are in my meeting")
  const sleeve = rage ? shirt : suit, farX = side * 12 * sc * 0.78 + lx, farY = shY + 4 + ly;
  const fHx = o.anim === "windup" ? farX + fx * 8 + side * 2 : farX + side * 3 - fx * 1, fHy = o.anim === "windup" ? shY - 4 - w * 10 : hipY - 2 + swing * 2 * -side;
  limb(g, farX, farY, fHx, fHy, shade(sleeve, -0.18), 6.2);
  if (rage) ellipse(g, fHx, fHy + 1, 3.2, 3.2, skin, INK, 1.2); else { ellipse(g, fHx, fHy + 1, 3.6, 3.6, skin, INK, 1.2); line(g, fHx - 2.6, fHy - 1.4, fHx + 2.6, fHy - 1.4, shirt, 1.6); }
  // torso
  const tori = (x0, x1, fill) => fillPoly(g, [[x0 + lx, shY + ly], [x1 + lx, shY + ly], [x1 * 0.86 + lx * 0.5, hipY + 1], [x0 * 0.86 + lx * 0.5, hipY + 1]], fill, INK, 1.7);
  if (rage) { // shirt untucked, hem hanging over the belt
    tori(tl, tr, shirt);
    fillPoly(g, [[lx + 2, shY + ly], [tr + lx, shY + ly], [tr * 0.86 + lx * 0.5, hipY + 1], [lx * 0.7 + 2, hipY + 1]], shade(shirt, -0.2));
    fillPoly(g, [[tl * 0.86 + lx * 0.5, hipY - 4], [tr * 0.86 + lx * 0.5, hipY - 4], [tr * 0.92 + lx * 0.5, hipY + 4], [tr * 0.5, hipY + 1.5], [tr * 0.1, hipY + 5], [tl * 0.4, hipY + 2], [tl * 0.9 + lx * 0.5, hipY + 4.5]], shade(shirt, -0.08), INK, 1.2);
    if (front) for (const k of [-1, 1]) { const x0 = lx + fx * 1.5 + k * 7.5; line(g, x0, shY + ly - 0.5, x0 - k * 0.5 + (k < 0 ? -1 : 1), hipY - 1, INK, 4.6); line(g, x0, shY + ly - 0.5, x0 - k * 0.5 + (k < 0 ? -1 : 1), hipY - 1, "#3a2c58", 2.6); ellipse(g, x0 - k * 0.2, hipY - 3, 1.6, 1.6, gold, INK, 0.7); } // suspenders
    else { for (const k of [-1, 1]) { line(g, lx + k * 7, shY + ly, lx + k * 5, hipY, INK, 4.6); line(g, lx + k * 7, shY + ly, lx + k * 5, hipY, "#3a2c58", 2.6); } }
  } else {
    tori(tl, tr, suit);
    if (front) {
      const cx0 = lx + fx * 1.5;
      fillPoly(g, [[cx0 - 5.5, shY + ly + 1], [cx0 + 5.5, shY + ly + 1], [cx0 + 1.4, hipY - 7], [cx0 - 1.4, hipY - 7]], shirt, INK, 1.1); // shirt V
      fillPoly(g, [[tl + lx, shY + ly], [cx0 - 5.5, shY + ly + 1], [cx0 - 1.2, hipY - 8], [tl * 0.86 + lx * 0.5, hipY + 1]], suitL, INK, 1.3); // left lapel panel
      fillPoly(g, [[tr + lx, shY + ly], [cx0 + 5.5, shY + ly + 1], [cx0 + 1.2, hipY - 8], [tr * 0.86 + lx * 0.5, hipY + 1]], suit, INK, 1.3);
      fillPoly(g, [[cx0 - 5.5, shY + ly + 1], [cx0 - 9.5, shY + ly + 9], [cx0 - 3.6, shY + ly + 12], [cx0 - 1, shY + ly + 7]], shade(suitL, 0.1), INK, 1.2); // peaked lapels
      fillPoly(g, [[cx0 + 5.5, shY + ly + 1], [cx0 + 9.5, shY + ly + 9], [cx0 + 3.6, shY + ly + 12], [cx0 + 1, shY + ly + 7]], shade(suit, 0.05), INK, 1.2);
      for (let i = 0; i < 4; i++) { const x = tl * 0.55 + i * 5.2; line(g, x + lx, shY + ly + 3, x * 0.86 + lx * 0.5, hipY - 3, "rgba(150,130,200,0.28)", 0.8); } // pinstripes
      for (let i = 0; i < 4; i++) { const x = tr * 0.2 + i * 5.2; line(g, x + lx, shY + ly + 3, x * 0.86 + lx * 0.5, hipY - 3, "rgba(150,130,200,0.2)", 0.8); }
      fillPoly(g, [[cx0 - 2, shY + ly + 2], [cx0 + 2, shY + ly + 2], [cx0 + 2.6, shY + ly + 17], [cx0, shY + ly + 21], [cx0 - 2.6, shY + ly + 17]], crim, INK, 1.1); // tie
      ellipse(g, cx0, shY + ly + 12, 1.1, 1.1, gold);
      fillPoly(g, [[tr - 9 + lx, shY + ly + 12], [tr - 3 + lx, shY + ly + 11], [tr - 3 + lx, shY + ly + 14], [tr - 9 + lx, shY + ly + 15]], "#fff6d8", INK, 0.8); // pocket square
      ellipse(g, lx + fx * 1.5 + 3, hipY - 6, 1.3, 1.3, gold, INK, 0.8); // button
    } else {
      fillPoly(g, [[lx + 1.5, shY + ly], [tr + lx, shY + ly], [tr * 0.86 + lx * 0.5, hipY + 1], [lx * 0.7 + 1.5, hipY + 1]], "rgba(20,10,50,0.22)");
      line(g, lx, shY + ly + 3, lx * 0.6, hipY + 1, "rgba(0,0,0,0.5)", 1.2); // back seam
      for (let i = 0; i < 6; i++) { const x = tl * 0.75 + i * 5.4; line(g, x + lx, shY + ly + 3, x * 0.86 + lx * 0.5, hipY - 3, "rgba(150,130,200,0.22)", 0.8); }
    }
  }
  // padded shoulders, the silhouette's signature (gold-piped epaulettes on the jacket; bare rolled-sleeve shoulders in phase 2)
  for (const k of [-1, 1]) {
    const sx = k * 7.8 * sc * wide * 0.78 + lx, sy = shY + ly + 1;
    if (!rage) { fillPoly(g, [[sx - k * 8, sy + 2], [sx - k * 3, sy - 4.5], [sx + k * 4.5, sy - 2.5], [sx + k * 7, sy + 5], [sx + k * 2, sy + 8]], k < 0 ? suitL : suit, INK, 1.5); line(g, sx - k * 5, sy - 3.4, sx + k * 4, sy - 1.6, gold, 1.6); }
    else ellipse(g, sx, sy + 1.5, 6, 5.2, k < 0 ? shirt : shade(shirt, -0.2), INK, 1.4);
  }
  line(g, tl + lx + 1, shY + ly - 0.5, tr + lx - 1, shY + ly - 0.5, shade(rage ? shirt : suitL, 0.4), 1.2);
  // head
  const hx = lx + fx * 2.6, hy = shY - hr + 3.5 + ly + bob * 0.5 + fy * 0.8;
  limb(g, lx + fx * 1.2, shY + 2 + ly, hx, hy + hr * 0.6, skin, 7);
  if (rage && front) { // open collar and a loosened tie hanging off to one side
    fillPoly(g, [[lx - 6 + fx, shY + ly + 1], [lx + 6 + fx, shY + ly + 1], [lx + 3 + fx, shY + ly + 6], [lx - 3 + fx, shY + ly + 6]], skin);
    fillPoly(g, [[lx - 8, shY + ly], [lx - 2, shY + ly], [lx - 1, shY + ly + 5]], shirt, INK, 1); fillPoly(g, [[lx + 8, shY + ly], [lx + 2, shY + ly], [lx + 1, shY + ly + 5]], shirt, INK, 1);
    fillPoly(g, [[lx + fx * 2 + 1, shY + ly + 4], [lx + fx * 2 + 5, shY + ly + 6], [lx + fx * 2 + 9, shY + ly + 24], [lx + fx * 2 + 5.5, shY + ly + 27], [lx + fx * 2 + 2, shY + ly + 13]], crim, INK, 1.1);
  }
  const jaw = [[hx - hr * 0.95, hy], [hx + hr * 0.95, hy], [hx + hr * 0.7, hy + hr * 1.0], [hx + hr * 0.2, hy + hr * 1.25], [hx - hr * 0.2, hy + hr * 1.25], [hx - hr * 0.7, hy + hr * 1.0]];
  ellipse(g, hx, hy, hr, hr * 1.05, skin, INK, 1.8);
  fillPoly(g, jaw, skin, INK, 1.8); ellipse(g, hx, hy, hr - 0.4, hr * 1.02, skin); // squared jaw
  const hair = rage ? "#3b3040" : "#2a2433", streak = rage ? "#8a7c9a" : "#b9b4c8";
  if (front) {
    const ex = hx + fx * 3.4, ey = hy + 1.2;
    if (rage) {
      ellipse(g, ex - 3.4, ey, 4.4, 3.6, "rgba(255,60,40,0.35)"); ellipse(g, ex + 3.4, ey, 4.4, 3.6, "rgba(255,60,40,0.35)");
      fillPoly(g, [[ex - 6, ey - 2.4], [ex - 1, ey - 0.6], [ex - 1.4, ey + 1.8], [ex - 5.4, ey + 1]], "#ff3a2a", INK, 1); fillPoly(g, [[ex + 6, ey - 2.4], [ex + 1, ey - 0.6], [ex + 1.4, ey + 1.8], [ex + 5.4, ey + 1]], "#ff3a2a", INK, 1);
      ellipse(g, ex - 3, ey, 0.9, 0.9, "#fff0d0"); ellipse(g, ex + 3, ey, 0.9, 0.9, "#fff0d0");
      fillPoly(g, [[ex - 4.6, ey + 5.4], [ex + 4.6, ey + 5.4], [ex + 4, ey + 8], [ex - 4, ey + 8]], "#3a0f18", INK, 1.1); for (let i = -1; i <= 2; i++) line(g, ex + i * 2.1 - 0.5, ey + 5.6, ex + i * 2.1 - 0.5, ey + 7.8, "#f4efe0", 0.9); // clenched teeth
    } else {
      fillPoly(g, [[ex - 5.8, ey - 1.8], [ex - 1, ey - 0.4], [ex - 1.6, ey + 1.2], [ex - 5.2, ey + 0.8]], "#fff6d8", INK, 1); fillPoly(g, [[ex + 5.8, ey - 1.8], [ex + 1, ey - 0.4], [ex + 1.6, ey + 1.2], [ex + 5.2, ey + 0.8]], "#fff6d8", INK, 1);
      ellipse(g, ex - 3.2, ey, 1.1, 1.1, "#1a1020"); ellipse(g, ex + 3.2, ey, 1.1, 1.1, "#1a1020");
      line(g, ex - 1.8, ey + 6, ex + 2.2, ey + 5.6, INK, 1.4); // flat, cold mouth
    }
    line(g, ex - 6.4, ey - 4.4, ex - 0.6, ey - 2, INK, 1.9); line(g, ex + 6.4, ey - 4.4, ex + 0.6, ey - 2, INK, 1.9); // heavy brows
    // slicked-back hair with a silver streak: a sweeping cap, no fringe
    g.beginPath(); g.ellipse(hx - fx * 0.5, hy - 2.4, hr + 0.8, hr * 0.82, 0, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(hx + hr * 0.7, hy - hr * 0.25); g.lineTo(hx - hr * 0.7, hy - hr * 0.25); g.closePath(); g.fillStyle = hair; g.fill(); g.lineWidth = ink(1.7); g.strokeStyle = INK; g.stroke();
    for (const k of [-3, 0, 3]) { g.beginPath(); g.moveTo(hx + k - 1, hy - hr * 0.5); g.quadraticCurveTo(hx + k + 1.5, hy - hr * 0.95, hx + k + 4.5, hy - hr * 1.1); g.lineWidth = 0.9; g.strokeStyle = streak; g.stroke(); }
    if (rage) for (const [k, l] of [[-5, 4.4], [0.5, 3.2], [5.5, 4]]) { g.beginPath(); g.moveTo(hx + k - 1.6, hy - hr * 0.72); g.quadraticCurveTo(hx + k + 2.4, hy - hr * 0.3, hx + k + (k < 0 ? -1 : 1), hy - hr * 0.72 + l * 1.5); g.quadraticCurveTo(hx + k - 1, hy - hr * 0.35, hx + k - 3.4, hy - hr * 0.7); g.closePath(); g.fillStyle = hair; g.fill(); g.lineWidth = ink(1); g.strokeStyle = INK; g.stroke(); } // locks fall forward
  } else {
    ellipse(g, hx, hy - 0.6, hr + 0.5, hr * 1.04, hair, INK, 1.8);
    for (const k of [-4, -1, 2, 5]) { g.beginPath(); g.moveTo(hx + k, hy - hr * 0.8); g.quadraticCurveTo(hx + k * 1.3, hy, hx + k * 0.8, hy + hr * 0.7); g.lineWidth = 0.9; g.strokeStyle = streak; g.stroke(); }
    ellipse(g, hx - hr * 0.98, hy + 1, 2, 3, skin, INK, 1.2); ellipse(g, hx + hr * 0.98, hy + 1, 2, 3, skin, INK, 1.2); // ears
  }
  g.beginPath(); g.arc(hx, hy, hr - 1, Math.PI * 1.05, Math.PI * 1.55); g.lineWidth = 1.2; g.strokeStyle = shade(skin, 0.45); g.stroke();
  // weapon arm and the gavel-stapler
  const nx = -side * 7.8 * sc * wide * 0.78 + lx, ny = shY + 4 + ly;
  limb(g, nx, ny, hx3, hy3, sleeve, 6.6);
  if (rage) { limb(g, hx3 + (nx - hx3) * 0.5, hy3 + (ny - hy3) * 0.5, hx3, hy3, skin, 5.4); } // rolled sleeve: bare forearm
  gavel(g, hx3, hy3, tx, ty, rage, o);
  ellipse(g, hx3, hy3, 3.6, 3.6, skin, INK, 1.3);
}

/** The gavel-stapler: a turned wooden handle ending in an oversized desk stapler laid across it as the mallet head. */
function gavel(g, hx, hy, tx, ty, rage, o) {
  const ang = Math.atan2(ty - hy, tx - hx), HL = 30, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const ex = hx + ux * HL, ey = hy + uy * HL; // the head's centre: a long turned handle, so the stapler reads as a mallet
  line(g, hx - ux * 6, hy - uy * 6, ex, ey, INK, 9.4); line(g, hx - ux * 6, hy - uy * 6, ex, ey, "#8a4526", 6); line(g, hx - ux * 5, hy - uy * 5 - 1.2, ex, ey - 1.2, "#c8743c", 1.6);
  for (const t of [0.3, 0.62]) { const rx = hx + (ex - hx) * t, ry = hy + (ey - hy) * t; line(g, rx - nx * 3.6, ry - ny * 3.6, rx + nx * 3.6, ry + ny * 3.6, INK, 4.4); line(g, rx - nx * 3.4, ry - ny * 3.4, rx + nx * 3.4, ry + ny * 3.4, "#e0b04a", 2.4); } // brass bands
  ellipse(g, hx - ux * 6, hy - uy * 6, 3.4, 3.4, "#e0b04a", INK, 1.1); // pommel
  // stapler head: base plate, arm, hinge, the staple slot; drawn crosswise (perpendicular to the handle)
  const L = 16, T = 6.4, q = (a, b) => [ex + nx * a + ux * b, ey + ny * a + uy * b];
  fillPoly(g, [q(-L, -T), q(L, -T), q(L, T * 0.2), q(-L, T * 0.2)], "#9b1d2c", INK, 1.5);          // red base plate
  fillPoly(g, [q(-L, -T * 0.2), q(L, -T * 0.2), q(L, -T * 2.1), q(-L, -T * 2.1)], "#cfd7e8", INK, 1.5); // steel arm
  fillPoly(g, [q(-L + 1, -T * 1.8), q(L - 1, -T * 1.8), q(L - 1, -T * 2.1), q(-L + 1, -T * 2.1)], "rgba(255,255,255,0.7)");
  fillPoly(g, [q(-L, -T * 0.2), q(L, -T * 0.2), q(L, T * 0.2), q(-L, T * 0.2)], "#1a1428");               // the slot
  for (let i = -2; i <= 2; i++) { const [px, py] = q(i * 4.6, T * 0.5); line(g, px, py, px + ux * 2.4, py + uy * 2.4, "#e8eef8", 1); } // staple teeth
  const [cx, cy] = q(-L, -T * 1.1); ellipse(g, cx, cy, 1.9, 1.9, "#7a8499", INK, 1); const [dx, dy] = q(L, -T * 1.1); ellipse(g, dx, dy, 1.9, 1.9, "#7a8499", INK, 1);
  if (rage || o.anim === "windup") { const [gx, gy] = q(0, -T * 2.4); g.save(); g.globalAlpha = rage ? 0.5 : 0.3 + 0.25 * o.w; ellipse(g, gx, gy, 6 + o.w * 2, 4 + o.w * 2, rage ? "#ff5a3a" : "#ffd24a"); g.restore(); }
}

/** Draw one character frame at the origin. type: 'clerk' | monster id. */
export function drawFigure(g, type, anim, dir, f) {
  const L = LOOKS[type] ?? LOOKS["temp-worker"], o = pose(anim, dir, f); // an unknown type (new content before its look exists) draws as a stand-in instead of breaking the atlas build
  g.save();
  if (anim === "death") {
    // fall over sideways, pivoting on the feet
    const s = o.fx >= 0 ? 1 : -1;
    g.translate(-s * o.p * 26, 0); g.rotate(s * o.p * 1.5); g.translate(0, o.p * 3);
    o.anim = "idle"; o.bob = 0; o.swing = 0; o.lunge = 0;
  }
  if (anim === "idle") o.bob = o.S * (L.breath ?? (HERO_IDS.includes(type) ? 2 : 0.9)); // idle breathing: 2 px bob on the hero and the manager (reads at 1x), 0.9 on the rest
  if (HERO_IDS.includes(type)) hero(g, type, o);
  else if (type.startsWith("ally.")) ally(g, type, o);
  else (L.kind === "imp" ? imp : L.kind === "machine" ? machine : L.kind === "director" ? director : human)(g, L, o);
  g.restore();
}
