// Removes monsters that finished their death animation window, and drops stale targets.
import { config } from "../config.js";

export function cleanup(state) {
  for (const m of state.monsters) if (m.ai === "dead") m.deathT++;
  state.monsters = state.monsters.filter((m) => m.ai !== "dead" || m.deathT < config.deathTicks);
  for (const f of state.floaters) f.life--;
  state.floaters = state.floaters.filter((f) => f.life > 0);
  const p = state.player;
  if (p.target && !state.monsters.some((m) => m.id === p.target && m.ai !== "dead")) p.target = null;
}
