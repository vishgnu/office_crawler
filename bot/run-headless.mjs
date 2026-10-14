// Headless bot run on the pure core (no browser). Usage: node bot/run-headless.mjs [runs=20] [maxTicks=200000] [reckless|-] [depth=9]
// Drives the same applyInput path as the real game; prints a summary and returns it as JSON on the last line.
import { newGame, step, applyInput, classes } from "../src/core/index.js";
import { BOT, createBotMemory, decide, noteResult } from "./policy.js";
import { createRecorder, observe, finish, summarise, table } from "./report.js";

/**
 * profile: { class (a class id; default the Facilities Manager), reckless, depth (play on until this floor is clear; default 1 = clear floor 1 only), respawn (after a death go back
 * to the Lobby and continue; default false), maxDeaths (with respawn; default 3) }. A run that wants floors beyond 1 starts in the Lobby.
 */
export function runOne(seed, maxTicks = 20000, profile = {}) {
  const goal = profile.depth ?? 1, maxDeaths = profile.maxDeaths ?? 3; // goal 9 = play on to the boss (the Executive Suite), beat it and keep playing
  const state = newGame(seed, { ...(goal > 1 ? { start: "town" } : {}), ...(profile.class ? { class: profile.class } : {}) }), mem = createBotMemory(profile), rec = createRecorder(seed);
  for (let i = 0; i < maxTicks && !(mem.done && !(state.victory && !state.victory.done)); i++) { // after the boss falls, play on to the victory screen
    if (state.scene === "dead") {
      if (!profile.respawn || rec.deaths >= maxDeaths) break;
      noteResult(mem, { t: "respawn" }, applyInput(state, { t: "respawn" })); rec.deaths++; rec.result = "running";
    }
    if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) noteResult(mem, cmd, applyInput(state, cmd)); }
    step(state);
    observe(state, rec);
    if (state.scene === "victory") { // the finale: record it and choose "keep playing" (back to the Lobby)
      rec.result = "won"; rec.winTick = state.tick; rec.victory = state.victory?.stats ?? null;
      noteResult(mem, { t: "keepPlaying" }, applyInput(state, { t: "keepPlaying" })); mem.done = true;
    }
  }
  if (state.scene === "floor") decide(state, mem); // settle `done` for a floor cleared on the last tick
  return finish(state, mem, rec, maxTicks);
}

const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
/** Per-class balance line (R-230 tooling): wins, median time to the boss kill in minutes, median deaths. */
export function classLine(runs) {
  const won = runs.filter((r) => r.result === "won");
  return { runs: runs.length, won: won.length, medianWinMin: won.length ? +(median(won.map((r) => r.ticks / 3600)) ?? 0).toFixed(1) : null, medianDeaths: median(runs.map((r) => r.deaths ?? 0)), medianLevel: median(runs.map((r) => r.level ?? 1)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Usage: node bot/run-headless.mjs [runs=20] [maxTicks=200000] [reckless|-] [depth=9] [class|all]: plays from the Lobby through the floors to the boss,
  // respawning after a death. `class` is a class id or `all` (every class, with a per-class line: win count, median clear time in minutes, median deaths).
  const n = Number(process.argv[2] ?? 20), maxTicks = Number(process.argv[3] ?? 200000), reckless = process.argv[4] === "reckless", depth = Number(process.argv[5] ?? 9);
  const which = process.argv[6] ?? "facilities-manager", ids = which === "all" ? classes.map((c) => c.id) : [which];
  const perClass = {};
  for (const id of ids) {
    const runs = Array.from({ length: n }, (_, i) => runOne(i + 1, maxTicks, { reckless, depth, respawn: depth > 1, maxDeaths: 12, class: id }));
    console.log(`\n== ${id}\n` + table(runs));
    const sum = summarise(runs);
    console.log("\n" + JSON.stringify({ class: id, ...sum }));
    perClass[id] = classLine(runs);
  }
  if (ids.length > 1) console.log("\n" + JSON.stringify({ perClass }));
}

