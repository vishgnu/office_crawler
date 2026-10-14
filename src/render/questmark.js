// Quest markers drawn procedurally (R7-0.7, no atlas sprites): the NPC overhead marker (exclamation sign = a quest is on offer, question mark =
// ready to hand in; two different SHAPES, not only two colours), the ground-item sign and the map pin. Colours are from the Okabe-Ito set.
// Nothing here allocates per call; the bob is a slow sine that is switched off under reduced motion.
import { npcMarker } from "../core/index.js";

export const NPC_SHAPE = Object.freeze({ available: "exclamation", handin: "question" });
export const QUEST_YELLOW = "#f0e442", QUEST_BLUE = "#56b4e9";

/** Overhead marker centred at (x, y), r px radius. Exclamation: yellow disc with a bar and a dot. Question: blue diamond-cut badge with a hook and a dot. */
export function drawNpcMarker(g, shape, x, y, r, ink, reducedMotion, now) {
  const by = reducedMotion ? 0 : Math.sin(now / 520) * 0.12 * r;
  y -= by;
  g.save(); g.lineJoin = "round"; g.lineCap = "round";
  g.lineWidth = Math.max(2, r * 0.3); g.strokeStyle = ink;
  g.beginPath();
  if (shape === "exclamation") { g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = QUEST_YELLOW; }
  else { g.moveTo(x, y - r * 1.2); g.lineTo(x + r * 1.1, y); g.lineTo(x, y + r * 1.2); g.lineTo(x - r * 1.1, y); g.closePath(); g.fillStyle = QUEST_BLUE; }
  g.stroke(); g.fill();
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = Math.max(1.8, r * 0.26);
  if (shape === "exclamation") {
    g.beginPath(); g.moveTo(x, y - r * 0.58); g.lineTo(x, y + r * 0.12); g.stroke();
    g.beginPath(); g.arc(x, y + r * 0.5, Math.max(1, r * 0.16), 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.arc(x, y - r * 0.28, r * 0.34, Math.PI * 1.05, Math.PI * 2.45); g.lineTo(x, y + r * 0.2); g.stroke();
    g.beginPath(); g.arc(x, y + r * 0.58, Math.max(1, r * 0.15), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

/** Triangle sign with an exclamation mark for a quest ground entry (marker glyph in the loot layer), centred at (x, y), size px across. */
export function drawQuestSign(g, x, y, size, colour, ink) {
  const r = size / 2;
  g.save(); g.lineJoin = "round"; g.lineCap = "round"; g.lineWidth = Math.max(2, size * 0.14); g.strokeStyle = ink; g.fillStyle = colour;
  g.beginPath(); g.moveTo(x, y - r * 1.05); g.lineTo(x + r * 1.1, y + r * 0.85); g.lineTo(x - r * 1.1, y + r * 0.85); g.closePath(); g.stroke(); g.fill();
  g.fillStyle = ink; g.lineWidth = Math.max(1.6, size * 0.13);
  g.beginPath(); g.moveTo(x, y - r * 0.4); g.lineTo(x, y + r * 0.22); g.stroke();
  g.beginPath(); g.arc(x, y + r * 0.58, Math.max(1, size * 0.07), 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Map pin for a known quest target: a yellow flag-shaped diamond with a ring (distinct from the round NPC dot and the triangular stairs). u = unit px. */
export function drawMapPin(g, x, y, u, ink) {
  g.save(); g.lineJoin = "round"; g.lineWidth = 2; g.strokeStyle = ink; g.fillStyle = QUEST_YELLOW;
  const s = u * 1.5;
  g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.8, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.8, y); g.closePath(); g.stroke(); g.fill();
  g.fillStyle = ink; g.beginPath(); g.rect(x - s * 0.1, y - s * 0.5, s * 0.2, s * 0.55); g.fill();
  g.beginPath(); g.arc(x, y + s * 0.4, s * 0.12, 0, Math.PI * 2); g.fill();
  g.restore();
}

/**
 * Overhead markers over the Lobby NPCs, in the screen pass above the lighting (called from fx.drawLoot): above the nameplate, bodies are the world pass actor
 * records (npc: true, id "npc:<id>"). Fills `list` = [{id, shape}] for every NPC with a marker (read by perf().npcMarkers), drawn only when on screen.
 */
const SHORT = Object.create(null); // "npc:vendor" -> "vendor", cached so a Lobby frame allocates no string
export function drawNpcMarkers(g, cam, core, bodies, list, style, reducedMotion, now) {
  let n = 0;
  if (core.depth === 0 && core.quests && bodies) {
    const z = cam.z, r = Math.max(9, Math.min(17, 5.4 * z)), ink = style.palette.ink;
    for (let i = 0; i < bodies.length; i++) {
      const o = bodies[i];
      if (!o.npc) continue;
      const id = SHORT[o.id] ?? (SHORT[o.id] = o.id.slice(4)), shape = NPC_SHAPE[npcMarker(core, id)];
      if (!shape) continue;
      const rec = list[n] ?? (list[n] = { id: "", shape: "" });
      rec.id = id; rec.shape = shape; n++;
      if (o.sx < -40 || o.sx > cam.w + 40 || o.sy < 0 || o.sy > cam.h + 140) continue;
      drawNpcMarker(g, shape, o.sx, o.sy - (style.dims[o.type]?.head ?? 54) * z - 30 - r, r, ink, reducedMotion, now);
    }
  }
  list.length = n;
}
