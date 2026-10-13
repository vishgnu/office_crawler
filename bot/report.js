// Shared bookkeeping for the bot runners: observe(view, rec) is called with every state-shaped view
// (the live core state in Node, a __app.getState() snapshot in the browser) and summarise() builds the report.
export const TICKS_PER_SECOND = 60;

export function createRecorder(seed) {
  return { seed, firstDamage: new Map(), kills: 0, ttk: [], seen: new Set(), total: null, hpMin: Infinity, hpLast: 0, tick: 0, result: "running", deathTick: null, clearTick: null };
}

export function observe(view, rec) {
  const t = view.tick;
  rec.tick = t;
  if (rec.total === null) rec.total = view.monsters.length;
  for (const m of view.monsters) {
    if (!rec.firstDamage.has(m.id) && m.hp < m.hpMax) rec.firstDamage.set(m.id, t);
    if (m.ai === "dead" && !rec.seen.has(m.id)) {
      rec.seen.add(m.id); rec.kills++;
      rec.ttk.push(t - (rec.firstDamage.get(m.id) ?? t)); // time from the first damage dealt to the kill
    }
  }
  rec.hpMin = Math.min(rec.hpMin, view.player.hp); rec.hpLast = view.player.hp;
  if (view.scene === "dead" && rec.result === "running") { rec.result = "died"; rec.deathTick = t; }
}

export function finish(view, mem, rec, maxTicks) {
  if (rec.result === "running") {
    if (mem.done) { rec.result = "cleared"; rec.clearTick = view.tick; }
    else if (view.tick >= maxTicks) rec.result = "timeout";
  }
  return { seed: rec.seed, result: rec.result, ticks: rec.tick, kills: rec.kills, total: rec.total, ttk: rec.ttk, stuck: mem.stuck, waitGaveUp: mem.waitGaveUp, failedMoves: mem.failedMoves, hpMin: rec.hpMin };
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Aggregate per-run results into the numbers the report shows. */
export function summarise(runs) {
  const ttk = runs.flatMap((r) => r.ttk);
  const count = (k) => runs.filter((r) => r.result === k).length;
  return {
    runs: runs.length, cleared: count("cleared"), died: count("died"), timeout: count("timeout"),
    kills: runs.reduce((a, r) => a + r.kills, 0), monsters: runs.reduce((a, r) => a + (r.total ?? 0), 0),
    ttkMeanSec: +(mean(ttk) / TICKS_PER_SECOND).toFixed(2), ttkMaxSec: +(Math.max(0, ...ttk) / TICKS_PER_SECOND).toFixed(2),
    stuckEvents: runs.reduce((a, r) => a + r.stuck, 0), waitGaveUp: runs.reduce((a, r) => a + r.waitGaveUp, 0), failedMoves: runs.reduce((a, r) => a + r.failedMoves, 0),
    meanRunSec: +(mean(runs.map((r) => r.ticks)) / TICKS_PER_SECOND).toFixed(1),
  };
}

export function table(runs) {
  const rows = runs.map((r) => `| ${r.seed} | ${r.result} | ${r.kills}/${r.total} | ${(r.ticks / TICKS_PER_SECOND).toFixed(0)} s | ${r.hpMin} | ${r.stuck} |`);
  return ["| seed | result | kills | game time | min hp | stuck |", "|---|---|---|---|---|---|", ...rows].join("\n");
}
