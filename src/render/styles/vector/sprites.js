// Small art: projectiles (drawn pointing along +x, rotated by the renderer), ground loot, status icons. Anchors are noted per function.
import { palette as P } from "./palette.js";
import { INK, ellipse, fillPoly, line, shade } from "../../draw/shapes.js";

export const PROJ_W = 44, PROJ_H = 28; // anchor: centre (22, 14)

/** kind: stapler | toner | slide. Drawn pointing to +x. */
export function drawProjectile(g, kind) {
  g.save(); g.translate(PROJ_W / 2, PROJ_H / 2);
  if (kind === "stapler") {
    fillPoly(g, [[-9, 1], [10, 1], [10, 5], [-9, 5]], "#3a4056", INK, 1.3);                  // base
    fillPoly(g, [[-9, -5], [9, -4], [11, 1], [-9, 1]], P.proj.stapler, INK, 1.3);            // arm
    fillPoly(g, [[-8, -4], [8, -3.2], [8, -1.8], [-8, -2.6]], "rgba(255,255,255,0.65)");      // rim light
    ellipse(g, -6, -1.6, 1.5, 1.5, "#e0363f", INK, 0.9);
    line(g, 12, 3, 17, 3, "#e8eef8", 1.4); line(g, -11, 3, -17, 3, "rgba(201,210,228,0.45)", 1.2); // staple glint and motion streak
  } else if (kind === "toner") {
    for (const [x, r, a] of [[-16, 2.2, 0.55], [-11, 3.2, 0.7], [-6, 4.2, 0.85]]) ellipse(g, x, (x % 2 ? 1 : -1), r, r, `rgba(23,19,31,${a})`);
    ellipse(g, 0, 0, 10, 10, "rgba(255,61,110,0.28)");
    ellipse(g, 1, 0, 7.4, 7, P.proj.toner, P.proj.tonerGlow, 1.6);
    ellipse(g, -1.4, -2.4, 2.4, 1.6, "rgba(255,255,255,0.55)");
    ellipse(g, 4, 2.4, 1.6, 1.6, P.proj.tonerGlow);
  } else if (kind === "slide") {
    fillPoly(g, [[-10, -7], [10, -7], [10, 7], [-10, 7]], P.proj.slide, INK, 1.4);
    fillPoly(g, [[-10, -7], [10, -7], [10, -3.4], [-10, -3.4]], P.proj.slideEdge);
    for (let i = 0; i < 3; i++) { const h = 3 + i * 2; fillPoly(g, [[-6 + i * 5, 5.4 - h], [-3 + i * 5, 5.4 - h], [-3 + i * 5, 5.4], [-6 + i * 5, 5.4]], i === 2 ? "#e0363f" : "#35a0e0", null); }
    line(g, -10, -7, 10, -7, "rgba(255,255,255,0.8)", 1);
  }
  else if (kind === "pen") { // blue ballpoint, clip and nib
    fillPoly(g, [[-11, -2.4], [7, -2.4], [11, 0], [7, 2.4], [-11, 2.4]], "#3b6cf0", INK, 1.3);
    fillPoly(g, [[7, -2.4], [11, 0], [7, 2.4]], "#f4efe0", INK, 1);
    line(g, -10, -1, 5, -1, "rgba(255,255,255,0.6)", 0.9); fillPoly(g, [[-11, -2.4], [-6, -2.4], [-6, -4.4], [-11, -4.4]], "#c4ccd8", INK, 0.9);
    line(g, -12, 0, -18, 0, "rgba(143,176,255,0.45)", 1.2);
  } else if (kind === "card") { // business card, white with a pink stripe
    fillPoly(g, [[-7, -4.6], [7, -4.6], [7, 4.6], [-7, 4.6]], "#fdf6e4", INK, 1.3);
    g.fillStyle = "#e0457b"; g.fillRect(-5.2, -2.6, 5, 1.8); g.fillRect(-5.2, 0.2, 9.6, 1.3); g.fillRect(-5.2, 2.2, 7, 1.1);
    line(g, -7, -4.6, 7, -4.6, "rgba(255,255,255,0.9)", 0.9);
  } else if (kind === "paper") { // crumpled sheet
    g.beginPath(); for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, r = i & 1 ? 5.2 : 7.2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9); } g.closePath();
    g.fillStyle = "#f4efe0"; g.fill(); g.lineWidth = 1.3; g.strokeStyle = INK; g.stroke();
    line(g, -3, -2, 2, 1, "rgba(13,10,28,0.45)", 0.9); line(g, -1, 3, 4, -2, "rgba(13,10,28,0.35)", 0.9);
  } else if (kind === "sealed") { // envelope stamped shut with a red wax seal
    fillPoly(g, [[-9, -6], [9, -6], [9, 6], [-9, 6]], "#fff3d8", INK, 1.4);
    fillPoly(g, [[-9, -6], [9, -6], [0, 1]], "#f1dcae", INK, 1.1);
    ellipse(g, 0, 1.4, 3.6, 3.6, "#e0363f", INK, 1.2); ellipse(g, -0.9, 0.5, 1.1, 1.1, "rgba(255,255,255,0.6)");
    line(g, -12, 0, -18, 0, "rgba(255,120,120,0.45)", 1.4);
  } else if (kind === "shard") { // ice crystal with a glow and a cold trail
    ellipse(g, 0, 0, 11, 8, "rgba(143,228,255,0.28)");
    fillPoly(g, [[-9, 0], [-2, -4.4], [11, 0], [-2, 4.4]], "#bff2ff", INK, 1.4);
    fillPoly(g, [[-9, 0], [-2, -4.4], [11, 0]], "#eafcff", null);
    line(g, -6, 0, 8, 0, "rgba(255,255,255,0.9)", 1); line(g, -14, -1.6, -20, -2.4, "rgba(191,242,255,0.5)", 1.4); line(g, -14, 1.6, -20, 2.4, "rgba(191,242,255,0.4)", 1.2);
  } else if (kind === "bolt") { // cyan plasma orb
    ellipse(g, 0, 0, 12, 10, "rgba(111,232,255,0.3)"); ellipse(g, 0, 0, 7, 7, "#6fe8ff", INK, 1.5); ellipse(g, 0, 0, 3.6, 3.6, "#ffffff");
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; line(g, Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a + 0.2) * 12, Math.sin(a + 0.2) * 12, "#bff7ff", 1.5); }
    line(g, -10, 0, -18, 0, "rgba(111,232,255,0.5)", 1.6);
  } else if (kind === "zap") { // short spark
    fillPoly(g, [[-8, -1.5], [-2, -3.2], [-3, -0.6], [8, -2.4], [1, 1.2], [3, 0.9], [-9, 3]], "#bff7ff", INK, 1.2);
    ellipse(g, 0, 0, 6, 5, "rgba(111,232,255,0.3)");
  }
  g.restore();
}

