// Ground tiles and wall blocks for the open-plan theme. One self-contained function per sprite key family.
import { palette as P } from "./palette.js";
import { poly, fillPoly, shade, line, ellipse, ink } from "../../draw/shapes.js";
import { fillTex } from "../../draw/textures.js";

const W = 64, H = 32;

const clipDiamond = (g, cx, cy, hw, hh) => { poly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]]); g.clip(); };

/**
 * Carpet / lino floor diamond. Variants 0-2 are clean: plain, inset panel, seam stripe. Variants 3-5 carry
 * baked grime: scuffs, a coffee stain, a blood smear (decals live in the static layer, never per frame).
 * 1px bleed hides seams between tiles.
 */
const themeOf = (theme) => P.themes[theme] ?? null;
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

/** Kind-specific floor pattern for the lobby and basement themes (drawn over the base fill). */
function kindDeco(g, kind, v, theme, b, cx, cy, hw, hh) {
  const quad = (s, ox, oy, fill) => fillPoly(g, [[cx + ox, cy + oy - hh * s], [cx + ox + hw * s, cy + oy], [cx + ox, cy + oy + hh * s], [cx + ox - hw * s, cy + oy]], fill);
  if (theme === "lobby" && kind === "reception") { // marble checker with a brass inlay
    quad(0.5, 0, -hh * 0.5, b); quad(0.5, 0, hh * 0.5, b);
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    line(g, cx - hw, cy, cx + hw, cy, "rgba(212,166,74,0.28)", 0.8); line(g, cx, cy - hh, cx, cy + hh, "rgba(212,166,74,0.28)", 0.8);
    g.restore();
  } else if (theme === "lobby" && kind === "breakroom") { // lino squares
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    line(g, cx - hw * 0.5, cy - hh * 0.5, cx + hw * 0.5, cy + hh * 0.5, "rgba(10,20,26,0.35)", 1);
    line(g, cx - hw * 0.5, cy + hh * 0.5, cx + hw * 0.5, cy - hh * 0.5, "rgba(10,20,26,0.35)", 1);
    quad(0.3, 0, 0, b);
    g.restore();
  } else if (theme === "executive" && kind === "boardroom") { // plush carpet: a woven diamond lattice with a thin gold inlay
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    for (const k of [-1, 0, 1]) { line(g, cx - hw, cy + k * hh * 0.5, cx, cy + k * hh * 0.5 + hh * 0.5 + (k ? 0 : 0), "rgba(10,2,14,0.2)", 1); line(g, cx, cy + k * hh * 0.5 - hh * 0.5, cx + hw, cy + k * hh * 0.5, "rgba(10,2,14,0.2)", 1); }
    quad(0.56, 0, 0, "rgba(255,200,120,0.07)");
    if (v === 0 || v === 3 || v === 4 || v === 5) { g.strokeStyle = "rgba(224,176,74,0.28)"; g.lineWidth = 0.9; poly(g, [[cx, cy - hh * 0.62], [cx + hw * 0.62, cy], [cx, cy + hh * 0.62], [cx - hw * 0.62, cy]]); g.stroke(); }
    g.restore();
  } else if (theme === "basement" && kind === "server") { // raised floor tiles, a cold LED line and a vent
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    line(g, cx - hw * 0.5, cy - hh * 0.5, cx + hw * 0.5, cy + hh * 0.5, "rgba(4,10,20,0.55)", 1.2);
    line(g, cx - hw * 0.5, cy + hh * 0.5, cx + hw * 0.5, cy - hh * 0.5, "rgba(4,10,20,0.55)", 1.2);
    if (v === 1) { for (let i = -2; i <= 2; i++) line(g, cx + i * 4 - 6, cy + i * 2 - 3, cx + i * 4 + 2, cy + i * 2 + 1, "rgba(3,8,16,0.8)", 1.6); }
    else if (v === 2) line(g, cx - hw * 0.6, cy, cx + hw * 0.6, cy, "rgba(53,224,200,0.35)", 1.2);
    g.restore();
  } else if (theme === "basement" && kind === "boiler") { // steel grating
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    for (let i = -6; i <= 6; i++) line(g, cx + i * 5 - 8, cy - 8 + i * 0.2, cx + i * 5 + 8, cy + 8 + i * 0.2, "rgba(0,0,0,0.38)", 1.3);
    quad(0.2, 0, 0, "rgba(255,150,60,0.07)");
    g.restore();
  } else if (theme === "basement" && kind === "archive") { // paper dust
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    for (const [x, y, w] of [[-12, -2, 6], [4, 5, 5], [10, -5, 4]]) fillPoly(g, [[cx + x, cy + y], [cx + x + w, cy + y - 1.5], [cx + x + w + 1.5, cy + y + 1.2], [cx + x + 1, cy + y + 2]], "rgba(236,228,207,0.14)");
    g.restore();
  }
}

