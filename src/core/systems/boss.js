// The end boss, "The Regional Director" (R-045). Per tick this system drives the boss's two phases on top of the normal
// monster AI (which still chases it to the hero and swings its melee attack):
//   phase 1: Paper Slam, a telegraphed ground attack. Its wind-up is public state (boss.windup) so the UI can draw it and the
//            hero can step out of the circle before it lands.
//   phase 2 (from config.boss.phase2At of its health, once): a roar that calls staff (interns and consultants), a faster and
//            wider Paper Slam, and the Quarterly Volley, a fan of slides aimed where the hero stood when the wind-up began.
// No randomness is used here: the pattern is a fixed cycle, so the encounter is the same for the same hero movement.
// Leaving the arena or dying resets the boss (the floor is rebuilt on re-entry, QF-04-9). Killing it unlocks the victory.
import { config } from "../config.js";
import { emit } from "../events.js";
import { getCtx } from "../ctx.js";
import { hasLineOfSight } from "../los.js";
import { posOf } from "../pos.js";
import { spawnMonster } from "../state.js";
import { fireProjectile } from "./projectiles.js";
import { hurtPlayer } from "./damage.js";

const SPREAD_COS = 0.98; // cos of the angle between neighbouring shots; sine is config.boss.volley.spread (no trig in core)

const dist2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const liveBoss = (state) => state.monsters.filter((m) => m.boss && m.ai !== "dead");

/** Unit vector rotated by k neighbouring-shot steps (k may be negative). */
function rotate(d, k) {
  const c = SPREAD_COS, s = config.boss.volley.spread * Math.sign(k);
  let x = d.x, y = d.y;
  for (let i = 0; i < Math.abs(k); i++) { const nx = x * c - y * s, ny = x * s + y * c; x = nx; y = ny; }
  return { x, y };
}

function startWindup(state, m, kind, extra = {}) {
  const cfg = config.boss[kind], b = m.boss;
  b.windup = { kind, t: 0, total: cfg.windup, recover: cfg.recover ?? 0, ...extra };
  m.ai = "windup"; m.path = []; m.attackT = 0; m.goal = null;
  emit(state, { type: "bossTelegraph", id: m.id, kind, ticks: cfg.windup, ...(extra.tile ? { tile: { ...extra.tile }, radius: extra.radius } : {}), ...(extra.dir ? { dir: { ...extra.dir } } : {}) });
}

function resolveSlam(state, m) {
  const w = m.boss.windup, p = state.player, cfg = config.boss.slam;
  const hit = p.hp > 0 && dist2(posOf(p), w.tile) <= w.radius * w.radius;
  emit(state, { type: "bossSlam", id: m.id, tile: { ...w.tile }, radius: w.radius, hit });
  if (hit) hurtPlayer(state, m.id, Math.max(1, Math.round(m.damage * cfg.damageMult)));
  m.boss.slams++;
}

function resolveVolley(state, m) {
  const w = m.boss.windup, cfg = config.boss.volley, from = posOf(m);
  const dmg = Math.max(1, Math.round(m.damage * cfg.damageMult)), n = cfg.shots, half = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const d = rotate(w.dir, i - half);
    fireProjectile(state, from, { x: from.x + d.x * 10, y: from.y + d.y * 10 }, {
      owner: m.id, kind: "slide", speed: cfg.speed, range: cfg.range, dmg: { min: Math.max(1, dmg - 1), max: dmg + 1 },
      att: { level: m.level, attackRating: m.attackRating },
    });
  }
  emit(state, { type: "bossVolley", id: m.id, shots: n });
  m.boss.volleys++;
}

/** Free walkable tiles around the boss, nearest first (ties: smaller y, then x). */
function summonTiles(state, m) {
  const ctx = getCtx(state), r = config.boss.summon.radius, out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = m.tile.x + dx, y = m.tile.y + dy;
    if ((dx || dy) && ctx.grid.walkable(x, y) && (x !== state.player.tile.x || y !== state.player.tile.y)) out.push({ x, y, d: dx * dx + dy * dy });
  }
  return out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
}

function resolveSummon(state, m) {
  const cfg = config.boss.summon, b = m.boss, spawned = [];
  const alive = state.monsters.filter((o) => o.summoned && o.ai !== "dead").length;
  const tiles = summonTiles(state, m);
  for (let i = 0; i < cfg.count && alive + spawned.length < cfg.max; i++) {
    const type = cfg.types[(b.summoned + i) % cfg.types.length];
    // Skip the nearest ring (it is where the boss stands next to the hero) by taking tiles two steps in.
    for (const t of tiles.slice(3)) {
      const add = spawnMonster(state, type, { x: t.x, y: t.y }, null, { level: cfg.level });
      if (add) { add.summoned = true; add.ai = "chase"; add.aiT = 0; spawned.push(add.id); break; }
    }
  }
  b.summoned += spawned.length;
  emit(state, { type: "bossSummon", id: m.id, adds: spawned });
}

