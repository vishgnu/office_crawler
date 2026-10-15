// Screenshots for R7-0.5 (journal desktop and phone, tracker, pause menu entry); JPEG < 300 KB. Not asserted by run-all.
// Usage: node e2e/r7-ui-journal-shots.mjs [outDir=docs/shots]
import { shotsDir } from "./shots-dir.mjs";
import { launch, open, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";

const out = shotsDir(process.argv[2]);
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const shot = async (g, name, clip) => { const path = `${out}/r7-ui-${name}.jpg`; await g.page.waitForTimeout(250); await g.page.screenshot({ path, type: "jpeg", quality: 82, ...(clip ? { clip } : {}) }); console.log(name, Math.round(statSync(path).size / 1024) + " KB"); };
const prep = async (viewport) => {
  const g = await open(browser, { query: "test=1&seed=1", viewport, lobby: true });
  await startNew(g.page, { name: "Pat Pending" });
  await g.app("quests.setStep", "main", 3);
  await g.app("quests.setStep", "sq2", 1);
  await g.app("quests.setStep", "sq1", 3);
  await g.app("cheat.giveGold", 10);
  return g;
};
for (const [k, vp] of Object.entries({ d: { width: 1280, height: 720 }, m: { width: 390, height: 844 } })) {
  const g = await prep(vp);
  if (k === "d") { await g.app("cheat.teleportFloor", 1); await g.app("step", 5); await shot(g, "tracker-d"); }
  await g.app("ui.open", "journal");
  await shot(g, `journal-${k}`);
  if (k === "d") { await g.page.evaluate(() => { document.querySelector("#pleft .pb").scrollTop = 9999; }); await shot(g, "journal-d-bottom"); await g.page.evaluate(() => { document.querySelector("#pleft .pb").scrollTop = 0; }); }
  if (k === "m") { await g.app("ui.close", "journal"); await g.app("cheat.teleportFloor", 1); await g.app("step", 5); await shot(g, "tracker-m"); }
  if (k === "d") {
    await g.app("ui.close", "journal"); await g.app("pause");
    await shot(g, "pause-journal-d");
  }
  await g.errors.length && console.log("ERRORS", g.errors);
  await g.context.close();
}
await browser.close();
