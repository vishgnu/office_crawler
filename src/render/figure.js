// Class figures for DOM screens (class selection cards, slot cards): paints a hero or ally straight onto a 2D canvas, outside the world atlas.
//   drawFigure(canvas, figureKey, { anim: "portrait" | "card-idle" | "idle" | "walk" | "attack" | "cast" | "death", t: seconds, dir: 0..7 })
// "portrait" is a static, front-on pose; "card-idle" loops the idle frames (a gentle bob, the laptop pulse, the card flip) and reads `t`;
// reduced motion screens pass "portrait". The canvas is cleared, the figure is scaled to fit and stands on a soft ground shadow. No state, no atlas.
import { drawFigure as paint, FIG_W, FIG_H, FIG_FX, FIG_FY } from "./styles/vector/characters.js";
import { PLAYER_ANIMS, HERO_CLASSES, ALLY_IDS } from "./keys.js";
import { HERO_ACCENT } from "./styles/vector/heroes.js";

/** Figure keys the style can draw: hero.<classId> and ally.<id>. */
export const figureKeys = () => [...HERO_CLASSES.map((c) => `hero.${c}`), ...ALLY_IDS.map((a) => `ally.${a}`)];

/** Sprite type behind a figure key, or null when the key is unknown. */
export const figureType = (figureKey) => {
  const [kind, id] = String(figureKey).split(".");
  return kind === "hero" && HERO_CLASSES.includes(id) ? id : kind === "ally" && ALLY_IDS.includes(id) ? `ally.${id}` : null;
};

export function drawFigure(canvas, figureKey, { anim = "portrait", t = 0, dir = 0 } = {}) {
  const type = figureType(figureKey), g = canvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
  if (!type) return false;
  const k = Math.min(canvas.width / FIG_W, canvas.height / FIG_H) * 0.96, ox = canvas.width / 2 - FIG_FX * k;
  const name = anim === "portrait" || anim === "card-idle" ? "idle" : anim, n = PLAYER_ANIMS[name] ?? 4;
  const frame = anim === "portrait" ? 0 : anim === "card-idle" ? Math.floor(t * 4) % n : Math.min(n - 1, Math.floor(t * 8) % n);
  g.save();
  g.translate(ox + FIG_FX * k, canvas.height - (FIG_H - FIG_FY) * k - canvas.height * 0.02);
  g.fillStyle = "rgba(8,6,20,0.38)"; g.beginPath(); g.ellipse(0, 0, 20 * k, 6.5 * k, 0, 0, Math.PI * 2); g.fill();
  const accent = HERO_ACCENT[type];
  if (accent) { g.strokeStyle = accent; g.globalAlpha = 0.55; g.lineWidth = Math.max(1.5, 1.6 * k); g.beginPath(); g.ellipse(0, 0, 26 * k, 8.5 * k, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
  g.scale(k, k);
  paint(g, type, name, dir, frame);
  g.restore();
  return true;
}