/** Choose the next special attack, or null when none is due or possible. */
function nextAttack(state, m) {
  const b = m.boss, p = state.player, ctx = getCtx(state), cfg = config.boss;
  const alive = state.monsters.filter((o) => o.summoned && o.ai !== "dead").length;
  if (b.phase === 2 && b.summonCd <= 0 && alive < cfg.summon.max) return "summon";
  if (b.cd > 0) return null;
  const sees = hasLineOfSight(ctx.grid, m.tile.x, m.tile.y, p.tile.x, p.tile.y);
  if (!sees) return null;
  if (b.phase === 1) return "slam";
  return b.seq % 2 === 0 ? "slam" : "volley"; // phase 2 cycle: slam, volley, slam, volley ...
}

function engage(state, m, p) {
  const b = m.boss, kind = nextAttack(state, m);
  if (!kind) return;
  if (b.phase === 2 && kind !== "summon") b.seq++;
  const pp = posOf(p);
  if (kind === "slam") startWindup(state, m, "slam", { tile: { x: pp.x, y: pp.y }, radius: b.phase === 2 ? config.boss.slam.radius2 : config.boss.slam.radius });
  else if (kind === "volley") {
    const dx = pp.x - m.tile.x, dy = pp.y - m.tile.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    startWindup(state, m, "volley", { dir: { x: dx / len, y: dy / len } });
  } else startWindup(state, m, "summon");
}

function tickBoss(state, m) {
  const b = m.boss, p = state.player, cfg = config.boss;
  if (b.phase === 1 && m.hp / m.hpMax <= cfg.phase2At) { // phase 2 begins once, and never ends
    b.phase = 2; b.pattern = "p2"; b.cd = 120; b.summonCd = 0; b.windup = null;
    emit(state, { type: "bossPhase", id: m.id, phase: 2 });
  }
  if (!b.engaged) {
    if (m.ai === "chase" || m.ai === "attack") { b.engaged = true; state.stats.bossAttempts++; emit(state, { type: "bossEngage", id: m.id }); }
    return;
  }
  if (p.hp <= 0) return;
  if (b.windup) {
    const w = b.windup;
    w.t++;
    if (w.t === w.total) {
      if (w.kind === "slam") resolveSlam(state, m); else if (w.kind === "volley") resolveVolley(state, m); else resolveSummon(state, m);
      w.resolved = true;
    }
    if (w.t >= w.total + w.recover) { // recovered: back to chasing; the next special is on a cooldown
      b.windup = null; m.ai = "chase"; m.path = []; m.goal = null; m.repathT = 0; m.attackT = 0;
      if (w.kind === "summon") b.summonCd = cfg.summon.cd; else b.cd = b.phase === 2 ? cfg.slam.cd2 : cfg.slam.cd1;
      if (w.kind === "volley") b.cd = cfg.volley.cd;
    }
    return;
  }
  if (b.cd > 0) b.cd--;
  if (b.summonCd > 0) b.summonCd--;
  if (m.ai === "chase" || m.ai === "attack") engage(state, m, p);
}

/** Per tick, after the monster AI. */
export function boss(state) {
  for (const m of liveBoss(state)) tickBoss(state, m);
  const v = state.victory;
  if (v && !v.done) {
    v.t++;
    if (v.t >= config.victoryDelayTicks || state.depth !== config.bossDepth) finishVictory(state);
  }
}

/** The boss died: the staff collapse, its attacks stop, and the victory countdown starts. */
export function onBossKilled(state, m) {
  m.boss.windup = null;
  state.bossDefeated = true;
  state.projectiles = state.projectiles.filter((pr) => !pr.hostile);
  for (const o of state.monsters) if (o.summoned && o.ai !== "dead") { o.hp = 0; o.ai = "dead"; o.deathT = 0; o.path = []; o.next = null; }
  state.victory = { t: 0, done: false, stats: null };
  emit(state, { type: "bossDefeated", id: m.id, tile: { ...m.tile } });
}

/** A normal monster died: clearing floor 8 unlocks the executive lift (the locked stairs, QF-04-5). */
export function onMonsterKilled(state) {
  if (state.depth !== config.maxDepth || state.bossUnlocked || state.floor.custom) return;
  if (state.monsters.some((o) => o.ai !== "dead") || (state.blockedSpawns ?? []).length) return;
  state.bossUnlocked = true;
  emit(state, { type: "stairsUnlocked", depth: state.depth });
}

/** Run statistics shown on the victory screen. */
export function runStats(state) {
  const p = state.player;
  return { ticks: state.tick, seconds: Math.floor(state.tick / config.tickHz), kills: state.stats.kills, deaths: state.stats.deaths, level: p.level, gold: p.gold, deepestDepth: state.deepestDepth, bossAttempts: state.stats.bossAttempts };
}

function finishVictory(state) {
  state.victory = { t: state.victory.t, done: true, stats: runStats(state) };
  state.scene = "victory";
  state.paused = false;
  state.player.action = "idle";
  emit(state, { type: "victory", stats: { ...state.victory.stats } });
  emit(state, { type: "autosave", reason: "victory" });
}

/** "Keep playing" on the victory screen: back to the Lobby with the character as it is; the boss stays dead. */
export function keepPlaying(state, enterFloor) {
  if (state.scene !== "victory") return { ok: false, error: "no victory to leave" };
  const from = state.depth;
  state.victory = null;
  enterFloor(state, 0, { at: "entry", from });
  emit(state, { type: "keepPlaying" });
  return { ok: true };
}
