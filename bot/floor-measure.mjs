// R8-A3 measurement: per class and floor 1-4 (bot route, quests on, from the Lobby): level on entry, deaths, near-deaths (hp < 25 %), lowest hp share, minutes.
// Usage: node bot/floor-measure.mjs [seeds=24] [maxTicks=60000]   (seeds 1..N, stops each run when it first reaches floor 5)
import { fork } from "node:child_process";
import { newGame, step, applyInput, classes } from "../src/core/index.js";
import { BOT, createBotMemory, decide, noteResult } from "./policy.js";
import { createRecorder, observe, observeEvents } from "./report.js";

export function measure(seed, cls, maxTicks) {
  const state = newGame(seed, { start: "town", class: cls }), mem = createBotMemory({ depth: 9, respawn: true, maxDeaths: 12, class: cls }), rec = createRecorder(seed);
  const fl = {}, F = (d) => (fl[d] ??= { entryLevel: null, deaths: 0, near: 0, lowest: 1, ticks: 0 });
  let lastDepth = 0;
  for (let i = 0; i < maxTicks; i++) {
    if (state.scene === "dead") {
      if (rec.deaths >= 12) break;
      F(state.depth).deaths++; noteResult(mem, { t: "respawn" }, applyInput(state, { t: "respawn" })); rec.deaths++; rec.result = "running";
    }
    if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) { noteResult(mem, cmd, applyInput(state, cmd)); observeEvents(state, rec); } }
    step(state); observe(state, rec);
    const d = state.depth;
    if (d >= 5) break;
    if (d >= 1 && state.scene === "floor") {
      const f = F(d);
      if (d !== lastDepth && f.entryLevel === null) f.entryLevel = state.player.level;
      f.ticks++; if (state.player.hp > 0) f.lowest = Math.min(f.lowest, state.player.hp / state.player.hpMax);
    }
    if (d !== lastDepth && d >= 1) lastDepth = d;
    if (d === 0) lastDepth = 0;
  }
  for (const [d, v] of Object.entries(rec.floors ?? {})) if (fl[d]) fl[d].near = v.near;
  return fl;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === "--one") { const [, , , cls, seed, mt] = process.argv; process.send(measure(+seed, cls, +mt)); process.exit(0); }
  const n = Number(process.argv[2] ?? 24), maxTicks = Number(process.argv[3] ?? 60000);
  const jobs = []; for (let s = 1; s <= n; s++) for (const c of classes) jobs.push({ id: c.id, seed: s });
  const res = Object.fromEntries(classes.map((c) => [c.id, []])); let next = 0, live = 0;
  await new Promise((done) => {
    const pump = () => {
      while (live < 3 && next < jobs.length) { const j = jobs[next++]; live++; const ch = fork(new URL(import.meta.url).pathname, ["--one", j.id, String(j.seed), String(maxTicks)]); ch.on("message", (r) => res[j.id].push(r)); ch.on("exit", () => { live--; pump(); if (!live && next >= jobs.length) done(); }); }
    };
    pump();
  });
  const med = (a) => { const b = a.filter((x) => x !== null && x !== undefined).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  console.log(`| floor | class | runs | median entry lvl | deaths | near-deaths | median lowest hp % | runs below 40 % | median min |\n|---|---|---|---|---|---|---|---|---|`);
  for (let d = 1; d <= 4; d++) for (const c of classes) {
    const rows = res[c.id].map((r) => r[d]).filter(Boolean);
    console.log(`| ${d} | ${c.id} | ${rows.length} | ${med(rows.map((r) => r.entryLevel))} | ${rows.reduce((a, r) => a + r.deaths, 0)} | ${rows.reduce((a, r) => a + r.near, 0)} | ${(100 * med(rows.map((r) => r.lowest))).toFixed(0)} | ${rows.filter((r) => r.lowest < 0.4).length} | ${(med(rows.map((r) => r.ticks)) / 3600).toFixed(1)} |`);
  }
}
