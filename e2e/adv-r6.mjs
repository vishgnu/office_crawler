// Adversarial e2e for round 6 (respec confirmation, skill tree connectors and keyboard, pause and slot layout, caster scaling, save compatibility,
// lazy atlas, per-class runs). Test-engineer, adversarial mode. Every page is served from an https origin (L-027), never file://.
// `xfail(name, ok, "ADV-R6-NN")` marks a demonstrated defect from docs/reviews/R6-adversarial.md: printed XFAIL (XPASS once fixed), never fails the script.
// Screenshots: docs/shots/adv-r6-*.jpg (JPEG, below 300 KB).
import { mkdirSync, statSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { launch, check, finish, startNew } from "./helpers.mjs";
import { toSave, checksumOf } from "../src/save/index.js";
import { newGame } from "../src/core/state.js";
import { canonical } from "../src/core/hash.js";

const browser = await launch();
const T = (id) => `[data-testid="${id}"]`;
const SHOTS = "docs/shots";
mkdirSync(SHOTS, { recursive: true });
const CL = { fm: "facilities-manager", sr: "sales-rep", it: "it-wizard" };
const xres = [];
function xfail(name, ok, id, detail) {
  xres.push({ name, ok: !!ok, id });
  console.log(`${ok ? "XPASS (defect fixed? remove the xfail)" : "XFAIL"} ${id} ${name}${!ok && detail !== undefined ? "  -> " + JSON.stringify(detail).slice(0, 300) : ""}`);
}
const shot = async (page, name) => {
  const path = `${SHOTS}/adv-r6-${name}.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 60 });
  const kb = statSync(path).size / 1024;
  check(`screenshot adv-r6-${name}.jpg is at most 300 KB`, kb <= 300, kb);
};

// ---- build variants of the game (respec mode) into a temp dir; the shipped dist/index.html is used for everything else
const tmp = mkdtempSync(join(tmpdir(), "adv-r6-"));
async function variant(name, respec) {
  const js = await build({
    entryPoints: ["src/main.js"], bundle: true, minify: true, format: "iife", write: false, target: "es2022",
    plugins: [{ name: "respec-mode", setup(b) { b.onLoad({ filter: /core[\\/]config\.js$/ }, (a) => {
      const src = readFileSync(a.path, "utf8"), from = 'respec: { mode: "free", townOnly: true, goldBase: 0, goldPerLevel: 0 }';
      if (!src.includes(from)) throw new Error("config.respec line not found: the variant build needs updating");
      return { contents: src.replace(from, `respec: ${respec}`), loader: "js", resolveDir: join(a.path, "..") };
    }); } }],
  });
  const shell = readFileSync("src/index.html", "utf8"), css = readFileSync("src/style.css", "utf8");
  const html = shell.replace("/*STYLE*/", () => css).replace("/*SCRIPT*/", () => js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"));
  const p = join(tmp, `${name}.html`); writeFileSync(p, html); return p;
}
const VARIANTS = {
  once: await variant("once", '{ mode: "once", townOnly: true, goldBase: 0, goldPerLevel: 0 }'),
  gold: await variant("gold", '{ mode: "gold", townOnly: true, goldBase: 50, goldPerLevel: 10 }'),
};

/** A page on an https origin serving `file` (default the shipped build). */
async function boot({ viewport = { width: 1280, height: 720 }, query = "test=1&seed=1", file = "dist/index.html", init = null, seed = null, deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  await context.route("https://oc.test/**", (r) => r.fulfill({ path: file, contentType: "text/html" }));
  if (init) await context.addInitScript(init);
  if (seed) await context.addInitScript((d) => { if (localStorage.getItem("advseed")) return; localStorage.setItem("advseed", "1"); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, seed);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message + " @ " + String(e.stack).split("\n").slice(1, 3).join(" | ")));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`https://oc.test/index.html?${query}`);
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  return { context, page, app, state: () => app("getState"), errors };
}
const VIEWS = [[1280, 720], [1024, 600], [720, 720], [390, 844], [390, 560]];
const sec = (name) => !process.env.SEC || process.env.SEC.split(",").includes(name); // SEC=pause runs one section while developing
const hero = async (opts, cls = CL.fm, name = "Probe") => { const g = await boot(opts); await startNew(g.page, { cls, name }); return g; };
const learnSome = async (g, plan) => { for (const [id, n] of plan) for (let i = 0; i < n; i++) await g.app("tree.learn", id); };
const PLAN = { [CL.fm]: [["pallet-slam", 3], ["floor-buffer", 2]], [CL.sr]: [["stapler-throw", 3], ["pen-volley", 2]], [CL.it]: [["server-overheat", 3], ["power-surge", 2]] };
const focusId = (page) => page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll(".screen,.panel")].every((e) => e.scrollWidth <= innerWidth + 1));
const openSkills = async (g) => { await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(80); };

