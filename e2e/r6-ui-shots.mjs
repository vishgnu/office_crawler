// Screenshots for R6 UI (N5 slots Close, N6/N7 pause take-over, N8 tree, character select, respec confirm); 1280x720 and 390x844, JPEG < 300 KB.
// Not asserted by run-all. Usage: node e2e/r6-ui-shots.mjs [outDir=docs/shots] [prefix=r6-ui]
import { shotsDir } from "./shots-dir.mjs";
import { launch, open, startNew } from "./helpers.mjs";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { content } from "../src/core/index.js";

const out = shotsDir(process.argv[2]), pre = process.argv[3] ?? "r6-ui";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const sizes = { d: { width: 1280, height: 720 }, m: { width: 390, height: 844 } };
const shot = async (g, name, clip) => { const path = `${out}/${pre}-${name}.jpg`; await g.page.waitForTimeout(250); await g.page.screenshot({ path, type: "jpeg", quality: 82, ...(clip ? { clip } : {}) }); console.log(name, Math.round(statSync(path).size / 1024) + " KB"); };
const lobby = (viewport) => open(browser, { query: "test=1&seed=1", viewport, lobby: true });
const setStatus = (g, status) => g.page.evaluate((st) => { const v = window.__app.slots.view(); v.status = st; }, status);
const only = process.argv[4];
const want = (n) => !only || only.split(",").includes(n);

for (const [k, vp] of Object.entries(sizes)) {
  if (want("cs")) for (const c of content.classes) {
    const g = await lobby(vp);
    await g.page.click(T("new-game"));
    await g.page.click(T(`class-${c.id}`));
    await g.page.waitForSelector(".create[data-ready='1']");
    await shot(g, `cs-${k}-${c.id}`);
    if (c === content.classes[0]) {
      await g.page.evaluate(() => document.documentElement.classList.remove("noanim")); await g.page.click(T("class-it-wizard")); await g.page.waitForTimeout(600); await g.page.click(T("class-facilities-manager"));
      let n = 0; for (const ms of [300, 80, 80]) { await g.page.waitForTimeout(ms); const path = `${out}/${pre}-cs-${k}-slam-${++n}.jpg`; await g.page.screenshot({ path, type: "jpeg", quality: 82, clip: k === "d" ? { x: 0, y: 220, width: 560, height: 400 } : { x: 0, y: 0, width: 390, height: 290 } }); console.log("slam", n); } await g.page.evaluate(() => document.documentElement.classList.add("noanim"));
    }
    if (c === content.classes[0]) { await g.page.fill(T("create-name"), "Pat Pending"); await shot(g, `cs-${k}-named`); }
    await g.context.close();
  }
  if (want("tree")) for (const lvl of [8, 20]) {
    const g = await lobby(vp);
    await startNew(g.page, { name: "Pat Pending" });
    await g.app("cheat.setLevel", lvl);
    const cls = (await g.state()).player.class, plan = { "facilities-manager": ["floor-buffer", "floor-buffer", "dress-code", "coffee-break", "fire-drill"], "sales-rep": ["hustle", "pen-volley"], "it-wizard": ["power-surge", "firewall"] }[cls] ?? [];
    if (lvl === 20) for (const id of plan) await g.app("input", { t: "learnSkill", id });
    await g.app("ui.open", "skills");
    await shot(g, `tree-${lvl}-${k}`);
    if (lvl === 8) {
      await g.page.evaluate(() => { const b = document.querySelector(".pb"); b.scrollTop = b.scrollHeight; });
      await shot(g, `tree-${lvl}-${k}-bottom`);
      await g.page.evaluate(() => { document.querySelector(".pb").scrollTop = 0; });
    }
    if (lvl === 20) {
      await g.page.evaluate(() => { document.querySelector(".pb").scrollTop = 330; });
      await shot(g, `tree-${lvl}-${k}-mid`);
      await g.page.evaluate(() => { document.querySelector(".pb").scrollTop = 0; });
      await g.page.click(T("respec"));
      await shot(g, `respec-${k}`);
      await g.page.keyboard.press("Escape");
      console.log(k, "panel still open after Esc:", await g.page.evaluate(() => !!document.querySelector('[data-testid="skills-panel"]')), "confirm gone:", !(await g.page.locator(T("respec-confirm")).count()));
    }
    await g.context.close();
  }
  if (want("slots")) {
    const g = await lobby(vp);
    const names = ["Pat Pending", "Sam Sample", "Ida Idle", "Lou Lobby", "Max Memo"];
    for (let n = 1; n <= 5; n++) await g.app("slots.run", { t: "createCharacter", slot: n, class: content.classes[(n - 1) % 3].id, name: names[n - 1], seed: n });
    await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title");
    await g.page.click(T("load-game")); await g.page.waitForSelector(T("slots-view"));
    await shot(g, `slots-${k}-five`);
    await g.page.evaluate(() => { const c = document.querySelector(".dlg-card"); c.scrollTop = c.scrollHeight; });
    await shot(g, `slots-${k}-five-bottom`);
    await g.context.close();
  }
  if (want("pause")) {
    const g = await lobby(vp);
    await startNew(g.page, { name: "Pat Pending" });
    await setStatus(g, { storage: "memory", owner: "stale", notice: "pre-switch-save-failed" });
    await g.app("pause");
    await g.page.waitForSelector(T("take-over-saves"));
    await shot(g, `pause-banners-${k}`);
    await g.page.click(T("take-over-saves"));
    await shot(g, `pause-takeover-${k}`);
    const m = await g.page.evaluate(() => { const h = document.querySelector(".pause h2")?.getBoundingClientRect(); const s = document.querySelector(".pause"); return { h2top: h?.top, sh: s.scrollHeight, ch: s.clientHeight }; });
    console.log(k, "pause metrics", JSON.stringify(m));
    await g.context.close();
  }
}
await browser.close();
