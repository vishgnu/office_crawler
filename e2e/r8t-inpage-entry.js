// Bundled by r8t-fullrun.mjs into the page: the bot policy running inside the browser against window.__app (public input path only, no cheat.*).
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";
import { createRecorder, observe, finish } from "../bot/report.js";

let idle = 0, mem, rec, view, maxTicks, won = false, finished = false;
window.__bot = {
  init(profile, seed, max) { mem = createBotMemory(profile); rec = createRecorder(seed); maxTicks = max; view = window.__app.getState(); observe(view, rec); },
  /** Runs decisions until `budget` decisions are used, the depth changes, the scene is victory/over, or the tick limit is hit. */
  run(budget) {
    const d0 = view.depth;
    for (let i = 0; i < budget; i++) {
      if (view.scene === "dead") {
        if (rec.deaths >= 12) { finished = true; break; }
        const dd = view.depth; noteResult(mem, { t: "respawn" }, window.__app.input({ t: "respawn" })); rec.deaths++; (rec.deathDepths ??= []).push(dd); rec.result = "running"; view = window.__app.getState(); continue;
      }
      if (view.scene === "victory") { rec.result = "won"; rec.winTick = view.tick; rec.victory = view.victory?.stats ?? null; mem.done = true; won = true; finished = true; break; } // the victory scene stays up: the runner clicks "keep playing" with the real mouse
      if (view.tick >= maxTicks) { finished = true; break; }
      if (mem.done && !won) { // boss down, floor cleared: the finale scene follows a moment later
        if ((idle += BOT.decideEvery) > 3000) { finished = true; break; }
        view = window.__app.step(BOT.decideEvery); observe(view, rec); continue;
      }
      const cmd = decide(view, mem);
      const r = cmd ? window.__app.input(cmd) : null;
      if (cmd) noteResult(mem, cmd, r);
      view = window.__app.step(BOT.decideEvery); observe(view, rec);
      if (view.depth !== d0) break;
    }
    return { scene: view.scene, tick: view.tick, depth: view.depth, level: view.player.level, deaths: rec.deaths, finished, won, hp: view.player.hp };
  },
  result() { return { res: finish(view, mem, rec, maxTicks), won, scene: view.scene, tick: view.tick }; },
};
