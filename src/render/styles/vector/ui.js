// HUD pieces and effect sprites. Globes are drawn live (fill level changes every tick) inside a
// pre-rendered frame sprite. Shapes differ (jug vs cup) so health and mana never rely on colour alone.
import { palette as P } from "./palette.js";
import { INK, ellipse, fillPoly, line, shade } from "../../draw/shapes.js";

export const GLOBE_REF = 60; // reference radius of the frame sprite (logical px)
export const GLOBE_SHAPES = { health: "jug", mana: "cup" };

/** Cup outline (mana): wide rim, tapered bowl, short foot. Centred on (0, 0). */
function cupPath(g, r) {
  g.beginPath();
  g.moveTo(-r * 0.95, -r * 0.8); g.lineTo(r * 0.95, -r * 0.8);
  g.quadraticCurveTo(r * 0.9, r * 0.35, r * 0.38, r * 0.7);
  g.lineTo(r * 0.38, r * 0.85); g.lineTo(-r * 0.38, r * 0.85); g.lineTo(-r * 0.38, r * 0.7);
  g.quadraticCurveTo(-r * 0.9, r * 0.35, -r * 0.95, -r * 0.8);
  g.closePath();
}

function jugPath(g, r) {
  g.beginPath();
  g.arc(0, 0.14 * r, 0.86 * r, -Math.PI * 0.36, Math.PI * 1.36, false); // body, open at the top for the neck
  g.lineTo(-r * 0.26, -r * 0.96); g.lineTo(r * 0.26, -r * 0.96);
  g.closePath();
}
const path = (g, kind, r) => (kind === "health" ? jugPath(g, r) : cupPath(g, r));

/** Live gauge: dark glass, flat liquid with one shade band and a wavy surface, sized to radius r. */
export function drawGlobe(g, kind, cx, cy, r, ratio, time) {
  g.save();
  g.translate(cx, cy);
  path(g, kind, r);
  g.fillStyle = "#12141b"; g.fill();
  g.save();
  path(g, kind, r); g.clip();
  if (ratio > 0) {
    const top = -r * 0.98, bot = r * 0.98, y = bot - (bot - top) * ratio, base = kind === "health" ? P.hp : P.mp;
    g.beginPath(); g.moveTo(-r * 1.2, bot + 2);
    for (let x = -r * 1.2; x <= r * 1.2; x += r / 10) g.lineTo(x, y + Math.sin(time / 380 + x / (r * 0.35)) * r * 0.025 * (ratio < 1 ? 1 : 0));
    g.lineTo(r * 1.2, bot + 2); g.closePath();
    g.fillStyle = base; g.fill();
    g.fillStyle = shade(base, -0.28); g.fillRect(r * 0.18, y - r * 0.1, r, 2.2 * r); // one shade level on the right
    g.fillStyle = shade(base, 0.3); g.fillRect(-r * 0.7, y + r * 0.03, r * 0.1, Math.max(0, bot - y - r * 0.1)); // rim light strip
  }
  g.restore();
  path(g, kind, r);
  g.lineWidth = Math.max(2, r * 0.07); g.strokeStyle = INK; g.lineJoin = "round"; g.stroke();
  g.restore();
}

/** Pre-rendered overlay: metal rim, glass highlight. Drawn over the live fill. */
export function drawGlobeFrame(g, kind) {
  const r = GLOBE_REF, c = GLOBE_REF + 6;
  g.translate(c, c);
  path(g, kind, r);
  g.lineWidth = 5; g.strokeStyle = "#5a6478"; g.lineJoin = "round"; g.stroke();
  path(g, kind, r);
  g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(0, 0.1 * r, r * 0.7, Math.PI * 1.05, Math.PI * 1.45);
  g.lineWidth = 3.5; g.strokeStyle = "rgba(255,255,255,0.28)"; g.lineCap = "round"; g.stroke();
}
export const GLOBE_FRAME = { w: 2 * (GLOBE_REF + 6), h: 2 * (GLOBE_REF + 6), ox: GLOBE_REF + 6, oy: GLOBE_REF + 6 };

export function drawBeltSlot(g) {
  fillPoly(g, [[3, 3], [37, 3], [37, 37], [3, 37]], "#14171f", "#5a6478", 2.5);
  line(g, 4.5, 4.5, 35.5, 4.5, "rgba(255,255,255,0.18)", 1.2);
}

export function drawAlert(g) {
  // exclamation mark: ink outline, warm yellow body
  fillPoly(g, [[6, 2], [12, 2], [11, 14], [7, 14]], "#f2c230", INK, 1.8);
  ellipse(g, 9, 19, 2.6, 2.6, "#f2c230", INK, 1.8);
}

export function drawPaper(g) { fillPoly(g, [[1, 2], [7, 0], [8, 6], [2, 8]], P.paper, INK, 1); }

/** Slash arc in front of the hero (drawn once per direction). */
export function drawSlash(g, dir, vec) {
  const [fx, fy] = vec;
  g.translate(24, 24);
  const a = Math.atan2(fy * 0.6, fx);
  g.beginPath(); g.arc(0, 0, 17, a - 0.9, a + 0.9);
  g.lineWidth = 5; g.strokeStyle = "rgba(235,240,255,0.85)"; g.lineCap = "round"; g.stroke();
  g.beginPath(); g.arc(0, 0, 13, a - 0.7, a + 0.7);
  g.lineWidth = 2; g.strokeStyle = "rgba(255,255,255,0.95)"; g.stroke();
}
