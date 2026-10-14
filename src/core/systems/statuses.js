// Timed effects (ADR-0005 section 5): burn, slow and weaken on monsters; buffs, heal-over-time, the shield and the dash on the hero.
// Called once per tick in a fixed order (monsters in array order, then the hero), so the result is deterministic.
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { emit } from "../events.js";
import { damageMonster, floater } from "./damage.js";
import { hitMonsterBySkill } from "./skillfx.js";
import { skills } from "../content/skills.js";
import { applyDerived } from "../items/derive.js";

/** Timers on monsters. Burn deals its damage every config.dotEvery ticks. */
export function monsterStatuses(state) {
  const t = state.tick + 1;
  for (const m of state.monsters) {
    if (m.ai === "dead") continue;
    if (m.burnT > 0) {
      m.burnT--;
      if (t % config.dotEvery === 0) { emit(state, { type: "dotTick", target: m.id, kind: "burn", value: m.burnDmg }); damageMonster(state, m, m.burnDmg, { source: "player", type: "fire", dot: true }); }
      if (m.ai === "dead") continue;
      if (m.burnT <= 0) m.burnDmg = 0;
    }
    if (m.slowT > 0 && --m.slowT <= 0) m.slowMag = 0;
    if (m.weakenT > 0 && --m.weakenT <= 0) m.weakenMag = 0;
    if (m.muteT <= 0) m.statusKind = null;
  }
}

/** The hero's buffs, shield and aura reserve. */
export function playerStatuses(state) {
  const p = state.player, t = state.tick + 1;
  if (p.hp <= 0) return;
  let changed = false;
  for (const b of p.buffs) {
    if (b.stat === "hot" && t % (b.every ?? config.dotEvery) === 0) {
      const before = p.hp;
      p.hp = Math.min(p.hpMax, p.hp + b.value);
      if (p.hp > before) { emit(state, { type: "heal", skill: b.skill, value: p.hp - before }); floater(state, p.hp - before, p.tile, "player", "heal"); emit(state, { type: "dotTick", target: "player", kind: "hot", value: p.hp - before }); }
    }
    b.t--;
  }
  if (p.buffs.some((b) => b.t <= 0)) {
    for (const b of p.buffs) if (b.t <= 0) { emit(state, { type: "buffEnd", skill: b.skill }); if (b.stat !== "hot") changed = true; }
    p.buffs = p.buffs.filter((b) => b.t > 0);
  }
  if (p.absorb && --p.absorb.t <= 0) { emit(state, { type: "buffEnd", skill: p.absorb.skill }); p.absorb = null; }
  if (changed) applyDerived(state);
  const cap = p.mpMax - (p.mpReserved ?? 0);
  if (p.mp > cap) p.mp = cap;
}

/** The dash: one tile per `step` ticks; crossed monsters (adjacent to the path) take the skill's effects once. */
export function dash(state) {
  const p = state.player, d = p.dash;
  if (!d) return;
  if (p.hp <= 0) { p.dash = null; return; }
  if (d.path.length === 0) { p.dash = null; return; }
  if (d.t++ % d.step !== 0) return;
  const ctx = getCtx(state), nx = d.path[0];
  if (state.monsters.some((m) => m.ai !== "dead" && ((m.tile.x === nx.x && m.tile.y === nx.y) || (m.next && m.next.x === nx.x && m.next.y === nx.y))) || !ctx.grid.walkable(nx.x, nx.y)) { d.path = []; p.dash = null; return; }
  d.path.shift();
  p.tile = { x: nx.x, y: nx.y }; p.next = null; p.moveT = 0;
  const def = skills[d.skill];
  for (const m of state.monsters) {
    if (m.ai === "dead" || d.hit.includes(m.id) || Math.max(Math.abs(m.tile.x - p.tile.x), Math.abs(m.tile.y - p.tile.y)) > 1) continue;
    d.hit.push(m.id);
    hitMonsterBySkill(state, def, d.level, m, { from: { x: p.tile.x - p.facing.x * 1, y: p.tile.y - p.facing.y * 1 } });
  }
  if (d.path.length === 0) p.dash = null;
}
