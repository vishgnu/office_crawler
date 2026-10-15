// R5 class heroes (in-world): Facilities Manager, Sales Rep, IT Wizard, plus the two summoned allies. Same canvas, feet origin, pose scalars and ink style
// as characters.js (the S1 hero), ported from docs/product/variants/character-select/figures.js (front-on) to the 8 isometric facings.
// Identity must survive at ~60 px: FM = wide, hard hat, hi-vis vest, a long wrench; SR = slim, pink suit, headset, blonde quiff, white shoes;
// IT = hunched purple hoodie, cyan glowing laptop, dark spikes, round glasses.
import { INK, limb, ellipse, fillPoly, line, shade, ink } from "../../draw/shapes.js";
import { gearHook, worn, bodySleeve } from "../../gearparts.js";
import { secondHand } from "../../gearkit.js";

export const HERO_IDS = ["facilities-manager", "sales-rep", "it-wizard"];
/** Accent colour per class (UI tokens --class-facilities / --class-sales / --class-it). */
export const HERO_ACCENT = { "facilities-manager": "#e8782a", "sales-rep": "#e0457b", "it-wizard": "#33e0ff" };
/** head: hat top above the feet (plates and floaters); shadowR: contact shadow half-width. */
export const HERO_DIM = {
  "facilities-manager": { head: 66, shadowR: 17 },
  "sales-rep": { head: 62, shadowR: 13 },
  "it-wizard": { head: 60, shadowR: 14 },
  "ally.intern": { head: 46, shadowR: 11 },
  "ally.cone": { head: 24, shadowR: 8 },
};
export const HERO_RIMS = { "facilities-manager": "#ffe9a8", "sales-rep": "#ffd0e4", "it-wizard": "#b8f6ff", "ally.intern": "#cfe8ff", "ally.cone": "#ffd0a0" };

const rect = (g, cx, cy, w, h, fill, st = INK, lw = 1.1) => fillPoly(g, [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]], fill, st, lw);
const glow = (g, x, y, r, col, a) => { // soft additive light; the nominal colour is '#rrggbb'
  const gr = g.createRadialGradient(x, y, 0, x, y, r), c = col.slice(1).match(/../g).map((h) => parseInt(h, 16)).join(",");
  gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
  g.save(); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
};

const SPEC = {
  "facilities-manager": { sc: 1.12, wide: 1.5, legH: 14, torsoH: 21, head: 8.6, skin: "#c98a5e", shirt: "#46618c", pants: "#34456e", shoe: "#5a3a28", shoeW: 4.8 },
  "sales-rep": { sc: 1.04, wide: 0.82, legH: 18, torsoH: 18, head: 9.4, skin: "#f6c49c", shirt: "#fdf6e4", pants: "#e0457b", shoe: "#f4ecd8", shoeW: 3.8 },
  "it-wizard": { sc: 1.0, wide: 1.1, legH: 15, torsoH: 19, head: 8.8, skin: "#e8b48a", shirt: "#6a4cd0", pants: "#2c3a6a", shoe: "#f4ecd8", shoeW: 4.2 },
};

/** Wrench: red grip, steel shaft, big open-jaw head. (hx, hy) the hand, (tx, ty) the head end. */
function wrench(g, hx, hy, tx, ty) {
  const dx = tx - hx, dy = ty - hy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux;
  line(g, hx - ux * 3, hy - uy * 3, tx, ty, INK, 7.6); line(g, hx - ux * 3, hy - uy * 3, tx, ty, "#d3dcea", 5);
  line(g, hx - ux * 3, hy - uy * 3, hx + dx * 0.42, hy + dy * 0.42, INK, 7.6); line(g, hx - ux * 3, hy - uy * 3, hx + dx * 0.42, hy + dy * 0.42, "#d83a2c", 5.2);
  const cx = tx + ux * 2.5, cy = ty + uy * 2.5;
  ellipse(g, cx, cy, 6.6, 6.6, "#d3dcea", INK, 1.5);
  fillPoly(g, [[cx + px * 2.4 + ux * 1, cy + py * 2.4 + uy * 1], [cx + px * 2.4 + ux * 8, cy + py * 2.4 + uy * 8], [cx - px * 2.4 + ux * 8, cy - py * 2.4 + uy * 8], [cx - px * 2.4 + ux * 1, cy - py * 2.4 + uy * 1]], "#1a1530", null);
  ellipse(g, cx - px * 2.2 - ux * 2, cy - py * 2.2 - uy * 2, 1.6, 1.6, "rgba(255,255,255,0.7)");
}

function stapler(g, hx, hy, ang) {
  g.save(); g.translate(hx, hy); g.rotate(ang);
  fillPoly(g, [[-3, -3], [10, -4.6], [11, -0.8], [-2, 1.6]], "#d83a2c", INK, 1.3);
  fillPoly(g, [[-3, -3], [10, -4.6], [10.4, -3.2], [-2.6, -1.6]], "#8793ae", INK, 0.8);
  g.restore();
}

