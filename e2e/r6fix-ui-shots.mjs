// Screenshots for the R6 fix round UI: Employee File per class, respec dialog, tree connectors (1x crop), cast-refused toast.
// 1280x720 and 390x844, JPEG < 300 KB. Not asserted by run-all. Usage: node e2e/r6fix-ui-shots.mjs [outDir=docs/shots] [prefix=r6fix-ui]
import { shotsDir } from "./shots-dir.mjs";
import { launch, open, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { content } from "../src/core/index.js";

const out = shotsDir(process.argv[2]), pre = process.argv[3] ?? "r6fix-ui";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const sizes = { d: { width: 1280, height: 720 }, m: { width: 390, height: 844 } };
const shot = async (g, name, clip) => { const path = `${out}/${pre}-${name}.jpg`; await g.page.waitForTimeout(250); await g.page.screenshot({ path, type: "jpeg", quality: 82, ...(clip ? { clip } : {}) }); console.log(name, Math.round(statSync(path).size / 1024) + " KB"); };
const plan = { "facilities-manager": ["floor-buffer", "floor-buffer", "dress-code", "coffee-break", "fire-drill"], "sales-rep": ["hustle", "pen-volley"], "it-wizard": ["power-surge", "firewall"] };

for (const [k, vp] of Object.entries(sizes)) {
  for (const c of content.classes) {
    const g = await open(browser, { query: "test=1&seed=1", viewport: vp, lobby: true });
    await startNew(g.page, { cls: c.id, name: "Pat Pending" });
    await g.app("cheat.setLevel", 8);
    await g.app("ui.open", "character");
    await g.page.waitForSelector(T("employee-file"));
    await g.page.hover(T(`alloc-${c.derived.powerAttr}`));
    await shot(g, `file-${k}-${c.id}`);
    await g.context.close();
  }
  { // tree + respec + connectors + toast on the first class
    const g = await open(browser, { query: "test=1&seed=1", viewport: vp, lobby: true });
    await startNew(g.page, { name: "Pat Pending" });
    await g.app("cheat.setLevel", 20);
    const cls = (await g.state()).player.class;
    for (const id of plan[cls]) await g.app("input", { t: "learnSkill", id });
    await g.app("ui.open", "skills");
    await g.page.waitForSelector(T("skills-panel"));
    if (k === "d") {
      const box = await g.page.locator(".tree .branch").first().boundingBox();
      await shot(g, `tree-1x-${k}`, { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.min(Math.round(box.height), 330) });
    } else await shot(g, `tree-${k}`);
    await g.page.click(T("respec"));
    await shot(g, `respec-${k}`);
    const info = await g.page.evaluate(() => { const d = document.querySelector('[data-testid="respec-confirm"]'); return { modal: d?.getAttribute("aria-modal"), by: d?.getAttribute("aria-labelledby"), desc: d?.getAttribute("aria-describedby"), active: document.activeElement?.dataset.testid }; });
    console.log(k, "dialog", JSON.stringify(info));
    for (let i = 0; i < 3; i++) await g.page.keyboard.press("Tab");
    console.log(k, "after 3 Tab focus still inside:", await g.page.evaluate(() => !!document.activeElement.closest(".rs-confirm")));
    await g.page.keyboard.press("Escape");
    console.log(k, "focus back on respec:", await g.page.evaluate(() => document.activeElement?.dataset.testid));
    await g.context.close();
  }
  { // refused cast toast: cast on the hero's own tile (no direction)
    const g = await open(browser, { query: "test=1&seed=1", viewport: vp, lobby: false });
    await startNew(g.page, { name: "Pat Pending" });
    await g.app("cheat.setLevel", 12);
    const cls = (await g.state()).player.class;
    const pick = Object.values(content.skills).find((d) => d.class === cls && ["projectile", "dash"].includes(d.archetype) && (d.reqLevel ?? 1) <= 12 && !(d.requires ?? []).length);
    for (const id of [...plan[cls], pick?.id].filter(Boolean)) await g.app("input", { t: "learnSkill", id });
    await g.page.waitForTimeout(3500); // let the "Learned" toasts go
    const s = await g.state();
    for (const id of [pick?.id].filter(Boolean)) {
      await g.app("input", { t: "cast", skill: id, tile: s.player.tile });
      if (await g.page.locator(T("toast")).isVisible()) { await g.page.waitForTimeout(100); console.log("toast after", id, JSON.stringify(await g.page.textContent(T("toast")))); break; }
    }
    await shot(g, `toast-${k}`);
    await g.context.close();
  }
}
await browser.close();
