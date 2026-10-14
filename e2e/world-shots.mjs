// WORLD work package screenshots: node e2e/world-shots.mjs [outDir=docs/shots]
// Bundles e2e/world-harness.js (real renderer modules, staged core states) and shoots docs/shots/s2-world-{basement,lobby,champions,loot}.jpg.
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const outDir = resolve(process.argv[2] ?? "docs/shots");
const only = process.argv[3];
const work = join(process.env.WORLD_TMP ?? tmpdir(), "world-harness");
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
const info = await call("init");
console.log("atlas", JSON.stringify(info));
const shot = async (name) => {
  const path = `${outDir}/s2-world-${name}.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 85 });
  console.log(name, Math.round(statSync(path).size / 1024), "KB");
};
const bossShot = async (name, stage, at, after = 0, dy = 0) => {
  const info = await call("boss", stage, at);
  console.log(name, JSON.stringify(info));
  if (after) await call("step", after);
  await call("renderBoss", true, dy);
  const path = `${outDir}/s3-boss-${name}.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 85 });
  console.log(name, Math.round(statSync(path).size / 1024), "KB");
};
const scenes = {
  async boss() {
    await bossShot("phase1", "idle", 0, 0, -2.5);
    await bossShot("room", "idle", 0, 0, -5);
    await bossShot("telegraph", "slam", 0.62);
    await bossShot("volley", "volley", 0.62);
    await bossShot("summon", "summon", 0.7);
    await bossShot("phase2", "phase2", 0);
    await bossShot("victory", "victory", 0);
  },
  async stairs() {
    for (const u of [false, true]) {
      console.log(JSON.stringify(await call("floor8Stairs", u))); await call("step", 4); await call("render");
      const path = `${outDir}/s3-world-stairs-${u ? "open" : "locked"}.jpg`; await page.screenshot({ path, type: "jpeg", quality: 85 });
    }
  },
  async bossbig() {
    await call("sheet", ["regional-director", "regional-director-rage"], [["idle", 0, 0], ["windup", 0, 3], ["attack", 2, 2]], 4.2, "#3a1b30");
    await page.screenshot({ path: `${outDir}/s3-sheet-boss-big.jpg`, type: "jpeg", quality: 90 });
  },
  async sheetboss() {
    const clip = { x: 0, y: 0, width: 1920, height: 1080 };
    const specs = [["idle", 0, 0], ["idle", 2, 1], ["walk", 6, 2], ["attack", 0, 2], ["windup", 0, 1], ["windup", 0, 3], ["death", 0, 3]];
    await call("sheet", ["regional-director", "regional-director-rage"], specs, 1.9, "#3a1b30");
    await page.screenshot({ path: `${outDir}/s3-sheet-boss.jpg`, type: "jpeg", quality: 90, clip });
    await call("sheet", ["regional-director", "regional-director-rage"], [["idle", 4, 0], ["idle", 5, 1], ["walk", 3, 2], ["attack", 5, 2], ["windup", 4, 3], ["walk", 1, 1], ["attack", 6, 1]], 1.9, "#3a1b30");
    await page.screenshot({ path: `${outDir}/s3-sheet-boss-b.jpg`, type: "jpeg", quality: 90, clip });
  },
  async basement() { console.log(JSON.stringify(await call("scene", "basement", 5))); await call("render"); await shot("basement"); },
  async lobby() {
    console.log(JSON.stringify(await call("scene", "lobby", 3)));
    await call("render"); await shot("lobby");
  },
  async champions() { console.log(JSON.stringify(await call("scene", "champions", 4))); await call("render"); await shot("champions"); },
  async loot() { console.log(JSON.stringify(await call("scene", "loot", 6))); await call("render"); await shot("loot"); },
  async sheet() {
    const clip = { x: 0, y: 0, width: 1920, height: 1080 };
    const row = (types, specs, name, k) => call("sheet", types, specs, k).then(() => page.screenshot({ path: `${outDir}/s2-sheet-${name}.jpg`, type: "jpeg", quality: 90, clip }));
    await row(["temp-worker", "printer-demon", "middle-manager"], [["idle", 0, 0], ["idle", 2, 1], ["walk", 6, 2], ["attack", 0, 2], ["attack", 5, 2], ["death", 0, 3]], "a", 2.2);
    await row(["vending-machine", "consultant", "auditor"], [["idle", 0, 0], ["idle", 2, 1], ["walk", 6, 2], ["attack", 0, 2], ["attack", 5, 2], ["death", 0, 3]], "b", 2.2);
    await row(["clerk", "npc-vendor", "npc-healer", "npc-potions", "npc-stash"], [["idle", 0, 0], ["idle", 2, 1], ["attack", 0, 2], ["cast", 0, 1], ["cast", 0, 3], ["cast", 5, 2]], "c", 1.8);
  },
  async perf() { // 1920x1080 crowd cost: zoom 1 is the bench scene, zoom 1.8 the real playing zoom
    for (const zoom of [1, 1.8]) {
      console.log("zoom", zoom, JSON.stringify(await call("init", 1920, 1080, zoom)).slice(0, 80));
      for (const o of [{ champ: false, loot: false, proj: false }, {}, { n: 0, loot: false, proj: false }]) console.log("perf", JSON.stringify(await call("perf", 60, o)));
    }
  },
  async lineup() {
    console.log(JSON.stringify(await call("scene", "lineup", 5))); await call("render");
    await page.screenshot({ path: `${outDir}/s2-world-lineup.jpg`, type: "jpeg", quality: 90, clip: { x: 360, y: 300, width: 1200, height: 560 } });
  },
  async monsters() { console.log(JSON.stringify(await call("scene", "monsters", 7))); await call("render"); await shot("monsters"); },
  async fx() {
    console.log(JSON.stringify(await call("scene", "monsters", 7)));
    await call("learn", "reply-all");
    await call("setLevel", 5);
    await call("learn", "coffee-break");
    await call("cast", "reply-all"); await call("step", 4); await call("render"); await shot("fx-cast");
    await call("levelup"); await call("cast", "coffee-break"); await call("step", 8); await call("render"); await shot("fx-levelup");
  },
};
for (const [k, fn] of Object.entries(scenes)) if (!only || only === k) await fn();
console.log("errors", errors);
await browser.close();
if (errors.length) process.exitCode = 1;
