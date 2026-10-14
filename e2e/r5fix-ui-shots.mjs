// Screenshots for the R5 fix round (UI-FIX): class selection per class, the skill tree, the slot manager with a notice and with the
// take-over action; 1280x720 and 390x844, JPEG < 300 KB. Not asserted by run-all. Usage: node e2e/r5fix-ui-shots.mjs [outDir=docs/shots]
import { launch, open, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { content } from "../src/core/index.js";

const out = resolve(process.argv[2] ?? "docs/shots");
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const sizes = { d: { width: 1280, height: 720 }, m: { width: 390, height: 844 } };
const shot = async (g, name) => { const path = `${out}/r5fix-ui-${name}.jpg`; await g.page.waitForTimeout(250); await g.page.screenshot({ path, type: "jpeg", quality: 82 }); console.log(name, Math.round(statSync(path).size / 1024) + " KB"); };
const lobby = (viewport) => open(browser, { query: "test=1&seed=1", viewport, lobby: true });
const setStatus = (g, status) => g.page.evaluate((st) => { const v = window.__app.slots.view(); v.status = st; }, status);

for (const [k, vp] of Object.entries(sizes)) {
  for (const c of content.classes) {
    const g = await lobby(vp);
    await g.page.click(T("new-game"));
    await g.page.click(T(`class-${c.id}`));
    await g.page.waitForSelector(".create[data-ready='1']");
    await shot(g, `cs-${k}-${c.id}`);
    if (c === content.classes[0]) { await g.page.fill(T("create-name"), "Pat Pending"); await shot(g, `cs-${k}-named`); }
    await g.context.close();
  }
  // tree
  {
    const g = await lobby(vp);
    await startNew(g.page, { name: "Pat Pending" });
    await g.app("cheat.setLevel", 8);
    await g.app("ui.open", "skills");
    await shot(g, `tree-${k}`);
    await g.context.close();
  }
  // slots with a notice and with take-over
  {
    const g = await lobby(vp);
    await startNew(g.page, { name: "Pat Pending" });
    await g.app("pause");
    await setStatus(g, { storage: "ok", owner: "stale", notice: "pre-switch-save-failed" });
    await g.page.click(T("pause-slots"));
    await shot(g, `slots-${k}-notice`);
    await g.page.click(T("take-over-saves"));
    await shot(g, `slots-${k}-takeover`);
    await g.context.close();
  }
}
await browser.close();
