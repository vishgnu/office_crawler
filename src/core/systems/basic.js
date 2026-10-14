// The class's basic attack (ADR-0005 section 3): melee walks adjacent, a projectile basic (toss, zap) stops in range with a clear flight line.
import { rayClear } from "../los.js";
import { isAdjacent } from "../grid.js";
import { skills } from "../content/skills.js";

/** Definition of the basic attack on the primary slot. */
export const basicDef = (state) => skills[state.player.skillBar.primary] ?? skills.strike;
export const isRangedBasic = (state) => basicDef(state).archetype === "projectile";

/** Can the hero standing on `from` hit a monster on `tile` with the basic attack right now? */
export function inBasicReach(state, ctx, from, tile) {
  const def = basicDef(state);
  if (def.archetype !== "projectile") return isAdjacent(ctx.grid, from, tile);
  const dx = tile.x - from.x, dy = tile.y - from.y, r = def.delivery.range - 0.5;
  return dx * dx + dy * dy <= r * r && rayClear(ctx.grid, from, tile);
}