/**
 * Floor variants (G round): 0-2 clean (plain, inset panel, seam), 3-5 baked grime, 6-11 clean again with a per-tile tone drift
 * (warm / cool hue, lighter / darker) and half of them mirrored, so the repeated diamond of one material does not read as wallpaper.
 */
export const FLOOR_VARIANT_DEF = [
  { d: 0 }, { d: 1 }, { d: 2 }, { d: 3, flip: 1 }, { d: 4 }, { d: 5, flip: 1 },
  { d: 0, hue: "warm", lum: 1, flip: 1 }, { d: 1, hue: "cool", lum: -1, flip: 1 }, { d: 2, hue: "warm", lum: -1 },
  { d: 0, hue: "cool", lum: 1 }, { d: 1, hue: "warm", lum: 1, flip: 1 }, { d: 2, hue: "cool", lum: -1, flip: 1 },
];
const TONE = { warm: "rgba(255,150,90,0.09)", cool: "rgba(90,140,255,0.1)", light: "rgba(150,170,255,0.11)", dark: "rgba(2,0,14,0.2)" };

export function drawFloor(g, kind, v, theme = "open-plan", sc = 1) {
  const T = themeOf(theme), floors = T ? T.floors : P.floors, def = FLOOR_VARIANT_DEF[v] ?? FLOOR_VARIANT_DEF[0], dv = def.d;
  const [a, b] = floors[kind] ?? floors.corridor, cx = 33, cy = 17, hw = W / 2 + 0.5, hh = H / 2 + 0.5;
  const decoKind = T && (kind in floors) && kind !== "corridor" && kind !== "storage";
  const scene = P.scenes[theme] ?? P.scenes["open-plan"], tex = scene.floorTex[kind] ?? scene.floorTex.default;
  g.save();
  if (def.flip) { g.translate(2 * cx, 0); g.scale(-1, 1); } // mirrored copy: breaks the repeated diamond (the weave runs the other way too)
  fillPoly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], a);
  if (decoKind) kindDeco(g, kind, dv, theme, b, cx, cy, hw, hh);
  if (decoKind && dv >= 1 && dv <= 2 && theme === "lobby") { /* the lobby keeps its inlay pattern clean */ }
  else if (dv === 1) {
    const s = 0.62;
    fillPoly(g, [[cx, cy - hh * s], [cx + hw * s, cy], [cx, cy + hh * s], [cx - hw * s, cy]], b);
  } else if (dv === 2) {
    fillPoly(g, [[cx - hw * 0.5, cy - hh * 0.5], [cx, cy - hh], [cx + hw * 0.5, cy - hh * 0.5], [cx, cy]], b);
  } else if (dv >= 3) {
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    if (dv === 3) { // scuff marks
      g.strokeStyle = "rgba(6,4,16,0.5)"; g.lineWidth = 1.3; g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-14, -2, -3, 3], [-9, 4, 3, 8], [6, -5, 15, -1]]) { g.beginPath(); g.moveTo(cx + x0, cy + y0); g.lineTo(cx + x1, cy + y1); g.stroke(); }
    } else if (dv === 4 && theme === "basement") { // puddle with a highlight and a drip
      ellipse(g, cx - 2, cy + 1, 12, 5.4, "rgba(24,64,104,0.7)");
      ellipse(g, cx - 5, cy - 0.5, 5, 1.8, "rgba(160,210,255,0.22)");
      ellipse(g, cx + 12, cy - 4, 1.6, 0.8, "rgba(24,64,104,0.8)");
    } else if (dv === 4 && theme === "executive") { // a cigar-burn and a scuff in the pile
      ellipse(g, cx + 3, cy, 3, 1.4, "rgba(0,0,0,0.5)"); line(g, cx - 12, cy + 2, cx - 2, cy + 6, "rgba(10,2,14,0.4)", 1.4);
    } else if (dv === 4) { // coffee ring + splash
      ellipse(g, cx - 3, cy + 1, 11, 5.2, P.decal.coffee);
      ellipse(g, cx - 3, cy + 1, 7, 3.2, "rgba(0,0,0,0.25)");
      ellipse(g, cx + 12, cy - 4, 2.5, 1.2, P.decal.coffee); ellipse(g, cx + 16, cy - 1, 1.6, 0.8, P.decal.coffee);
    } else if (theme === "executive") { // spilled red wine and a scatter of dropped paper (the executive floor has no blood: the dread is in the light)
      ellipse(g, cx - 3, cy + 1, 9, 4.2, "rgba(58,10,34,0.5)"); ellipse(g, cx - 4, cy + 0.4, 4, 1.8, "rgba(110,40,80,0.3)"); ellipse(g, cx + 10, cy - 3, 1.6, 0.8, "rgba(70,6,28,0.8)");
      fillPoly(g, [[cx + 4, cy + 3], [cx + 12, cy + 1], [cx + 14, cy + 5], [cx + 6, cy + 7]], "rgba(236,228,207,0.5)");
    } else if (theme === "lobby") { // the Lobby is a safe place: a scuffed rug patch instead of blood
      ellipse(g, cx - 2, cy, 13, 5.6, "rgba(10,6,20,0.28)");
      line(g, cx - 10, cy + 1, cx + 8, cy - 1, "rgba(212,166,74,0.25)", 1);
    } else { // blood smear with drag marks
      ellipse(g, cx - 2, cy, 13, 5.6, P.decal.blood);
      ellipse(g, cx - 1, cy + 0.5, 7.5, 3.1, "rgba(0,0,0,0.3)");
      g.strokeStyle = P.decal.blood; g.lineWidth = 2.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(cx - 12, cy + 1); g.lineTo(cx - 24, cy + 7); g.stroke();
      ellipse(g, cx + 14, cy - 5, 1.8, 0.9, P.decal.blood);
    }
    g.restore();
  }
  // material texture: the pattern origin is the tile's top vertex, so the weave runs on across the seams of neighbouring tiles
  g.save(); clipDiamond(g, cx, cy, hw, hh); fillTex(g, tex[0], "T", cx, cy - H / 2, tex[1]); g.restore();
  g.restore(); // end of the mirrored drawing: the bevel keeps its light direction (up-left)
  // per-tile tone drift: some tiles a little lighter or darker, some warmer or cooler (hue, not only brightness)
  if (def.lum || def.hue) {
    g.save(); clipDiamond(g, cx, cy, hw, hh);
    if (def.lum) fillPoly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], def.lum > 0 ? TONE.light : TONE.dark);
    if (def.hue) fillPoly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], TONE[def.hue]);
    g.restore();
  }
  // soft highlight on the tile centre, then the bevel: a dark joint all round and a lit up-left edge (survives the dark grade, reads as tiles at 1x)
  fillPoly(g, [[cx, cy - hh * 0.3], [cx + hw * 0.3, cy], [cx, cy + hh * 0.3], [cx - hw * 0.3, cy]], "rgba(255,255,255,0.03)");
  g.lineJoin = "round";
  g.lineWidth = 1.2; g.strokeStyle = scene.joint ?? "rgba(8,6,20,0.55)";
  poly(g, [[cx, cy - hh + 0.5], [cx + hw - 1, cy], [cx, cy + hh - 0.5], [cx - hw + 1, cy]]); g.stroke();
  g.lineWidth = 1; g.strokeStyle = T ? T.floorEdge : P.floorEdge; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx - hw + 2, cy + 0.2); g.lineTo(cx, cy - hh + 1.4); g.lineTo(cx + hw - 2, cy + 0.2); g.stroke();
}

