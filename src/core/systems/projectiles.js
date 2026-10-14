// Projectiles shared by the hero and monsters (R-022). A projectile flies in a straight line, one hit at most:
// the first wall ends it, the first target on its line takes the hit. The hero's shots only hit monsters, monster shots only the hero.
import { config } from "../config.js";
import { getCtx } from "../ctx.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { createSpatialHash } from "../spatial.js";
import { posOf } from "../pos.js";
import { hasLineOfSight } from "../los.js";
import { skills } from "../content/skills.js";
import { rollSwing, damageMonster, hurtPlayer, floater, playerDamage, effDefense } from "./damage.js";
import { hitMonsterBySkill } from "./skillfx.js";

/**
 * Create a projectile at `from` (float tile coordinates) flying towards `to`.
 * opts: { owner: "player" | monsterId, kind, speed, range (tiles), dmg: {min,max}, bonus, att: {level, attackRating}, skill,
 *          hit: { skill, level } (the shot carries that skill's effects), pierce (extra targets), chain (jumps), falloff, chainRange }.
 * Returns the projectile, or null when from and to coincide.
 */
export function fireProjectile(state, from, to, opts) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;
  const pr = {
    id: `j${state.nextId++}`, kind: opts.kind, owner: opts.owner, hostile: opts.owner !== "player",
    pos: { x: from.x, y: from.y }, dir: { x: dx / len, y: dy / len }, speed: opts.speed, ttl: Math.ceil(opts.range / opts.speed),
    dmg: { min: opts.dmg.min, max: opts.dmg.max }, bonus: opts.bonus ?? 0, att: { level: opts.att.level, attackRating: opts.att.attackRating }, skill: opts.skill ?? null,
    ...(opts.hit ? { hit: { skill: opts.hit.skill, level: opts.hit.level }, pierce: opts.pierce ?? 0, chain: opts.chain ?? 0, falloff: opts.falloff ?? 1, chainRange: opts.chainRange ?? 4, mult: 1, hitIds: [] } : {}),
  };
  state.projectiles.push(pr);
  emit(state, { type: "projectile", id: pr.id, kind: pr.kind, owner: pr.owner });
  return pr;
}

const dist2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

function hitMonster(state, pr, m) {
  if (pr.hit) { hitMonsterBySkill(state, skills[pr.hit.skill], pr.hit.level, m, { projectile: true, att: pr.att, from: { x: Math.round(pr.pos.x - pr.dir.x), y: Math.round(pr.pos.y - pr.dir.y) }, mult: pr.mult }); return; }
  const r = rollSwing(stream(state, "combat"), pr.att, { level: m.level, defense: effDefense(m) }, pr.dmg, pr.bonus);
  if (!r.hit) { emit(state, { type: "miss", source: "player", target: m.id }); floater(state, 0, m.tile, m.id, "miss"); return; }
  const d = playerDamage(state, r.damage);
  damageMonster(state, m, d.amount, { source: "player", skill: pr.skill ?? undefined, crit: d.crit });
}

function hitPlayer(state, pr) {
  const p = state.player;
  const r = rollSwing(stream(state, "combat"), pr.att, p, pr.dmg, pr.bonus);
  if (!r.hit) { emit(state, { type: "miss", source: pr.owner, target: "player" }); return; }
  hurtPlayer(state, pr.owner, r.damage);
}

export function projectiles(state) {
  if (state.projectiles.length === 0) return;
  const ctx = getCtx(state), p = state.player, rad2 = config.projectileHitRadius * config.projectileHitRadius;
  let hash = null;
  if (state.projectiles.some((pr) => !pr.hostile)) {
    hash = createSpatialHash();
    for (const m of state.monsters) if (m.ai !== "dead") { const q = posOf(m); hash.insert(m, q.x, q.y); }
  }
  const keep = [];
  for (const pr of state.projectiles) {
    pr.pos.x += pr.dir.x * pr.speed; pr.pos.y += pr.dir.y * pr.speed; pr.ttl--;
    const tx = Math.round(pr.pos.x), ty = Math.round(pr.pos.y);
    if (ctx.grid.opaque(tx, ty)) { emit(state, { type: "projectileEnd", id: pr.id, reason: "wall", tile: { x: tx, y: ty } }); continue; }
    if (pr.hostile) {
      if (p.hp > 0 && dist2(pr.pos, posOf(p)) <= rad2) { hitPlayer(state, pr); emit(state, { type: "projectileEnd", id: pr.id, reason: "hit" }); continue; }
    } else {
      let best = null, bd = Infinity;
      for (const m of hash.query(pr.pos.x, pr.pos.y, config.projectileHitRadius)) {
        if (m.ai === "dead" || pr.hitIds?.includes(m.id)) continue;
        const d = dist2(pr.pos, posOf(m));
        if (d <= rad2 && d < bd) { bd = d; best = m; }
      }
      if (best) {
        hitMonster(state, pr, best);
        if (pr.hit) { // pierce first, then chain to the nearest monster not yet hit
          pr.hitIds.push(best.id);
          if (pr.pierce > 0) { pr.pierce--; keep.push(pr); continue; }
          if (pr.chain > 0) {
            let nx = null, nd = Infinity;
            for (const o of state.monsters) {
              if (o.ai === "dead" || pr.hitIds.includes(o.id)) continue;
              const dd = dist2(posOf(best), posOf(o));
              if (dd <= pr.chainRange * pr.chainRange && dd < nd && hasLineOfSight(ctx.grid, best.tile.x, best.tile.y, o.tile.x, o.tile.y)) { nd = dd; nx = o; }
            }
            if (nx) {
              const q = posOf(nx), b = posOf(best), l = Math.sqrt(nd);
              pr.pos = { x: b.x, y: b.y }; pr.dir = { x: (q.x - b.x) / l, y: (q.y - b.y) / l };
              pr.chain--; pr.mult *= pr.falloff; pr.ttl = Math.max(pr.ttl, Math.ceil((l + 1) / pr.speed));
              emit(state, { type: "projectileChain", id: pr.id, from: { x: b.x, y: b.y }, to: { x: q.x, y: q.y } });
              keep.push(pr); continue;
            }
          }
        }
        emit(state, { type: "projectileEnd", id: pr.id, reason: "hit" }); continue;
      }
    }
    if (pr.ttl <= 0) { emit(state, { type: "projectileEnd", id: pr.id, reason: "range" }); continue; }
    keep.push(pr);
  }
  state.projectiles = keep;
}
