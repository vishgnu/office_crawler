// Headless bot run on the pure core (no browser). Usage: node bot/run-headless.mjs [runs=20] [maxTicks=20000] [reckless]
// Drives the same applyInput path as the real game; prints a summary and returns it as JSON on the last line.
import { newGame, step, applyInput } from "../src/core/index.js";
import { BOT, createBotMemory, decide, noteResult } from "./policy.js";
import { createRecorder, observe, finish, summarise, table } from "./report.js";

export function runOne(seed, maxTicks = 20000, profile = {}) {
  const state = newGame(seed), mem = createBotMemory(profile), rec = createRecorder(seed);
  for (let i = 0; i < maxTicks && state.scene === "floor" && !mem.done; i++) {
    if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) noteResult(mem, cmd, applyInput(state, cmd)); }
    step(state);
    observe(state, rec);
  }
  if (state.scene === "floor") decide(state, mem); // settle `done` for a floor cleared on the last tick
  return finish(state, mem, rec, maxTicks);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 20), maxTicks = Number(process.argv[3] ?? 20000), reckless = process.argv[4] === "reckless";
  const runs = Array.from({ length: n }, (_, i) => runOne(i + 1, maxTicks, { reckless }));
  console.log(table(runs));
  const sum = summarise(runs);
  console.log("\n" + JSON.stringify(sum));
}
