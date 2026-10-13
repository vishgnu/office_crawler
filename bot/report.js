// Shared bookkeeping for the bot runners: observe(view, rec) is called with every state-shaped view
// (the live core state in Node, a __app.getState() snapshot in the browser) and summarise() builds the report.
export const TICKS_PER_SECOND = 60;

export function createRecorder(seed) {
  return { seed, deaths: 0, maxLevel: 1, ids: new Set(), firstDamage: new Map(), kills: 0, ttk: [], seen: new Set(), total: null, hpMin: Infinity, hpLast: 0, tick: 0, result: "running", deathTick: null, clearTick: null, boss: { engaged: null, killed: null, hpMin: Infinity, deathsInArena: 0, phase2At: null } };
}

export function observe(view, rec) {
  const t = view.tick;
  rec.tick = t;
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
  rec.hpMin = Math.min(rec.hpMin, view.player.hp); rec.hpLast = view.player.hp;
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
  return { seed: rec.seed, result: rec.result, ticks: rec.tick, kills: rec.kills, total: rec.total, ttk: rec.ttk, stuck: mem.stuck, waitGaveUp: mem.waitGaveUp, failedMoves: mem.failedMoves, hpMin: rec.hpMin, boss: { ...rec.boss, hpMin: rec.boss.hpMin === Infinity ? null : rec.boss.hpMin, fightTicks: rec.boss.killed !== null && rec.boss.engaged !== null ? rec.boss.killed - rec.boss.engaged : null }, victory: rec.victory ?? null, depth: view.deepestDepth ?? 1, level: rec.maxLevel, deaths: rec.deaths + (rec.result === "died" ? 1 : 0), gold: view.player.gold - (rec.gold0 ?? 0), worn: Object.values(view.equipment ?? {}).filter(Boolean).length, loot: (view.groundItems ?? []).length };
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
    stuckEvents: runs.reduce((a, r) => a + r.stuck, 0), waitGaveUp: runs.reduce((a, r) => a + r.waitGaveUp, 0), failedMoves: runs.reduce((a, r) => a + r.failedMoves, 0),
    meanDepth: +mean(runs.map((r) => r.depth ?? 1)).toFixed(2), maxDepth: Math.max(1, ...runs.map((r) => r.depth ?? 1)), meanLevel: +mean(runs.map((r) => r.level ?? 1)).toFixed(1), deaths: runs.reduce((a, r) => a + (r.deaths ?? 0), 0),
    meanRunSec: +(mean(runs.map((r) => r.ticks)) / TICKS_PER_SECOND).toFixed(1),
  };
}

export function table(runs) {
  const rows = runs.map((r) => `| ${r.seed} | ${r.result} | ${r.depth ?? 1} | ${r.level ?? 1} | ${r.kills}/${r.total} | ${(r.ticks / TICKS_PER_SECOND).toFixed(0)} s | ${r.hpMin} | ${r.deaths ?? 0} | ${r.stuck} |`);
  return ["| seed | result | depth | level | kills | game time | min hp | deaths | stuck |", "|---|---|---|---|---|---|---|---|---|", ...rows].join("\n");
}
