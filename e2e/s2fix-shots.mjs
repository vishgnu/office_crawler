// Screenshots of the S2 fix round (UI-FIX): docs/shots/s2-fix-{fight,inventory,map,phone}.jpg (JPEG q85, <= 300 KB).
// Usage: node e2e/s2fix-shots.mjs [outDir=docs/shots]. Not asserted; the e2e scripts check the behaviour.
import { launch, open, freeTilesNear, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";

const out = resolve(process.argv[2] ?? "docs/shots");
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const shot = async (g, name) => {
  const path = `${out}/s2-fix-${name}.jpg`;
  await g.page.waitForTimeout(200);
  await g.page.screenshot({ path, type: "jpeg", quality: 85 });
  console.log(name, Math.round(statSync(path).size / 1024) + " KB");
};
const begin = async (viewport, seed = 5) => {
  const g = await open(browser, { query: `test=1&seed=${seed}`, viewport, lobby: true });
  await startNew(g.page);
  return g;
};

// fight: a pack around the hero, loot on the ground, floaters and plates
{
  const g = await begin({ width: 1280, height: 800 });
  await g.app("cheat.setLevel", 6);
  await g.app("cheat.teleportFloor", 3);
  let s = await g.state();
  const spots = freeTilesNear(s, s.player.tile, 4, 1);
  const types = ["printer-demon", "printer-demon", "temp-worker", "printer-imp", "printer-demon", "temp-worker"];
  const ids = [];
  for (let i = 0; i < types.length && i < spots.length; i++) { const r = await g.app("cheat.spawnMonster", types[i], spots[i * 2 % spots.length]); if (r.ok) ids.push(r.id); }
  for (const o of [{ rarity: "unique", slot: "head", ilvl: 10 }, { rarity: "rare", slot: "weapon", ilvl: 10 }, { rarity: "magic", slot: "feet", ilvl: 8 }, { rarity: "normal", slot: "body", ilvl: 3 }]) await g.app("cheat.spawnItem", o);
  s = await g.state();
  const near = s.monsters.filter((m) => m.ai !== "dead").sort((a, b) => Math.hypot(a.tile.x - s.player.tile.x, a.tile.y - s.player.tile.y) - Math.hypot(b.tile.x - s.player.tile.x, b.tile.y - s.player.tile.y))[0];
  if (near) await g.app("cmd.attack", near.id);
  for (let i = 0; i < 40; i++) { await g.app("step", 1); const st = await g.state(); if (st.floaters?.length >= 3 || st.player.hp < st.player.hpMax * 0.9 && st.floaters?.length) break; }
  await g.app("step", 4);
  await shot(g, "fight");
  await g.context.close();
}

// inventory: items, Emergency Exit in the drawer and belt, tooltip, XP label mid-level
{
  const g = await begin({ width: 1280, height: 800 }, 1);
  await g.app("cheat.setLevel", 7);
  await g.app("input", { t: "allocate", attr: "grit" });
  const give = (o) => g.app("cheat.giveItem", o);
  await give({ base: "letter-opener", rarity: "magic", ilvl: 6 });
  await give({ base: "keyboard-sword", rarity: "rare", ilvl: 12 });
  await give({ base: "visor-cap", rarity: "magic", ilvl: 4 });
  const ex = await give({ base: "emergency-exit" });
  const ex2 = await give({ base: "emergency-exit" });
  if (ex2.id) await g.app("input", { t: "toBelt", id: ex2.id });
  await g.page.keyboard.press("KeyI"); await g.page.keyboard.press("KeyC");
  await g.app("step", 2);
  const s = await g.state(), it = s.inventory.items.find((i) => i.base === "emergency-exit") ?? s.inventory.items[0];
  await g.page.hover(T(`cell-${it.x}-${it.y}`));
  await shot(g, "inventory");
  await g.context.close();
}

// map: explore a floor a little, open the automap; a second screenshot of the minimap alone is not kept
{
  const g = await begin({ width: 1280, height: 800 }, 3);
  await g.app("cheat.setLevel", 30);
  await g.app("cheat.teleportFloor", 2);
  for (let k = 0; k < 6; k++) {
    await g.app("cheat.setHp", 9999);
    const s = await g.state(), spots = freeTilesNear(s, s.player.tile, 9, 6);
    if (!spots.length) break;
    const t = spots[Math.min(spots.length - 1, 5 + k * 3)];
    await g.app("clickTile", t.x, t.y);
    for (let i = 0; i < 14; i++) await g.app("step", 10);
  }
  await g.page.keyboard.press("KeyM");
  await g.app("step", 1);
  await shot(g, "map");
  await g.context.close();
}

// phone: 390x844 Gear tab with an item in hand (Put back / Drop stay visible) and a toast in its own lane under the drawer
{
  const g = await begin({ width: 390, height: 844 }, 1);
  await g.app("cheat.setLevel", 4);
  await g.app("input", { t: "learnSkill", id: "reply-all" });
  await g.app("input", { t: "assignSkill", slot: 1, id: "reply-all" });
  await g.app("cheat.giveItem", { base: "keyboard-sword", rarity: "rare", ilvl: 12 });
  await g.app("cheat.giveItem", { base: "emergency-exit" });
  await g.page.keyboard.press("KeyI");
  await g.app("step", 2);
  const s = await g.state(), it = s.inventory.items.find((i) => i.base === "keyboard-sword");
  await g.page.click(T(`cell-${it.x}-${it.y}`));
  await g.app("cheat.setHp", 3);
  await g.page.keyboard.press("Digit1");
  await g.page.mouse.move(200, 300);
  await shot(g, "phone");
  if (process.env.PHONE_WORLD) { await g.page.keyboard.press("Escape"); await g.page.keyboard.press("KeyI"); await g.app("step", 1); await g.page.screenshot({ path: process.env.PHONE_WORLD }); }
  await g.context.close();
}
await browser.close();
