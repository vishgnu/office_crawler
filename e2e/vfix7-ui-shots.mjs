// Screenshots for VFIX-R7-UI (U1-U6, N12, N14). JPEG, not asserted by run-all.
// Usage: node e2e/vfix7-ui-shots.mjs [prefix=vfix7-ui] [only]
import { launch, open, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";

const out = resolve("docs/shots"), pre = process.argv[2] ?? "vfix7-ui", only = process.argv[3];
const T = (id) => `[data-testid="${id}"]`;
const sizes = { d: { width: 1280, height: 720 }, m: { width: 390, height: 844 }, s: { width: 360, height: 740 }, t: { width: 320, height: 640 } };
const browser = await launch();
const shot = async (g, name, clip) => { const path = `${out}/${pre}-${name}.jpg`; await g.page.waitForTimeout(250); await g.page.screenshot({ path, type: "jpeg", quality: 80, ...(clip ? { clip } : {}) }); console.log(name, Math.round(statSync(path).size / 1024) + " KB"); };
const talk = async (g, npc) => { const n = (await g.state()).npcs.find((o) => o.id === npc); await g.app("clickTile", n.tile.x, n.tile.y); for (let i = 0; i < 12; i++) { await g.app("step", 60); if ((await g.state()).ui.dialog?.npc === npc) break; } await g.page.waitForTimeout(100); };
const mk = async (k, cls) => { const g = await open(browser, { query: "test=1&seed=3", viewport: sizes[k], lobby: true }); await startNew(g.page, { cls, name: "Pat Pending" }); await g.app("step", 3); return g; };
const want = (n) => !only || only === n;

for (const k of Object.keys(sizes)) {
  if (k === "t" && only && only !== "dock") continue;
  if (want("dock")) { // U1: level 30, attribute + skill points, a quest ready
    const g = await mk(k, "it-wizard"); await g.app("cheat.setLevel", 30); await g.app("quests.setStep", "sq1", 2); await g.app("step", 3);
    console.log(k, "dock", JSON.stringify(await g.page.evaluate(() => [...document.querySelectorAll('[data-testid^="dock-"]')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.testid, Math.round(r.left), Math.round(r.right)]; }))));
    await shot(g, `dock-${k}`, k === "d" ? { x: 1000, y: 0, width: 280, height: 220 } : { x: 0, y: 0, width: sizes[k].width, height: k === "t" ? 150 : 110 }); await g.context.close();
  }
  if (want("tree")) { // U2 + N12
    const g = await mk(k, "facilities-manager"); await g.app("cheat.setLevel", 12); await g.app("ui.open", "skills"); await g.app("step", 2); await shot(g, `tree-${k}`);
    if (k !== "d") { await g.page.evaluate(() => document.querySelector("#pleft .pb").scrollTo(0, 700)); await shot(g, `tree-${k}-scrolled`); }
    await g.context.close();
  }
  if (want("toast")) { // U3 / U4 / U5: accept toast, bag-full alert with the vendor window open
    let g = await mk(k, "facilities-manager");
    await g.app("quests.setStep", "sq5", 2);
    for (let n = 0; n < 80; n++) { const r = await g.app("cheat.giveItem", { slot: "body" }); if (!r?.ok) break; }
    await g.app("step", 200);
    await talk(g, "vendor"); await shot(g, `npc-open-${k}`);
    await g.page.click(T("quest-handin-sq5")); await g.app("step", 2); await shot(g, `bagfull-${k}`);
    console.log(k, "toast:", await g.page.textContent("#toast"), "hidden:", await g.page.evaluate(() => document.querySelector("#toast").hidden));
    await g.context.close();
    g = await mk(k, "sales-rep"); await g.app("step", 200);
    await talk(g, "vendor"); await g.page.click(T("quest-accept-sq1")); await g.app("step", 2); await g.page.keyboard.press("Escape"); await g.app("step", 2); await shot(g, `accepted-${k}`);
    await g.context.close();
  }
  if (want("handin")) { // R8-Q3 second hand-in toast
    const g = await mk(k, "sales-rep"); await g.app("step", 200);
    await g.app("quests.setStep", "sq1", 2); await g.app("step", 3);
    await talk(g, "vendor"); await g.page.click(T("quest-handin-sq1")); await g.app("step", 2); await shot(g, `handin-${k}`);
    console.log(k, "handin toast:", await g.page.textContent("#toast"));
    await g.context.close();
  }
}
if (want("cs")) { // N14: a paused fake clock steps the flourish frame by frame (real-time screenshots arrive after it is over)
  const context = await browser.newContext({ viewport: sizes.d }), page = await context.newPage();
  await page.clock.install({ time: 0 });
  await page.goto(new URL("../dist/index.html", import.meta.url).href);
  await page.clock.runFor(1500);
  await page.click(T("new-game")); await page.clock.runFor(500); await page.click(T("class-it-wizard")); await page.clock.runFor(1500);
  await page.click(T("class-facilities-manager"));
  let t = 0;
  for (const [i, ms] of [[0, 50], [1, 100], [2, 130], [3, 130], [4, 130], [5, 200]]) { await page.clock.runFor(ms); t += ms; const path = `${out}/${pre}-cs-${i}.jpg`; await page.screenshot({ path, type: "jpeg", quality: 82, clip: { x: 60, y: 120, width: 560, height: 520 } }); console.log("cs", i, t + " ms after the click"); }
  await context.close();
}
await browser.close();