/** Ground loot marker: a small cardboard box. Anchor: ground point (12, 16) on a 24x22 canvas. */
export function drawLootItem(g) {
  ellipse(g, 12, 17, 9, 3.4, "rgba(0,0,0,0.3)");
  fillPoly(g, [[3, 9], [12, 6], [21, 9], [12, 13]], "#d6b27c", INK, 1.2);
  fillPoly(g, [[3, 9], [12, 13], [12, 19], [3, 15]], "#b88e56", INK, 1.2);
  fillPoly(g, [[12, 13], [21, 9], [21, 15], [12, 19]], "#8f6a3c", INK, 1.2);
  fillPoly(g, [[9, 7.4], [15, 7.4], [18, 9], [12, 11.2]], "#f1e2bf");
  line(g, 4, 8.8, 12, 6.2, "rgba(255,255,255,0.7)", 0.9);
}

/** Gold pile: n coins in stacks. Canvas 36x26, ground anchor (18, 18). */
export function drawGold(g, size) {
  const coins = { s: 3, m: 8, l: 15 }[size];
  ellipse(g, 18, 19, 8 + coins * 0.5, 3.4 + coins * 0.15, "rgba(0,0,0,0.3)");
  const spots = [[18, 17], [13, 17], [23, 17], [10, 14], [26, 14], [16, 13], [21, 13], [12, 11], [24, 11], [18, 10], [14, 8], [22, 8], [18, 5], [8, 17], [28, 17]];
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  for (let k = 0; k < coins; k++) {
    const [x, y] = spots[order[k]];
    ellipse(g, x, y + 1.6, 4.6, 2.2, "#a8851f", INK, 1);
    ellipse(g, x, y, 4.6, 2.2, "#e6c84a", INK, 1);
    ellipse(g, x - 0.8, y - 0.3, 1.8, 0.8, "#fff1a8");
  }
}

/** Muted icon: a speaker with a red slash on a dark bubble. Canvas 24x26, anchor bottom centre (12, 26). */
export function drawMuted(g) {
  fillPoly(g, [[3, 2], [21, 2], [21, 18], [14, 18], [12, 23], [10, 18], [3, 18]], "#1a1436", INK, 1.6);
  fillPoly(g, [[6, 8], [9, 8], [13, 5], [13, 15], [9, 12], [6, 12]], "#f3eefc");
  g.strokeStyle = "#f3eefc"; g.lineWidth = 1.4; g.beginPath(); g.arc(13.5, 10, 3.2, -0.9, 0.9); g.stroke();
  line(g, 5, 16, 20, 4, "#ff4a52", 2.4); 
}

/** Flee icon: a sweat drop and speed lines. Canvas 22x22, anchor bottom centre. */
export function drawFlee(g) {
  fillPoly(g, [[13, 2], [18, 11], [13, 17], [8, 11]], "#7fd4ff", INK, 1.3);
  ellipse(g, 12, 11.5, 1.6, 2.2, "rgba(255,255,255,0.7)");
  for (const y of [5, 10, 15]) line(g, 1, y, 6, y, "#e6e0ff", 1.6);
}

/** Four-point spark (impacts, level-up glints). Canvas 12x12, anchor centre. */
export function drawSpark(g) {
  fillPoly(g, [[6, 0], [7.4, 4.6], [12, 6], [7.4, 7.4], [6, 12], [4.6, 7.4], [0, 6], [4.6, 4.6]], "#fff6c8");
}

/** Green plus (heal). Canvas 12x12, anchor centre. */
export function drawPlus(g) {
  fillPoly(g, [[4.4, 0.6], [7.6, 0.6], [7.6, 4.4], [11.4, 4.4], [11.4, 7.6], [7.6, 7.6], [7.6, 11.4], [4.4, 11.4], [4.4, 7.6], [0.6, 7.6], [0.6, 4.4], [4.4, 4.4]], "#6fe08a", INK, 1);
}