export function drawMarker(g, id, theme = "open-plan", sc = 1) {
  drawFloor(g, "corridor", 0, theme, sc);
  const cx = 33, cy = 17;
  if (theme === "lobby" && id === "stairs-down") { // the elevator pad: brushed steel, centre seam, a lit call arrow
    fillPoly(g, [[cx, cy - 15], [cx + 30, cy], [cx, cy + 15], [cx - 30, cy]], "#8e9bb4", P.ink, 1.4);
    fillPoly(g, [[cx, cy - 15], [cx + 30, cy], [cx + 15, cy + 7.5], [cx - 15, cy - 7.5]], "#a6b3cc");
    line(g, cx - 15, cy - 7.5, cx + 15, cy + 7.5, P.ink, 1.4);
    fillPoly(g, [[cx - 6, cy - 3], [cx + 6, cy - 3], [cx, cy + 5]], "#5af0a0", P.ink, 1);
    return;
  }
  if (id === "stairs-locked" || id === "stairs-open") { drawBossStairs(g, id === "stairs-open", cx, cy); return; }
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

/**
 * The way down from the last floor. Locked: dim steps under hazard tape (diagonal black and yellow bands across the whole tile and a
 * padlock) so it reads as shut without colour. Open: the steps lit from below with a gold frame and a stack of down chevrons.
 */
function drawBossStairs(g, open, cx, cy) {
  const col = open ? "#f0c24a" : "#6a5a70";
  for (let i = 0; i < 4; i++) {
    const t = i / 4, t2 = (i + 1) / 4, x0 = cx - 24 + 48 * t, x1 = cx - 24 + 48 * t2;
    const top = (x) => 17 - (16 - Math.abs(x - cx) * 0.5) + 4, bot = (x) => 17 + (16 - Math.abs(x - cx) * 0.5) - 4;
    fillPoly(g, [[x0, top(x0)], [x1, top(x1)], [x1, bot(x1)], [x0, bot(x0)]], i % 2 ? shade(col, -0.25) : col, P.ink, 1.2);
  }
  if (open) {
    fillPoly(g, [[cx, cy - 15], [cx + 30, cy], [cx, cy + 15], [cx - 30, cy]], null, "#ffe9a0", 1.6);
    for (let k = 0; k < 3; k++) { const y = cy - 5 + k * 5; fillPoly(g, [[cx - 7, y - 3], [cx, y + 3], [cx + 7, y - 3], [cx + 7, y - 0.4], [cx, y + 5.6], [cx - 7, y - 0.4]], k === 1 ? "#ffffff" : "#5af0a0", P.ink, 0.9); }
    return;
  }
  g.save(); poly(g, [[cx, cy - 15], [cx + 30, cy], [cx, cy + 15], [cx - 30, cy]]); g.clip();
  for (let i = -8; i <= 8; i++) { const x = cx + i * 8; fillPoly(g, [[x, cy - 18], [x + 4.5, cy - 18], [x + 4.5 - 18, cy + 18], [x - 18, cy + 18]], i & 1 ? "#14101c" : "#f0c23a"); } // hazard bands
  g.restore();
  fillPoly(g, [[cx, cy - 15], [cx + 30, cy], [cx, cy + 15], [cx - 30, cy]], null, P.ink, 1.6);
  // padlock
  g.strokeStyle = P.ink; g.lineWidth = ink(3); g.beginPath(); g.arc(cx, cy - 3, 4, Math.PI, 0); g.stroke();
  g.strokeStyle = "#d8dce8"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy - 3, 4, Math.PI, 0); g.stroke();
  fillPoly(g, [[cx - 5.5, cy - 3], [cx + 5.5, cy - 3], [cx + 5.5, cy + 4.5], [cx - 5.5, cy + 4.5]], "#c9a050", P.ink, 1.2);
  ellipse(g, cx, cy, 1.1, 1.1, P.ink);
}

