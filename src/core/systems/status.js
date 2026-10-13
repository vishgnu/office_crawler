// Slow per-tick effects: natural regeneration (QF-02-4 default; set the config values to 0 to disable).
import { config } from "../config.js";

export function status(state) {
  const p = state.player, t = state.tick + 1;
  if (p.hp <= 0) return;
  const { hpEvery, mpEvery } = config.regen;
  if (hpEvery > 0 && t % hpEvery === 0) p.hp = Math.min(p.hpMax, p.hp + 1);
  if (mpEvery > 0 && t % mpEvery === 0) p.mp = Math.min(p.mpMax, p.mp + 1);
}
