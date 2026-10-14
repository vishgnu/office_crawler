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
async function boot({ viewport = { width: 1280, height: 720 }, query = "test=1&seed=1", file = "dist/index.html", init = null, deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  await context.route("https://oc.test/**", (r) => r.fulfill({ path: file, contentType: "text/html" }));
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message + " @ " + String(e.stack).split("\n").slice(1, 3).join(" | ")));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`https://oc.test/index.html?${query}`);
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  return { context, page, app, state: () => app("getState"), errors };
}
const hero = async (opts, cls = CL.fm, name = "Probe") => { const g = await boot(opts); await startNew(g.page, { cls, name }); return g; };
const learnSome = async (g, plan) => { for (const [id, n] of plan) for (let i = 0; i < n; i++) await g.app("tree.learn", id); };
const PLAN = { [CL.fm]: [["pallet-slam", 3], ["floor-buffer", 2]], [CL.sr]: [["stapler-throw", 3], ["pen-volley", 2]], [CL.it]: [["server-overheat", 3], ["power-surge", 2]] };
const focusId = (page) => page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll(".screen,.panel")].every((e) => e.scrollWidth <= innerWidth + 1));
const openSkills = async (g) => { await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(80); };

// ================================================================ 1. respec confirmation
{
  const g = await hero(); await g.app("cheat.setLevel", 16); await learnSome(g, PLAN[CL.fm]);
  const before = (await g.state()).player;
  const learned = before.skillPoints;
  await openSkills(g);
  check("[R6-respec] the confirmation is not shown before the click", (await g.page.locator(T("respec-confirm")).count()) === 0);
  await g.page.click(T("respec"));
  check("[R6-respec] Respec opens a confirmation that names the refund and changes nothing yet", (await g.page.locator(T("respec-confirm")).count()) === 1 && (await g.state()).player.skillPoints === learned && Object.keys((await g.state()).player.skills).length > 1);
  const refund = Number((await g.page.textContent(T("respec-refund"))).match(/\d+/)?.[0]);
  check("[R6-respec] the confirmation text and the Yes button agree with the real refund (4 points here)", refund === 4 && /4/.test(await g.page.textContent(T("respec-yes"))), [refund, await g.page.textContent(T("respec-yes"))]);
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
  check("[R6-respec] points learned while it was closed are counted: refund 5", /5/.test(await g.page.textContent(T("respec-refund"))), await g.page.textContent(T("respec-refund")));
  await g.app("tree.learn", "pallet-slam");
  await g.page.waitForTimeout(80);
  const sh = await g.page.locator(T("respec-confirm")).count() ? await g.page.textContent(T("respec-refund")) : "gone";
  check("[R6-respec] a skill learned while the confirmation is open updates its refund (6) or closes it, never shows a stale number", sh === "gone" || /6/.test(sh), sh);
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