/** Executive glass wall: a night skyline (towers with lit windows, a moon) behind a thin brass frame. Face-space helper `quad`. */
function cityWindow(g, pt, quad, blob, G, seed) {
  quad(pt, 0.06, 0.2, 0.94, 0.8, G.frame, P.ink, 1.2);
  quad(pt, 0.09, 0.23, 0.91, 0.77, G.sky);
  quad(pt, 0.09, 0.5, 0.91, 0.77, G.sky2);
  // moon and a few stars
  blob(pt, 0.78, 0.68, 0.035, 0.07, G.moon);
  for (const [u, v] of [[0.2, 0.7], [0.36, 0.62], [0.55, 0.72], [0.66, 0.6]]) quad(pt, u, v, u + 0.012, v + 0.025, "rgba(255,255,255,0.8)");
  // towers: [u0, u1, height]
  const towers = seed ? [[0.1, 0.26, 0.2], [0.26, 0.38, 0.32], [0.4, 0.6, 0.24], [0.6, 0.72, 0.38], [0.74, 0.9, 0.18]] : [[0.1, 0.22, 0.3], [0.24, 0.42, 0.2], [0.42, 0.52, 0.36], [0.54, 0.74, 0.22], [0.76, 0.9, 0.3]];
  towers.forEach(([u0, u1, h], i) => {
    quad(pt, u0, 0.23, u1, 0.23 + h, i & 1 ? "#141a3c" : "#10152f");
    for (let k = 0; k < 6; k++) { const u = u0 + 0.025 + (k % 3) * 0.04, v = 0.26 + Math.floor(k / 3) * 0.08 + ((i + k) % 2) * 0.03; if (u + 0.025 < u1 && v < 0.2 + h) quad(pt, u, v, u + 0.022, v + 0.035, (i + k) % 3 ? G.light : G.light2); }
  });
  // glass sheen and mullions
  quad(pt, 0.09, 0.23, 0.4, 0.77, "rgba(180,210,255,0.07)");
  quad(pt, 0.34, 0.2, 0.355, 0.8, G.frame); quad(pt, 0.64, 0.2, 0.655, 0.8, G.frame);
}

