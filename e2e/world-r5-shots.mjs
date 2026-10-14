// R5 WORLD screenshots: node e2e/world-r5-shots.mjs [outDir=docs/shots] [scene]
// Real core states (class heroes, real casts) staged by e2e/world-harness.js; shoots docs/shots/r5-world-{classes,fm-skills,sales-skills,it-skills}.jpg (JPEG q85).
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const outDir = resolve(process.argv[2] ?? "docs/shots");
const only = process.argv[3];
const work = join(process.env.WORLD_TMP ?? tmpdir(), "world-harness-r5");
mkdirSync(work, { recursive: true });
const js = await build({ entryPoints: ["e2e/world-harness.js"], bundle: true, format: "iife", write: false, target: "es2022" });
writeFileSync(join(work, "index.html"), `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><canvas id="game"></canvas><script>${js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(pathToFileURL(join(work, "index.html")).href);
const call = (fn, ...a) => page.evaluate(([f, args]) => window.W[f](...args), [fn, a]);
console.log("atlas", JSON.stringify(await call("init")));

const SCALE = 0.75; // the contact sheets are drawn at 1440x810 so each JPEG stays under 300 KB
const save = async (name) => {
  const path = `${outDir}/r5-world-${name}.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 85, clip: { x: 0, y: 0, width: Math.round(1920 * SCALE), height: Math.round(1080 * SCALE) } });
  console.log(name, Math.round(statSync(path).size / 1024), "KB");
};
/** One panel: stage a fight for the class, run `moves`, then copy the hero-centred crop into the sheet. */
const panel = async (i, cols, rows, cls, moves, o = {}) => {
  await call("fight", cls, o.fight ?? {});
  for (const mv of moves) {
    if (mv.skill) { const r = await call("skill", mv.skill, mv.level ?? 3); if (!r.ok) console.log("  cast failed", JSON.stringify(r)); }
    else if (mv.aura) await call("aura", mv.aura);
    else if (mv.status) await call("setStatus", mv.status);
    else if (mv.hold) await call("hold");
    else if (mv.crit) await call("crit");
    if (mv.step) await call("step", mv.step);
  }
  await call("render");
  return call("panel", i, cols, rows, o.crop ?? {});
};
const sheet = async (name, cols, rows, panels) => {
  for (let i = 0; i < panels.length; i++) { const [cls, moves, o] = panels[i]; await panel(i, cols, rows, cls, moves, o); }
  await call("panelsShow", SCALE);
  await save(name);
};

const FM = "facilities-manager", SR = "sales-rep", IT = "it-wizard";
const scenes = {
  async classes() {
    await sheet("classes", 3, 1, [
      [FM, [{ skill: "pallet-slam", step: 3 }], { fight: { seed: 5 } }],
      [SR, [{ skill: "pen-volley", step: 4 }], { fight: { seed: 5 } }],
      [IT, [{ skill: "power-surge", step: 5 }], { fight: { seed: 5 } }],
    ]);
  },
  async fm() {
    await sheet("fm-skills", 3, 2, [
      [FM, [{ skill: "pallet-slam", step: 3 }]],
      [FM, [{ skill: "floor-buffer", step: 4 }]],
      [FM, [{ aura: "fire-drill", step: 2 }, { skill: "lockout", step: 3 }]],
      [FM, [{ hold: 1 }, { skill: "wet-floor", step: 24 }], { fight: { r: [4, 5] } }],
      [FM, [{ skill: "traffic-cone", step: 6 }]],
      [FM, [{ skill: "dolly-charge", step: 3 }]],
    ]);
  },
  async sales() {
    await sheet("sales-skills", 3, 2, [
      [SR, [{ skill: "stapler-throw", step: 3 }]],
      [SR, [{ skill: "card-fan", step: 3 }]],
      [SR, [{ skill: "intern", step: 30 }, { skill: "department-meeting", step: 4 }]],
      [SR, [{ skill: "reply-all", step: 3 }]],
      [SR, [{ skill: "hard-close", step: 12 }]],
      [SR, [{ skill: "stapler-throw", step: 6 }, { crit: 1, step: 2 }]],
    ]);
  },
  async it() {
    await sheet("it-skills", 3, 2, [
      [IT, [{ skill: "server-overheat", step: 6 }]],
      [IT, [{ skill: "power-surge", step: 6 }]],
      [IT, [{ skill: "blue-screen", step: 4 }]],
      [IT, [{ skill: "cold-boot", step: 5 }]],
      [IT, [{ skill: "firewall", step: 3 }, { status: ["freeze", "slow", "weaken", "burn", "stun"], step: 1 }]],
      [IT, [{ skill: "turn-it-off", step: 4 }]],
    ]);
  },
};
for (const [name, fn] of Object.entries(scenes)) if (!only || only === name) await fn();
if (errors.length) console.log("ERRORS", errors.slice(0, 5));
await browser.close();