function card(g, x, y, ang, sc = 1, alpha = 1) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc); g.globalAlpha = alpha;
  fillPoly(g, [[-4.6, -3], [4.6, -3], [4.6, 3], [-4.6, 3]], "#fdf6e4", INK, 1);
  g.fillStyle = "#e0457b"; g.fillRect(-3.2, -1.6, 3, 1.2); g.fillRect(-3.2, 0.4, 6, 0.9);
  g.restore();
}

function laptop(g, x, y, open, front, pulse) {
  // x,y: hinge point (bottom centre of the screen). The screen faces the viewer in front views; the back of the lid (with a glowing logo) otherwise.
  glow(g, x, y - 7, 19, "#33e0ff", 0.2 + 0.08 * pulse);
  const w = 18, h = 13 * open;
  fillPoly(g, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 1, y - h], [x - w / 2 + 1, y - h]], "#8793ae", INK, 1.5);
  if (front) {
    fillPoly(g, [[x - w / 2 + 2, y - 1.6], [x + w / 2 - 2, y - 1.6], [x + w / 2 - 2.6, y - h + 1.6], [x - w / 2 + 2.6, y - h + 1.6]], "#33e0ff", null);
    g.fillStyle = "#0b3d52";
    for (let k = 0; k < 3; k++) g.fillRect(x - 5.4, y - h + 3.2 + k * 2.8 * open, [7, 10, 5][k], 1.3);
  } else { ellipse(g, x, y - h * 0.5, 2.3, 2.3, "#33e0ff", null); }
  fillPoly(g, [[x - w / 2 - 1.5, y], [x + w / 2 + 1.5, y], [x + w / 2 + 3, y + 2.6], [x - w / 2 - 3, y + 2.6]], "#aeb8cf", INK, 1.2);
}

/**
 * Painters share one signature: (g, id, o) with o from characters.js pose(). `G` (R8, ADR-0008) is the optional gear state from gearparts.js makeGear():
 * absent or with nothing worn, no hook does anything and the draw is the pre-R8 sprite call for call (test/render-r8-gear.test.js).
 */
