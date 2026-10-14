// The skill runner (ADR-0005 sections 3 and 4): one function per delivery archetype and one switch over the effect ops.
// 30 skills are rows of data over these code paths. Everything random comes from the "combat" stream.
import { config } from "../config.js";
import { getCtx, idx } from "../ctx.js";
import { stream } from "../state.js";
import { emit } from "../events.js";
import { hasLineOfSight } from "../los.js";
import { posOf } from "../pos.js";
import { rotateDeg } from "../dir.js";
import { skills, at } from "../content/skills.js";
import { allyUnits } from "../content/allies.js";
import { fireProjectile } from "./projectiles.js";
import { damageMonster, playerDamage, effDefense, floater, alert, knockBack, hitChance } from "./damage.js";

const round = Math.round;
const dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
const alive = (state) => state.monsters.filter((m) => m.ai !== "dead");

/** Mean of the equipped weapon's damage range, scaled by the skill's weapon share (skills grow with gear). */
const weaponBonus = (p, share) => Math.floor(((p.damage.min + p.damage.max) / 2) * (share ?? 0));

/** Skill level used for numbers: learned level plus gear bonus (class-tagged affixes); basics are level 1. */
export function effLevel(state, def) {
  if (def.kind === "basic") return 1;
  const k = state.player.skills[def.id] ?? 0;
  if (k < 1) return 0;
  const m = state.player.mods;
  return k + (m?.skillLevelAll ?? 0) + (m?.skillLevelBranch?.[def.branch] ?? 0);
}

/** Percent damage bonus from skill-damage mods (by damage type or tag) and synergies. */
function skillPct(state, def, type) {
  const p = state.player, sd = p.mods?.skillDamagePct ?? {};
  let pct = type ? sd[type] ?? 0 : 0;
  for (const tag of def.tags ?? []) if (tag !== type) pct += sd[tag] ?? 0;
  for (const sy of def.synergy ?? []) if (sy.stat === "damagePct") pct += sy.perLevel * (p.skills[sy.from] ?? 0);
  return pct;
}

// ---- statuses on monsters ------------------------------------------------------------------------------------------------------

function applyStatus(state, def, level, e, m) {
  const ticks = round(at(e.ticks, level)), boss = m.tier === "boss";
  if (e.kind === "stun" || e.kind === "mute" || e.kind === "freeze") {
    if (boss) { emit(state, { type: "resisted", target: m.id, skill: def.id }); return; } // bosses shrug off stun, mute and freeze
    m.muteT = Math.max(m.muteT, ticks); m.statusKind = e.kind; m.path = []; m.attackT = 0; alert(state, m);
    if (e.kind === "mute") emit(state, { type: "muted", target: m.id, ticks: m.muteT });
  } else if (e.kind === "slow") {
    m.slowT = Math.max(m.slowT, boss ? Math.floor(ticks / 2) : ticks); m.slowMag = Math.max(m.slowMag, round(at(e.mag, level)));
  } else if (e.kind === "weaken") {
    m.weakenT = Math.max(m.weakenT, boss ? Math.floor(ticks / 2) : ticks); m.weakenMag = Math.max(m.weakenMag, round(at(e.mag, level)));
  }
  emit(state, { type: "status", target: m.id, kind: e.kind, ticks });
}

function applyDot(state, def, level, e, m) {
  const per = Math.max(1, round(at(e.perTick, level) * (100 + skillPct(state, def, e.type)) / 100)), ticks = round(at(e.ticks, level));
  if (m.burnT <= 0 || per >= m.burnDmg) { m.burnDmg = per; m.burnT = Math.max(m.burnT, ticks); } else m.burnT = Math.max(m.burnT, ticks);
  emit(state, { type: "status", target: m.id, kind: "burn", ticks });
}

/**
 * Apply a skill's on-hit effects to one monster. ctx: { projectile, att, from (tile), mult, only (list of ops) }.
 * A projectile with physical damage rolls to hit first. Returns false on a miss.
 */
