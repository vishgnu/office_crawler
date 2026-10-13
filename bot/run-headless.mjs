// Headless bot run on the pure core (no browser). Usage: node bot/run-headless.mjs [runs=20] [maxTicks=200000] [reckless|-] [depth=8]
// Drives the same applyInput path as the real game; prints a summary and returns it as JSON on the last line.
import { newGame, step, applyInput } from "../src/core/index.js";
import { BOT, createBotMemory, decide, noteResult } from "./policy.js";
import { createRecorder, observe, finish, summarise, table } from "./report.js";

/**
 * profile: { reckless, depth (play on until this floor is clear; default 1 = clear floor 1 only), respawn (after a death go back
 * to the Lobby and continue; default false), maxDeaths (with respawn; default 3) }. A run that wants floors beyond 1 starts in the Lobby.
 */
export function runOne(seed, maxTicks = 20000, profile = {}) {
  const goal = profile.depth ?? 1, maxDeaths = profile.maxDeaths ?? 3;
  const state = newGame(seed, goal > 1 ? { start: "town" } : {}), mem = createBotMemory(profile), rec = createRecorder(seed);
  for (let i = 0; i < maxTicks && !mem.done; i++) {
    if (state.scene === "dead") {
      if (!profile.respawn || rec.deaths >= maxDeaths) break;
      noteResult(mem, { t: "respawn" }, applyInput(state, { t: "respawn" })); rec.deaths++; rec.result = "running";
    }
    if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) noteResult(mem, cmd, applyInput(state, cmd)); }
    step(state);
    observe(state, rec);
  }
  if (state.scene === "floor") decide(state, mem); // settle `done` for a floor cleared on the last tick
  return finish(state, mem, rec, maxTicks);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Usage: node bot/run-headless.mjs [runs=20] [maxTicks=200000] [reckless|-] [depth=8]: plays from the Lobby through the floors, respawning after a death.
  const n = Number(process.argv[2] ?? 20), maxTicks = Number(process.argv[3] ?? 200000), reckless = process.argv[4] === "reckless", depth = Number(process.argv[5] ?? 8);
  const runs = Array.from({ length: n }, (_, i) => runOne(i + 1, maxTicks, { reckless, depth, respawn: depth > 1, maxDeaths: 12 }));
  console.log(table(runs));
  const sum = summarise(runs);
  console.log("\n" + JSON.stringify(sum));
}