export function hero(g, id, o, G = null) {
  const K = SPEC[id], { fx, fy, bob, swing, lunge, a } = o, front = fy > -0.2, sc = K.sc, wide = K.wide;
  const isFM = id === "facilities-manager", isSR = id === "sales-rep", isIT = id === "it-wizard";
  const lx = fx * lunge * 5, ly = fy * lunge * 2.5, hunch = isIT ? 2.4 : 0;
  const hipY = -K.legH * sc + bob * 0.4, shY = hipY - K.torsoH * sc + (isIT ? 2 : 0);
  const side = fx >= 0 ? -1 : 1, pulse = 0.5 + 0.5 * Math.sin((o.f / o.n) * Math.PI * 2 * (o.anim === "idle" ? 1 : 2));
  const hw = 7.5 * sc * wide; // torso half width
  // near arm + the class item: hand and item-tip positions (numbers only; drawn further down). Hoisted so gear behind the body can use them.
  const nx = -side * (hw - 0.5) + lx, ny = shY + 3 + ly;
  const hxx = -side * (hw + 1.6) + lx, hyy = hipY - 5 + ly;
  let hx3 = hxx, hy3 = hyy, tx, ty;
  const ahead = (k) => fx * k, adown = (k) => fy * k;
  if (isFM) {
    // wrench: idle shouldered, walk bobs, attack: raise, slam, recover; cast: overhead ground slam pose
    if (o.anim === "cast") { hx3 = hxx + fx * 6; hy3 = shY - 2 - 5 * o.cast + ly; tx = hx3 + fx * 3 - side * 1; ty = hy3 - 12 - 2 * o.cast; }
    else if (o.anim === "attack") {
      if (a < 0.34) { const t = a / 0.34; tx = hxx + (-side) * 4 - fx * 3 * t; ty = hyy - 10 - 20 * t; }
      else if (a < 0.75) { const t = (a - 0.34) / 0.41; tx = hxx + fx * 20 * t - side * 2; ty = hyy - 30 + 31 * t + fy * 10 * t; }
      else { const t = (a - 0.75) / 0.25; tx = hxx + fx * 20 * (1 - t) * 0.6; ty = hyy - 2 + 8 * t; }
    } else { tx = hxx - side * 6 + fx * 2; ty = hyy - 24 + (o.anim === "walk" ? swing * 1.8 : o.bob * 0.6); }
  } else if (isSR) {
    if (o.anim === "cast") { hx3 = hxx + fx * 7; hy3 = shY - 3 - 8 * o.cast + ly; tx = hx3; ty = hy3 - 4; }
    else if (o.anim === "attack") { const t = Math.sin(Math.min(1, a / 0.75) * Math.PI * 0.6); hx3 = hxx + fx * 12 * t; hy3 = hyy - 12 * t + fy * 6 * t; tx = hx3; ty = hy3; }
    else { hx3 = hxx; hy3 = hyy - 2 + (o.anim === "walk" ? swing * 1.5 : 0); tx = hx3; ty = hy3; }
  } else {
    if (o.anim === "cast") { hx3 = hxx + fx * 8; hy3 = shY - 4 - 10 * o.cast + ly; }
    else if (o.anim === "attack") { const t = Math.sin(Math.min(1, a / 0.75) * Math.PI * 0.6); hx3 = hxx + fx * 14 * t; hy3 = hyy - 14 * t + fy * 6 * t; }
    else { hx3 = hxx; hy3 = hyy - 4 + (o.anim === "walk" ? swing * 1.5 : o.bob * 0.6); }
    tx = hx3; ty = hy3;
  }
  // anchors for the gear parts (only built when gear is worn)
  const wornW = worn(G, "weapon"), behind = !front && o.anim !== "attack" && o.anim !== "cast";
  const A = G ? { id, sc, front, fx, fy, side, lx, ly, hipY, shY, hw, wide, behind, skin: K.skin, shoeW: K.shoeW, anim: o.anim, f: o.f, n: o.n, near: [hx3, hy3], tip: [tx, ty], far: null, head: null, leg: null, two: !!wornW?.two, wdir: null, hook: "", legW: (isFM ? 6.4 : isSR ? 4.4 : 5.2) * sc, ns: [nx, ny], fs: [side * (hw - 0.5) + lx, shY + 3], taper: 0, cx0: 0 } : null;
  if (A) { // weapon direction: along hand -> tip for the wrench; upright (swinging forward in attack) for the card and laptop classes
    let wx = tx - hx3, wy = ty - hy3;
    if (Math.hypot(wx, wy) < 2) { if (o.anim === "attack" && a > 0.2) { wx = fx * 0.9; wy = -0.3 + fy * 0.4; } else { wx = fx * 0.4 - side * 0.3; wy = -1; } }
    const wl = Math.hypot(wx, wy) || 1; A.wdir = [wx / wl, wy / wl];
  }
  // legs
  for (const k of [-1, 1]) {
    const ph = swing * k, ftx = k * 3.8 * sc * (isFM ? 1.25 : 1) + fx * 6 * ph, fty = fy * 3 * ph - Math.max(0, ph) * 2;
    limb(g, k * 3.6 * sc * (isFM ? 1.3 : 1) + lx * 0.2, hipY, ftx, fty - 1, k < 0 ? shade(K.pants, -0.36) : K.pants, (isFM ? 6.4 : isSR ? 4.4 : 5.2) * sc);
    if (A) { A.leg = { x: ftx, y: fty, k, hx: k * 3.6 * sc * (isFM ? 1.3 : 1) + lx * 0.2 }; gearHook(g, "legs", G, A); }
    ellipse(g, ftx + fx * 1.4, fty, K.shoeW * sc, 2.5 * sc, K.shoe, INK, 1.3);
    if (isIT) line(g, ftx - K.shoeW * 0.8 + fx * 1.4, fty + 1.9, ftx + K.shoeW * 0.8 + fx * 1.4, fty + 1.9, "#33e0ff", 1.3);
    if (A) gearHook(g, "feet", G, A);
  }
  // far arm behind the torso (IT: the laptop arm)
  const sleeve = (A && bodySleeve(G)) || (isFM ? K.shirt : isSR ? "#e0457b" : K.shirt); // a worn body part colours the sleeves too
  const farTo = (x, y) => limb(g, side * (hw - 0.5) + lx, shY + 3, x, y, shade(sleeve, -0.2), isFM ? 5.6 : isSR ? 3.8 : 4.6);
  let farHand = null;
  if (isIT) farHand = [side * (hw + 5) + lx + fx * 2, hipY - 7 + swing * 1.2];
  else if (isSR && o.anim === "cast") farHand = [side * 9 + lx + fx * 6, shY - 4 - 6 * o.cast];
  else farHand = [side * (hw + 1.5) + lx - fx * 1, hipY - 3 + swing * 2 * -side];
  if (A?.two) farHand = secondHand(A); // a two-handed weapon: the far arm reaches the shaft
  farTo(farHand[0], farHand[1]);
  if (A) { A.far = farHand; gearHook(g, "weaponBack", G, A); if (!front) gearHook(g, "offhand", G, A); } // behind the torso: a weapon carried at the back, an off-hand seen from behind
  // torso
  const tl = -hw, tr = hw, taper = isSR ? 2.2 : isFM ? -0.5 : 0.5;
  const torso = (col, edge = INK, lw = 1.7) => fillPoly(g, [[tl + lx, shY + ly], [tr + lx, shY + ly], [tr - taper + lx * 0.5, hipY + 1], [tl + taper + lx * 0.5, hipY + 1]], col, edge, lw);
  const half = (col) => fillPoly(g, [[lx + 1.5, shY + ly], [tr + lx, shY + ly], [tr - taper + lx * 0.5, hipY + 1], [lx * 0.7 + 1.5, hipY + 1]], col);
  const cx0 = lx + fx * 1.8;
  if (isFM) {
    torso(K.shirt);
    const vt = shY + ly + 0.5, vb = hipY - 1;
    if (front) {
      fillPoly(g, [[tl + lx, vt], [cx0 - 2.4, vt], [cx0 - 3.2, vb], [tl - taper + lx * 0.5, vb]], "#ff8a1f", INK, 1.3);
      fillPoly(g, [[cx0 + 2.4, vt], [tr + lx, vt], [tr - taper + lx * 0.5, vb], [cx0 + 3.2, vb]], "#e0701a", INK, 1.3);
      for (const yy of [vt + 7, vt + 12.5]) { line(g, tl + 1.2 + lx, yy, cx0 - 3, yy, "#f4f6d0", 2); line(g, cx0 + 3, yy, tr - 1.2 + lx, yy, "#d7dab0", 2); }
      line(g, tl + 2 + lx, vt + 0.6, tl + 3.4 + lx, vt + 6, "#f4f6d0", 2); line(g, tr - 2 + lx, vt + 0.6, tr - 3.4 + lx, vt + 6, "#d7dab0", 2);
    } else {
      fillPoly(g, [[tl + lx, vt], [tr + lx, vt], [tr - taper + lx * 0.5, vb], [tl + taper + lx * 0.5, vb]], "#ff8a1f", INK, 1.4);
      for (const yy of [vt + 7, vt + 12.5]) line(g, tl + 1.2 + lx, yy, tr - 1.2 + lx, yy, "#f4f6d0", 2);
      line(g, cx0, vt, cx0, vb, "#e0701a", 1.4);
    }
    half("rgba(20,10,50,0.28)");
    // tool belt with gold buckle, key ring and a spare tape on the hip
    fillPoly(g, [[tl + lx, hipY - 5], [tr + lx, hipY - 5], [tr - taper + lx * 0.5, hipY + 0.5], [tl + taper + lx * 0.5, hipY + 0.5]], "#6b4528", INK, 1.3);
    if (front) rect(g, cx0, hipY - 2.4, 5, 4, "#ffb81f", INK, 1);
    ellipse(g, tr - 3 + lx, hipY + 2.6, 2.4, 2.4, null, "#d3dcea", 1.4); rect(g, tr - 3 + lx, hipY + 5.4, 2.4, 4, "#8793ae", INK, 0.9);
  } else if (isSR) {
    torso("#e0457b");
    if (front) {
      fillPoly(g, [[cx0 - 4.4, shY + ly], [cx0 + 4.4, shY + ly], [cx0 + 0.3, hipY - 3]], K.shirt, INK, 1.1); // open collar
      fillPoly(g, [[cx0 - 0.2, shY + ly + 1], [cx0 + 2.2, shY + ly + 3], [cx0 + 1.6, hipY - 6], [cx0 + 0.2, hipY - 3], [cx0 - 1.2, hipY - 6], [cx0 - 1.8, shY + ly + 3]], "#ffd23a", INK, 1); // tie
      fillPoly(g, [[tl + lx, shY + ly], [cx0 - 4.4, shY + ly], [cx0 + 0.3 - 2, hipY - 3], [tl + taper + lx * 0.5, hipY + 1]], "#c0346a", INK, 1.1); // lapel panels
      fillPoly(g, [[cx0 + 4.4, shY + ly], [tr + lx, shY + ly], [tr - taper + lx * 0.5, hipY + 1], [cx0 + 2.6, hipY - 3]], "#a82a5a", INK, 1.1);
      rect(g, tr - 2.6 + lx, shY + ly + 8, 3.4, 2.6, K.shirt, INK, 0.8); // pocket square
    } else { line(g, cx0, shY + ly + 1, cx0, hipY, "#b02a5c", 1.3); half("rgba(20,10,50,0.3)"); }
    if (front) half("rgba(20,10,50,0.28)");
  } else {
    // IT hoodie: big body, kangaroo pocket, drawstrings
    torso(K.shirt);
    half("rgba(20,10,50,0.32)");
    fillPoly(g, [[tl + 1 + lx, hipY - 2], [tr - 1 + lx, hipY - 2], [tr - 3 + lx, hipY - 9], [tl + 3 + lx, hipY - 9]], "#2aa8c8", INK, 1.2); // second colour block: cyan kangaroo pocket
    fillPoly(g, [[tl + lx - 0.5, hipY - 1], [tr + lx + 0.5, hipY - 1], [tr + lx + 0.5, hipY + 3.4], [tl + lx - 0.5, hipY + 3.4]], shade(K.shirt, -0.38), INK, 1.2);
    if (front) { line(g, cx0 - 2.6, shY + ly + 2, cx0 - 3, shY + ly + 10, "#ffe9b0", 1.5); line(g, cx0 + 2.6, shY + ly + 2, cx0 + 3, shY + ly + 10, "#ffe9b0", 1.5); }
    else { // hood bunched on the back
      fillPoly(g, [[cx0 - 7, shY + ly + 1], [cx0 + 7, shY + ly + 1], [cx0 + 5, shY + ly + 13], [cx0, shY + ly + 16], [cx0 - 5, shY + ly + 13]], shade(K.shirt, -0.3), INK, 1.1);
    }
  }
  line(g, tl + lx + 1, shY + ly + 1.2, tr + lx - 1, shY + ly + 1.2, shade(isFM ? "#ff8a1f" : isSR ? "#e0457b" : K.shirt, 0.4), 1.2);
  if (A) { A.taper = taper; A.cx0 = cx0; gearHook(g, "torso", G, A); }
  // lanyard + badge for everyone but the FM (keys at the belt) -- IT cord pair
  // laptop (IT) is held on the far side, in front of the torso edge; a worn off-hand item or a two-handed weapon replaces it
  if (isIT && !worn(G, "offhand") && !wornW?.two) laptop(g, farHand[0] + (front ? side * 0 : 0), farHand[1] - 1, 1, front, pulse);
  if (A && front) gearHook(g, "offhand", G, A);
  // head
  const gearHead = worn(G, "head"), capped = gearHead && gearHead.cat !== "headset"; // a worn head part replaces the class hat / headset and covers the class hair
  const hr = K.head * 1.1, hx = lx + fx * 2.2 + fx * hunch, hy = shY - hr + 3 + ly + bob * 0.5 + fy * 0.8 + (isIT ? 3 : 0);
  if (A) A.head = { x: hx, y: hy, r: hr };
  limb(g, lx + fx * 1.2, shY + 2 + ly, hx, hy + hr * 0.6, K.skin, isFM ? 6 : 4); // neck
  if (isIT) { // hood bunched behind and around the head
    ellipse(g, hx - fx * 1.5, hy + 1.4, hr + 3.6, hr + 2.2, shade(K.shirt, -0.3), INK, 1.5);
    ellipse(g, hx - fx * 1.5 - 1, hy - 1.5, hr + 2, hr * 0.9, shade(K.shirt, -0.12), null);
  }
  ellipse(g, hx, hy, hr, hr * 1.05, K.skin, INK, 1.8);
  if (front) {
    const ex = hx + fx * 3.2, ey = hy + 0.8;
    if (isFM) {
      // round G3: white eyes with 2.5 px pupils, set below the (now thin) brim, so the face reads at 1x instead of a dark band
      ellipse(g, ex - 4.6, ey + 1.7, 3.1, 2.8, "#f6f1e4", INK, 1.1); ellipse(g, ex + 4.6, ey + 1.7, 3.1, 2.8, "#f6f1e4", INK, 1.1);
      ellipse(g, ex - 4.2 + fx * 0.6, ey + 2, 1.5, 1.95, INK); ellipse(g, ex + 5 + fx * 0.6, ey + 2, 1.5, 1.95, INK);
      ellipse(g, ex - 4.7 + fx * 0.6, ey + 1.2, 0.55, 0.6, "rgba(255,255,255,0.95)"); ellipse(g, ex + 4.5 + fx * 0.6, ey + 1.2, 0.55, 0.6, "rgba(255,255,255,0.95)");
      line(g, ex - 7, ey - 4.6, ex - 2, ey - 3.8, "#3a2a22", 1.8); line(g, ex + 2, ey - 3.8, ex + 7, ey - 4.6, "#3a2a22", 1.8);
      g.beginPath(); g.ellipse(hx + fx, hy + 4.4, hr * 0.95, hr * 0.7, 0, 0.1, Math.PI - 0.1); g.fillStyle = "#2b1d17"; g.fill(); g.lineWidth = ink(1.4); g.strokeStyle = INK; g.stroke(); // beard
      line(g, ex - 1.8, ey + 5.8, ex + 1.8, ey + 5.8, "#c98a5e", 1.2);
    } else if (isSR) {
      ellipse(g, ex - 3.9, ey, 2.5, 3.5, INK); ellipse(g, ex + 3.9, ey, 2.5, 3.5, INK); ellipse(g, ex - 4.5, ey - 1.4, 0.95, 1.1, "rgba(255,255,255,0.95)"); ellipse(g, ex + 3.3, ey - 1.4, 0.95, 1.1, "rgba(255,255,255,0.95)");
      line(g, ex - 6.4, ey - 4.6, ex - 1.6, ey - 5, "#6a4a18", 2.1); line(g, ex + 1.6, ey - 5, ex + 6.4, ey - 4.6, "#6a4a18", 2.1);
      g.beginPath(); g.moveTo(ex - 3.2, ey + 5.4); g.quadraticCurveTo(ex + 0.2, ey + 8.2, ex + 4.2, ey + 5); g.lineWidth = ink(2); g.strokeStyle = INK; g.stroke(); // grin
    } else {
      ellipse(g, ex - 4.1, ey, 4.7, 4.7, "rgba(196,236,255,0.85)", INK, 1.7); ellipse(g, ex + 4.3, ey, 4.7, 4.7, "rgba(196,236,255,0.85)", INK, 1.7);
      line(g, ex - 0.3, ey - 0.2, ex + 0.5, ey - 0.2, INK, 1.5);
      ellipse(g, ex - 4.1, ey + 0.4, 2.3, 2.9, INK); ellipse(g, ex + 4.3, ey + 0.4, 2.3, 2.9, INK); ellipse(g, ex - 4.7, ey - 0.8, 0.8, 0.9, "rgba(255,255,255,0.95)"); ellipse(g, ex + 3.7, ey - 0.8, 0.8, 0.9, "rgba(255,255,255,0.95)");
      g.beginPath(); g.moveTo(ex - 2.6, ey + 6.4); g.quadraticCurveTo(ex + 0.4, ey + 8.2, ex + 3.4, ey + 6); g.lineWidth = ink(1.9); g.strokeStyle = INK; g.stroke();
    }
  }
  g.save(); g.beginPath(); g.ellipse(hx, hy, hr, hr * 1.05, 0, 0, Math.PI * 2); g.clip(); // two-tone head: shadow side away from the light
  g.fillStyle = "rgba(34,10,56,0.36)"; g.beginPath(); g.ellipse(hx + hr * 0.9, hy + hr * 0.1, hr * 0.95, hr * 1.35, 0, 0, Math.PI * 2); g.fill(); g.restore();
  // hair / hats
  if (isFM) {
    const top = front ? 0 : 1;
    if (!front) ellipse(g, hx, hy + 1, hr + 0.5, hr * 0.95, "#2b1d17", INK, 1.5);
    if (gearHead) { if (front) { g.beginPath(); g.ellipse(hx, hy - 1.6, hr + 0.3, hr * 0.86, 0, Math.PI, 0); g.closePath(); g.fillStyle = "#2b1d17"; g.fill(); g.lineWidth = ink(1.6); g.strokeStyle = INK; g.stroke(); } } // worn head part: the class hat is off, dark hair under it
    else {
      g.beginPath(); g.ellipse(hx, hy - 2.2, hr + 1.4, hr * 0.92, 0, Math.PI, 0); g.closePath(); g.fillStyle = "#ffd23a"; g.fill(); g.lineWidth = ink(1.8); g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.ellipse(hx - 1.5, hy - 4.2, hr * 0.7, hr * 0.5, 0, Math.PI * 1.05, Math.PI * 1.6); g.lineWidth = 1.5; g.strokeStyle = "#fff3a0"; g.stroke(); // rim light
      fillPoly(g, [[hx - hr - 2.6, hy - 2.2], [hx + hr + 2.6, hy - 2.2], [hx + hr + 1.5 + (front ? fx * 3 : 0), hy - 0.9 + top * 0.4], [hx - hr - 1.5 + (front ? fx * 3 : 0), hy - 0.9 + top * 0.4]], "#f0bc2a", INK, 1.4); // brim
      rect(g, hx + fx * 0.6, hy - hr - 1.2, 4, 3.2, "#fff3a0", INK, 1); // lamp / ridge
    }
  } else if (isSR) {
    if (front) {
      g.beginPath(); g.ellipse(hx, hy - 1.5, hr + 0.4, hr * 0.78, 0, Math.PI, 0); g.fillStyle = "#f2c14e"; g.fill(); g.lineWidth = ink(1.6); g.strokeStyle = INK; g.stroke();
      if (!capped) { g.beginPath(); g.moveTo(hx - hr - 0.2, hy - 2); g.quadraticCurveTo(hx - hr * 1.1, hy - hr * 1.3, hx - 1, hy - hr * 1.38); g.quadraticCurveTo(hx + hr * 1.3, hy - hr * 1.7, hx + hr * 1.25, hy - hr * 0.7); g.lineTo(hx + hr + 0.2, hy - 2.5); g.quadraticCurveTo(hx + 2, hy - hr * 1.0, hx - hr * 0.5, hy - hr * 0.7); g.closePath();
      g.fillStyle = "#f2c14e"; g.fill(); g.lineWidth = ink(1.5); g.strokeStyle = INK; g.stroke(); // quiff
      line(g, hx - 1, hy - hr * 1.18, hx + 5, hy - hr * 1.32, "#ffe9a0", 1.3); }
    } else {
      ellipse(g, hx, hy - 0.5, hr + 0.4, hr * 1.02, "#f2c14e", INK, 1.8);
      if (!capped) { g.beginPath(); g.moveTo(hx - hr * 0.8, hy - hr * 0.6); g.quadraticCurveTo(hx - hr * 0.5, hy - hr * 1.5, hx + hr * 0.5, hy - hr * 1.45); g.quadraticCurveTo(hx + hr * 1.3, hy - hr * 1.2, hx + hr * 0.9, hy - hr * 0.5); g.closePath(); g.fillStyle = "#f2c14e"; g.fill(); g.lineWidth = ink(1.4); g.strokeStyle = INK; g.stroke(); }
      if (!gearHead) { g.beginPath(); g.arc(hx, hy + 0.5, hr + 0.9, Math.PI * 1.04, Math.PI * 1.96); g.lineCap = "round"; g.lineWidth = ink(3.8); g.strokeStyle = INK; g.stroke(); g.lineWidth = 2; g.strokeStyle = "#232a58"; g.stroke(); }
    }
    const sx = hx - fx * 1 - hr * 0.98; // headset: earcup, band, orange mic boom (off when a head part is worn)
    if (!gearHead) { ellipse(g, sx, hy + 0.5, 2.8, 3.8, "#232a58", INK, 1.2); if (!front) ellipse(g, hx + hr * 1.0, hy + 1.2, 2.8, 3.6, "#232a58", INK, 1.2); }
    if (front && !gearHead) {
      g.beginPath(); g.arc(hx, hy - 1, hr + 0.9, Math.PI * 1.1, Math.PI * 1.55); g.lineWidth = ink(2.4); g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = "#3a4488"; g.stroke();
      g.beginPath(); g.moveTo(sx, hy + 3.5); g.quadraticCurveTo(sx + 1, hy + hr * 0.95, hx + fx * 3 - 1, hy + hr * 0.78); g.lineWidth = ink(1.4); g.strokeStyle = INK; g.stroke();
      ellipse(g, hx + fx * 3 - 1, hy + hr * 0.78, 1.7, 1.5, "#ff8a1f", INK, 0.9);
    }
  } else { // IT: dark spikes
    if (capped) { if (front) { g.beginPath(); g.ellipse(hx, hy - 1.2, hr + 0.3, hr * 0.8, 0, Math.PI, 0); g.closePath(); g.fillStyle = "#2a1a40"; g.fill(); g.lineWidth = ink(1.5); g.strokeStyle = INK; g.stroke(); } else ellipse(g, hx, hy - 0.5, hr + 0.4, hr * 1.02, "#2a1a40", INK, 1.8); } // under a cap or helmet: flat hair, no spikes
    else if (front) {
      fillPoly(g, [[hx - hr - 0.4, hy - 2], [hx - hr * 0.9, hy - hr * 1.15], [hx - hr * 0.45, hy - hr * 0.8], [hx - hr * 0.2, hy - hr * 1.55], [hx + hr * 0.2, hy - hr * 0.95], [hx + hr * 0.6, hy - hr * 1.4], [hx + hr * 0.85, hy - hr * 0.8], [hx + hr + 0.4, hy - 2], [hx + hr * 0.6, hy - hr * 0.5], [hx - hr * 0.6, hy - hr * 0.55]], "#2a1a40", INK, 1.5);
    } else {
      ellipse(g, hx, hy - 0.5, hr + 0.4, hr * 1.02, "#2a1a40", INK, 1.8);
      if (!capped) fillPoly(g, [[hx - hr * 0.8, hy - hr * 0.7], [hx - hr * 0.3, hy - hr * 1.5], [hx + hr * 0.2, hy - hr * 0.95], [hx + hr * 0.6, hy - hr * 1.4], [hx + hr * 0.85, hy - hr * 0.6]], "#2a1a40", INK, 1.2);
    }
  }
  g.beginPath(); g.arc(hx, hy, hr - 1, Math.PI * 1.05, Math.PI * 1.55); g.lineWidth = 1.8; g.strokeStyle = shade(K.skin, 0.5); g.stroke(); // rim light
  if (A) gearHook(g, "head", G, A);

  // near arm + the class item (positions were computed above, before the legs)
  limb(g, nx, ny, hx3, hy3, sleeve, isFM ? 5.8 : isSR ? 3.9 : 4.8);
  if (isFM) { if (!wornW) wrench(g, hx3, hy3, tx, ty); }
  else if (isSR) {
    if (o.anim === "cast") { // a fan of business cards held overhead
      for (let k = -2; k <= 2; k++) card(g, hx3 + k * 4.6, hy3 - 7 - Math.abs(k) * -1.4 - 2, k * 0.34, 1.15);
    } else if (o.anim === "attack") { if (!wornW) stapler(g, hx3 + 2, hy3 - 1, Math.atan2(fy * 0.5, fx || 0.6) * 0.8 - 0.1 * (fx < 0 ? -1 : 1)); if (a > 0.3) for (let k = 0; k < 2; k++) card(g, hx3 + fx * (9 + k * 7), hy3 - 3 - k * 3, 0.5 + k, 0.95, 0.9 - k * 0.3); }
    else if (!wornW) { stapler(g, hx3 + fx * 2 + 0.5, hy3 - 0.5, fx < 0 ? 3.3 : -0.1 + swing * 0.1); card(g, hx3 + side * -4 - fx * 3, hy3 - 6, -0.4 + Math.sin((o.f / o.n) * 6.28) * 0.3, 1); }
  } else { // IT: free hand, glowing; cast = keycaps orbit overhead
    if (o.anim === "cast" || o.anim === "attack") {
      const k = o.anim === "cast" ? o.cast : Math.sin(Math.min(1, a / 0.75) * Math.PI * 0.6);
      glow(g, hx3, hy3 - 3, 14 + 6 * k, "#33e0ff", 0.4 + 0.25 * k);
      if (o.anim === "cast") for (let q = 0; q < 3; q++) {
        const an = (o.f / o.n) * 6.28 + q * 2.09, kx = hx3 + Math.cos(an) * 9, ky = hy3 - 10 + Math.sin(an) * 3.5;
        rect(g, kx, ky, 5.4, 5, "#4c5280", INK, 1); ellipse(g, kx, ky, 1.2, 1.2, "#33e0ff");
      } else for (let q = 0; q < 3; q++) line(g, hx3 + fx * (4 + q * 3), hy3 - 2 - q, hx3 + fx * (9 + q * 3), hy3 - 3 - q * 1.5, "#bff7ff", 1.6);
    }
    ellipse(g, hx3, hy3, 2.8, 2.8, K.skin, INK, 1.2);
    if (o.anim === "idle" || o.anim === "walk") { ellipse(g, hx3, hy3 - 0.3, 2.8, 2.8, K.skin, INK, 1.2); }
  }
  if (A) gearHook(g, "weaponFront", G, A);
  if (!isFM) ellipse(g, hx3, hy3, isSR ? 2.5 : 2.8, isSR ? 2.5 : 2.8, K.skin, INK, 1.2);
  else ellipse(g, hx3, hy3, 3.4, 3.4, K.skin, INK, 1.2);
  if (A) gearHook(g, "hands", G, A);
}