export function hitMonsterBySkill(state, def, level, m, ctx = {}) {
  const p = state.player, rng = stream(state, "combat"), fx = def.effects;
  const only = ctx.only;
  if (ctx.projectile && fx.some((e) => e.op === "damage" && e.type === "physical")) {
    if (rng.next() >= hitChance(ctx.att ?? p, { level: m.level, defense: effDefense(m) })) {
      emit(state, { type: "miss", source: "player", target: m.id }); floater(state, 0, m.tile, m.id, "miss");
      return false;
    }
  }
  let mult = ctx.mult ?? 1;
  for (const e of fx) {
    if (e.op !== "execute") continue;
    const hit = e.vs === "stagger" ? m.ai === "stagger" : m.hp / m.hpMax < (e.below ?? 1);
    if (hit) mult *= at(e.mult, level);
  }
  const knock = fx.some((e) => e.op === "knockback");
  let damaged = false;
  for (const e of fx) {
    if (m.ai === "dead") break;
    if (only && !only.includes(e.op)) continue;
    if (e.op === "damage") {
      const base = round((rng.int(round(at(e.min, level)), round(at(e.max, level))) + weaponBonus(p, e.weaponShare)) * mult);
      const r = playerDamage(state, base, skillPct(state, def, e.type));
      damageMonster(state, m, r.amount, { source: "player", from: ctx.from ?? p.tile, knock, skill: def.id, type: e.type, crit: r.crit });
      damaged = true;
    } else if (e.op === "dot") applyDot(state, def, level, e, m);
    else if (e.op === "status") applyStatus(state, def, level, e, m);
  }
  if (knock && !damaged && m.ai !== "dead" && m.tier !== "boss") knockBack(state, m, ctx.from ?? p.tile);
  return true;
}

// ---- archetypes ----------------------------------------------------------------------------------------------------------------

const freeTilesAround = (state, tile, n) => {
  const ctx = getCtx(state), out = [], taken = (x, y) => ctx.occ[idx(ctx, { x, y })] !== 0 || state.allies.some((a) => a.tile.x === x && a.tile.y === y) || (state.player.tile.x === x && state.player.tile.y === y);
  for (let r = 1; r <= 4 && out.length < n; r++) {
    const ring = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = tile.x + dx, y = tile.y + dy;
      if (ctx.grid.walkable(x, y) && !taken(x, y) && !out.some((o) => o.x === x && o.y === y) && !state.monsters.some((m) => m.ai !== "dead" && m.tile.x === x && m.tile.y === y)) ring.push({ x, y });
    }
    ring.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const t of ring) if (out.length < n) out.push(t);
  }
  return out;
};

/** Check what the archetype needs before any mana is spent. Returns an error string or null. */
export function precheck(state, def, to) {
  const p = state.player, d = def.delivery ?? {}, ctx = getCtx(state);
  switch (def.archetype) {
    case "projectile":
      if (!to) return "needs a target tile";
      if (to.x === p.tile.x && to.y === p.tile.y) return "no direction";
      return null;
    case "area":
      if (d.at === "target") {
        if (!to) return "needs a target tile";
        if (dist(p.tile, to) > (d.range ?? 10)) return "out of range";
        if (d.los && !hasLineOfSight(ctx.grid, p.tile.x, p.tile.y, to.x, to.y)) return "no line of sight";
      }
      return null;
    case "trap":
      if (!to) return "needs a target tile";
      if (dist(p.tile, to) > (d.range ?? 8) || !ctx.grid.walkable(to.x, to.y)) return "out of range";
      return null;
    case "dash":
      if (!to || (to.x === p.tile.x && to.y === p.tile.y)) return "no direction";
      return null;
    default: return null;
  }
}

function runProjectile(state, def, level, to) {
  const p = state.player, d = def.delivery, from = posOf(p);
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy), aim = { x: dx / len, y: dy / len };
  const count = Math.max(1, Math.floor(at(d.count ?? 1, level))), spread = d.spreadDeg ?? 0;
  for (let i = 0; i < count; i++) {
    let dir = aim;
    if (count > 1) {
      const step = spread >= 360 ? 360 / count : spread / (count - 1);
      dir = rotateDeg(aim, spread >= 360 ? i * step : -spread / 2 + i * step);
    }
    fireProjectile(state, from, { x: from.x + dir.x * 10, y: from.y + dir.y * 10 }, {
      owner: "player", kind: d.kind, speed: d.speed, range: d.range, dmg: { min: 0, max: 0 }, att: p, skill: def.id,
      hit: { skill: def.id, level }, pierce: d.pierce ?? 0, chain: Math.floor(at(d.chain ?? 0, level)), falloff: d.falloff ?? 1, chainRange: d.chainRange ?? 4,
    });
  }
  p.facing = { x: aim.x, y: aim.y };
}

