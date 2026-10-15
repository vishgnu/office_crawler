// VFIX-R7-WORLD shots: real build, 1x. node e2e/vfix7-w-shots.mjs <tag>  -> docs/shots/vfix7-w-<tag>-*.jpg (full frames + 1x crops)
import { launch, open, freeTilesNear, tileScreen } from "./helpers.mjs";
const tag = process.argv[2] ?? "after", out = "docs/shots/vfix7-w-";
const browser = await launch();
const D = { width: 1280, height: 720 }, M = { width: 390, height: 844 };
const clamp = (c, v) => ({ x: Math.max(0, Math.min(v.w - c.w, c.x)), y: Math.max(0, Math.min(v.h - c.h, c.y)), width: c.w, height: c.h });
async function crop(g, name, cx, cy, w, h, vp) { await g.page.screenshot({ path: `${out}${tag}-${name}.jpg`, type: "jpeg", quality: 88, clip: clamp({ x: cx - w / 2, y: cy - h / 2, w, h }, { w: vp.width, h: vp.height }) }); }
async function full(g, name) { await g.page.screenshot({ path: `${out}${tag}-${name}.jpg`, type: "jpeg", quality: 85 }); }
async function elite(vp, name) {
  const g = await open(browser, { query: "test=1&seed=3", viewport: vp, lobby: true });
  await g.app("character.create", { slot: 1, class: "sales-rep", name: "T" }); await g.page.waitForTimeout(400);
  await g.app("quests.setStep", "sq3", 1);
  await g.app("cheat.teleportFloor", 3); await g.app("cheat.teleportFloor", 4);
  await g.app("cheat.setLevel", 40); await g.app("cheat.setHp", 9999);
  let s = await g.app("step", 10);
  const el = s.monsters.find((m) => m.name === "The Toner Tyrant");
  if (!el) { console.log("NO ELITE"); await g.context.close(); return; }
  for (const m of s.monsters) if (m.name !== "The Toner Tyrant" && m.ai !== "dead") await g.app("cheat.damageMonster", m.id, 99999); // a quiet floor for the shot
  await g.app("step", 20); s = await g.state();
  const near = freeTilesNear(s, el.tile, 4, 1);
  const items = [{ rarity: "rare", slot: "weapon" }, { rarity: "magic", slot: "body" }, { rarity: "unique" }, { rarity: "rare", slot: "head" }, { rarity: "magic", slot: "weapon" }];
  for (let i = 0; i < items.length; i++) if (near[i * 2]) await g.app("cheat.spawnItem", items[i], near[i * 2]);
  // walk the hero to the elite (re-issue the move; the elite may drift towards him), stop within 3 tiles
  for (let k = 0; k < 90; k++) {
    s = await g.state(); const e = s.monsters.find((m) => m.name === "The Toner Tyrant"), d = Math.hypot(e.tile.x - s.player.tile.x, e.tile.y - s.player.tile.y);
    if (d <= 3.5) break;
    await g.app("cheat.setHp", 99999);
    if (k % 6 === 0) await g.app("cmd.moveTo", { x: e.tile.x, y: e.tile.y });
    await g.app("step", 10);
  }
  await g.app("step", 2); await g.page.waitForTimeout(250);
  s = await g.state(); const el2 = s.monsters.find((m) => m.name === "The Toner Tyrant"), cam = s.ui.camera;
  const p = tileScreen(cam, el2.tile.x, el2.tile.y); console.log(name, "elite", JSON.stringify(el2.tile), "hero", JSON.stringify(s.player.tile), JSON.stringify(p));
  await full(g, name); await crop(g, name + "-crop", p.x, p.y - 90, 420, 300, vp);
  console.log(name, "errs", g.errors.slice(0, 2), "hp", s.player.hp);
  await g.context.close();
}
async function npc(name) {
  const g = await open(browser, { query: "test=1&seed=1", viewport: M, lobby: true });
  await g.app("character.create", { slot: 1, class: "sales-rep", name: "T" }); await g.page.waitForTimeout(500);
  let s = await g.state();
  const n = s.npcs.find((x) => x.id === "vendor");
  const near = freeTilesNear(s, n.tile, 2, 1);
  await g.app("cmd.moveTo", near[0]);
  for (let k = 0; k < 10; k++) { await g.app("step", 10); await g.page.waitForTimeout(40); }
  await g.page.waitForTimeout(250); s = await g.state();
  const p = tileScreen(s.ui.camera, n.tile.x, n.tile.y);
  await full(g, name); await crop(g, name + "-crop", p.x, p.y - 60, 300, 260, M);
  await g.context.close();
}
async function map(vp, name, withBadge) {
  const g = await open(browser, { query: "test=1&seed=3", viewport: vp, lobby: true });
  await g.app("character.create", { slot: 1, class: "sales-rep", name: "T" }); await g.page.waitForTimeout(400);
  await g.app("quests.accept", "sq3"); await g.app("quests.setStep", "sq3", 1); await g.app("quests.pin", "sq3");
  await g.app("cheat.teleportFloor", 4); await g.app("cheat.setHp", 9999);
  await g.app("step", 20); await g.page.keyboard.press("KeyM"); await g.page.waitForTimeout(300);
  await full(g, name); await crop(g, name + "-crop", vp.width / 2, vp.height - 90, Math.min(vp.width, 700), 180, vp);
  await g.context.close();
}
async function lobbyMap(vp, name) {
  const g = await open(browser, { query: "test=1&seed=1", viewport: vp, lobby: true });
  await g.app("character.create", { slot: 1, class: "sales-rep", name: "T" }); await g.page.waitForTimeout(500);
  await g.app("step", 20); await g.page.keyboard.press("KeyM"); await g.page.waitForTimeout(300);
  await full(g, name); await crop(g, name + "-crop", vp.width / 2, 120, Math.min(vp.width, 640), 220, vp);
  await g.context.close();
}
async function crowd(name) {
  const g = await open(browser, { query: "test=1&seed=5", viewport: D });
  await g.app("newGame", { seed: 5 }); await g.app("cheat.setLevel", 12); await g.app("cheat.setHp", 9999);
  await g.app("cheat.teleportFloor", 3);
  let s = await g.app("step", 20);
  const types = ["consultant", "middle-manager", "temp-worker", "printer-imp", "zombie-intern", "auditor"];
  const near = freeTilesNear(s, s.player.tile, 3, 1).filter((t) => t.x >= s.player.tile.x && t.y >= s.player.tile.y);
  types.forEach((t, i) => near[i] && g.app("cheat.spawnMonster", t, near[i]));
  await g.app("cheat.spawnItem", { rarity: "rare", slot: "weapon" }, s.player.tile);
  await g.app("cheat.spawnItem", { rarity: "unique" }, s.player.tile);
  await g.app("step", 3); await g.page.waitForTimeout(250); s = await g.state();
  const p = tileScreen(s.ui.camera, s.player.tile.x, s.player.tile.y);
  await full(g, name); await crop(g, name + "-crop", p.x, p.y - 20, 300, 220, D);
  await g.context.close();
}
await elite(D, "elite-d"); await elite(M, "elite-m"); await npc("npc-m"); await map(D, "map-elite-d"); await lobbyMap(D, "map-lobby-d"); await lobbyMap({ width: 1280, height: 720 }, "map-lobby-d2"); await crowd("crowd-d"); await lobbyMap(M, "map-lobby-m");
await browser.close();
