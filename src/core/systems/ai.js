// Monster behaviour: idle -> notice -> chase -> attack. Movement itself happens in movement.js.
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { isAdjacent } from "../grid.js";
import { hasLineOfSight } from "../los.js";
import { planPath } from "../nav.js";
import { monsters as registry } from "../content/monsters.js";

function canSee(ctx, m, p) {
  const r = registry[m.type].sightRange, dx = p.tile.x - m.tile.x, dy = p.tile.y - m.tile.y;
  return dx * dx + dy * dy <= r * r && hasLineOfSight(ctx.grid, m.tile.x, m.tile.y, p.tile.x, p.tile.y);
}

function wakePack(state, m) {
  if (m.packId === null) return;
  for (const o of state.monsters) if (o !== m && o.packId === m.packId && o.ai === "idle") { o.ai = "notice"; o.aiT = 1; }
}

function chase(ctx, m, p) {
  if (m.repathT > 0) m.repathT--;
  const stale = !m.goal || m.goal.x !== p.tile.x || m.goal.y !== p.tile.y;
  if ((m.path.length === 0 || stale) && m.repathT === 0) {
    m.path = planPath(ctx, m.next ?? m.tile, p.tile, { adjacent: true, maxNodes: config.ai.maxPathNodes }) ?? [];
    m.goal = { ...p.tile };
    m.repathT = config.ai.repathTicks; // also rate-limits searches towards an unreachable player
  }
}

export function ai(state) {
  const ctx = getCtx(state), p = state.player;
  for (const m of state.monsters) {
    const still = !m.next;
    switch (m.ai) {
      case "idle":
        if (canSee(ctx, m, p)) { m.ai = "notice"; m.aiT = 1; wakePack(state, m); }
        break;
      case "notice":
        if (++m.aiT >= config.noticeTicks) { m.ai = "chase"; m.path = []; m.goal = null; m.repathT = 0; }
        break;
      case "chase":
        if (still && isAdjacent(ctx.grid, m.tile, p.tile)) { m.ai = "attack"; m.attackT = 0; m.path = []; }
        else chase(ctx, m, p);
        break;
      case "attack":
        // Between swings, close the distance again if the player has moved away.
        if (m.attackT === 0 && !(still && isAdjacent(ctx.grid, m.tile, p.tile))) { m.ai = "chase"; m.path = []; m.goal = null; m.repathT = 0; }
        break;
    }
  }
}
