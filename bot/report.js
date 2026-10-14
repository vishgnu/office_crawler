// Shared bookkeeping for the bot runners: observe(view, rec) is called with every state-shaped view
// (the live core state in Node, a __app.getState() snapshot in the browser) and summarise() builds the report.
import { content, mainState } from "../src/core/index.js";
import { QBOT } from "./quests.js";
export const TICKS_PER_SECOND = 60;

export function createRecorder(seed) {
  return { seed, deaths: 0, maxLevel: 1, ids: new Set(), firstDamage: new Map(), kills: 0, ttk: [], seen: new Set(), total: null, hpMin: Infinity, hpLast: 0, tick: 0, result: "running", dmg: {}, casts: {}, deathTick: null, clearTick: null, boss: { engaged: null, killed: null, hpMin: Infinity, deathsInArena: 0, phase2At: null } };
}

/** Damage and casts per skill from the events the view carries (instant skills fire in applyInput, before the tick clears the list, so the runner calls this after both). */
export function observeEvents(view, rec) {
  for (const ev of view.events ?? []) { // a browser snapshot may not carry events
    if (ev.type === "hit" && ev.target !== "player") { const k = ev.skill ?? (ev.source === "ally" ? "allies" : ev.damageType ? "burn" : "basic-melee"); rec.dmg[k] = (rec.dmg[k] ?? 0) + ev.value; }
    else if (ev.type === "cast") rec.casts[ev.skill] = (rec.casts[ev.skill] ?? 0) + 1;
    else if (ev.type === "quest.step" && MAIN_IDS.includes(ev.id) && !(rec.evSeen ??= new WeakSet()).has(ev)) { rec.evSeen.add(ev); (rec.mainSteps ??= []).push(content.mainSteps.find((s) => s.arcId === ev.id).n + ev.step - 1); } // R7-0.4: the main steps (global 1..10) in the order they were reached (AC-R-241-2)
    else if (ev.type === "quest.completed" && MAIN_IDS.includes(ev.id) && !(rec.evSeen ??= new WeakSet()).has(ev)) { rec.evSeen.add(ev); (rec.arcsDone ??= []).push(ev.id); if (ev.id === MAIN_IDS[MAIN_IDS.length - 1]) (rec.mainSteps ??= []).push(content.mainSteps.length + 1); }
  }
}

const MAIN_IDS = content.mainIds, QUEST_IDS = content.questIds;
/** Tick at which each quest was first seen completed (R7-0.4): side quests by their stored state, a main quest by its milestones (same fields in the core state and in a browser snapshot). */
export function observeQuests(view, rec) {
  const qs = view.quests;
  if (!qs) return;
  rec.qDone ??= {};
  for (const id of QUEST_IDS) if (rec.qDone[id] === undefined && (MAIN_IDS.includes(id) ? qs.main?.m && mainState(qs.main.m, id) === "completed" : qs[id]?.s === "completed")) rec.qDone[id] = view.tick;
}

export function observe(view, rec) {
  const t = view.tick;
  rec.tick = t;
  observeQuests(view, rec);
  if (rec.total === null) { rec.total = 0; rec.gold0 = view.player.gold; }
  rec.maxLevel = Math.max(rec.maxLevel, view.player.level);
  for (const m of view.monsters) {
    if (!rec.ids.has(m.id)) { rec.ids.add(m.id); rec.total++; }
    if (!rec.firstDamage.has(m.id) && m.hp < m.hpMax) rec.firstDamage.set(m.id, t);
    if (m.ai === "dead" && !rec.seen.has(m.id)) {
      rec.seen.add(m.id); rec.kills++;
      rec.ttk.push(t - (rec.firstDamage.get(m.id) ?? t)); // time from the first damage dealt to the kill
    }
  }
  observeEvents(view, rec);
  rec.hpMin = Math.min(rec.hpMin, view.player.hp); rec.hpLast = view.player.hp;
  // R7-3: per-floor feel numbers (0 = Lobby, 9 = boss arena): ticks spent, damage taken, near-deaths (hp falls below 25 % of the maximum: one count per dip).
  const fl = ((rec.floors ??= {})[view.depth] ??= { ticks: 0, dmg: 0, near: 0 });
  fl.ticks++;
  for (const ev of view.events ?? []) if (ev.type === "hit" && ev.target === "player" && !(rec.hitSeen ??= new WeakSet()).has(ev)) { rec.hitSeen.add(ev); fl.dmg += ev.value; }
  const low = view.player.hp > 0 && view.player.hp < view.player.hpMax * 0.25;
  if (low && !rec.low) fl.near++;
  rec.low = low;
  const boss = view.monsters.find((m) => m.boss);
  if (boss) { // the finale: when the fight started, how low the hero got, when phase 2 began and when the boss fell
    const b = rec.boss;
    if (boss.boss.engaged && b.engaged === null) b.engaged = t;
    if (boss.boss.engaged) b.hpMin = Math.min(b.hpMin, view.player.hp);
    if (boss.boss.phase === 2 && b.phase2At === null) b.phase2At = t;
    if (boss.ai === "dead" && b.killed === null) b.killed = t;
  }
  if (view.scene === "dead" && view.depth === 9) rec.boss.deathsInArena++;
  if (view.scene === "dead" && rec.result === "running") { rec.result = "died"; rec.deathTick = t; rec.deathDepth = view.depth; }
}

