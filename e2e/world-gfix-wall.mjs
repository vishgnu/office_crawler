// G-FIX: actors standing beside wall tops (south / east of them) at default zoom: node e2e/world-gfix-wall.mjs <tag>
import { launch, open } from "./helpers.mjs";
const tag = process.argv[2] ?? "wall", out = "docs/shots/g-fix/";
const browser = await launch();
const g = await open(browser, { query: "test=1&seed=5", viewport: { width: 1920, height: 1080 } });
await g.app("newGame", { seed: 5 });
await g.app("cheat.setHp", 9999);
let s = await g.app("step", 10);
const f = s.floor, W = f.w, tiles = f.tiles, wall = (x, y) => x < 0 || y < 0 || x >= W || y >= f.h || tiles[y * W + x] === 2;
const hero = s.player.tile, cand = [];
for (let y = hero.y - 7; y <= hero.y + 7; y++) for (let x = hero.x - 7; x <= hero.x + 7; x++) {
  if (wall(x, y) || tiles[y * W + x] !== 1) continue;
  if ((wall(x + 1, y) || wall(x, y + 1)) && !(x === hero.x && y === hero.y)) cand.push({ x, y, d: Math.hypot(x - hero.x, y - hero.y) });
}
cand.sort((a, b) => a.d - b.d);
const types = ["zombie-intern", "temp-worker", "consultant", "zombie-intern"];
let n = 0;
for (const c of cand) { if (n >= 4) break; if (cand.some((o) => o !== c && o.used && Math.hypot(o.x - c.x, o.y - c.y) < 2.5)) continue; if (await g.app("cheat.spawnMonster", types[n], { x: c.x, y: c.y })) { c.used = true; n++; } }
await g.page.waitForTimeout(250);
await g.page.screenshot({ path: `${out}${tag}.jpg`, type: "jpeg", quality: 85, clip: { x: 460, y: 240, width: 1000, height: 640 } });
console.log("spawned", n, JSON.stringify(g.errors.slice(0, 2)), JSON.stringify(cand.slice(0, 3)));
await browser.close();
