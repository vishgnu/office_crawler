// Minimal HUD: health jug, mana cup, labels, belt placeholder slots, target bar, floor name.
import { content } from "../core/index.js";
import { hudLayout } from "../ui/layout.js";
import { keys } from "./keys.js";

const S = content.strings;
const ratio = (v, max) => (max > 0 ? Math.min(1, Math.max(0, v / max)) : 0);

/** HUD values + rects for the hook and tests (pure). */
export function hudState(core, w, h, style) {
  const L = hudLayout(w, h), p = core.player;
  const gauge = (kind, value, max, geo) => ({
    value, max, ratio: ratio(value, max), shape: style.ui.shapes[kind], label: `${value} / ${max}`,
    rect: { ...geo.rect },
  });
  return { health: gauge("health", p.hp, p.hpMax, L.health), mana: gauge("mana", p.mp, p.mpMax, L.mana) };
}

export function drawHud(g, w, h, core, atlas, style, now, targetId) {
  const L = hudLayout(w, h), s = L.scale, p = core.player;
  const globes = [["health", L.health, p.hp, p.hpMax, S.health], ["mana", L.mana, p.mp, p.mpMax, S.mana]];
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  for (const [kind, geo, v, max, name] of globes) {
    style.ui.drawGlobe(g, kind, geo.cx, geo.cy, geo.r * 0.9, ratio(v, max), now);
    const f = atlas.get(keys.ui(`globe-${kind}`)), k = (geo.r * 0.9) / style.ui.globeRef;
    g.drawImage(f.img, geo.cx - f.ox * k, geo.cy - f.oy * k, f.w * k, f.h * k);
    g.font = `bold ${Math.round(15 * s)}px system-ui, sans-serif`;
    g.lineWidth = 4 * s; g.strokeStyle = "#0a0c12"; g.lineJoin = "round";
    const label = `${v} / ${max}`;
    g.strokeText(label, geo.cx, geo.cy + geo.r + 20 * s); g.fillStyle = "#e8ecf6"; g.fillText(label, geo.cx, geo.cy + geo.r + 20 * s);
    g.font = `${Math.round(11 * s)}px system-ui, sans-serif`; g.fillStyle = "#9aa6c0";
    g.fillText(name, geo.cx, geo.cy - geo.r - 6 * s);
  }
  const slot = atlas.get(keys.ui("belt-slot"));
  g.font = `${Math.round(11 * s)}px system-ui, sans-serif`;
  L.belt.forEach((b, i) => {
    g.drawImage(slot.img, b.x, b.y, b.w, b.h);
    g.fillStyle = "#7c88a4"; g.textAlign = "left"; g.fillText(String(i + 1), b.x + 5 * s, b.y + b.h - 6 * s);
  });
  g.textAlign = "left"; g.fillStyle = "#9aa6c0"; g.font = `${Math.round(13 * s)}px system-ui, sans-serif`;
  g.fillText(S.floorName, 16 * s, 26 * s);

  const m = targetId && core.monsters.find((o) => o.id === targetId && o.ai !== "dead");
  if (m) {
    const t = L.target, def = content.monsters[m.type];
    g.fillStyle = "#14171f"; g.fillRect(t.x, t.y, t.w, t.h);
    g.fillStyle = "#b8252f"; g.fillRect(t.x, t.y, t.w * ratio(m.hp, m.hpMax), t.h);
    g.strokeStyle = "#0a0c12"; g.lineWidth = 2 * s; g.strokeRect(t.x, t.y, t.w, t.h);
    g.textAlign = "center"; g.fillStyle = "#e8ecf6"; g.font = `bold ${Math.round(13 * s)}px system-ui, sans-serif`;
    g.lineWidth = 3 * s; g.strokeStyle = "#0a0c12"; g.strokeText(def.name, w / 2, t.y + t.h + 16 * s); g.fillText(def.name, w / 2, t.y + t.h + 16 * s);
  }
}
