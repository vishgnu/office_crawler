// Screenshots of the S2 UI for visual review (not asserted). Usage: node e2e/ui-shots.mjs [outDir=docs/shots]
// Writes s2-ui-{inventory,employee-file,vendor,skills,lobby}.jpg (JPEG q85) plus the 1024 px and phone variants.
import { shotsDir } from "./shots-dir.mjs";
import { launch, open, tileScreen, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";

const out = shotsDir(process.argv[2]);
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const shot = async (g, name) => { const path = `${out}/s2-ui-${name}.jpg`; await g.page.waitForTimeout(150); await g.page.screenshot({ path, type: "jpeg", quality: 85 }); console.log(name, Math.round(statSync(path).size / 1024) + " KB"); };
const begin = async (viewport, seed = 1) => {
  const g = await open(browser, { query: `test=1&seed=${seed}`, viewport, lobby: true });
  await startNew(g.page);
  return g;
};
const gear = async (g) => {
  await g.app("cheat.setLevel", 7);
  for (const a of ["grit", "grit", "grit", "grit", "stamina", "stamina", "focus", "agility", "agility"]) await g.app("input", { t: "allocate", attr: a });
  const ids = {};
  const give = async (k, o, wear = false) => { ids[k] = (await g.app("cheat.giveItem", o)).id; if (wear) await g.app("input", { t: "equip", id: ids[k] }); };
  await give("w", { base: "letter-opener", rarity: "magic", ilvl: 6 }, true);
  await give("w2", { base: "keyboard-sword", rarity: "rare", ilvl: 12 });
  await give("body", { base: "cardigan", rarity: "normal", ilvl: 2 }, true);
  await give("vest", { base: "hi-vis-vest", rarity: "magic", ilvl: 9 });
  await give("head", { base: "visor-cap", rarity: "magic", ilvl: 4 }, true);
  await give("shield", { base: "clipboard-shield", rarity: "magic", ilvl: 6 }, true);
  await give("gloves", { base: "typing-mitts", rarity: "rare", ilvl: 13 });
  await give("hands", { base: "wrist-brace", rarity: "normal", ilvl: 2 }, true);
  await give("belt", { base: "leather-belt", rarity: "rare", ilvl: 8 }, true);
  await give("ring", { base: "rubber-band-ring", rarity: "magic", ilvl: 6 }, true);
  await give("boots", { base: "sneakers", rarity: "normal", ilvl: 2 }, true);
  await give("pot", { potion: true });
  await give("u", { rarity: "unique", ilvl: 12, slot: "amulet" });
  await g.app("input", { t: "toBelt", id: ids.pot });
  return ids;
};

// inventory + file side by side with a comparison tooltip
{
  const g = await begin({ width: 1280, height: 800 });
  const ids = await gear(g);
  await g.page.keyboard.press("KeyI"); await g.page.keyboard.press("KeyC");
  await g.app("step", 2);
  const s = await g.state(), it = s.inventory.items.find((i) => i.id === ids.w2);
  await g.page.hover(T(`cell-${it.x}-${it.y}`));
  await shot(g, "inventory");
  await g.context.close();
}
// Employee File alone, with an unmet item listed
{
  const g = await begin({ width: 1280, height: 800 });
  await gear(g);
  await g.page.keyboard.press("KeyC");
  await g.app("step", 2);
  await g.page.hover(T("alloc-agility"));
  await shot(g, "employee-file");
  await g.context.close();
}
// vendor window with the drawer
{
  const g = await begin({ width: 1280, height: 800 });
  await g.app("cheat.giveGold", 400);
  const s0 = await g.state(), npc = s0.floor.npcs.find((n) => n.id === "vendor");
  const sc = tileScreen(s0.ui.camera, npc.tile.x, npc.tile.y);
  await g.page.mouse.click(sc.x, sc.y);
  for (let i = 0; i < 100; i++) { const s = await g.app("step", 10); if (s.ui.dialog) break; }
  await g.app("step", 5);
  await g.page.hover(T("buy-6"));
  await shot(g, "vendor");
  await g.context.close();
}
// skills panel on floor 1 with monsters
{
  const g = await begin({ width: 1280, height: 800 });
  await g.app("cheat.setLevel", 5);
  await g.app("cheat.teleportFloor", 1);
  for (const id of ["stapler-throw", "reply-all", "coffee-break", "dress-code"]) await g.app("input", { t: "learnSkill", id });
  await g.app("input", { t: "key", code: "F1" });
  await g.page.keyboard.press("KeyS");
  await g.app("step", 30);
  await shot(g, "skills");
  await g.context.close();
}
// the Lobby at the start
{
  const g = await begin({ width: 1280, height: 800 });
  await g.app("step", 30);
  await shot(g, "lobby");
  await g.context.close();
}
// narrow desktop and phone
{
  const g = await begin({ width: 1024, height: 768 });
  const ids = await gear(g);
  await g.page.keyboard.press("KeyI"); await g.page.keyboard.press("KeyC");
  await g.app("step", 2);
  const s = await g.state(), it = s.inventory.items.find((i) => i.id === ids.w2);
  await g.page.hover(T(`cell-${it.x}-${it.y}`));
  await shot(g, "inventory-1024");
  await g.context.close();
}
{
  const g = await begin({ width: 390, height: 844 });
  await gear(g);
  await g.page.keyboard.press("KeyI");
  await g.app("step", 2);
  await shot(g, "inventory-390");
  await g.page.click("#pright " + T("tab-character"));
  await shot(g, "employee-file-390");
  await g.context.close();
}
await browser.close();
