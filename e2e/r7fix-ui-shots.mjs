// Screenshots for FIX-R7-UI: the toast sequence (quest line holds, level-up waits, then shows) and the phone focus return. JPEG, not asserted by run-all.
// Usage: node e2e/r7fix-ui-shots.mjs [outDir=docs/shots] [prefix=r7fix-ui]
import { shotsDir } from "./shots-dir.mjs";
import { launch, open, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";

const out = shotsDir(process.argv[2]), pre = process.argv[3] ?? "r7fix-ui";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const shot = async (g, name, clip) => { const path = `${out}/${pre}-${name}.jpg`; await g.page.waitForTimeout(150); await g.page.screenshot({ path, type: "jpeg", quality: 82, ...(clip ? { clip } : {}) }); console.log(name, Math.round(statSync(path).size / 1024) + " KB"); };
const talk = async (g, npc) => { const n = (await g.state()).npcs.find((o) => o.id === npc); await g.app("clickTile", n.tile.x, n.tile.y); for (let i = 0; i < 12; i++) { await g.app("step", 60); if ((await g.state()).ui.dialog?.npc === npc) break; } await g.page.waitForTimeout(60); };
const kill = async (g, n) => { const s = await g.state(); for (const z of s.monsters.filter((m) => m.type === "zombie-intern" && m.ai !== "dead").slice(0, n)) { await g.app("cheat.damageMonster", z.id, 9999); await g.app("step", 1); } };

{ // a level-up on the finishing kill: the quest line first, the level-up line after it
  const g = await open(browser, { query: "test=1&seed=3&realtime=1", viewport: { width: 1280, height: 720 }, lobby: true });
  await startNew(g.page, { cls: "sales-rep", name: "Pat Pending" });
  await g.app("cheat.teleportFloor", 1); await g.app("step", 2); await kill(g, 15);
  await g.app("cheat.teleportFloor", 0); await g.app("step", 2);
  await talk(g, "vendor"); await g.page.click(T("quest-accept-sq1")); await g.app("step", 2); await g.page.keyboard.press("Escape");
  await g.page.waitForTimeout(4300); // the accept line has run its time
  await g.app("cheat.teleportFloor", 1); await g.app("step", 2); await g.page.waitForTimeout(4300);
  for (let i = 0; i < 8; i++) await kill(g, 1);
  const box = async () => { const b = await g.page.locator("#toast").boundingBox(); return b ? { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 20), width: Math.min(1280, b.width + 80), height: b.height + 40 } : undefined; };
  console.log("t0 toast:", await g.page.textContent("#toast"), "| live:", await g.page.textContent("#live"));
  await shot(g, "toast-1-quest-line", await box());
  await g.page.waitForTimeout(4100);
  console.log("t+4.1s toast:", await g.page.textContent("#toast"), "| live:", await g.page.textContent("#live"));
  await shot(g, "toast-2-levelup-after", await box());
  await g.context.close();
}
{ // phone: Escape on the journal returns focus to the dock button
  const g = await open(browser, { query: "test=1&seed=3", viewport: { width: 390, height: 844 }, lobby: true });
  await startNew(g.page, { cls: "sales-rep", name: "Pat Pending" });
  const fid = () => g.page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
  await g.page.focus(T("dock-journal")); await g.page.keyboard.press("Enter"); await g.app("step", 2);
  await shot(g, "phone-journal-open");
  await g.page.keyboard.press("Escape"); await g.app("step", 2);
  console.log("focus after Escape:", await fid());
  await shot(g, "phone-focus-returned", { x: 0, y: 0, width: 390, height: 140 });
  await g.context.close();
}
await browser.close();