function runArea(state, def, level, to) {
  const p = state.player, d = def.delivery, ctx = getCtx(state), r = at(d.radius, level), r2 = r * r;
  const center = d.at === "target" ? { x: to.x, y: to.y } : { x: p.tile.x, y: p.tile.y };
  emit(state, { type: "burst", skill: def.id, tile: { ...center }, radius: r, shape: d.shape });
  for (const m of state.monsters) {
    if (m.ai === "dead") continue;
    const q = posOf(m), d2 = (q.x - center.x) * (q.x - center.x) + (q.y - center.y) * (q.y - center.y);
    if (d2 > r2 || (d.los && !hasLineOfSight(ctx.grid, center.x, center.y, m.tile.x, m.tile.y))) continue;
    hitMonsterBySkill(state, def, level, m, { from: center });
  }
  if (d.linger) {
    const ticks = round(at(d.linger.ticks, level));
    addZone(state, { kind: "field", skill: def.id, level, tile: center, radius: r, armT: 0, ttl: ticks, every: d.linger.every ?? config.dotEvery });
  }
}

export function addZone(state, z) {
  const zone = { id: `z${state.nextId++}`, ...z };
  state.zones.push(zone);
  emit(state, { type: "zoneStart", id: zone.id, skill: zone.skill, kind: zone.kind, tile: { ...zone.tile }, radius: zone.radius });
  return zone;
}
export function removeZone(state, z) {
  state.zones = state.zones.filter((o) => o !== z);
  emit(state, { type: "zoneEnd", id: z.id });
}

function runTrap(state, def, level, to) {
  const d = def.delivery, mine = state.zones.filter((z) => z.skill === def.id);
  while (mine.length >= (d.max ?? 3)) removeZone(state, mine.shift());
  addZone(state, { kind: "trap", skill: def.id, level, tile: { x: to.x, y: to.y }, radius: at(d.radius, level), armT: d.armTicks ?? 30, ttl: d.ttl ?? 1800 });
}

function runSelf(state, def, level) {
  const p = state.player;
  for (const e of def.effects) {
    if (e.op === "heal") {
      const before = p.hp;
      p.hp = Math.min(p.hpMax, p.hp + round(at(e.amount, level)));
      emit(state, { type: "heal", skill: def.id, value: p.hp - before });
      if (p.hp > before) floater(state, p.hp - before, p.tile, "player", "heal");
    } else if (e.op === "hot") {
      const ticks = round(at(e.ticks, level));
      p.buffs = p.buffs.filter((b) => b.skill !== def.id);
      p.buffs.push({ skill: def.id, stat: "hot", value: round(at(e.amount, level)), t: ticks, every: e.every ?? config.dotEvery });
      emit(state, { type: "buffStart", skill: def.id, stat: "hot", ticks });
    }
  }
}

function runBuff(state, def, level) {
  const p = state.player;
  for (const e of def.effects) {
    if (e.op === "absorb") {
      const ticks = round(at(e.ticks, level));
      p.absorb = { skill: def.id, amount: round(at(e.amount, level)), t: ticks, reflect: round(at(e.reflectPct ?? 0, level)), type: def.tags.includes("cold") ? "cold" : "physical" };
      emit(state, { type: "buffStart", skill: def.id, stat: "absorb", ticks });
    } else if (e.op === "statMod") {
      const ticks = round(at(def.delivery.ticks ?? 300, level));
      p.buffs = p.buffs.filter((b) => !(b.skill === def.id && b.stat === e.stat));
      p.buffs.push({ skill: def.id, stat: e.stat, value: round(at(e.value, level)), t: ticks });
      emit(state, { type: "buffStart", skill: def.id, stat: e.stat, ticks });
    }
  }
}

