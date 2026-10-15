// R8-0.3 / R8-Q1 UI screenshots (docs/shots/r8ui-*.jpg): Employee File bust with gear, slot cards with three geared characters, the owed-reward dialog on desktop and phone.
import { launch, open, startNew, SHOTS } from "./helpers.mjs";
import { mkdirSync } from "node:fs";
const OUT = process.env.R8UI_OUT || SHOTS; mkdirSync(OUT, { recursive: true });
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const jpg = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/r8ui-${name}.jpg`, type: "jpeg", quality: 85, ...opts });
const settle = async (g) => { await g.app("step", 2); await g.page.waitForTimeout(250); };
const wear = async (g, list) => { for (const [base, rarity] of list) { const r = await g.app("cheat.giveItem", { base, rarity }); await g.app("input", { t: "equip", id: r.id }); } await settle(g); };
const KITS = {
  "facilities-manager": [["hard-hat", "rare"], ["blazer", "magic"], ["rubber-gloves", "normal"], ["steel-toe-boots", "rare"], ["pipe-wrench", "unique"]],
  "sales-rep": [["visor-cap", "magic"], ["pinstripe-suit", "rare"], ["loafers", "normal"], ["letter-opener", "rare"], ["clipboard-shield", "magic"]],
  "it-wizard": [["headset", "rare"], ["cardigan", "magic"], ["typing-mitts", "normal"], ["sneakers", "magic"], ["usb-staff", "rare"]],
};
{
  const g = await open(browser, { query: "test=1&seed=3", viewport: { width: 1280, height: 720 }, lobby: true });
  const classes = Object.keys(KITS);
  for (let i = 0; i < 3; i++) {
    if (i) { await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title"); }
    await startNew(g.page, { cls: classes[i], name: ["Dana Wrench", "Sam Quota", "Ada Byte"][i] });
    await g.app("cheat.setLevel", 20);
    await g.app("input", { t: "unequip", slot: "weapon" });
    await wear(g, KITS[classes[i]]);
    if (i === 0) { await g.app("ui.open", "character"); await settle(g); await jpg(g.page, "bust-d", { clip: { x: 0, y: 0, width: 520, height: 720 } }); await g.app("ui.close", "character"); }
    await g.app("save.write");
  }
  await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title");
  await g.page.click(T("load-game")); await g.page.waitForSelector(T("slot-3")); await g.page.waitForTimeout(300);
  await jpg(g.page, "slotcards-d");
  await g.context.close();
}
for (const [name, viewport] of [["owed-d", { width: 1280, height: 720 }], ["owed-m", { width: 390, height: 844 }]]) {
  const g = await open(browser, { query: "test=1&seed=3", viewport, lobby: true });
  await startNew(g.page, { cls: "facilities-manager" });
  await g.app("quests.setStep", "sq5", 2);
  for (let n = 0; n < 80; n++) { const r = await g.app("cheat.giveItem", { slot: "body" }); if (!r?.ok) break; }
  for (let n = 0; n < 60; n++) { const r = await g.app("cheat.giveItem", { slot: "ring" }); if (!r?.ok) break; }
  await g.app("step", 200);
  const n = (await g.state()).npcs.find((o) => o.id === "vendor"); await g.app("clickTile", n.tile.x, n.tile.y);
  for (let i = 0; i < 12; i++) { await g.app("step", 60); if ((await g.state()).ui.dialog?.npc === "vendor") break; }
  await g.page.waitForTimeout(500);
  await g.page.click(T("quest-handin-sq5")); await g.app("step", 2); await g.page.waitForTimeout(400);
  await jpg(g.page, name);
  await g.context.close();
}
await browser.close();
