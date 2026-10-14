// Ground zones (ADR-0005 section 5): traps that spring on the first monster in reach and fields that linger and keep working.
import { emit } from "../events.js";
import { posOf } from "../pos.js";
import { skills } from "../content/skills.js";
import { hitMonsterBySkill, removeZone } from "./skillfx.js";

const inside = (z, m) => { const q = posOf(m); return (q.x - z.tile.x) * (q.x - z.tile.x) + (q.y - z.tile.y) * (q.y - z.tile.y) <= z.radius * z.radius; };

export function zones(state) {
  if (state.zones.length === 0) return;
  for (const z of [...state.zones]) {
    const def = skills[z.skill];
    if (z.armT > 0) z.armT--;
    else if (z.kind === "trap") {
      const hit = state.monsters.filter((m) => m.ai !== "dead" && inside(z, m));
      if (hit.length) {
        emit(state, { type: "zoneTrigger", id: z.id });
        for (const m of hit) hitMonsterBySkill(state, def, z.level, m, { from: z.tile });
        removeZone(state, z);
        continue;
      }
    } else if (z.kind === "field" && (state.tick + 1) % z.every === 0) {
      emit(state, { type: "zoneTrigger", id: z.id });
      for (const m of state.monsters) if (m.ai !== "dead" && inside(z, m)) hitMonsterBySkill(state, def, z.level, m, { from: z.tile, only: ["dot", "status"] });
    }
    if (--z.ttl <= 0) removeZone(state, z);
  }
}
