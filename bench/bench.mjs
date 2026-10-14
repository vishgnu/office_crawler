// Wall-clock performance checks (`npm run bench`). NOT part of `npm test` or `npm run e2e`: timings flake
// under load, so unit tests bound the work instead (learning L-06). Run on a quiet machine; exits non-zero
// when a budget from the specs is exceeded.
import { generateFloor } from "../src/core/gen/floor.js";
import os from "node:os";
import { newGame, step, findPath, config } from "../src/core/index.js";

let failed = 0;
const report = (name, ms, budget, extra = "") => {
  const ok = ms < budget;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${Math.round(ms)} ms (budget ${budget} ms)${extra}`);
};
const time = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };

// AC-R-042-4: generation well under 500 ms per floor (worst of 50)
let worst = 0;
for (let i = 0; i < 50; i++) worst = Math.max(worst, time(() => generateFloor(1000 + i, 1)));
report("AC-R-042-4 floor generation, worst of 50", worst, 500);

// AC-R-122-2: 10,000 idle ticks well under 10 s
report("AC-R-122-2 10,000 idle ticks", time(() => { const s = newGame(1); for (let i = 0; i < 10000; i++) step(s); }), 10000);

// AC-R-005-9: enclosed goal on a 100x100 grid returns quickly
const wall = (x, y) => Math.abs(Math.abs(x - 50) - 2) === 0 && Math.abs(y - 50) <= 2 || Math.abs(Math.abs(y - 50) - 2) === 0 && Math.abs(x - 50) <= 2;
const g = { width: 100, height: 100, walkable: (x, y) => x >= 0 && y >= 0 && x < 100 && y < 100 && !wall(x, y) };
report("AC-R-005-9 enclosed goal on 100x100", time(() => findPath(g, 0, 0, 50, 50, 10000, config.pathDiagCost)), 1000);

// ADR-0004 + NFR-P01: atlas build and a 50-monster scene in the real browser (headless Chromium, software GL: pessimistic).
// Report fps from real animation frames. The scene is 1920x1080 at zoom 1 (the playing zoom is 1.8) so that 50 monsters are actually on screen.
const FPS_TARGET = 40;
const result = { fps50: null, fps50Low: null, visible: null };
try {
  const { launch, open, freeTilesNear } = await import("../e2e/helpers.mjs");
  const browser = await launch();
  const page0 = await open(browser);
  const perf0 = await page0.app("perf");
  report("ADR-0004 atlas build", perf0.atlasMs, 5000, `, ${perf0.atlasKeys} sprites`);
  await page0.context.close();

  const scene = async (extra) => {
    const g = await open(browser, { query: `test=1&seed=3&zoom=1${extra}`, viewport: { width: 1920, height: 1080 } });
    await g.app("newGame", { seed: 3 });
    let s = await g.app("step", 30);
    const types = ["zombie-intern", "printer-imp"];
    let n = 0;
    for (const t of freeTilesNear(s, s.player.tile, 12, 2)) {
      if (n >= 50) break;
      if ((await g.app("cheat.spawnMonster", types[n % 2], { x: t.x, y: t.y })).ok) n++;
    }
    s = await g.app("step", 6); // a few ticks so the pack members start to move
    const visible = s.monsters.filter((m) => { const c = s.ui.camera, x = c.ox + (m.pos.x - m.pos.y) * 32 * c.z + 32 * c.z, y = c.oy + (m.pos.x + m.pos.y + 1) * 16 * c.z; return x > 0 && x < c.w && y > 0 && y < c.h; }).length;
    await g.page.waitForTimeout(1500); // warm-up
    // the lazy sprites of the new types are drawn a few per frame in the first seconds after they appear (world.js warmFrames); wait until that is done so the window is steady state
    for (let i = 0, last = -1; i < 60; i++) { const c = await g.page.evaluate(() => window.__atlasStats?.lazy ?? 0); if (c === last) break; last = c; await g.page.waitForTimeout(400); }
    // the measured window: 150 real frames; every frame's dt, the atlas first-use counters and heap drops (GC) are recorded inside it
    const win = await g.page.evaluate(() => new Promise((r) => {
      const st = window.__atlasStats ?? { lazy: 0, lazyMs: 0, sil: 0, silMs: 0 }, s0 = { ...st }, dts = [], mem = () => performance.memory?.usedJSHeapSize ?? 0;
      let i = 0, drops = 0, last = performance.now(), m0 = mem(), mPrev = m0;
      const f = (t) => {
        dts.push(t - last); last = t; const m = mem(); if (m < mPrev - 20000) drops++; mPrev = m;
        if (++i >= 150) r({ dts: dts.slice(1), heapDrops: drops, lazy: st.lazy - s0.lazy, lazyMs: st.lazyMs - s0.lazyMs, sil: st.sil - s0.sil, silMs: st.silMs - s0.silMs, heapGrowthKB: Math.round((mem() - m0) / 1024) });
        else requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }));
    const perf = await g.app("perf");
    await g.context.close();
    const f = win.dts.slice(-120), avg = f.reduce((a, b) => a + b, 0) / f.length;
    const sorted = [...win.dts].sort((a, b) => a - b), q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    return { fps: 1000 / avg, renderAvg: perf.renderMsAvg, renderP95: perf.renderMsP95, visible, spawned: n, fx: perf.fx,
      frame: { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: sorted[sorted.length - 1], over25: sorted.filter((d) => d > 25).length }, win };
  };
  for (const [label, extra, key] of [["full fx", "", "fps50"], ["lowFx", "&lowfx=1", "fps50Low"]]) {
    const r = await scene(extra);
    result[key] = Math.round(r.fps * 10) / 10; result.visible = r.visible;
    console.log(`INFO 50 monsters (${r.spawned} spawned, ${r.visible} on screen), ${label}: ${result[key]} fps, render ${r.renderAvg.toFixed(1)} ms avg / ${r.renderP95.toFixed(1)} ms p95`);
    const fr = r.frame, w = r.win;
    console.log(`INFO   frame ms p50 ${fr.p50.toFixed(1)} p95 ${fr.p95.toFixed(1)} p99 ${fr.p99.toFixed(1)} max ${fr.max.toFixed(1)}, ${fr.over25} frames > 25 ms; in window: ${w.lazy} lazy draws (${w.lazyMs.toFixed(1)} ms), ${w.sil} silhouettes (${w.silMs.toFixed(1)} ms), ${w.heapDrops} heap drops (GC), heap +${w.heapGrowthKB} KB; load ${os.loadavg().map((x) => x.toFixed(2)).join(" ")}`);
    result[key + "Frame"] = { p50: +fr.p50.toFixed(1), p95: +fr.p95.toFixed(1), p99: +fr.p99.toFixed(1), max: +fr.max.toFixed(1), lazy: w.lazy, sil: w.sil, gc: w.heapDrops };
  }
  // New floor in play (PERF-R6, CR6-04, STUTTER-R7): real animation frames (?realtime=1, the game's own loop runs the simulation and the render, nothing is stepped by hand)
  // for 300 frames (about 5 s) after the floor loads. "ahead": the hero has been on the floor above for a while (the idle warm of the next floor's monster types has run: it
  // is polled through window.__atlasStats.warmLeft, at most 40 s) = a normal stairs descent. "cold": the load comes right after the first frames (a teleport cheat, or stairs
  // taken at once) = the worst case. Frame ms: p50 / p99 / max over those frames; first-use draws inside the window are counted.
  for (const [mode, depth] of [["ahead", 2], ["ahead", 5], ["cold", 2], ["cold", 5]]) {
    const g = await open(browser, { query: "test=1&realtime=1&seed=3&zoom=1.8", viewport: { width: 1280, height: 720 } });
    if (process.env.NOAHEAD) await g.page.evaluate(() => { window.__noAhead = true; }); // baseline switch: warm of the current floor only (the R6 behaviour)
    await g.app("newGame", { seed: 3 });
    await g.page.waitForTimeout(800);
    if (mode === "ahead") {
      if (depth > 2) { await g.app("cheat.teleportFloor", depth - 1); await g.page.waitForTimeout(500); }
      for (let i = 0; i < 100; i++) { const left = await g.page.evaluate(() => window.__atlasStats?.warmLeft ?? 0); if (left === 0 && i > 2) break; await g.page.waitForTimeout(400); }
    }
    await g.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await g.app("cheat.teleportFloor", depth);
    const w = await g.page.evaluate(() => new Promise((r) => {
      const st = window.__atlasStats ?? { lazy: 0, lazyMs: 0 }, s0 = { ...st }, dts = [];
      let i = 0, last = performance.now();
      const f = (t) => {
        dts.push(t - last); last = t;
        if (++i >= 300) r({ dts: dts.slice(1), lazy: st.lazy - s0.lazy, lazyMs: st.lazyMs - s0.lazyMs });
        else requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }));
    const s = await g.app("getState");
    await g.context.close();
    const d = [...w.dts].sort((a, b) => a - b);
    const r = { p50: d[d.length >> 1], p99: d[Math.floor(d.length * 0.99)], max: d[d.length - 1], over33: d.filter((x) => x > 34).length };
    console.log(`INFO floor ${depth} load, ${mode} (${new Set(s.monsters.map((m) => m.type)).size} monster types), 300 real frames after the load: frame ms p50 ${r.p50.toFixed(1)} p99 ${r.p99.toFixed(1)} max ${r.max.toFixed(1)}, ${r.over33} frames > 34 ms; ${w.lazy} lazy draws (${w.lazyMs.toFixed(0)} ms); load ${os.loadavg().map((x) => x.toFixed(2)).join(" ")}`);
    result["floor" + depth + (mode === "cold" ? "Cold" : "")] = { p50: +r.p50.toFixed(1), p99: +r.p99.toFixed(1), frameMax: +r.max.toFixed(1), over34: r.over33, lazy: w.lazy };
  }
  const ok = result.fps50 >= FPS_TARGET;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} NFR-P01 50 monsters on screen, full fx: ${result.fps50} fps (target >= ${FPS_TARGET}; lowFx ${result.fps50Low} fps)`);
  await browser.close();
} catch (err) {
  console.log(`SKIP browser benches (no browser or no dist build: ${String(err.message).split("\n")[0]})`);
}
console.log(`BENCH_JSON ${JSON.stringify(result)}`);
console.log(failed ? `\nBENCH FAILED: ${failed} over budget` : "\nBENCH OK");
process.exit(failed ? 1 : 0);