/** Wall block, drawn per neighbour mask (bit 1 = wall to N, 2 = E, 4 = S, 8 = W). */
export const WALL_H = 44;
export const WALL_W = 88, WALL_CANVAS_H = 96, WALL_CY = 62; // 12 px of padding either side and 16 below the block: the baked floor AO strips spill past the 64x32 diamond

export function drawWall(g, mask, variant = 0, theme = "open-plan", sc = 1) {
  const w = themeOf(theme)?.wall ?? P.wall, cx = WALL_W / 2, cy = WALL_CY, hw = 32, hh = 16, h = WALL_H, scene = P.scenes[theme] ?? P.scenes["open-plan"];
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
  // material overlay on a face quad: texture `tex` = [name, alpha] skewed onto the left ('L') or right ('R') plane, origin at the quad's top-left corner
  const texQuad = (pt, kind, u0, v0, u1, v1, tex) => { const o = pt(u0, v1); poly(g, [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)]); fillTex(g, tex[0], kind, o[0], o[1], tex[1]); };
  const face = (pt, base, edgeSide, kind) => {
    quad(pt, 0, 0, 1, 1, base);
    texQuad(pt, kind, 0, 0, 1, 1, scene.wallTex);
    quad(pt, 0, 0, 1, 0.13, w.base);                         // skirting
    quad(pt, 0.07, 0.2, 0.93, 0.74, shade(base, 0.1), shade(base, -0.28), 1); // wall panel
    texQuad(pt, kind, 0.07, 0.2, 0.93, 0.74, scene.panelTex);
    quad(pt, 0.07, 0.2, 0.93, 0.235, "rgba(255,255,255,0.1)"); // lit top lip of the panel
    quad(pt, 0.07, 0.715, 0.93, 0.74, "rgba(0,0,0,0.22)");    // shadow under it
    quad(pt, 0, 0.9, 1, 1, w.trim); quad(pt, 0, 0.9, 1, 0.93, w.trimDark); // orange trim
    if (theme === "executive" && variant === 1) cityWindow(g, pt, quad, blob, themeOf("executive").glass, edgeSide ? 1 : 0);
    else if (theme === "executive" && variant === 2) { // award wall: a framed certificate and a gilt shield
      quad(pt, 0.12, 0.32, 0.5, 0.7, "#e0b04a", P.ink, 1.1); quad(pt, 0.16, 0.37, 0.46, 0.65, "#f4efe0"); quad(pt, 0.2, 0.5, 0.42, 0.52, "rgba(13,10,28,0.5)"); quad(pt, 0.2, 0.56, 0.38, 0.58, "rgba(13,10,28,0.5)");
      fillPoly(g, [pt(0.6, 0.62), pt(0.86, 0.62), pt(0.86, 0.46), pt(0.73, 0.34), pt(0.6, 0.46)], "#e0b04a", P.ink, 1.1); fillPoly(g, [pt(0.65, 0.58), pt(0.81, 0.58), pt(0.81, 0.48), pt(0.73, 0.4), pt(0.65, 0.48)], "#8a1f34");
    } else if (theme === "lobby" && variant === 1) { // framed poster on the wainscot
      quad(pt, 0.3, 0.36, 0.7, 0.7, "#1a1436", P.ink, 1); quad(pt, 0.35, 0.42, 0.65, 0.64, "#e8b44a"); quad(pt, 0.35, 0.42, 0.5, 0.53, "#5b8cff");
    } else if (theme === "basement" && variant === 1) { // pipe run with brackets
      quad(pt, 0, 0.42, 1, 0.54, "#7a5a3c", P.ink, 1.1); quad(pt, 0, 0.5, 1, 0.54, "#a9784a");
      for (const u of [0.2, 0.62]) quad(pt, u, 0.36, u + 0.06, 0.6, "#2b3640", P.ink, 1);
    } else if (theme === "basement" && variant === 2) { // damp streaks
      for (const u of [0.25, 0.5, 0.78]) quad(pt, u, 0.2, u + 0.04, 0.8, "rgba(20,48,80,0.4)");
    } else if (variant === 1) { // office window onto a dusk skyline (the light shaft it casts is a static pool, world.js / light.js)
      quad(pt, 0.11, 0.26, 0.89, 0.8, "#1a2f3a", P.ink, 1.3);                       // frame
      quad(pt, 0.14, 0.3, 0.86, 0.76, "#1c2a62");                                    // sky: three dusk bands
      quad(pt, 0.14, 0.3, 0.86, 0.44, "#4a4e96"); quad(pt, 0.14, 0.44, 0.86, 0.58, "#33407f");
      for (const [u0, u1, hh2] of [[0.16, 0.3, 0.14], [0.32, 0.46, 0.2], [0.5, 0.62, 0.12], [0.66, 0.84, 0.18]]) { // skyline
        quad(pt, u0, 0.3, u1, 0.3 + hh2, "#141a3c");
        for (let k = 0; k < 4; k++) { const u = u0 + 0.025 + (k % 2) * 0.05, v = 0.33 + Math.floor(k / 2) * 0.06; if (u + 0.03 < u1 && v + 0.035 < 0.3 + hh2) quad(pt, u, v, u + 0.03, v + 0.035, (k + u0 * 10 | 0) % 2 ? "#ffd98a" : "#9fe8ff"); }
      }
      blob(pt, 0.74, 0.66, 0.045, 0.07, "#f4f0ff");                                  // moon
      quad(pt, 0.49, 0.28, 0.51, 0.78, "#1a2f3a");                                   // mullion
      quad(pt, 0.14, 0.3, 0.46, 0.76, "rgba(190,215,255,0.1)");                      // glass sheen
      quad(pt, 0.08, 0.235, 0.92, 0.27, shade(w.trim, 0.2));                          // sill
    }
    if (variant === 2 && edgeSide && theme === "open-plan") { blob(pt, 0.55, 0.55, 0.14, 0.17, "rgba(120,24,48,0.85)"); blob(pt, 0.62, 0.22, 0.04, 0.12, "rgba(120,24,48,0.85)"); blob(pt, 0.4, 0.4, 0.05, 0.06, "rgba(120,24,48,0.85)"); }
    for (const [v0, v1, al] of [[0, 0.11, 0.34], [0.11, 0.22, 0.2], [0.22, 0.34, 0.09]]) quad(pt, 0, v0, 1, v1, rgba(scene.glow, al)); // per-area wall-base glow (teal / amber / rust / burgundy)
    fillPoly(g, [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)], null, P.ink, 1.6);
  };
  // floor AO: a dark strip on the floor along the foot of every face that looks onto open floor, baked into the wall sprite (0 per frame)
  const ao = (a, b, ex, ey) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, gr = g.createLinearGradient(mx, my, mx + ex, my + ey);
    gr.addColorStop(0, "rgba(4,2,16,0.6)"); gr.addColorStop(0.5, "rgba(4,2,16,0.22)"); gr.addColorStop(1, "rgba(4,2,16,0)");
    fillPoly(g, [a, b, [b[0] + ex, b[1] + ey], [a[0] + ex, a[1] + ey]], gr);
    const gl = g.createLinearGradient(mx, my, mx + ex, my + ey); gl.addColorStop(0, rgba(scene.glow, 0.16)); gl.addColorStop(0.6, rgba(scene.glow, 0)); // the glow also washes the floor a little
    fillPoly(g, [a, b, [b[0] + ex, b[1] + ey], [a[0] + ex, a[1] + ey]], gl);
  };
  if (faceLeft) ao(L, B, -hw * 0.42, hh * 0.42);
  if (faceRight) ao(R, B, hw * 0.42, hh * 0.42);
  if (faceRight) face(rf, w.right, true, "R");
  if (faceLeft) face(lf, w.left, false, "L");
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
