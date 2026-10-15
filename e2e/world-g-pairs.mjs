// WORLD-G before/after pairs from the real game: node e2e/world-g-pairs.mjs [outDir=docs/shots]
// After-shots of the lobby (1280x800) and the basement (1280x720) in the real game (HUD included), then side-by-side pairs with docs/shots/final-lobby.jpg and polish-basement.jpg.
import { shotsDir, PUBLISHED_SHOTS } from "./shots-dir.mjs";
import { launch, open, freeTilesNear } from "./helpers.mjs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
const out = shotsDir(process.argv[2]);
const browser = await launch();
{ // lobby
  const g = await open(browser, { query: "test=1&seed=11", lobby: true, viewport: { width: 1280, height: 800 } });
  await g.app("newGame", { seed: 11, start: "town" }).catch(() => {});
  await g.page.waitForTimeout(1200);
  await g.page.screenshot({ path: `${out}/g-after-lobby.jpg`, type: "jpeg", quality: 85 });
  console.log("lobby errors", g.errors);
  await g.context.close();
}
{ // basement, same staging as e2e/polish-final-shots.mjs
  const g = await open(browser, { query: "test=1&seed=11", viewport: { width: 1280, height: 720 } });
  await g.app("newGame", { seed: 11, start: "floor" });
  await g.app("cheat.setLevel", 20); await g.app("cheat.setHp", 9999);
  await g.app("cheat.teleportFloor", 5);
  let s = await g.app("step", 30);
  const near = freeTilesNear(s, s.player.tile, 9, 3), types = ["consultant", "auditor", "consultant", "auditor", "consultant"];
  for (let i = 0; i < types.length; i++) await g.app("cheat.spawnMonster", types[i], near[i * 4] ?? near[i]);
  await g.app("step", 25); await g.page.waitForTimeout(250);
  await g.page.screenshot({ path: `${out}/g-after-basement.jpg`, type: "jpeg", quality: 85 });
  console.log("basement errors", g.errors);
  await g.context.close();
}
// side-by-side pairs (before left, after right), composed in the browser
const b64 = (f) => "data:image/jpeg;base64," + readFileSync(f).toString("base64");
for (const [name, before, after, w, h] of [["lobby", "final-lobby.jpg", "g-after-lobby.jpg", 1280, 800], ["basement", "polish-basement.jpg", "g-after-basement.jpg", 1280, 720]]) {
  const p = await browser.newPage({ viewport: { width: w * 2 + 8, height: h } });
  await p.setContent(`<body style="margin:0;background:#222;display:flex;gap:8px"><img src="${b64(`${PUBLISHED_SHOTS}/${before}`)}"><img src="${b64(`${out}/${after}`)}">`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/g-pair-${name}.jpg`, type: "jpeg", quality: 82 });
  await p.close();
}
await browser.close();
