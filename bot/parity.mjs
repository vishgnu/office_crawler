// Class parity report (R-230, R6-1): every class over N fixed seeds, whole run to the boss, in parallel worker processes.
// Usage: node bot/parity.mjs [seeds=12] [maxTicks=150000] [out.json]   (seeds 1..N; prints the parity table, damage share per skill and the band verdict)
//        node bot/parity.mjs --read out.json                           (reprint a saved run)
// Band (circle-02 Q7 option A): median clear time and median deaths of each class within 25 % of the three-class median; clear time 20 to 40 min; no tree skill above 50 % of the damage the class's tree skills deal (basic attacks reported apart).
import { fork } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { classes } from "../src/core/index.js";
import { runOne } from "./run-headless.mjs";

const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const f1 = (v) => (v === null || v === undefined ? "n/a" : (+v).toFixed(1));

/** Pure: per-class summary, band verdicts and damage share from run results ({ [classId]: run[] }). */
export function parity(byClass) {
  const rows = {};
  for (const [id, runs] of Object.entries(byClass)) {
    const won = runs.filter((r) => r.result === "won"), min = won.map((r) => r.ticks / 3600);
    const dmg = {}; let total = 0;
    for (const r of runs) for (const [k, v] of Object.entries(r.dmg ?? {})) { dmg[k] = (dmg[k] ?? 0) + v; total += v; }
    const share = Object.entries(dmg).map(([k, v]) => [k, v / (total || 1)]).sort((a, b) => b[1] - a[1]);
    const BASIC = new Set(["basic-melee", "toss", "zap"]), tree = share.filter(([k]) => !BASIC.has(k)), treeTotal = tree.reduce((a, [, v]) => a + v, 0);
    const dd = {}; for (const r of runs) for (const d of r.deathDepths ?? []) dd[d] = (dd[d] ?? 0) + 1;
    rows[id] = { deathsByDepth: dd, basicShare: share.filter(([k]) => BASIC.has(k)).reduce((a, [, v]) => a + v, 0), topTree: tree[0]?.[0] ?? null, topTreeShare: treeTotal ? tree[0][1] / treeTotal : 0, runs: runs.length, won: won.length, medianMin: median(min), minMin: min.length ? Math.min(...min) : null, maxMin: min.length ? Math.max(...min) : null, medianDeaths: median(runs.map((r) => r.deaths ?? 0)), meanDeaths: mean(runs.map((r) => r.deaths ?? 0)), medianLevel: median(runs.map((r) => r.level ?? 1)), share };
  }
  const ids = Object.keys(rows), mT = median(ids.map((i) => rows[i].medianMin).filter((v) => v !== null)), mD = median(ids.map((i) => rows[i].medianDeaths));
  for (const id of ids) {
    const r = rows[id], dev = (v, m) => (m ? (v - m) / m : 0);
    r.timeDev = r.medianMin === null ? null : dev(r.medianMin, mT); r.deathDev = dev(r.medianDeaths, mD);
    r.inTime = r.timeDev !== null && Math.abs(r.timeDev) <= 0.25; r.inDeaths = Math.abs(r.deathDev) <= 0.25;
    r.inWindow = r.medianMin !== null && r.medianMin >= 20 && r.medianMin <= 40; r.noDominant = r.topTreeShare <= 0.5;
    r.pass = r.inTime && r.inDeaths && r.inWindow && r.noDominant;
  }
  return { rows, medianMin: mT, medianDeaths: mD };
}

export function print(p, byClass) {
  const out = ["| class | runs | wins | median min (min-max) | dev | median deaths | dev | mean deaths | median level | basic attack share | top tree skill (share of tree damage) | verdict |", "|---|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const [id, r] of Object.entries(p.rows)) out.push(`| ${id} | ${r.runs} | ${r.won} | ${f1(r.medianMin)} (${f1(r.minMin)}-${f1(r.maxMin)}) | ${r.timeDev === null ? "n/a" : (r.timeDev * 100).toFixed(0) + " %"} | ${r.medianDeaths} | ${(r.deathDev * 100).toFixed(0)} % | ${f1(r.meanDeaths)} | ${r.medianLevel} | ${(r.basicShare * 100).toFixed(0)} % | ${r.topTree} ${(r.topTreeShare * 100).toFixed(0)} % | ${r.pass ? "in band" : "OUT: " + [!r.inTime && "time", !r.inDeaths && "deaths", !r.inWindow && "20-40 min", !r.noDominant && "dominant skill"].filter(Boolean).join(", ")} |`);
  out.push("", `Three-class median: ${f1(p.medianMin)} min, ${p.medianDeaths} deaths.`, "", "Damage share per skill (all runs of the class, damage dealt to monsters):");
  for (const [id, r] of Object.entries(p.rows)) out.push(`- ${id}: ` + r.share.filter(([, s]) => s >= 0.01).map(([k, s]) => `${k} ${(s * 100).toFixed(0)} %`).join(", "));
  out.push("", "Deaths by depth (all runs; 9 = boss arena):");
  for (const [id, r] of Object.entries(p.rows)) out.push(`- ${id}: ` + Object.entries(r.deathsByDepth).map(([d, n]) => `d${d} ${n}`).join(", "));
  return out.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === "--one") { // worker: one run, result back to the parent
    const [, , , id, seed, maxTicks] = process.argv;
    process.send(runOne(+seed, +maxTicks, { depth: 9, respawn: true, maxDeaths: 12, class: id }));
    process.exit(0);
  }
  if (process.argv[2] === "--read") { const byClass = JSON.parse(readFileSync(process.argv[3], "utf8")); console.log(print(parity(byClass), byClass)); process.exit(0); }
  const n = Number(process.argv[2] ?? 12), maxTicks = Number(process.argv[3] ?? 150000), outFile = process.argv[4];
  const jobs = [];
  for (let s = 1; s <= n; s++) for (const c of classes) jobs.push({ id: c.id, seed: s });
  const byClass = Object.fromEntries(classes.map((c) => [c.id, []])), workers = 4;
  let next = 0, live = 0;
  await new Promise((done) => {
    const pump = () => {
      while (live < workers && next < jobs.length) {
        const j = jobs[next++]; live++;
        const ch = fork(new URL(import.meta.url).pathname, ["--one", j.id, String(j.seed), String(maxTicks)]);
        ch.on("message", (r) => byClass[j.id].push(r));
        ch.on("exit", () => { live--; if (next >= jobs.length && live === 0) done(); else pump(); });
      }
    };
    pump();
  });
  for (const r of Object.values(byClass)) r.sort((a, b) => a.seed - b.seed);
  if (outFile) writeFileSync(outFile, JSON.stringify(byClass));
  console.log(print(parity(byClass), byClass));
}
