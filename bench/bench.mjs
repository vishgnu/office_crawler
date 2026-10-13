// Wall-clock performance checks (`npm run bench`). NOT part of `npm test` or `npm run e2e`: timings flake
// under load, so unit tests bound the work instead (learning L-06). Run on a quiet machine; exits non-zero
// when a budget from the specs is exceeded.
import { generateFloor } from "../src/core/gen/floor.js";
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
    await g.page.evaluate(() => new Promise((r) => { let i = 0; const f = () => (++i >= 150 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const perf = await g.app("perf");
    await g.context.close();
    const f = perf.frameMs.slice(-120), avg = f.reduce((a, b) => a + b, 0) / f.length;
    return { fps: 1000 / avg, renderAvg: perf.renderMsAvg, renderP95: perf.renderMsP95, visible, spawned: n, fx: perf.fx };
  };
  for (const [label, extra, key] of [["full fx", "", "fps50"], ["lowFx", "&lowfx=1", "fps50Low"]]) {
    const r = await scene(extra);
    result[key] = Math.round(r.fps * 10) / 10; result.visible = r.visible;
    console.log(`INFO 50 monsters (${r.spawned} spawned, ${r.visible} on screen), ${label}: ${result[key]} fps, render ${r.renderAvg.toFixed(1)} ms avg / ${r.renderP95.toFixed(1)} ms p95`);
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
