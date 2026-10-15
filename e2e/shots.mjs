// Screenshots of the real game for the visual reviewer (not asserted, not part of `npm run e2e`).
// Usage: node e2e/shots.mjs [outDir=docs/shots] [query="test=1&seed=1"] [ext=jpg]. Writes s1-ported-<w>x<h>.<ext>
// (JPEG quality 85 keeps each file under 400 KB). The scene: a short fight, caught on the tick a hit lands.
import { shotsDir } from "./shots-dir.mjs";
import { launch, open, freeTilesNear } from "./helpers.mjs";
import { resolve } from "node:path";

const outDir = shotsDir(process.argv[2]), query = process.argv[3] ?? "test=1&seed=1", ext = process.argv[4] ?? "jpg";
const sizes = [[1920, 1080], [1280, 720], [390, 844]];
const browser = await launch();
for (const [width, height] of sizes) {
  const g = await open(browser, { query, viewport: { width, height } });
  await g.app("newGame", { seed: 1 });
  let s = await g.app("step", 30);
  const near = freeTilesNear(s, s.player.tile, 6, 2);
  await g.app("cheat.spawnMonster", "zombie-intern", near[0]);
  await g.app("cheat.spawnMonster", "zombie-intern", near[3] ?? near[1]);
  await g.app("cheat.spawnMonster", "printer-imp", near[5] ?? near[2]);
  await g.app("step", 40);
  s = await g.state();
  // fight the monster that stands lowest on screen, so the hero faces the camera
  const m = s.monsters.filter((x) => x.ai !== "dead").sort((a, b) => b.tile.x + b.tile.y - (a.tile.x + a.tile.y))[0];
  if (m) await g.app("cmd.attack", m.id);
  for (let i = 0; i < 400; i++) {
    s = await g.app("step", 1);
    if (s.events.some((e) => e.type === "hit" && e.source === "player")) break;
  }
  await g.page.waitForTimeout(70);
  const tag = `${width}x${height}`;
  await g.page.screenshot(ext === "png" ? { path: `${outDir}/s1-ported-${tag}.png` } : { path: `${outDir}/s1-ported-${tag}.jpg`, type: "jpeg", quality: 85 });
  if (g.errors.length) console.log("ERRORS", tag, g.errors);
  await g.context.close();
}
await browser.close();
