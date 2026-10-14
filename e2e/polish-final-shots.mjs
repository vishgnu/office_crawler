// Final visual polish: after-shots docs/shots/polish-{title,basement,loot,hc-text}.jpg (JPEG q85).
// Usage: node e2e/polish-final-shots.mjs [outDir=docs/shots]
import { launch, open, freeTilesNear } from "./helpers.mjs";
import { resolve } from "node:path";
const out = resolve(process.argv[2] ?? "docs/shots");
const browser = await launch();
const shot = (g, n) => g.page.screenshot({ path: `${out}/polish-${n}.jpg`, type: "jpeg", quality: 85 });
const only = process.argv[3];
if (!only || only === "title") {
  const g = await open(browser, { query: "test=1&seed=11", lobby: true, viewport: { width: 1280, height: 720 } });
  await g.page.waitForTimeout(800); await shot(g, "title");
  await g.context.close();
  const p = await open(browser, { query: "test=1&seed=11", lobby: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.page.waitForTimeout(800); await p.page.screenshot({ path: `${out}/polish-title-390.jpg`, type: "jpeg", quality: 85 });
  await p.context.close();
}
if (!only || only === "basement") {
  const g = await open(browser, { query: "test=1&seed=11", viewport: { width: 1280, height: 720 } });
  await g.app("newGame", { seed: 11, start: "floor" });
  await g.app("cheat.setLevel", 20); await g.app("cheat.setHp", 9999);
  await g.app("cheat.teleportFloor", 5);
  let s = await g.app("step", 30);
  const near = freeTilesNear(s, s.player.tile, 9, 3);
  const types = ["consultant", "auditor", "consultant", "auditor", "consultant"];
  for (let i = 0; i < types.length; i++) await g.app("cheat.spawnMonster", types[i], near[i * 4] ?? near[i]);
  await g.app("step", 25); await g.page.waitForTimeout(150);
  await shot(g, "basement");
  console.log("basement errors", g.errors, JSON.stringify((await g.app("perf")).fps));
  await g.context.close();
}
if (!only || only === "loot") {
  const g = await open(browser, { query: "test=1&seed=11", viewport: { width: 1280, height: 720 } });
  await g.app("newGame", { seed: 11, start: "floor" });
  await g.app("cheat.setLevel", 10);
  let s = await g.app("step", 10);
  const near = freeTilesNear(s, s.player.tile, 3, 0);
  const rar = ["normal","normal","normal","magic","normal","rare","normal","normal","magic","normal","normal","unique"];
  for (let i = 0; i < 12; i++) { try { await g.app("cheat.spawnItem", { rarity: rar[i] }, near[i % near.length]); } catch (e) { console.log(e.message); } }
  await g.app("step", 5); await g.page.waitForTimeout(150);
  await shot(g, "loot");
  console.log("loot errors", g.errors);
  await g.context.close();
}
if (!only || only === "hc-text") {
  const g = await open(browser, { query: "test=1&seed=11", viewport: { width: 1280, height: 720 } });
  await g.app("newGame", { seed: 11, start: "floor" });
  await g.app("options.setFlag", "highContrast", true); await g.app("options.setTextScale", 1.5);
  await g.app("cheat.setLevel", 6);
  await g.app("cheat.giveItem", { rarity: "rare", slot: "weapon" });
  await g.app("ui.open", "inventory");
  await g.page.waitForTimeout(500);
  const cell = g.page.locator('[data-testid^="cell-"][data-tip]').first();
  await cell.hover(); await g.page.waitForTimeout(300);
  await shot(g, "hc-text");
  await g.page.mouse.move(640, 400);
  await g.app("ui.open", "character"); await g.page.waitForTimeout(500);
  await g.page.screenshot({ path: `${out}/polish-hc-file.jpg`, type: "jpeg", quality: 85 });
  console.log("hc errors", g.errors);
  await g.context.close();
}
await browser.close();
