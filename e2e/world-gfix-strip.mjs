// G-FIX motion strip: three frames, 1920x1080 at default zoom, 1x crops (no scaling) side by side. node e2e/world-gfix-strip.mjs <tag> [monster] [floor] [type]
import { launch, open, freeTilesNear } from "./helpers.mjs";
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const tag = process.argv[2] ?? "strip", type = process.argv[3] ?? "middle-manager", depth = Number(process.argv[4] ?? 1), out = "docs/shots/g-fix/";
const browser = await launch();
const g = await open(browser, { query: "test=1&seed=5" + (process.env.Q ?? ""), viewport: { width: 1920, height: 1080 } });
await g.app("newGame", { seed: 5 });
if (depth > 1) await g.app("cheat.teleportFloor", depth);
await g.app("cheat.setHp", 9999);
let s = await g.app("step", 10);
const near = freeTilesNear(s, s.player.tile, 4, 2);
await g.app("cheat.spawnMonster", type, near[0]);
s = await g.state();
const m = s.monsters.find((x) => x.type === type), cam = s.ui.camera;
const sx = cam.ox + (m.tile.x - m.tile.y) * 32 * cam.z, sy = cam.oy + (m.tile.x + m.tile.y + 1) * 16 * cam.z;
const clip = process.env.CLIP ? Object.fromEntries(process.env.CLIP.split(",").map((v, i) => [["x", "y", "width", "height"][i], Number(v)])) : { x: Math.round(sx - 90), y: Math.round(sy - 200), width: 180, height: 230 };
const shots = [];
for (let i = 0; i < 3; i++) { await g.page.waitForTimeout(230); shots.push(await g.page.screenshot({ type: "png", clip })); }
// compose into one JPEG with a page canvas
const b64 = shots.map((b) => b.toString("base64"));
const page = await g.context.newPage();
await page.setContent("<canvas id=c></canvas>");
const jpg = await page.evaluate(async (arr) => {
  const imgs = await Promise.all(arr.map((a) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + a; })));
  const c = document.getElementById("c"); c.width = imgs[0].width * 3 + 8; c.height = imgs[0].height;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  imgs.forEach((im, k) => x.drawImage(im, k * (im.width + 4), 0));
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}, b64);
writeFileSync(`${out}${tag}.jpg`, Buffer.from(jpg, "base64"));
console.log("ok", m.type, JSON.stringify(g.errors.slice(0, 2)));
await browser.close();
