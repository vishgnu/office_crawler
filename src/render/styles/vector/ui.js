// HUD pieces and effect sprites. Vessels (coffee mug = health, water-cooler jug = mana) are drawn in two parts:
// a pre-rendered frame sprite (outline, glass shine, glyph) and a live liquid fill that changes every tick.
// Shapes, glyphs and fill patterns differ (heart + bubbles vs drop + ripples), so the two never rely on colour alone.
import { palette as P } from "./palette.js";
import { INK, ellipse, fillPoly, line, shade } from "../../draw/shapes.js";

/** Reference box of each vessel sprite (logical px); the HUD scales these to the layout rect. */
export const VESSEL_REF = { health: { w: 108, h: 100 }, mana: { w: 84, h: 116 } };
const PAD = 4;
export const VESSEL_SHAPES = { health: "mug", mana: "jug" };
const LIQUID = { health: [20, 92], mana: [28, 110] }; // y range the liquid can fill (top, bottom) in ref px

/** Interior path of the vessel in reference coordinates (clip for the liquid, outline for the frame). */
function vesselPath(g, kind) {
  g.beginPath();
  if (kind === "health") { g.roundRect(8, 14, 68, 80, 12); return; }
  g.moveTo(31, 4); g.lineTo(53, 4); g.lineTo(53, 24);
  g.bezierCurveTo(53, 32, 76, 34, 76, 54); g.lineTo(76, 100);
  g.quadraticCurveTo(76, 112, 64, 112); g.lineTo(20, 112); g.quadraticCurveTo(8, 112, 8, 100);
  g.lineTo(8, 54); g.bezierCurveTo(8, 34, 31, 32, 31, 24); g.closePath();
}

