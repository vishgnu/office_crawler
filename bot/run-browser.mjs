// Browser bot run: the same policy as run-headless.mjs, executed against the built game through window.__app
// (Playwright, headless Chromium). An automated playtest: it explores, fights and dies or clears the floor, and
// fails if the page throws or logs an error. Usage: node bot/run-browser.mjs [runs=5] [maxTicks=12000] [reckless]
import { launch, open } from "../e2e/helpers.mjs";
import { BOT, createBotMemory, decide, noteResult } from "./policy.js";
import { createRecorder, observe, finish, summarise, table } from "./report.js";

export async function runBrowser(n = 5, maxTicks = 12000, profile = {}, firstSeed = 1) {
  const browser = await launch();
  const g = await open(browser, { query: "test=1&seed=1" });
  const runs = [];
  for (let i = 0; i < n; i++) {
    const seed = firstSeed + i, mem = createBotMemory(profile), rec = createRecorder(seed);
    let view = await g.app("newGame", { seed, ...(profile.class ? { class: profile.class } : {}) });
    observe(view, rec);
    while (view.scene === "floor" && !mem.done && view.tick < maxTicks) {
      const cmd = decide(view, mem);
      // one round trip per decision: apply the command through the hook, then advance a few ticks
      const out = await g.page.evaluate(([c, k]) => { const r = c ? window.__app.input(c) : null; return { r, s: window.__app.step(k) }; }, [cmd, BOT.decideEvery]);
      if (cmd) noteResult(mem, cmd, out.r);
      view = out.s;
      observe(view, rec);
    }
    if (view.scene === "floor") decide(view, mem);
    runs.push(finish(view, mem, rec, maxTicks));
  }
  const errors = [...g.errors];
  await browser.close();
  return { runs, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 5), maxTicks = Number(process.argv[3] ?? 12000), reckless = process.argv[4] === "reckless";
  const { runs, errors } = await runBrowser(n, maxTicks, { reckless });
  console.log(table(runs));
  console.log("\n" + JSON.stringify({ ...summarise(runs), pageErrors: errors.length }));
  if (errors.length) { console.log("PAGE ERRORS", errors.slice(0, 5)); process.exitCode = 1; }
}
