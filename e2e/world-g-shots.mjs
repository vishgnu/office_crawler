// WORLD-G screenshots (graphics detail round): node e2e/world-g-shots.mjs [outDir=docs/shots] [prefix=g] [scene] [size=both|1920|1280]
// Harness scenes at real game scale (default zoom, 1920x1080 and 1280x720): office, basement, lobby, boardroom, classes. JPEG q85.
import { shotsDir } from "./shots-dir.mjs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const outDir = shotsDir(process.argv[2]), prefix = process.argv[3] ?? "g", only = process.argv[4], sizes = process.argv[5] === "1920" ? [[1920, 1080]] : process.argv[5] === "1280" ? [[1280, 720]] : [[1920, 1080], [1280, 720]];
const work = join(process.env.WORLD_TMP ?? tmpdir(), "world-harness-g-" + prefix);
mkdirSync(work, { recursive: true });
const js = await build({ entryPoints: ["e2e/world-harness.js"], bundle: true, format: "iife", write: false, target: "es2022" });
writeFileSync(join(work, "index.html"), `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><canvas id="game"></canvas><script>${js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`);
const browser = await chromium.launch();
const errors = [];
const results = {};
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(pathToFileURL(join(work, "index.html")).href);
  const call = (fn, ...a) => page.evaluate(([f, args]) => window.W[f](...args), [fn, a]);
  const info = await call("init", w, h);
  results[`atlas${w}`] = info;
  console.log("atlas", w, JSON.stringify(info));
  const save = async (name) => {
    const path = `${outDir}/${prefix}-${name}${w === 1920 ? "" : "-" + w}.jpg`;
    await page.screenshot({ path, type: "jpeg", quality: 85 });
    console.log(name, w, Math.round(statSync(path).size / 1024), "KB");
  };
  const scenes = {
    async office() { console.log(JSON.stringify(await call("gScene", "office"))); await call("render"); await save("office"); },
    async basement() { console.log(JSON.stringify(await call("gScene", "basement"))); await call("render"); await save("basement"); },
    async lobby() { console.log(JSON.stringify(await call("gScene", "lobby"))); await call("render"); await save("lobby"); },
    async boardroom() { console.log(JSON.stringify(await call("gScene", "boardroom"))); await call("render"); await save("boardroom"); },
    async classes() {
      const cols = 3, SC = w === 1920 ? 0.75 : 1;
      const cls = ["facilities-manager", "sales-rep", "it-wizard"];
      for (let i = 0; i < 3; i++) { await call("fight", cls[i], { seed: 5 }); await call("step", 6); await call("unflash"); await call("render"); await call("panel", i, cols, 1, { ox: 0, oy: -70 }); }
      await call("panelsShow", SC);
      const path = `${outDir}/${prefix}-classes${w === 1920 ? "" : "-" + w}.jpg`;
      await page.screenshot({ path, type: "jpeg", quality: 85, clip: { x: 0, y: 0, width: Math.round(w * SC), height: Math.round(h * SC) } });
      console.log("classes", w, Math.round(statSync(path).size / 1024), "KB");
    },
  };
  for (const [n, f] of Object.entries(scenes)) if (!only || only === "all" || only === n) await f();
  await page.close();
}
console.log("errors", JSON.stringify(errors.slice(0, 5)));
await browser.close();