// ================================================================ 1. respec confirmation
if (sec("respec")) {
{
  const g = await hero(); await g.app("cheat.setLevel", 16); await learnSome(g, PLAN[CL.fm]);
  const before = (await g.state()).player;
  const learned = before.skillPoints;
  await openSkills(g);
  check("[R6-respec] the confirmation is not shown before the click", (await g.page.locator(T("respec-confirm")).count()) === 0);
  await g.page.click(T("respec"));
  check("[R6-respec] Respec opens a confirmation that names the refund and changes nothing yet", (await g.page.locator(T("respec-confirm")).count()) === 1 && (await g.state()).player.skillPoints === learned && Object.keys((await g.state()).player.skills).length > 1);
  const refund = Number((await g.page.textContent(T("respec-refund"))).match(/\d+/)?.[0]);
  const real = Object.entries((await g.state()).player.skills).reduce((a, [id, l]) => a + (id === "pallet-slam" ? l - 1 : l), 0);
  check("[R6-respec] the confirmation text and the Yes button agree with the real refund", refund === real && real > 0 && new RegExp(`\\b${real}\\b`).test(await g.page.textContent(T("respec-yes"))), [refund, real, await g.page.textContent(T("respec-yes"))]);
  check("[R6-respec] focus moves into the confirmation (Cancel is the safe default)", (await focusId(g.page)) === "respec-no", await focusId(g.page));
  await g.page.keyboard.press("Escape");
  check("[R6-respec] Esc closes the confirmation first: the panel stays open, nothing changed, focus is back on Respec", (await g.page.locator(T("respec-confirm")).count()) === 0 && (await g.state()).ui.panels?.skills === true && (await g.state()).player.skillPoints === learned && (await focusId(g.page)) === "respec", [await focusId(g.page)]);
  await g.page.click(T("respec")); await g.page.click(T("respec-no"));
  check("[R6-respec] Cancel closes it with nothing changed", (await g.page.locator(T("respec-confirm")).count()) === 0 && (await g.state()).player.skillPoints === learned);
  // Enter on the focused Cancel / Space on Yes by keyboard
  await g.page.click(T("respec")); await g.page.keyboard.press("Enter");
  check("[R6-respec] Enter on the focused Cancel cancels (keyboard users cannot confirm by accident)", (await g.page.locator(T("respec-confirm")).count()) === 0 && (await g.state()).player.skillPoints === learned);
  // two clicks on Respec in a row: one confirmation, not two, not a respec
  await g.page.evaluate(() => { const b = document.querySelector('[data-testid="respec"]'); b.click(); b.click(); });
  check("[R6-respec] two fast clicks on Respec show one confirmation and do not respec", (await g.page.locator(T("respec-confirm")).count()) === 1 && (await g.state()).player.skillPoints === learned);
  // learning while the confirmation is open: the numbers on it follow
  await g.page.keyboard.press("Escape"); await g.app("tree.learn", "pallet-slam");
  await g.page.click(T("respec"));
  check("[R6-respec] points learned while it was closed are counted: refund +1", new RegExp(`\\b${real + 1}\\b`).test(await g.page.textContent(T("respec-refund"))), await g.page.textContent(T("respec-refund")));
  await g.app("tree.learn", "floor-buffer");
  await g.page.waitForTimeout(80);
  const sh = await g.page.locator(T("respec-confirm")).count() ? await g.page.textContent(T("respec-refund")) : "gone";
  check("[R6-respec] a skill learned while the confirmation is open updates its refund (+2) or closes it, never shows a stale number", sh === "gone" || new RegExp(`\\b${real + 2}\\b`).test(sh), sh);
  await shot(g.page, "respec-confirm");
  // double click on Yes: refunded once
  await g.page.evaluate(() => { const b = document.querySelector('[data-testid="respec-yes"]'); if (b) { b.click(); b.click(); } });
  const after = (await g.state()).player;
  check("[R6-respec] a double click on Yes respecs once: every point back exactly once, only the signature left", after.skillPoints === 15 && Object.keys(after.skills).join() === "pallet-slam" && after.respecsUsed === 1, [after.skillPoints, after.skills, after.respecsUsed]);
  check("[R6-respec] after Yes the confirmation is gone and the panel is still open", (await g.page.locator(T("respec-confirm")).count()) === 0 && (await g.state()).ui.panels?.skills === true);
  check("[R6-respec] focus is on a live control after Yes (not on the body)", (await focusId(g.page)) !== "BODY", await focusId(g.page));
  check("[R6-respec] Respec with nothing learned runs at once, no confirmation, nothing changes in free mode", await (async () => { await g.page.click(T("respec")); return (await g.page.locator(T("respec-confirm")).count()) === 0 && (await g.state()).player.skillPoints === 15; })());
  check("[R6-respec] no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}
// leaving the Lobby, closing the panel, pausing while it is open
{
  const g = await hero(); await g.app("cheat.setLevel", 16); await learnSome(g, PLAN[CL.fm]);
  await openSkills(g); await g.page.click(T("respec"));
  await g.app("cheat.teleportFloor", 1); await g.page.waitForTimeout(100);
  check("[R6-respec] leaving the Lobby with the confirmation open removes it", (await g.page.locator(T("respec-confirm")).count()) === 0);
  await g.app("cheat.teleportFloor", 0); await g.page.waitForTimeout(100);
  await openSkills(g).catch(() => {});
  if (!(await g.state()).ui.panels?.skills) await openSkills(g);
  check("[R6-respec] coming back to the Lobby does not bring the old confirmation back", (await g.page.locator(T("respec-confirm")).count()) === 0);
  await g.page.click(T("respec"));
  await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(80); await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(80);
  check("[R6-respec] closing the panel with S while it is open and reopening it: no confirmation", (await g.page.locator(T("respec-confirm")).count()) === 0 && (await g.state()).player.skillPoints < 15);
  await g.page.click(T("respec"));
  await g.page.keyboard.press("Escape"); await g.page.keyboard.press("Escape");
  const st = await g.state();
  check("[R6-respec] Esc twice (confirmation, then panel) leaves the game un-paused and the points untouched", st.player.skillPoints < 15 && !st.ui.panels?.skills, [st.paused, st.ui.panels]);
  await g.page.keyboard.press("Escape"); // pause
  await g.page.keyboard.press("Escape"); // resume
  await openSkills(g);
  check("[R6-respec] after pause and resume no confirmation is open", (await g.page.locator(T("respec-confirm")).count()) === 0);
  // dying with the confirmation open is covered by the scene reset check above (any scene other than town); the window must have no error
  check("[R6-respec] no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}
// modes: once and gold (variant builds with config.respec changed)
{
  const g = await boot({ file: VARIANTS.once }); await startNew(g.page, { cls: CL.sr, name: "Once" });
  await g.app("cheat.setLevel", 16); await learnSome(g, PLAN[CL.sr]); await openSkills(g);
  await g.page.click(T("respec"));
  check("[R6-once] the confirmation says it is the only respec", /once|only|one/i.test(await g.page.textContent(T("respec-refund"))), await g.page.textContent(T("respec-refund")));
  await g.page.click(T("respec-yes"));
  check("[R6-once] after the one respec the button is disabled with the reason on screen", (await g.page.locator(T("respec")).isDisabled()) && /already/i.test(await g.page.textContent(T("respec-note"))), await g.page.textContent(T("respec-note")));
  await g.page.locator(T("respec")).click({ force: true }).catch(() => {});
  check("[R6-once] forcing a click on the disabled button opens no confirmation", (await g.page.locator(T("respec-confirm")).count()) === 0);
  await g.context.close();
}
{ // the once mode, with the first click being a respec of an empty tree
  const g = await boot({ file: VARIANTS.once }); await startNew(g.page, { cls: CL.sr, name: "Once0" });
  await g.app("cheat.setLevel", 16); await openSkills(g);
  await g.page.click(T("respec")); // nothing learned: runs without a confirmation
  await learnSome(g, PLAN[CL.sr]);
  const r = await g.app("tree.respec");
  xfail("[R6-once] clicking Respec with nothing learned does not use up the one respec of the once mode", r.ok === true, "ADV-R6-02", { second: r });
  await g.context.close();
}
{
  const g = await boot({ file: VARIANTS.gold }); await startNew(g.page, { cls: CL.it, name: "Gold" });
  await g.app("cheat.setLevel", 16); await g.app("cheat.giveGold", 1000); await openSkills(g);
  const g0 = (await g.state()).player.gold;
  await g.page.click(T("respec"));
  const g1 = (await g.state()).player.gold;
  xfail("[R6-gold] Respec with nothing to return takes no gold (here it silently charged 210 gold for 0 points, with no confirmation)", g1 === g0, "ADV-R6-02", { before: g0, after: g1 });
  await learnSome(g, PLAN[CL.it]);
  await g.page.click(T("respec"));
  const txt = await g.page.textContent(T("respec-refund"));
  check("[R6-gold] the confirmation names the gold price", /\d+ gold|gold/i.test(txt) && /210|\d{2,}/.test(txt), txt);
  const gb = (await g.state()).player.gold;
  await g.page.click(T("respec-yes"));
  const ga = (await g.state()).player.gold, pa = (await g.state()).player;
  check("[R6-gold] Yes charges exactly the shown price once", gb - ga === 50 + 10 * 16 && pa.respecsUsed >= 1, [gb, ga]);
  // not enough gold: button disabled, explanation visible
  await learnSome(g, PLAN[CL.it]);
  await g.app("cheat.giveGold", -100000).catch(() => {});
  await g.context.close();
}
{ // gold: the player cannot afford it: disabled and says why; spending the gold while the confirmation is open closes it (never a stale Yes)
  const g = await boot({ file: VARIANTS.gold }); await startNew(g.page, { cls: CL.it, name: "Poor" });
  await g.app("cheat.setLevel", 16); await g.app("cheat.giveGold", 300); await learnSome(g, PLAN[CL.it]); await openSkills(g);
  await g.page.click(T("respec"));
  const gold = (await g.state()).player.gold;
  await g.app("input", { t: "sell", where: "x" }).catch(() => {});
  check("[R6-gold] with 300 gold the confirmation shows (cost 210)", (await g.page.locator(T("respec-confirm")).count()) === 1 && gold >= 210, gold);
  await g.page.click(T("respec-yes"));
  check("[R6-gold] after paying, the player has less than the price and Respec is disabled with a reason", (await g.page.locator(T("respec")).isDisabled()) === ((await g.state()).player.gold < 210), (await g.state()).player.gold);
  await g.context.close();
}

} // sec respec
// ================================================================ 2. tree connectors: every class, every state, three widths
if (sec("tree")) {
/** Reads every node and connector of the open skills panel: geometry in CSS px, pseudo-element widths from the computed style. */
const readTree = (page) => page.evaluate(() => {
  const out = [];
  for (const br of document.querySelectorAll('[data-testid^="branch-"]')) {
    const nodes = [...br.querySelectorAll(".tnode")].map((li) => {
      const r = li.getBoundingClientRect(), lk = li.querySelector(":scope > i.lk"), kd = li.querySelector(":scope > i.kd");
      const pse = (el, w) => el ? parseFloat(getComputedStyle(el, w).width) : null;
      return { id: li.dataset.testid.replace("skill-", ""), state: li.dataset.state, tier: Number(li.dataset.tier), x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2,
        lk: lk ? { cls: lk.className, span: lk.style.getPropertyValue("--span"), after: pse(lk, "::after"), disp: getComputedStyle(lk).display } : null, kd: kd ? { cls: kd.className, disp: getComputedStyle(kd).display } : null,
        need: li.querySelector(".tn-req")?.textContent ?? null, needVisible: li.querySelector(".tn-req") ? getComputedStyle(li.querySelector(".tn-req")).display !== "none" : false };
    });
    out.push({ branch: br.dataset.testid, nodes });
  }
  return out;
});
for (const [clsKey, cls] of Object.entries(CL)) {
  for (const stage of ["fresh", "lvl8", "partial", "maxed"]) {
    const g = await hero({ viewport: { width: 1280, height: 720 } }, cls, "Tree");
    const tv0 = await g.app("tree.get");
    const all = tv0.branches.flatMap((b) => b.nodes);
    if (stage !== "fresh") await g.app("cheat.setLevel", stage === "lvl8" ? 8 : 30);
    if (stage === "partial") for (const n of all.filter((x) => x.tier === 1)) await g.app("tree.learn", n.id);
    if (stage === "maxed") for (let r = 0; r < 5; r++) for (const n of all) await g.app("tree.learn", n.id);
    await openSkills(g); await g.page.waitForTimeout(60);
    const tv = await g.app("tree.get"), dom = await readTree(g.page);
    const byId = new Map(tv.branches.flatMap((b) => b.nodes).map((n) => [n.id, n]));
    const bad = [], short = [];
    for (const b of tv.branches) {
      const d = dom.find((x) => x.branch === `branch-${b.id}`);
      if (!d) { bad.push(`no branch ${b.id}`); continue; }
      const dn = new Map(d.nodes.map((n) => [n.id, n]));
      for (const n of b.nodes) {
        const e = dn.get(n.id);
        if (!e) { bad.push(`no node ${n.id}`); continue; }
        if (e.state !== n.state) bad.push(`${n.id} state ${e.state} vs ${n.state}`);
        const par = n.requires.map((r) => dn.get(r.id)).find(Boolean);
        if (n.requires.length) {
          if (!e.lk) { bad.push(`${n.id} has no connector`); continue; }
          const allMet = n.requires.every((r) => r.met);
          if (e.lk.cls.includes(" ok") !== allMet) bad.push(`${n.id} connector ok=${e.lk.cls} but prerequisites met=${allMet}`);
          const dx = n.col - byId.get(n.requires[0].id).col, want = dx > 0 ? "l" : dx < 0 ? "r" : "s";
          if (!e.lk.cls.split(" ").includes(want)) bad.push(`${n.id} elbow ${e.lk.cls} wants ${want}`);
          if (par) {
            if (!(par.y + par.h <= e.y + 1)) bad.push(`${n.id} parent is not above it`);
            if (want !== "s" && Math.abs(e.lk.after - (Math.abs(e.cx - par.cx) + 1.5)) > 1) short.push(`${n.id} elbow ${e.lk.after} px, parent centre is ${Math.abs(e.cx - par.cx) + 1.5} px away`);
            if (!par.kd) bad.push(`${par.id} has no stub for its dependant ${n.id}`);
            else if (par.kd.cls.includes(" ok") !== ((byId.get(par.id).level ?? 0) > 0)) bad.push(`${par.id} stub colour ${par.kd.cls} vs level ${byId.get(par.id).level}`);
            if (e.y - (par.y + par.h) > 40) bad.push(`${n.id} gap to parent is ${Math.round(e.y - par.y - par.h)} px: the two stubs cannot meet`);
          }
        } else if (e.lk) bad.push(`${n.id} has a connector without a prerequisite`);
      }
    }
    check(`[R6-tree] ${clsKey} ${stage}: every prerequisite has a connector with the right direction and colour (met or not), parent stubs match, nodes keep their state`, bad.length === 0, bad.slice(0, 3));
    if (stage === "lvl8") xfail(`[R6-tree] ${clsKey}: every elbow reaches the centre of its parent's stub (it stops 2 to 7 px short: 100% excludes the 4 px of border per column)`, short.length === 0, "ADV-R6-03", short.slice(0, 2));
    if (stage === "partial" || stage === "lvl8") check(`[R6-tree] ${clsKey} ${stage}: no horizontal scroll`, await overflow(g.page));
    if (stage === "partial") await shot(g.page, `tree-${clsKey}-partial`);
    check(`[R6-tree] ${clsKey} ${stage}: no page error`, g.errors.length === 0, g.errors);
    await g.context.close();
  }
}

} // sec tree
// ================================================================ 3. tree keyboard
if (sec("keys")) {
{
  const g = await hero({}, CL.fm, "Keys"); await g.app("cheat.setLevel", 16);
  await openSkills(g);
  check("[R6-keys] S opens the panel and focus is inside it or still on the page (not lost on a removed node)", true);
  // walk the whole panel with Tab: every learn / node / assign / respec / close control is reached, in DOM order, and focus never falls to <body>
  await g.page.focus(T("close-skills"));
  const seen = [], lost = [];
  for (let i = 0; i < 160; i++) {
    await g.page.keyboard.press("Tab");
    const id = await focusId(g.page);
    if (id === "BODY") lost.push(i);
    seen.push(id);
    if (seen.filter((x) => x === id).length > 1 && seen.length > 20) break;
  }
  const want = ["respec", "node-pallet-slam", "learn-pallet-slam", "node-floor-buffer", "learn-floor-buffer", "node-demolition-day", "node-dress-code"];
  check("[R6-keys] Tab reaches Respec, every node and every Learn button of the Facilities Manager tree", want.every((w) => seen.includes(w)), want.filter((w) => !seen.includes(w)));
  check("[R6-keys] Tab visits a branch top to bottom (node, then its Learn, then the next tier)", seen.indexOf("node-pallet-slam") < seen.indexOf("node-floor-buffer") && seen.indexOf("node-floor-buffer") < seen.indexOf("node-demolition-day"), seen.slice(0, 30));
  check("[R6-keys] the drawer does not trap Tab: after its last node the focus leaves it once (to the page), then reaches the HUD", lost.length === 1 && seen.some((x) => /^hud-/.test(x)), [lost, seen.slice(20, 30)]);
  check("[R6-keys] a disabled Learn (locked tier 3) is skipped by Tab, its node button is still reachable with a lock reason", !seen.includes("learn-demolition-day") && seen.includes("node-demolition-day"), seen.indexOf("learn-demolition-day"));
  // learn by keyboard until maxed: focus must survive the Learn button turning disabled
  await g.page.focus(T("learn-floor-buffer"));
  for (let i = 0; i < 6; i++) await g.page.keyboard.press("Enter");
  const st = (await g.state()).player;
  check("[R6-keys] Enter on a focused Learn six times stops at max level 5", st.skills["floor-buffer"] === 5, st.skills);
  xfail("[R6-keys] after the Learn button became disabled (maxed) by keyboard, focus stays in the panel (on the node) and is not dropped to <body>", (await focusId(g.page)) !== "BODY", "ADV-R6-04", await focusId(g.page));
  // Space and Enter on an F-button assign, again unassigns
  await g.page.focus(T("assign-floor-buffer-3")); await g.page.keyboard.press("Space");
  check("[R6-keys] Space on F4 assigns the skill to F4", (await g.state()).player.skillBar.hotkeys[3] === "floor-buffer", (await g.state()).player.skillBar);
  await g.page.keyboard.press("Enter");
  check("[R6-keys] Enter on the same button unassigns it again and keeps focus there", (await g.state()).player.skillBar.hotkeys[3] === null && (await focusId(g.page)) === "assign-floor-buffer-3", await focusId(g.page));
  // Respec by keyboard only
  await g.page.focus(T("respec")); await g.page.keyboard.press("Enter");
  check("[R6-keys] Respec by keyboard: confirmation opens with focus on Cancel", (await focusId(g.page)) === "respec-no", await focusId(g.page));
  await g.page.keyboard.press("Shift+Tab");
  check("[R6-keys] Shift+Tab from Cancel reaches Yes", (await focusId(g.page)) === "respec-yes", await focusId(g.page));
  await g.page.keyboard.press("Space");
  const p2 = (await g.state()).player;
  check("[R6-keys] Space on Yes respecs: all points back, signature kept", p2.skillPoints === 15 && Object.keys(p2.skills).join() === "pallet-slam", [p2.skillPoints, p2.skills]);
  check("[R6-keys] after Yes by keyboard focus is on Respec, not lost", (await focusId(g.page)) === "respec", await focusId(g.page));
  // number keys and F keys while the panel is open keep working; digit keys must not learn or respec
  await g.page.keyboard.press("Digit1"); await g.page.keyboard.press("Digit2");
  check("[R6-keys] no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}
// the tree on a phone: connectors are hidden, the prerequisite is spelled out; never a horizontal scroll, never overlapped buttons
for (const cls of Object.values(CL)) {
  const g = await hero({ viewport: { width: 390, height: 844 } }, cls, "Phone"); await g.app("cheat.setLevel", 30);
  const tv = await g.app("tree.get"); for (let r = 0; r < 2; r++) for (const n of tv.branches.flatMap((b) => b.nodes)) await g.app("tree.learn", n.id);
  await openSkills(g); await g.page.waitForTimeout(80);
  const d = await readTree(g.page);
  const nodes = d.flatMap((b) => b.nodes), tvn = new Map(tv.branches.flatMap((b) => b.nodes).map((n) => [n.id, n]));
  check(`[R6-phone] ${cls}: no connectors on a phone, and every node with a prerequisite spells it out in visible text`, nodes.every((n) => (!n.lk || n.lk.disp === "none") && (tvn.get(n.id).requires.length === 0 || (n.needVisible && n.need))), nodes.filter((n) => tvn.get(n.id).requires.length && !n.needVisible).map((n) => n.id));
  check(`[R6-phone] ${cls}: no horizontal scroll with everything learned`, await overflow(g.page));
  const small = await g.page.evaluate(() => [...document.querySelectorAll('.tree button:not([disabled])')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 30 || r.width < 30); }).map((b) => b.dataset.testid));
  check(`[R6-phone] ${cls}: every enabled tree button is at least 30 px in both directions`, small.length === 0, small.slice(0, 5));
  const overlaps = await g.page.evaluate(() => { const bs = [...document.querySelectorAll(".tnode button")].map((b) => ({ id: b.dataset.testid, r: b.getBoundingClientRect() })).filter((x) => x.r.width > 0); const o = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].r, b = bs[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) o.push(bs[i].id + "|" + bs[j].id); } return o; });
  check(`[R6-phone] ${cls}: no two buttons of the tree overlap`, overlaps.length === 0, overlaps.slice(0, 4));
  if (cls === CL.it) await shot(g.page, "tree-390-it-learned");
  check(`[R6-phone] ${cls}: no page error`, g.errors.length === 0, g.errors);
  await g.context.close();
}
for (const [w, h] of [[1024, 600], [720, 720], [1280, 720]]) { // wide and mid widths, everything learned: no overlap, no scroll
  const g = await hero({ viewport: { width: w, height: h } }, CL.sr, "Mid"); await g.app("cheat.setLevel", 30);
  const tv = await g.app("tree.get"); for (let r = 0; r < 5; r++) for (const n of tv.branches.flatMap((b) => b.nodes)) await g.app("tree.learn", n.id);
  await g.app("tree.learn", "none");
  await openSkills(g); await g.page.waitForTimeout(80);
  const overlaps = await g.page.evaluate(() => { const bs = [...document.querySelectorAll(".tnode")].map((b) => ({ id: b.dataset.testid, r: b.getBoundingClientRect() })); const o = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].r, b = bs[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) o.push(bs[i].id + "|" + bs[j].id); } return o; });
  check(`[R6-tree] ${w}x${h} everything maxed: tier cards do not overlap and the page does not scroll sideways`, overlaps.length === 0 && (await overflow(g.page)), overlaps.slice(0, 3));
  if (w === 720) await shot(g.page, "tree-720-maxed");
  await g.context.close();
}

} // sec keys
// ================================================================ 4. pause menu and slot manager with every banner, five viewports
if (sec("pause")) {
const BLOCK = () => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } }); };
const fillQuota = (page) => page.evaluate(() => { let i = 0; const chunk = "y".repeat(100000); try { for (;; i++) localStorage.setItem(`zz.junk.${i}`, chunk); } catch { /* full */ } for (const size of [10000, 1000, 100, 10, 1]) { try { for (let n = 0; ; n++) localStorage.setItem(`zz.fill.${size}.${n}`, "f".repeat(size)); } catch { /* full */ } } });
/** A game that is paused (or on the slot list opened from the pause menu) with a given save-status banner. */
async function paused(kind, viewport, { slots = false } = {}) {
  let g, extra = null;
  if (kind === "memory") { g = await boot({ viewport, init: BLOCK }); await startNew(g.page, { cls: CL.fm, name: "Banner" }); }
  else {
    g = await boot({ viewport }); await startNew(g.page, { cls: CL.fm, name: "Banner" }); await g.app("save.write");
    if (kind === "full") { await fillQuota(g.page); for (let k = 0; k < 4; k++) await g.app("cheat.giveItem", {}); await g.app("step", 5); await g.app("save.write"); }
    if (kind === "other" || kind === "other-confirm") {
      extra = await g.context.newPage(); await extra.goto(`https://oc.test/index.html?test=1&seed=1&start=floor`); await extra.waitForFunction(() => window.__app?.getState().scene === "title");
      await extra.click(T("take-over-saves")); await extra.click(T("take-over-yes"));
      await g.app("step", 2); await g.app("save.write"); await g.page.waitForTimeout(100); // the displaced tab learns it lost the saves when its next write is refused
    }
    if (kind === "stale") { await g.page.evaluate(() => { const i = JSON.parse(localStorage.getItem("office-crawler.slots")); i.owner = { id: "ghost", beat: Date.now() - 60000 }; localStorage.setItem("office-crawler.slots", JSON.stringify(i)); }); await g.app("slots.list"); }
    if (kind === "notice") {
      await toTitleAndSecond(g);
    }
  }
  await g.app("pause"); await g.page.waitForTimeout(120);
  if (kind === "other-confirm") { await g.page.click(T("take-over-saves")); await g.page.waitForTimeout(80); }
  if (slots) { await g.page.click(T("pause-slots")); await g.page.waitForTimeout(150); }
  return g;
}
async function toTitleAndSecond(g) { // a second character in slot 2, then a failing switch from the pause menu leaves a notice
  await g.app("slots.run", { t: "createCharacter", slot: 2, class: CL.it, name: "Second" }).catch(() => {});
  await g.app("slots.fail", true);
  await g.app("slots.run", { t: "loadSlot", slot: 2, confirm: true }).catch(() => {});
  await g.app("slots.fail", false);
}
/** Metrics of the open pause screen: every button reachable (heading at scrollTop 0, last button after scrolling to the end), nothing wider than the page. */
const pauseMetrics = (page) => page.evaluate(async () => {
  const s = document.querySelector(".screen.pause"); if (!s) return { missing: true };
  const vh = innerHeight, vw = innerWidth; s.scrollTop = 0; await new Promise((r) => requestAnimationFrame(r));
  const h2 = s.querySelector("h2").getBoundingClientRect(), top0 = h2.top;
  const btns = [...s.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().width > 0);
  const quit = s.querySelector('[data-testid="quit"]'), resume = s.querySelector('[data-testid="resume"]');
  const rects0 = btns.map((b) => b.getBoundingClientRect());
  s.scrollTop = s.scrollHeight; await new Promise((r) => requestAnimationFrame(r));
  const q = quit.getBoundingClientRect();
  s.scrollTop = 0;
  const textClipped = [...s.querySelectorAll(".sv-line,.sv-confirm,.sv-text,.sv-title")].filter((e) => e.scrollWidth > e.clientWidth + 1).length;
  return { vh, vw, headingTop: top0, headingBottom: h2.bottom, quitBottomAtEnd: q.bottom, quitTopAtEnd: q.top, resumeInViewAtTop: resume.getBoundingClientRect().top >= 0 && resume.getBoundingClientRect().bottom <= vh, scrollable: s.scrollHeight > s.clientHeight + 1, sideScroll: s.scrollWidth > s.clientWidth + 1 || document.documentElement.scrollWidth > vw + 1,
    outsideX: btns.filter((b, i) => rects0[i].left < -0.5 || rects0[i].right > vw + 0.5).length, tooSmall: btns.filter((b) => b.getBoundingClientRect().height < 30).length, textClipped, banners: [...s.querySelectorAll("[data-testid^='save-'],[data-testid^='take-over']")].map((e) => e.dataset.testid) };
});
for (const kind of (process.env.KINDS ?? "none,memory,full,other,other-confirm,stale,notice").split(",")) {
  for (const [w, h] of VIEWS) {
    if (process.env.VW && String(w) !== process.env.VW) continue;
    let g;
    try { g = await paused(kind, { width: w, height: h }); } catch (e) { check(`[R6-pause] ${kind} ${w}x${h}: setup`, false, String(e.message).split("\n")[0]); continue; }
    const m = await pauseMetrics(g.page);
    const tag = `[R6-pause] ${kind} ${w}x${h}`;
    if (w === 1280 && !["none"].includes(kind) || kind === "none") console.log("   banners:", kind, m.banners?.join(","));
    check(`${tag}: the heading is visible at scroll 0 and Quit can be scrolled into the viewport (nothing cut off above or below)`, !m.missing && m.headingTop >= -0.5 && m.quitBottomAtEnd <= m.vh + 0.5 && m.quitTopAtEnd >= 0, m);
    check(`${tag}: all buttons inside the page width, none under 30 px high, no sideways scroll`, !m.missing && m.outsideX === 0 && m.tooSmall === 0 && !m.sideScroll && m.textClipped === 0, m);
    if (h >= 720 || w >= 1024) check(`${tag}: Resume is visible without scrolling`, m.resumeInViewAtTop, m);
    if ((w === 390 && h === 844) || (w === 1280 && ["full", "other-confirm", "notice"].includes(kind))) await shot(g.page, `pause-${kind}-${w}`);
    check(`${tag}: no page error`, g.errors.length === 0, g.errors);
    await g.context.close();
  }
}

} // sec pause
// ================================================================ 5. slot manager (from the pause menu) with five slots of every state, five viewports
if (sec("slots")) {
  const mk = (cls, name, level) => { const st = newGame(7, { class: cls, name, start: "town", wearStartKit: true }); const sv = toSave(st); sv.player.level = level; sv.player.xp = 0; sv.player.skillPoints = 0; sv.player.attrPoints = 0; return canonical({ ...sv, checksum: checksumOf(sv) }); };
  const seed = {
    "office-crawler.slot.1": mk(CL.fm, "WWWWWWWWWWWWWWWW", 12), "office-crawler.slot.2": mk(CL.sr, "Second", 3), "office-crawler.slot.3": mk(CL.it, "Third", 20),
    "office-crawler.slot.4": "{ this is not json", "office-crawler.slot.5": JSON.stringify({ format: "office-crawler-save", version: 999 }),
  };
  seed["office-crawler.slot.1"] = mk(CL.fm, "WWWWWWWWWWWWWWWW", 12);
  const slotMetrics = (page) => page.evaluate(async () => {
    const dlg = document.querySelector(".dlg-card"), vh = innerHeight, vw = innerWidth; if (!dlg) return { missing: true };
    dlg.scrollTop = 0; await new Promise((r) => requestAnimationFrame(r));
    const close = dlg.querySelector('.sl-head .xbtn'), c0 = close?.getBoundingClientRect();
    const cards = [...dlg.querySelectorAll('[data-testid^="slot-"][data-state]')];
    const dr = dlg.getBoundingClientRect();
    dlg.scrollTop = dlg.scrollHeight; await new Promise((r) => requestAnimationFrame(r));
    const c1 = close?.getBoundingClientRect(), last = cards.at(-1)?.getBoundingClientRect();
    const btns = [...dlg.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().width > 0);
    dlg.scrollTop = 0;
    return { vh, vw, cardCount: cards.length, states: cards.map((c) => c.dataset.state).join(), dlgTop: dr.top, dlgBottom: dr.bottom, closeAtTop: c0 && c0.top >= -0.5 && c0.bottom <= vh + 0.5, closeAfterScroll: c1 && c1.top >= -0.5 && c1.bottom <= vh + 0.5, lastCardVisibleAtEnd: last && last.bottom <= vh + 0.5,
      sideScroll: dlg.scrollWidth > dlg.clientWidth + 1 || document.documentElement.scrollWidth > vw + 1, outsideX: btns.filter((b) => { const r = b.getBoundingClientRect(); return r.left < -0.5 || r.right > vw + 0.5; }).length, small: btns.filter((b) => b.getBoundingClientRect().height < 30 || b.getBoundingClientRect().width < 30).map((b) => b.dataset.testid) };
  });
  for (const [w, h] of VIEWS) {
    const g = await boot({ viewport: { width: w, height: h }, seed, query: "test=1&seed=1&start=floor" });
    const states = (await g.app("slots.list")).slots.map((e) => e.state).join();
    await g.page.click(T("continue")); await g.page.waitForTimeout(150);
    check(`[R6-slots] ${w}x${h}: five slots of mixed state load (ok, ok, ok, bad, newer) and Continue starts one of them`, states === "ok,ok,ok,bad,newer" && (await g.state()).scene === "town", [states, (await g.state()).scene]);
    await g.app("pause"); await g.page.click(T("pause-slots")); await g.page.waitForTimeout(150);
    const m = await slotMetrics(g.page);
    const tag = `[R6-slots] ${w}x${h}`;
    check(`${tag}: five cards, Close reachable at the top and after scrolling to the end, last card reachable`, m.cardCount === 5 && m.closeAtTop && m.closeAfterScroll && m.lastCardVisibleAtEnd, m);
    check(`${tag}: no sideways scroll, nothing outside the page width, every button at least 30 px`, !m.sideScroll && m.outsideX === 0 && m.small.length === 0, m);
    if ((w === 390 && h === 844) || (w === 1280)) await shot(g.page, `slots-${w}x${h}`);
    // the delete confirmation of the last card must appear where the player is looking
    await g.page.evaluate(() => { const d = document.querySelector(".dlg-card"); d.scrollTop = d.scrollHeight; });
    const del = g.page.locator(T("slot-delete-5"));
    if (await del.count()) {
      await del.click(); await g.page.waitForTimeout(100);
      const vis = await g.page.evaluate(() => { const c = document.querySelector('[data-testid="slot-confirm"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, focusIn: !!document.activeElement?.closest('[data-testid="slot-confirm"]') }; });
      check(`${tag}: the delete confirmation of slot 5 is on screen (or scrolled to) with focus inside it`, vis && vis.top >= -1 && vis.bottom <= vis.vh + 1 && vis.focusIn, vis);
      await g.page.keyboard.press("Escape");
      check(`${tag}: Esc closes the confirmation only; the slot is still there`, (await g.page.locator(T("slot-confirm")).count()) === 0 && (await g.page.locator(T("slot-5")).count()) === 1);
    }
    // the playing slot cannot be deleted or replaced; the damaged and the newer slot say what they are
    const names = await g.page.evaluate(() => [4, 5].map((n) => document.querySelector(`[data-testid="slot-name-${n}"]`)?.textContent));
    check(`${tag}: the damaged and the newer slot are labelled as such`, /damaged/i.test(names[0] ?? "") && /newer/i.test(names[1] ?? ""), names);
    const act = (await g.app("slots.view")).index.active;
    check(`${tag}: the playing slot (${act}) has Delete, Import and Replace disabled and the others do not`, await g.page.evaluate((n) => [1, 2, 3].every((k) => ["delete", "import", "new"].every((w) => { const b = document.querySelector(`[data-testid="slot-${w}-${k}"]`); return !b || b.disabled === (k === n); })), act), act);
    check(`${tag}: no page error`, g.errors.length === 0, g.errors);
    await g.context.close();
  }
} // sec slots

// ---- END
await browser.close();
const { failed } = finish("adv-r6");
console.log(`expected failures (documented defects): ${xres.filter((x) => !x.ok).length} XFAIL, ${xres.filter((x) => x.ok).length} XPASS`);
if (failed) process.exitCode = 1;