function runSummon(state, def, level) {
  const p = state.player, d = def.delivery, e = def.effects.find((x) => x.op === "summon"), unit = allyUnits[d.unit];
  const count = Math.max(1, Math.floor(at(d.count ?? 1, level))), max = Math.max(count, Math.floor(at(d.max ?? count, level)));
  const own = state.allies.filter((a) => a.skill === def.id);
  while (own.length + count > max && own.length) { const a = own.shift(); state.allies = state.allies.filter((o) => o !== a); emit(state, { type: "allyDied", id: a.id, reason: "replaced" }); }
  for (const tile of freeTilesAround(state, p.tile, count)) {
    while (state.allies.length >= config.maxAllies) { const a = state.allies.shift(); emit(state, { type: "allyDied", id: a.id, reason: "replaced" }); }
    const hp = round(at(e.hp, level));
    const a = { id: `a${state.nextId++}`, unit: unit.id, skill: def.id, owner: "player", tile, next: null, moveT: 0, moveTotal: 0, hp, hpMax: hp, damage: round(at(e.damage, level)), ttl: round(at(d.ticks, level)), taunt: !!e.taunt, path: [], attackT: 0, flashTicks: 0 };
    state.allies.push(a);
    emit(state, { type: "summon", skill: def.id, unit: a.unit, id: a.id, tile: { ...tile } });
  }
}

function runDash(state, def, level, to) {
  const p = state.player, d = def.delivery, ctx = getCtx(state), from = { x: p.tile.x, y: p.tile.y };
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy), dir = { x: dx / len, y: dy / len };
  if (p.next) { p.tile = { x: p.next.x, y: p.next.y }; p.next = null; p.moveT = 0; p.moveTotal = 0; } // finish the step in progress at once
  const n = Math.floor(at(d.distance, level)), path = [];
  let cur = { x: p.tile.x, y: p.tile.y };
  for (let k = 1; k <= n * 2 && path.length < n; k++) {
    const t = { x: round(from.x + dir.x * k * 0.5), y: round(from.y + dir.y * k * 0.5) }; // sampled every half tile so no tile is skipped
    if (t.x === cur.x && t.y === cur.y) continue;
    const sx = t.x - cur.x, sy = t.y - cur.y;
    if (Math.max(Math.abs(sx), Math.abs(sy)) !== 1) break;
    const corner = !sx || !sy || (ctx.grid.walkable(cur.x + sx, cur.y) && ctx.grid.walkable(cur.x, cur.y + sy));
    if (!ctx.grid.walkable(t.x, t.y) || !corner || state.monsters.some((m) => m.ai !== "dead" && ((m.tile.x === t.x && m.tile.y === t.y) || (m.next && m.next.x === t.x && m.next.y === t.y)))) break;
    path.push(t); cur = t;
  }
  p.dash = { skill: def.id, level, path, t: 0, step: Math.max(1, Math.floor((d.ticks ?? 10) / Math.max(1, path.length))), hit: [] };
  p.facing = { x: dir.x, y: dir.y };
  emit(state, { type: "dash", skill: def.id, from, to: path.length ? { ...path[path.length - 1] } : { ...from } });
  return (d.ticks ?? 10) + 2;
}

/** Run a validated, paid-for cast. Returns extra ticks the hero is busy (dash). */
export function runSkill(state, def, level, to) {
  switch (def.archetype) {
    case "projectile": runProjectile(state, def, level, to); break;
    case "area": runArea(state, def, level, to); break;
    case "self": runSelf(state, def, level); break;
    case "buff": runBuff(state, def, level); break;
    case "summon": runSummon(state, def, level); break;
    case "trap": runTrap(state, def, level, to); break;
    case "dash": return runDash(state, def, level, to);
    default: break;
  }
  return 0;
}

/** The hero's basic attack for a projectile class (toss, zap): one shot at the monster. */
export function fireBasic(state, m) {
  const p = state.player, def = skills[p.skillBar.primary];
  if (!def || def.archetype !== "projectile") return false;
  runProjectile(state, def, 1, m.tile);
  return true;
}