/** Summoned allies: the Summer Intern (small, lanyard, oversized mug) and the Traffic Cone decoy. Idle/walk/attack/death like the monsters. */
export function ally(g, id, o) {
  const { fx, fy, bob, swing, lunge, a } = o, front = fy > -0.2;
  if (id === "ally.cone") {
    const w = o.anim === "death" ? 0 : 1;
    ellipse(g, 0, -1, 10.5, 4.2, "#2a2a38", INK, 1.5);
    fillPoly(g, [[-8, -2], [8, -2], [3.2, -28], [-3.2, -28]], "#ff7a1f", INK, 1.8);
    fillPoly(g, [[-5.6, -13], [5.6, -13], [4.4, -18.6], [-4.4, -18.6]], "#fff3e0", null);
    fillPoly(g, [[-7, -7.4], [7, -7.4], [6.2, -2.6], [-6.2, -2.6]], shade("#ff7a1f", -0.12), null);
    line(g, -2.4, -26, -5, -4, "rgba(255,255,255,0.45)", 1.6);
    ellipse(g, 0, -28.4, 3.4, 1.4, "#e05a10", INK, 1.2);
    if (w && front) { ellipse(g, -1.5, -11.6, 0.1, 0.1, INK); }
    return;
  }
  // intern: a smaller worker, light-blue shirt, lanyard, huge coffee mug that doubles as its weapon
  const sc = 0.82, legH = 13 * sc, hipY = -legH + bob * 0.4, shY = hipY - 17 * sc, hr = 7.6;
  const lx = fx * lunge * 5, ly = fy * lunge * 2.5, side = fx >= 0 ? -1 : 1;
  for (const k of [-1, 1]) {
    const ph = swing * k, ftx = k * 3.4 * sc + fx * 5 * ph, fty = fy * 2.6 * ph - Math.max(0, ph) * 2;
    limb(g, k * 3.2 * sc + lx * 0.2, hipY, ftx, fty - 1, k < 0 ? "#2f3a58" : "#3b4a72", 4.4); ellipse(g, ftx + fx, fty, 3.2, 2, "#f4ecd8", INK, 1.1);
  }
  limb(g, side * 6 + lx, shY + 3, side * 7.4 + lx, hipY - 3, "#8fb4e8", 3.6);
  fillPoly(g, [[-6.2 + lx, shY + ly], [6.2 + lx, shY + ly], [5 + lx * 0.5, hipY + 1], [-5 + lx * 0.5, hipY + 1]], "#a9c8f4", INK, 1.5);
  if (front) {
    line(g, lx - 3.5, shY + ly + 1, lx - 2.4, shY + ly + 10, "#ffffff", 1.2); rect(g, lx - 2.4, shY + ly + 12, 5, 6, "#ffffff", INK, 1);
    rect(g, lx - 2.4, shY + ly + 11.4, 3, 1.4, "#e0457b", null);
  }
  const hx = lx + fx * 2, hy = shY - hr + 3 + ly + bob * 0.5;
  ellipse(g, hx, hy, hr, hr * 1.05, "#f3d2b6", INK, 1.6);
  if (front) { const ex = hx + fx * 3; ellipse(g, ex - 2.6, hy + 0.8, 1.2, 1.6, INK); ellipse(g, ex + 2.6, hy + 0.8, 1.2, 1.6, INK); g.beginPath(); g.arc(ex, hy + 3.4, 2.2, 0.2, Math.PI - 0.2); g.lineWidth = ink(1.1); g.strokeStyle = INK; g.stroke(); }
  g.beginPath(); g.ellipse(hx, hy - 1.4, hr + 0.4, hr * 0.78, 0, Math.PI, 0); g.fillStyle = "#6a3a22"; g.fill(); g.lineWidth = ink(1.5); g.strokeStyle = INK; g.stroke();
  if (!front) ellipse(g, hx, hy - 0.4, hr + 0.4, hr, "#6a3a22", INK, 1.5);
  // near arm + mug (attack: swing it forward and splash)
  const nx = -side * 5.8 + lx, ny = shY + 3 + ly;
  let mx = nx + fx * 4, my = hipY - 2 + ly;
  if (o.anim === "attack") { const t = Math.sin(Math.min(1, a / 0.7) * Math.PI * 0.6); mx = nx + fx * 12 * t; my = hipY - 8 - 6 * t + ly; }
  limb(g, nx, ny, mx, my, "#a9c8f4", 3.8);
  rect(g, mx, my - 3, 7, 8, "#fff3d8", INK, 1.2); line(g, mx + 3.5, my - 4, mx + 6, my - 2, INK, 2.4);
  rect(g, mx, my - 6.4, 5, 1.6, "#6a3a22", null);
  ellipse(g, mx, my + 1, 2.2, 2.2, "#f3d2b6", INK, 1);
}
