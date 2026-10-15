// WORLD-G art-review contact sheet: node e2e/world-g-sheet.mjs <out.jpg> [k=2.2] [group=monsters|heroes|npcs]
import { shotsDir } from "./shots-dir.mjs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
const out = process.argv[2] ?? join(shotsDir(), "g-sheet.jpg"), k = +(process.argv[3] ?? 2.2), group = process.argv[4] ?? "monsters";
const work = join(tmpdir(), "world-harness-sheet"); mkdirSync(work, { recursive: true });
const js = await build({ entryPoints: ["e2e/world-harness.js"], bundle: true, format: "iife", write: false, target: "es2022" });
writeFileSync(join(work, "index.html"), `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="game"></canvas><script>${js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`);
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(join(work, "index.html")).href);
await page.evaluate(() => window.W.init(1920, 1080));
const sets = {
  monsters: [["zombie-intern", "printer-imp", "temp-worker", "printer-demon", "middle-manager", "vending-machine", "consultant", "auditor"], [["idle", 0, 0], ["idle", 2, 2], ["walk", 6, 1], ["attack", 0, 2]]],
  heroes: [["clerk", "facilities-manager", "sales-rep", "it-wizard", "regional-director", "regional-director-rage", "npc-vendor", "npc-healer"], [["idle", 0, 0], ["idle", 2, 2], ["walk", 6, 1], ["attack", 0, 2]]],
};
const [types, specs] = sets[group];
await page.evaluate(([t, s, kk]) => window.W.sheet(t, s, kk, "#2b3647"), [types, specs, k]);
await page.screenshot({ path: out, type: "jpeg", quality: 90 });
await browser.close();
