// Slow per-tick effects: natural regeneration (QF-02-4 default; set the config values to 0 to disable), the timers of
// casting, hit flashes and the Mute skill, and champion regeneration.
import { config } from "../config.js";

export function status(state) {
  const p = state.player, t = state.tick + 1;
  for (const m of state.monsters) {
    if (m.flashTicks > 0) m.flashTicks--;
    if (m.ai === "dead") continue;
    if (m.muteT > 0) m.muteT--;
    if (m.mods?.includes("regenerating") && t % 30 === 0 && m.hp < m.hpMax) m.hp = Math.min(m.hpMax, m.hp + Math.max(1, Math.floor(m.hpMax / 20)));
  }
  if (p.hp <= 0) return;
  if (p.flashTicks > 0) p.flashTicks--;
  if (p.castT > 0) p.castT--;
  const { hpEvery, mpEvery } = config.regen;
  if (hpEvery > 0 && t % hpEvery === 0) p.hp = Math.min(p.hpMax, p.hp + 1);
  if (mpEvery > 0 && t % mpEvery === 0) p.mp = Math.min(p.mpMax, p.mp + 1);
}
