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

// ADR-0004: sprite atlas build in the real browser
try {
  const { launch, open } = await import("../e2e/helpers.mjs");
  const browser = await launch();
  const page = await open(browser);
  const perf = await page.app("perf");
  report("ADR-0004 atlas build", perf.atlasMs, 5000, `, ${perf.atlasKeys} sprites`);
  await browser.close();
} catch (err) {
  console.log(`SKIP atlas build (no browser or no dist build: ${String(err.message).split("\n")[0]})`);
}
console.log(failed ? `\nBENCH FAILED: ${failed} over budget` : "\nBENCH OK");
process.exit(failed ? 1 : 0);
