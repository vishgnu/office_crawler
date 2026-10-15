// R8-T no-cheat full run per class to the boss in a real (headless Chromium) browser. Usage: node e2e/r8t-fullrun.mjs <class> [seed=1] [maxTicks=400000]
// Start through the real UI (New game -> class card -> name -> Start). Then public inputs only (the bot policy's commands via window.__app.input; no cheat.* call).
// The game clock is the test hook's manual clock (step(k)), not wall time, so a full run takes minutes, not hours.
import { launch, open, startNew, SHOTS, check, finish } from "./helpers.mjs";
import { writeFileSync } from "node:fs";

const cls = process.argv[2] ?? "facilities-manager", seed = Number(process.argv[3] ?? 1), maxTicks = Number(process.argv[4] ?? 400000);
const t0 = Date.now();
const browser = await launch();
const g = await open(browser, { query: `test=1&seed=${seed}`, lobby: true });
await startNew(g.page, { cls, name: "Runner" });
let view = await g.state();
check(`[${cls}] starts in the Lobby via the real UI`, view.scene === "town" || view.depth === 0, { scene: view.scene, depth: view.depth });
check(`[${cls}] class is ${cls}`, (view.player.class ?? view.player.classId) === cls, view.player.class);
const profile = { depth: 9, respawn: true, maxDeaths: 12, class: cls };
const { build } = await import("esbuild");
const bundle = (await build({ entryPoints: ["e2e/r8t-inpage-entry.js"], bundle: true, format: "iife", write: false, target: "es2022" })).outputFiles[0].text;
await g.page.evaluate(bundle);
await g.page.evaluate(([p, sd, m]) => window.__bot.init(p, sd, m), [profile, seed, maxTicks]);
const shot = async (n) => g.page.screenshot({ path: `${SHOTS}/r8t-${cls}-${n}.png` });
const depthShots = new Set(); let st, won = false, lastLog = 0;
for (;;) {
  st = await g.page.evaluate(() => window.__bot.run(400));
  if (st.tick - lastLog >= 6000) { lastLog = st.tick; console.log(`progress ${cls} tick ${st.tick} depth ${st.depth} lvl ${st.level} deaths ${st.deaths} wall ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
  if (!depthShots.has(st.depth)) { depthShots.add(st.depth); await shot(`d${st.depth}`); }
  if (st.finished) break;
}
await shot(st.won ? "victory-after" : "end");
let victoryUi = null;
if (st.won) {
  victoryUi = await g.page.evaluate(() => ({ scene: window.__app.getState().scene, btns: [...document.querySelectorAll("#overlay button")].map((b) => b.dataset.testid), text: document.querySelector("#overlay")?.innerText.slice(0, 300) }));
  console.log("victory UI", JSON.stringify(victoryUi));
  const keep = await g.page.$('#overlay [data-testid="keep-playing"]') ?? await g.page.$('#overlay button');
  if (keep) await keep.click(); // real mouse click on the main button of the victory screen
  await g.page.waitForTimeout(200);
  const after = await g.state();
  check(`[${cls}] real click on the victory button returns to play (scene ${after.scene}, depth ${after.depth})`, after.scene !== "victory", after.scene);
  await g.page.evaluate(() => window.__app.save.write());
  const raw = await g.page.evaluate(() => window.__app.save.read());
  check(`[${cls}] victory/boss-defeated flags are in the save`, raw && (raw.bossDefeated === true), raw && raw.bossDefeated);
}
const R = await g.page.evaluate(() => window.__bot.result());
won = R.won; view = { tick: R.tick, scene: R.scene };
const res = R.res;
check(`[${cls}] reached the boss floor (deepest ${res.depth})`, res.depth >= 9, res.depth);
check(`[${cls}] beat the boss and saw the victory scene`, won, { result: res.result, tick: view.tick, scene: view.scene });
check(`[${cls}] no page errors`, g.errors.length === 0, g.errors.slice(0, 5));
check(`[${cls}] no network requests beyond the file`, g.requests.every((u) => u.startsWith("file:") || u.startsWith("data:") || u.startsWith("blob:")), g.requests.filter((u) => !u.startsWith("file:")).slice(0, 5));
const summary = { class: cls, seed, result: res.result, won, deaths: res.deaths, deathDepths: res.deathDepths, level: res.level, depth: res.depth, gameMin: +(view.tick / 3600).toFixed(1), wallSec: +((Date.now() - t0) / 1000).toFixed(0), stuck: res.stuck, failedMoves: res.failedMoves, watchdog: res.watchdogFired, quests: { all: res.quests.all, done: res.quests.done, gaveUp: res.quests.gaveUp, trips: res.quests.trips }, boss: res.boss, floors: Object.fromEntries(Object.entries(res.floors).map(([d, f]) => [d, { min: +(f.ticks / 3600).toFixed(1), dmg: f.dmg, near: f.near }])), pageErrors: g.errors.length };
console.log(JSON.stringify(summary));
writeFileSync(`${SHOTS}/r8t-fullrun-${cls}.json`, JSON.stringify(summary, null, 1));
await browser.close();
finish(`r8t-fullrun ${cls}`);