/** Live liquid. (x, y, w, h) is the target rect; time in ms animates the surface and bubbles. */
export function drawVesselLive(g, kind, x, y, w, h, ratio, time) {
  const ref = VESSEL_REF[kind], [top, bot] = LIQUID[kind], bw = kind === "health" ? 76 : 84;
  g.save();
  g.translate(x, y); g.scale(w / ref.w, h / ref.h);
  vesselPath(g, kind);
  g.fillStyle = "#120e26"; g.fill();
  g.clip();
  if (ratio > 0) {
    const base = kind === "health" ? P.hp : P.mp, ys = bot - (bot - top) * ratio;
    const amp = ratio < 1 ? 1.4 : 0;
    g.beginPath(); g.moveTo(-4, bot + 4);
    for (let px = -4; px <= bw + 4; px += 6) g.lineTo(px, ys + Math.sin(time / 380 + px / 11) * amp);
    g.lineTo(bw + 4, bot + 4); g.closePath();
    g.fillStyle = base; g.fill();
    g.fillStyle = shade(base, -0.28); g.fillRect(bw * 0.62, ys - 2, bw, bot - ys + 8); // one shade band on the right
    g.fillStyle = shade(base, 0.3); g.fillRect(bw * 0.16, ys + 3, 4, Math.max(0, bot - ys - 8)); // rim-light strip
    if (kind === "health") { // bubbles rise through the coffee
      for (let i = 0; i < 4; i++) {
        const t = ((time * 0.00035 + i * 0.27) % 1), by = bot - 4 - t * (bot - ys - 6);
        if (by > ys + 2) ellipse(g, 20 + i * 15 + Math.sin(i * 3 + t * 6) * 2, by, 2 + (i & 1), 2 + (i & 1), "rgba(255,255,255,0.35)", "rgba(255,255,255,0.5)", 0.8);
      }
    } else { // ripples spread on the surface
      for (let i = 0; i < 2; i++) {
        const t = ((time * 0.0006 + i * 0.5) % 1);
        g.beginPath(); g.ellipse(bw / 2, ys + 3, 6 + t * 24, 1.6 + t * 4, 0, 0, Math.PI * 2);
        g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t)})`; g.lineWidth = 1.2; g.stroke();
      }
    }
  }
  g.restore();
}

/** Pre-rendered overlay: outline, glass shine, handle or neck, glyph. Drawn over the live fill. */
export function drawVesselFrame(g, kind) {
  g.translate(PAD, PAD);
  g.lineJoin = "round"; g.lineCap = "round";
  if (kind === "health") {
    // handle (behind the body outline)
    g.beginPath(); g.moveTo(74, 34); g.bezierCurveTo(100, 30, 100, 74, 74, 72);
    g.strokeStyle = INK; g.lineWidth = 11; g.stroke(); g.strokeStyle = "#c9c3ec"; g.lineWidth = 6; g.stroke();
    // steam
    for (const sx of [32, 50]) { g.beginPath(); g.moveTo(sx, 12); g.bezierCurveTo(sx - 6, 7, sx + 6, 4, sx, -1); g.strokeStyle = "rgba(201,195,236,0.75)"; g.lineWidth = 2.6; g.stroke(); }
  } else {
    // neck cap
    fillPoly(g, [[27, 0], [57, 0], [57, 6], [27, 6]], "#c9d6e4", INK, 2);
  }
  vesselPath(g, kind);
  g.lineWidth = 5.5; g.strokeStyle = INK; g.stroke();
  g.lineWidth = 2.6; g.strokeStyle = kind === "health" ? "#f3eefc" : "#d6e6f5"; g.stroke();
  if (kind === "health") { g.fillStyle = "#c9c3ec"; g.beginPath(); g.roundRect(8, 14, 68, 7, [12, 12, 0, 0]); g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke(); }
  vesselFx(g, kind);
  // glass shine
  g.beginPath(); g.moveTo(kind === "health" ? 16 : 15, kind === "health" ? 30 : 60); g.lineTo(kind === "health" ? 16 : 15, kind === "health" ? 70 : 92);
  g.lineWidth = 3.5; g.strokeStyle = "rgba(255,255,255,0.32)"; g.stroke();
  // glyph: heart (health) or drop (mana), white with an ink outline
  g.save();
  if (kind === "health") {
    g.translate(42, 42); g.beginPath(); g.moveTo(0, 11); g.bezierCurveTo(-18, -1, -10, -14, 0, -6); g.bezierCurveTo(10, -14, 18, -1, 0, 11); g.closePath();
  } else {
    g.translate(42, 62); g.beginPath(); g.moveTo(0, -15); g.bezierCurveTo(14, 2, 12, 14, 0, 14); g.bezierCurveTo(-12, 14, -14, 2, 0, -15); g.closePath();
  }
  g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); g.fillStyle = "#ffffff"; g.fill();
  g.restore();
}
/** Glaze (mug) and ribbed plastic (jug), shaded inside the outline (G round, item 4): a side gradient, a darker top, then stitched bands or ribs. */
function vesselFx(g, kind) {
  g.save(); vesselPath(g, kind); g.clip();
  let gr = g.createLinearGradient(8, 0, 76, 0);
  gr.addColorStop(0, "rgba(255,255,255,0.24)"); gr.addColorStop(0.3, "rgba(255,255,255,0.02)"); gr.addColorStop(0.75, "rgba(0,0,20,0.1)"); gr.addColorStop(1, "rgba(0,0,20,0.32)");
  g.fillStyle = gr; g.fillRect(0, 0, 90, 120);
  gr = g.createLinearGradient(0, 14, 0, 40); gr.addColorStop(0, "rgba(0,0,20,0.35)"); gr.addColorStop(1, "rgba(0,0,20,0)"); g.fillStyle = gr; g.fillRect(0, 14, 90, 26);
  if (kind === "health") { // stitched bands round the mug and a speckled glaze
    g.setLineDash([5, 4]); g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(8, 28); g.lineTo(76, 28); g.moveTo(8, 84); g.lineTo(76, 84); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(255,255,255,0.28)"; let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) g.fillRect(14 + rnd() * 54, 34 + rnd() * 44, 1.6, 1.6);
  } else { // ribbed plastic
    for (let k = 0; k < 7; k++) { const y = 44 + k * 10; g.fillStyle = "rgba(0,0,30,0.22)"; g.fillRect(8, y, 68, 2); g.fillStyle = "rgba(255,255,255,0.2)"; g.fillRect(8, y + 2, 68, 1.4); }
  }
  g.restore();
  const rv = (x, y) => { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fillStyle = "#e6ecfa"; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke(); };
  if (kind === "health") { rv(14, 20); rv(70, 20); rv(14, 88); rv(70, 88); } else { rv(15, 62); rv(69, 62); rv(15, 106); rv(69, 106); }
}
export const vesselFrameSize = (kind) => ({ w: VESSEL_REF[kind].w + 2 * PAD, h: VESSEL_REF[kind].h + 2 * PAD, ox: PAD, oy: PAD });
export const VESSEL_PAD = PAD;

/** Skill/belt slot frame, drawn to fill (0,0)-(w,h). */
export function drawSlot(g, w, h, active) {
  const r = Math.min(w, h) * 0.2;
  g.lineJoin = "round";
  g.beginPath(); g.roundRect(1.5, 1.5, w - 3, h - 3, r);
  g.fillStyle = active ? "#3a2f78" : P.ui.slot; g.fill();
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.roundRect(3.2, 3.2, w - 6.4, h - 6.4, r * 0.8);
  g.lineWidth = active ? 2.4 : 1.8; g.strokeStyle = active ? P.ui.xp : P.ui.slotEdge; g.stroke();
  line(g, 6, 5, w - 6, 5, "rgba(255,255,255,0.14)", 1.4);
  g.save(); g.beginPath(); g.roundRect(1.5, 1.5, w - 3, h - 3, r); g.clip(); // well shading (G round): dark top inner shadow, lit bottom lip
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0.45)"); gr.addColorStop(0.35, "rgba(0,0,0,0)"); gr.addColorStop(0.8, "rgba(255,255,255,0)"); gr.addColorStop(1, active ? "rgba(255,230,120,0.3)" : "rgba(190,180,255,0.16)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h); g.restore();
  g.fillStyle = active ? "#ffe9a0" : "#a89cf0";
  for (const [qx, qy] of [[0.17, 0.17], [0.83, 0.17], [0.17, 0.83], [0.83, 0.83]]) { g.beginPath(); g.arc(Math.round(w * qx), Math.round(h * qy), Math.max(1, w * 0.024), 0, Math.PI * 2); g.fill(); } // corner studs
}

/** Basic attack icon (keyboard strike), 48x48 box. */
export function drawIconStrike(g) {
  g.translate(24, 24);
  fillPoly(g, [[-14, 3], [14, -3], [16, 4], [-14, 9]], "#a3b3d4", INK, 1.6);
  fillPoly(g, [[-14, 3], [13, -10], [16, -4], [-14, -3]], "#d3dcea", INK, 1.6);
  for (let i = 0; i < 4; i++) ellipse(g, -8 + i * 6, -1.5 - i * 1.7, 1.6, 1.3, "#4c5280");
  ellipse(g, 15, -4, 2.8, 2.8, "#ffd05c", INK, 1.2);
}
export function drawIconPlus(g) { line(g, 24, 14, 24, 34, "rgba(201,195,236,0.8)", 3.5); line(g, 14, 24, 34, 24, "rgba(201,195,236,0.8)", 3.5); }

export function drawAlert(g) {
  // exclamation mark: ink outline, warm yellow body
  fillPoly(g, [[6, 2], [12, 2], [11, 14], [7, 14]], "#f2c230", INK, 1.8);
  ellipse(g, 9, 19, 2.6, 2.6, "#f2c230", INK, 1.8);
}

export function drawPaper(g) { fillPoly(g, [[1, 2], [7, 0], [8, 6], [2, 8]], P.paper, INK, 1); }

/** Soft contact shadow, 64x32 centred. Tinted per actor by drawing it at an alpha. */
export function drawShadow(g) {
  const grad = g.createRadialGradient(32, 16, 2, 32, 16, 31);
  grad.addColorStop(0, "rgba(6,4,20,0.95)"); grad.addColorStop(0.65, "rgba(6,4,20,0.8)"); grad.addColorStop(1, "rgba(6,4,20,0)");
  g.save(); g.translate(32, 16); g.scale(1, 0.5); g.translate(-32, -32);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64); g.restore();
}

/** Slash arc in front of the hero (drawn once per direction). */
export function drawSlash(g, dir, vec) {
  const [fx, fy] = vec;
  g.translate(24, 24);
  const a = Math.atan2(fy * 0.6, fx);
  g.beginPath(); g.arc(0, 0, 17, a - 0.9, a + 0.9);
  g.lineWidth = 6; g.strokeStyle = "#ffd24a"; g.lineCap = "round"; g.stroke();
  g.beginPath(); g.arc(0, 0, 17, a - 0.85, a + 0.85);
  g.lineWidth = 3.4; g.strokeStyle = "#ffffff"; g.stroke();
}