export function finish(view, mem, rec, maxTicks) {
  if (rec.result === "running") {
    if (mem.done) { rec.result = "cleared"; rec.clearTick = view.tick; }
    else if (view.tick >= maxTicks) rec.result = "timeout";
  }
  return { seed: rec.seed, result: rec.result, deathDepths: rec.deathDepths ?? [], dmg: rec.dmg, casts: rec.casts, ticks: rec.tick, kills: rec.kills, total: rec.total, ttk: rec.ttk, stuck: mem.stuck, waitGaveUp: mem.waitGaveUp, watchdogFired: mem.watchdogFired ?? 0, watchdogQuiet: mem.watchdogQuiet ?? 0, watchdogLog: mem.watchdogLog ?? [], failedMoves: mem.failedMoves, hpMin: rec.hpMin, boss: { ...rec.boss, hpMin: rec.boss.hpMin === Infinity ? null : rec.boss.hpMin, fightTicks: rec.boss.killed !== null && rec.boss.engaged !== null ? rec.boss.killed - rec.boss.engaged : null }, floors: rec.floors ?? {}, victory: rec.victory ?? null, quests: { done: Object.keys(rec.qDone ?? {}), all: QUEST_IDS.every((id) => rec.qDone?.[id] !== undefined), ticks: rec.qDone ?? {}, mainSteps: rec.mainSteps ?? [], arcs: rec.arcsDone ?? [], trips: mem.q?.trips ?? 0, tripTicks: mem.q?.tripTicks ?? 0, tripStages: (mem.q?.stageTicks ?? []).map((t, i) => (t === undefined ? null : { depth: QBOT.trips[i].depth, ticks: t })).filter(Boolean), gaveUp: Object.keys(mem.q?.gaveUp ?? {}) }, depth: view.deepestDepth ?? 1, level: rec.maxLevel, deaths: rec.deaths + (rec.result === "died" ? 1 : 0), gold: view.player.gold - (rec.gold0 ?? 0), worn: Object.values(view.equipment ?? {}).filter(Boolean).length, loot: (view.groundItems ?? []).length };
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Aggregate per-run results into the numbers the report shows. */
export function summarise(runs) {
  const ttk = runs.flatMap((r) => r.ttk);
  const count = (k) => runs.filter((r) => r.result === k).length;
  return {
    runs: runs.length, won: count("won"), bossFightSecMean: +mean(runs.filter((r) => r.boss?.fightTicks).map((r) => r.boss.fightTicks / TICKS_PER_SECOND)).toFixed(1), bossHpMinMean: +mean(runs.filter((r) => r.boss?.hpMin != null).map((r) => r.boss.hpMin)).toFixed(1), bossArenaDeaths: runs.reduce((a, r) => a + (r.boss?.deathsInArena ?? 0), 0), cleared: count("cleared"), died: count("died"), timeout: count("timeout"),
    kills: runs.reduce((a, r) => a + r.kills, 0), monsters: runs.reduce((a, r) => a + (r.total ?? 0), 0),
    ttkMeanSec: +(mean(ttk) / TICKS_PER_SECOND).toFixed(2), ttkMaxSec: +(Math.max(0, ...ttk) / TICKS_PER_SECOND).toFixed(2),
    stuckEvents: runs.reduce((a, r) => a + r.stuck, 0), waitGaveUp: runs.reduce((a, r) => a + r.waitGaveUp, 0), watchdogFired: runs.reduce((a, r) => a + (r.watchdogFired ?? 0), 0), watchdogQuiet: runs.reduce((a, r) => a + (r.watchdogQuiet ?? 0), 0), failedMoves: runs.reduce((a, r) => a + r.failedMoves, 0),
    meanDepth: +mean(runs.map((r) => r.depth ?? 1)).toFixed(2), maxDepth: Math.max(1, ...runs.map((r) => r.depth ?? 1)), meanLevel: +mean(runs.map((r) => r.level ?? 1)).toFixed(1), deaths: runs.reduce((a, r) => a + (r.deaths ?? 0), 0),
    questsAll: runs.filter((r) => r.quests?.all).length,
    meanRunSec: +(mean(runs.map((r) => r.ticks)) / TICKS_PER_SECOND).toFixed(1),
  };
}

export function table(runs) {
  const rows = runs.map((r) => `| ${r.seed} | ${r.result} | ${r.depth ?? 1} | ${r.level ?? 1} | ${r.kills}/${r.total} | ${(r.ticks / TICKS_PER_SECOND).toFixed(0)} s | ${r.hpMin} | ${r.deaths ?? 0} | ${r.stuck} |`);
  return ["| seed | result | depth | level | kills | game time | min hp | deaths | stuck |", "|---|---|---|---|---|---|---|---|---|", ...rows].join("\n");
}
