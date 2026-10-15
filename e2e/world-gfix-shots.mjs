// G-FIX shots: real build, default zoom, 1920x1080; full frame + 1x crops around the hero. node e2e/world-gfix-shots.mjs <tag> [floor...]
import { mkdirSync } from "node:fs";
import { launch, open, freeTilesNear, SHOTS } from "./helpers.mjs";
const tag = process.argv[2] ?? "after", floors = process.argv.slice(3).map(Number), out = SHOTS + "/g-fix/"; mkdirSync(out, { recursive: true });
const browser = await launch();
async function scene(depth, name, opts = {}) {
  const g = await open(browser, { query: "test=1&seed=" + (opts.seed ?? 5) + (opts.q ?? ""), viewport: { width: 1920, height: 1080 }, lobby: !!process.env.LOBBY });
  if (process.env.CLS) { await g.app("character.create", { slot: 1, class: process.env.CLS, name: "T" }); await g.page.waitForTimeout(500); } else await g.app("newGame", { seed: opts.seed ?? 5 });
  if (depth > 1) await g.app("cheat.teleportFloor", depth);
  if (process.env.LOBBY) { await g.app("step", 30); await g.page.waitForTimeout(200); await g.page.screenshot({ path: `${out}${tag}-${name}.jpg`, type: "jpeg", quality: 85 }); await g.context.close(); return; }
  await g.app("cheat.setLevel", 12); await g.app("cheat.setHp", 9999);
  let s = await g.app("step", 20);
  const types = depth >= 9 ? ["middle-manager", "zombie-intern", "printer-imp", "temp-worker", "printer-demon", "consultant", "auditor"] : ["zombie-intern", "printer-imp", "temp-worker", "printer-demon", "middle-manager", "consultant", "auditor", "vending-machine"];
  const near = freeTilesNear(s, s.player.tile, 6, 2);
  types.forEach((t, i) => near[i * 2] && g.app("cheat.spawnMonster", t, near[i * 2]));
  if (!opts.noLoot) {
    const items = [{ rarity: "normal", slot: "head" }, { rarity: "magic", slot: "body" }, { rarity: "rare", slot: "weapon" }, { rarity: "unique" }, { rarity: "rare", slot: "body" }, { rarity: "normal", slot: "weapon" }, { rarity: "magic", slot: "head" }];
    for (let i = 0; i < items.length; i++) { const t = near[i * 2 + 1]; if (t) await g.app("cheat.spawnItem", items[i], t); }
  }
  await g.app("step", 25); s = await g.state();
  await g.page.waitForTimeout(150);
  await g.page.screenshot({ path: `${out}${tag}-${name}.jpg`, type: "jpeg", quality: 85 });
  const hs = await g.page.evaluate(() => window.__app.getState().ui?.camera ?? null);
  await g.page.screenshot({ path: `${out}${tag}-${name}-crop.jpg`, type: "jpeg", quality: 85, clip: { x: 560, y: 240, width: 800, height: 600 } });
  console.log(name, "errs", JSON.stringify(g.errors.slice(0, 2)), JSON.stringify(hs).slice(0, 120));
  await g.context.close();
}
for (const f of floors.length ? floors : [1, 5, 9]) await scene(f, "f" + f, { q: process.env.Q ?? "" });
await browser.close();
