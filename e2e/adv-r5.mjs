// Adversarial e2e for rounds 4, 5 and G (save slots, skill trees, character select, pause/quit/resume, class smoke). Test-engineer, adversarial mode.
// Every `xfail(name, ok, "ADV-R5-NN")` is a demonstrated defect from docs/reviews/R5-adversarial.md: it is printed as XFAIL (or XPASS once fixed)
// and never fails the script. Screenshots: docs/shots/adv-r5-*.jpg (JPEG, below 300 KB).
import { mkdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { launch, open, check, finish, startNew, DIST } from "./helpers.mjs";
import { toSave, checksumOf } from "../src/save/index.js";
import { newGame } from "../src/core/state.js";
import { canonical } from "../src/core/hash.js";

const browser = await launch();
const T = (id) => `[data-testid="${id}"]`;
const SHOTS = "docs/shots";
mkdirSync(SHOTS, { recursive: true });
const CL = { fm: "facilities-manager", sr: "sales-rep", it: "it-wizard" };
const V1 = readFileSync("test/fixtures/save-v1.json", "utf8");
const xres = [];
const fixed = (name, ok, id, detail) => check(`[${id}] ${name}`, ok, detail); // a round-1 defect that is now fixed: a plain check
function xfail(name, ok, id, detail) {
  xres.push({ name, ok: !!ok, id });
  console.log(`${ok ? "XPASS (defect fixed? remove the xfail)" : "XFAIL"} ${id} ${name}${!ok && detail !== undefined ? "  -> " + JSON.stringify(detail).slice(0, 300) : ""}`);
}
const shot = async (page, name) => {
  const path = `${SHOTS}/adv-r5-${name}.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 60 });
  const kb = statSync(path).size / 1024;
  check(`screenshot adv-r5-${name}.jpg is at most 300 KB`, kb <= 300, kb);
};
const lobby = (viewport = { width: 1280, height: 720 }, query = "test=1&seed=1") => open(browser, { query, viewport, lobby: true });
const toTitle = async (g) => { await g.app("pause"); await g.page.click(T("quit")); };
const focusId = (page) => page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
const lsJson = (page, key) => page.evaluate((k) => { const t = localStorage.getItem(k); try { return t === null ? null : JSON.parse(t); } catch { return "unparseable"; } }, key);
const lsRaw = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const states = async (g) => (await g.app("slots.list")).slots.map((e) => e.state).join(",");
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll(".screen,.panel")].every((e) => e.scrollWidth <= innerWidth + 1));
const goTitle = (page) => page.waitForFunction(() => window.__app?.getState().scene === "title");

/** A browser context whose localStorage is seeded once (before the game script runs) with `data`. */
async function seeded(data, { query = "test=1&seed=1&start=floor", viewport = { width: 1280, height: 720 } } = {}) {
  const context = await browser.newContext({ viewport });
  // Serve the build from a real https origin: on file:// Chromium (Playwright, ephemeral profile) sometimes starts the reloaded document with an EMPTY
  // localStorage, before any game code runs (measured 4 of 23 runs under load; 0 of 24 on http and on this route). Harness artefact, see R5-adversarial.md.
  await context.route("https://oc.test/**", (r) => r.fulfill({ path: "dist/index.html", contentType: "text/html" }));
  await context.addInitScript((d) => { if (localStorage.getItem("advseed")) return; localStorage.setItem("advseed", "1"); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, data);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message + " @ " + String(e.stack).split("\n").slice(1, 3).join(" | ")));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`https://oc.test/index.html?${query}`);
  await goTitle(page);
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  return { context, page, errors, app, state: () => app("getState") };
}

/** Seed data that includes a correct index: put the raw slot texts into a running page, drop the index, let the game rebuild it, dump everything. */
async function buildSeed(slotTexts) {
  const g = await lobby();
  await g.page.evaluate((t) => { for (const [k, v] of Object.entries(t)) localStorage.setItem(k, v); localStorage.removeItem("office-crawler.slots"); }, slotTexts);
  await g.app("slots.list"); // rebuilds and stores the index
  const dump = await g.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("office-crawler.")).map((k) => [k, localStorage.getItem(k)])));
  await g.context.close();
  return dump;
}

// ---------------------------------------------------------------- factory: real character texts to seed other contexts with
const texts = {};
{
  const g = await lobby();
  await startNew(g.page, { name: "Factory One", cls: CL.sr });
  await g.app("cheat.giveGold", 321); await g.app("save.write");
  texts.one = await lsRaw(g.page, "office-crawler.slot.1");
  await toTitle(g);
  await startNew(g.page, { name: "Factory Two", cls: CL.it });
  await g.app("save.write");
  texts.two = await lsRaw(g.page, "office-crawler.slot.2");
  check("factory: two characters stored in slots 1 and 2", texts.one && texts.two && (await states(g)) === "ok,ok,empty,empty,empty");
  await g.context.close();
}

// ---------------------------------------------------------------- AC-R-227 plus hostile storage at boot
{
  const big = "x".repeat(450000);
  const newer = JSON.stringify({ ...JSON.parse(texts.one), version: 99 });
  const g = await seeded(await buildSeed({ "office-crawler.slot.1": texts.one, "office-crawler.slot.2": texts.two, "office-crawler.slot.3": texts.one.replace('"gold":', '"gold":9'), "office-crawler.slot.4": newer, "office-crawler.slot.5": big }));
  const s = await g.state();
  check("boot with a corrupt, a newer and an oversized slot: the title shows, no page error", s.scene === "title" && g.errors.length === 0, g.errors);
  check("the five slots read ok, ok, bad, newer, bad", (await states(g)) === "ok,ok,bad,newer,bad", await states(g));
  check("slot 4 (newer build) and slot 5 are left untouched by the boot", (await lsRaw(g.page, "office-crawler.slot.4")) === newer && (await lsRaw(g.page, "office-crawler.slot.5")) === big);
  await g.page.click(T("load-game"));
  check("the Load dialog marks bad and newer slots in text and offers no Load button for them", (await g.page.locator(T("slot-3")).getAttribute("data-state")) === "bad" && (await g.page.locator(T("slot-4")).getAttribute("data-state")) === "newer" && (await g.page.locator(T("slot-load-3")).count()) === 0 && (await g.page.locator(T("slot-load-4")).count()) === 0);
  await shot(g.page, "slots-damaged");
  check("the Load dialog fits the viewport width", await overflow(g.page));
  await g.page.click(T("slots-close"));
  await g.page.click(T("continue"));
  check("Continue loads the most recent good character", (await g.state()).scene === "town" && ["Factory One", "Factory Two"].includes((await g.state()).player.name));
  await g.app("step", 120); await g.app("save.write");
  check("after play and autosave the damaged, newer and oversized slots are byte-identical", (await lsRaw(g.page, "office-crawler.slot.4")) === newer && (await lsRaw(g.page, "office-crawler.slot.5")) === big);
  check("the damaged text of slot 3 is kept for export", (await lsRaw(g.page, "office-crawler.slot.3.bad")) !== null || (await lsRaw(g.page, "office-crawler.slot.3")) !== null);
  check("no page error during the whole scenario", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- a tampered index: wrong shape is rebuilt, odd-but-valid shape does not throw
{
  const g = await seeded({ "office-crawler.slot.1": texts.one, "office-crawler.slots": JSON.stringify({ v: 2, active: 3, last: 9, owner: null, slots: [] }) });
  check("an index with the wrong shape is rebuilt from the slot texts", (await states(g)) === "ok,empty,empty,empty,empty" && g.errors.length === 0, g.errors);
  await g.context.close();
  const odd = { v: 2, active: 3, last: 3, owner: null, slots: [1, 2, 3, 4, 5].map((n) => ({ n, state: "ok" })) }; // valid shape, entries without name/class/level
  const h = await seeded({ "office-crawler.slot.1": texts.one, "office-crawler.slots": JSON.stringify(odd) });
  await h.page.click(T("load-game")).catch(() => {});
  await h.page.waitForTimeout(100);
  check("an index whose entries are 'ok' without fields renders without a page error", h.errors.length === 0, h.errors);
  await h.page.keyboard.press("Escape");
  await h.page.click(T("continue")).catch(() => {});
  await h.page.waitForTimeout(150);
  check("and Continue on it does not throw", h.errors.length === 0, h.errors);
  await h.context.close();
}

// ---------------------------------------------------------------- ADV-R5-01: index lost while the slot texts exist (and the legacy backup is still there)
{
  const g = await seeded({ "office-crawler.slot.1": texts.one, "office-crawler.slot.2": texts.two });
  fixed("slot texts without an index key are found at boot (slots 1 and 2 show as characters)", (await states(g)) === "ok,ok,empty,empty,empty", "ADV-R5-01", await states(g));
  await g.context.close();
  const h = await seeded({ "office-crawler.slot.1": texts.one, "office-crawler.slot.2": texts.two, "office-crawler.save": V1 });
  fixed("with a legacy backup present the played character in slot 1 is not replaced by the migrated legacy save", (await lsJson(h.page, "office-crawler.slot.1"))?.name === "Factory One", "ADV-R5-01", (await lsJson(h.page, "office-crawler.slot.1"))?.name);
  await h.context.close();
}

// ---------------------------------------------------------------- AC-R-225-5 legacy Clerk save, plus damaged legacy
{
  const g = await seeded({ "office-crawler.save": V1 });
  const idx = await g.app("slots.list");
  check("legacy single-slot save becomes slot 1 (facilities-manager, name Employee), legacy key stays", idx.slots[0].state === "ok" && idx.slots[0].class === CL.fm && idx.slots[0].name === "Employee" && (await lsRaw(g.page, "office-crawler.save")) === V1);
  check("the title tells the player about the refund", /point/i.test(await g.page.locator(T("title-notice")).innerText().catch(() => "")), await g.page.locator(T("title-notice")).innerText().catch(() => null));
  await g.page.click(T("continue"));
  const p = (await g.state()).player;
  check("Continue opens the migrated character with the refunded points and only the free signature", p.class === CL.fm && p.skillPoints === JSON.parse(V1).player.skillPoints + 4 && Object.keys(p.skills).join() === "pallet-slam", p);
  await toTitle(g);
  const text = await lsRaw(g.page, "office-crawler.slot.1");
  await g.page.reload(); await goTitle(g.page); await g.page.waitForTimeout(400);
  check("a second boot does not migrate again (slot text unchanged, no notice)", (await lsRaw(g.page, "office-crawler.slot.1")) === text && (await g.page.locator(T("title-notice")).count()) === 0);
  await g.context.close();
  for (const [what, legacy] of [["truncated", V1.slice(0, 300)], ["garbage", "\u0000\u0001garbage"], ["newer", JSON.stringify({ ...JSON.parse(V1), version: 9 })]]) {
    const h = await seeded({ "office-crawler.save": legacy });
    const st = (await h.app("slots.list")).slots[0].state;
    check(`${what} legacy save: title loads, slot 1 is ${what === "newer" ? "newer" : "bad"}, no page error`, (await h.state()).scene === "title" && st === (what === "newer" ? "newer" : "bad") && h.errors.length === 0, [st, h.errors]);
    check(`${what} legacy save: the legacy text stays where it was`, (await lsRaw(h.page, "office-crawler.save")) === legacy);
    await h.context.close();
  }
}

// ---------------------------------------------------------------- ADV-R5-02 (fixed): owner = { id, beat }; stale (15 s) is taken over, a live owner blocks and offers Take over
{
  const g = await lobby();
  await startNew(g.page, { name: "Ghost" }); await g.app("save.write");
  await g.page.evaluate(() => { const i = JSON.parse(localStorage.getItem("office-crawler.slots")); i.owner = { id: "tab-that-crashed", beat: Date.now() - 60000 }; localStorage.setItem("office-crawler.slots", JSON.stringify(i)); sessionStorage.clear(); });
  await g.page.reload(); await goTitle(g.page);
  await g.page.click(T("continue"));
  await g.page.waitForTimeout(150);
  fixed("Continue works when the owner's heartbeat is stale (a crashed or discarded tab)", (await g.state()).scene === "town", "ADV-R5-02");
  const o1 = (await lsJson(g.page, "office-crawler.slots")).owner;
  check("after the takeover the index owner is this tab with a fresh beat", o1 && typeof o1 === "object" && o1.id !== "tab-that-crashed" && Date.now() - o1.beat < 10000, o1);
  await toTitle(g);
  fixed("a new character can be created while the old owner is stale", await (async () => { await g.page.click(T("new-game")); await g.page.fill(T("create-name"), "Fresh"); await g.page.click(T("create-start")); return (await g.state()).scene === "town"; })(), "ADV-R5-02");
  await g.context.close();
}
{ // a LIVE owner (another real tab that keeps playing) blocks with a clear message and offers Take over
  const g = await lobby();
  await startNew(g.page, { name: "Live", cls: CL.sr }); await g.app("save.write");
  const b = await g.context.newPage(); const errB = [];
  b.on("pageerror", (e) => errB.push(e.message));
  await b.goto(`${DIST}?test=1&seed=1&start=floor`); await goTitle(b);
  const bapp = (fn, ...a) => b.evaluate(([f, x]) => f.split(".").reduce((o, k) => o[k], window.__app)(...x), [fn, a]);
  const owner = (await lsJson(b, "office-crawler.slots")).owner;
  check("a playing tab publishes { id, beat } as owner", owner && typeof owner.id === "string" && Number.isFinite(owner.beat), owner);
  check("tab B sees the live owner as 'other' in the status and shows the banner with Take over", (await bapp("slots.view")).status.owner === "other" && (await b.locator(T("take-over-saves")).count()) === 1);
  await b.click(T("continue")); await b.waitForTimeout(150);
  check("tab B's Continue is refused while the owner is live, with a visible reason", (await bapp("getState")).scene === "title" && /another tab/i.test(await b.evaluate(() => document.body.innerText)));
  await g.app("step", 30);
  await g.page.waitForTimeout(5600); // one heartbeat period: A keeps the lock fresh by itself, without any save
  const beat2 = (await lsJson(b, "office-crawler.slots")).owner.beat;
  check("the playing tab refreshes its beat from a timer (about every 5 s)", beat2 > owner.beat, [owner.beat, beat2]);
  await b.click(T("take-over-saves"));
  check("Take over asks for confirmation, takes focus and traps Tab", (await b.locator(T("take-over-confirm")).count()) === 1 && (await b.evaluate(() => !!document.activeElement?.closest('[data-testid="take-over-confirm"]'))));
  const tabs = [];
  for (let i = 0; i < 5; i++) { await b.keyboard.press("Tab"); tabs.push(await b.evaluate(() => !!document.activeElement?.closest('[data-testid="take-over-confirm"]'))); }
  check("Tab stays inside the take-over dialog (5 presses)", tabs.every(Boolean), tabs);
  await b.keyboard.press("Escape");
  check("Esc closes the take-over dialog and gives focus back to its button", (await b.locator(T("take-over-confirm")).count()) === 0 && (await b.evaluate(() => document.activeElement?.dataset?.testid)) === "take-over-saves");
  await b.click(T("take-over-saves")); await b.click(T("take-over-yes"));
  check("after Take over tab B owns the saves and can Continue", (await bapp("slots.view")).status.owner === "self");
  await b.click(T("continue")); await b.waitForTimeout(150);
  check("tab B is playing the character", (await bapp("getState")).scene === "town");
  // tab A, which was taken over, is now refused and must not write over B
  const textB = await lsRaw(b, "office-crawler.slot.1");
  await g.app("cheat.giveGold", 777);
  const wr = await g.app("save.write");
  check("the displaced tab's save is refused (another-tab) and does not overwrite the new owner's slot", wr.ok === false && (await lsRaw(b, "office-crawler.slot.1")) === textB, wr);
  check("the displaced tab shows who owns the saves", (await g.app("slots.view")).status.owner === "other");
  check("no page errors in either tab", g.errors.length === 0 && errB.length === 0, [g.errors, errB]);
  await g.context.close();
}

// ---------------------------------------------------------------- ADV-R5-06 blocked storage: the game must say that nothing is saved
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } }); });
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${DIST}?test=1&seed=1`); await goTitle(page);
  await page.click(T("new-game")); await page.fill(T("create-name"), "Volatile"); await page.click(T("create-start"));
  await page.waitForTimeout(150);
  const s = await page.evaluate(() => window.__app.getState());
  check("with localStorage blocked the game still starts and runs, no page error", s.scene === "town" && errors.length === 0, errors);
  const said = await page.evaluate(() => /not (be )?saved|cannot save|can't save|private|storage|won't be saved/i.test(document.body.innerText) || !!window.__app.getState().ui?.notice);
  fixed("with localStorage blocked the player is told that progress will not be kept", said, "ADV-R5-06");
  await context.close();
}

// ---------------------------------------------------------------- AC-R-227-2 and quota: storage full while playing
{
  const g = await lobby();
  await startNew(g.page, { name: "Full" }); await g.app("save.write");
  const before = await lsRaw(g.page, "office-crawler.slot.1");
  await g.page.evaluate(() => { // fill the origin up to its quota with foreign keys, then free a sliver
    let i = 0; const chunk = "y".repeat(100000);
    try { for (;; i++) localStorage.setItem(`zz.junk.${i}`, chunk); } catch { /* full */ }
    for (const size of [10000, 1000, 100, 10, 1]) { try { for (let n = 0; ; n++) localStorage.setItem(`zz.fill.${size}.${n}`, "f".repeat(size)); } catch { /* full at this granularity */ } }
  });
  for (let k = 0; k < 4; k++) await g.app("cheat.giveItem", {}); // the save text grows by a few hundred characters and no longer fits
  await g.app("step", 5);
  const r = await g.app("save.write");
  const s = await g.state();
  check("storage truly full: the forced save fails cleanly, the game keeps running", r.ok === false && s.scene === "town" && g.errors.length === 0, [r, g.errors]);
  check("the last good text of the slot is unchanged after the failed write", (await lsRaw(g.page, "office-crawler.slot.1")) === before);
  check("the player gets a notice about the full storage", /full|space|storage|save/i.test(JSON.stringify(s.ui.notice ?? s.ui.toast ?? "")) || /full|storage/i.test(await g.page.evaluate(() => document.body.innerText)), s.ui.notice);
  await g.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("zz.")) localStorage.removeItem(k); });
  check("after space is freed the next save succeeds", (await g.app("save.write")).ok === true);
  check("no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- two tabs, same context
{
  const g = await lobby();
  await startNew(g.page, { name: "TabA", cls: CL.sr }); await g.app("save.write");
  await toTitle(g);
  await startNew(g.page, { name: "TabA2", cls: CL.it }); await g.app("save.write");
  const b = await g.context.newPage(); const errB = [];
  b.on("pageerror", (e) => errB.push(e.message));
  await b.goto(`${DIST}?test=1&seed=1&start=floor`); await goTitle(b);
  const bapp = (fn, ...a) => b.evaluate(([f, x]) => f.split(".").reduce((o, k) => o[k], window.__app)(...x), [fn, a]);
  await b.click(T("continue")); await b.waitForTimeout(120);
  check("tab B cannot take the character tab A is playing: it stays on the title with the reason", (await bapp("getState")).scene === "title" && /another tab/i.test(await b.locator(T("title-notice")).innerText().catch(() => "")));
  const del = await bapp("slots.run", { t: "deleteSlot", slot: 1, confirm: true });
  check("tab B may not delete a slot while A owns the index", del.ok === false && del.error === "another-tab", del);
  const rn = await bapp("slots.run", { t: "renameSlot", slot: 2, name: "Hijacked" });
  await g.app("save.write");
  const name2 = (await lsJson(g.page, "office-crawler.slot.2")).name;
  fixed("tab B's rename of the slot tab A is playing is refused (another-tab), not silently lost on A's next save", rn.ok === false && name2 === "TabA2", "ADV-R5-09", { rn, stored: name2 });
  await g.page.keyboard.press("Escape"); await g.page.click(T("quit"));
  await b.reload(); await goTitle(b);
  await b.click(T("continue")); await b.waitForTimeout(120);
  check("after tab A quits to the title, tab B can continue", (await bapp("getState")).scene === "town");
  check("no page errors in either tab", g.errors.length === 0 && errB.length === 0, [g.errors, errB]);
  await g.context.close();
}

// ---------------------------------------------------------------- reload / pagehide / bfcache: the progress and the active slot come back
{
  const g = await lobby();
  await startNew(g.page, { name: "Pager", cls: CL.fm });
  await g.app("cheat.giveGold", 250);
  await g.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  const idx = await lsJson(g.page, "office-crawler.slots");
  check("pagehide flushes the game into its slot and releases the active slot and owner", idx.active === null && idx.owner === null && (await lsJson(g.page, "office-crawler.slot.1")).player.gold === 300, idx);
  await g.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))); // the bfcache restore path
  await g.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await g.app("cheat.giveGold", 5);
  check("after a restore the autosave works again (active slot re-acquired)", (await g.app("save.write")).ok === true);
  await g.page.reload(); await goTitle(g.page);
  await g.page.click(T("continue"));
  check("reload then Continue brings the character back with its gold", (await g.state()).player.gold === 305 && (await g.state()).player.name === "Pager", (await g.state()).player?.gold);
  await g.context.close();
}

// ---------------------------------------------------------------- character select: keyboard only, double start, Esc during the transition
{
  const g = await lobby();
  await g.page.focus(T("new-game")); await g.page.keyboard.press("Enter");
  check("keyboard: Enter on New game opens the class screen with focus on the chosen class", (await g.state()).ui.menu === "create" && (await focusId(g.page)) === `class-${CL.fm}`);
  await g.page.keyboard.press("ArrowRight"); await g.page.keyboard.press("ArrowRight"); await g.page.keyboard.press("ArrowRight");
  check("keyboard: arrows wrap around (3 steps = back to the first class)", (await g.page.locator(".cs-cls.on").getAttribute("data-class")) === CL.fm);
  await g.page.keyboard.press("ArrowLeft");
  check("keyboard: ArrowLeft from the first class wraps to the last", (await g.page.locator(".cs-cls.on").getAttribute("data-class")) === CL.it);
  await g.page.keyboard.press("Enter");
  check("keyboard: Enter on a class moves to the name field", (await focusId(g.page)) === "create-name");
  await g.page.keyboard.type("Key Board 1");
  check("typing a, d and digits into the name field does not change the class", (await g.page.locator(".cs-cls.on").getAttribute("data-class")) === CL.it);
  await g.page.keyboard.press("Tab"); await g.page.keyboard.press("Tab");
  check("keyboard: Tab, Tab reaches Start", (await focusId(g.page)) === "create-start");
  await g.page.keyboard.press("Enter");
  await g.page.waitForTimeout(100);
  const s = await g.state();
  check("keyboard only: a game starts in the first free slot with the chosen class and name", s.scene === "town" && s.player.class === CL.it && s.player.name === "Key Board 1", s.player);
  await toTitle(g);
  // Esc: first Esc leaves the name field, the second closes the screen without creating anything
  await g.page.click(T("new-game")); await g.page.focus(T("create-name")); await g.page.keyboard.type("abc");
  await g.page.keyboard.press("Escape");
  const first = (await g.state()).ui.menu;
  await g.page.keyboard.press("Escape");
  check("Esc steps back one level at a time and creates nothing", first === "create" && (await g.state()).ui.menu === "title" && (await states(g)) === "ok,empty,empty,empty,empty");
  await g.context.close();
}
{
  const g = await lobby();
  await g.page.click(T("new-game")); await g.page.fill(T("create-name"), "Double");
  await g.page.evaluate(() => document.documentElement.classList.remove("noanim")); // test mode skips the elevator: put it back for this check
  await g.page.click(T("create-start"));
  await g.page.click(T("create-start"), { force: true, timeout: 400 }).catch(() => {});
  await g.page.keyboard.press("Enter"); await g.page.keyboard.press("Enter");
  await g.page.waitForTimeout(1800);
  check("double Start (click, click, Enter, Enter) during the elevator creates exactly one character", (await states(g)) === "ok,empty,empty,empty,empty" && (await g.state()).scene === "town" && g.errors.length === 0, [await states(g), g.errors]);
  await g.context.close();
}
{
  const g = await lobby();
  await g.page.click(T("new-game")); await g.page.fill(T("create-name"), "Escapee");
  await g.page.evaluate(() => document.documentElement.classList.remove("noanim"));
  await g.page.click(T("create-start"));
  await g.page.keyboard.press("Escape");
  await g.page.waitForTimeout(1800);
  fixed("Esc pressed after Start (during the elevator) cancels: nothing is created and the game does not start behind the player's back", (await states(g)) === "empty,empty,empty,empty,empty" && (await g.state()).scene === "title", "ADV-R5-11", { slots: await states(g), scene: (await g.state()).scene });
  await g.context.close();
}

// ---------------------------------------------------------------- phone 390: class screen, skills, slots, no horizontal scroll
{
  const g = await lobby({ width: 390, height: 844 });
  await g.page.click(T("new-game")); await g.page.waitForTimeout(250);
  check("390 px: class screen has no horizontal scroll", await overflow(g.page));
  await shot(g.page, "create-390");
  for (const id of [CL.fm, CL.sr, CL.it]) { await g.page.click(T(`class-${id}`)); check(`390 px: Start stays reachable with ${id} chosen (inside the page width)`, await g.page.evaluate(() => { const r = document.querySelector('[data-testid="create-start"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; })); }
  await g.page.fill(T("create-name"), "W".repeat(16)); await g.page.click(T("create-start"));
  check("390 px: a 16 letter name of wide capitals is accepted", (await g.state()).scene === "town", (await g.state()).scene);
  await g.app("cheat.setLevel", 17);
  await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(150);
  check("390 px: the skill tree has no horizontal scroll at level 17", await overflow(g.page));
  await shot(g.page, "tree-390");
  await g.page.keyboard.press("Escape"); // closes the drawer
  await g.page.keyboard.press("Escape"); // pause
  await g.page.click(T("pause-slots")); await g.page.waitForTimeout(150);
  check("390 px: the slot list from the pause menu has no horizontal scroll", await overflow(g.page));
  await shot(g.page, "slots-390");
  check("390 px: no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- the slot manager: delete/undo/replace/import/rename flows
{
  const g = await lobby();
  await startNew(g.page, { name: "Alpha", cls: CL.sr });
  await g.app("save.write");
  await toTitle(g);
  await startNew(g.page, { name: "Bravo", cls: CL.it });
  await g.app("save.write");
  await toTitle(g);
  await g.page.click(T("load-game"));
  // delete + cancel + confirm + undo
  await g.page.click(T("slot-delete-1"));
  check("delete asks first and names the character", /Alpha/.test(await g.page.locator(T("slot-confirm-title")).innerText()));
  fixed("the delete confirmation takes focus (so Enter/Space/Tab work from the keyboard)", (await g.page.evaluate(() => document.activeElement?.closest('[role="alertdialog"]') !== null)), "ADV-R5-07", await focusId(g.page));
  const seq = [];
  for (let i = 0; i < 8; i++) { await g.page.keyboard.press("Tab"); seq.push(await g.page.evaluate(() => (document.activeElement === document.body ? "BODY" : document.activeElement?.dataset?.testid))); }
  fixed("Tab never leaves the dialog for the page body in 8 presses (focus trap, AC-NFR-A07-1)", !seq.includes("BODY"), "ADV-R5-07", seq);
  await g.page.click(T("slot-confirm-no"));
  check("Cancel leaves the character where it was", (await states(g)) === "ok,ok,empty,empty,empty");
  fixed("focus returns to the Delete button after Cancel", (await focusId(g.page)) === "slot-delete-1", "ADV-R5-07", await focusId(g.page));
  await g.page.click(T("slot-delete-1")); await g.page.click(T("slot-confirm-yes"));
  check("confirming delete empties the slot and shows an Undo", (await states(g)) === "empty,ok,empty,empty,empty" && (await g.page.locator(T("slot-undo-1")).count()) === 1);
  await g.page.click(T("slot-undo-1"));
  check("Undo brings the deleted character back unchanged", (await states(g)) === "ok,ok,empty,empty,empty" && (await lsJson(g.page, "office-crawler.slot.1")).name === "Alpha");
  // import: garbage, then a good file over an occupied slot, then undo
  await g.page.click(T("slot-import-3"));
  writeFileSync("/tmp/adv-r5-garbage.json", Buffer.from([0xff, 0xfe, 0, 1, 2, 3, 4]));
  await g.page.setInputFiles(T("import-file"), "/tmp/adv-r5-garbage.json"); await g.page.waitForTimeout(200);
  check("a binary file is refused with a message and the dialog stays usable", /not a usable|too large|newer/i.test(await g.page.locator(T("slots-message")).innerText()) && (await g.page.locator(T("import-file")).count()) === 1 && (await states(g)) === "ok,ok,empty,empty,empty");
  writeFileSync("/tmp/adv-r5-good.json", texts.two);
  await g.page.setInputFiles(T("import-file"), "/tmp/adv-r5-good.json"); await g.page.waitForTimeout(200);
  check("a valid file imports into the empty slot 3 without a prompt", (await states(g)) === "ok,ok,ok,empty,empty" && (await g.page.locator(T("slot-name-3")).innerText()).includes("Factory Two"));
  await g.page.click(T("slot-import-1"));
  writeFileSync("/tmp/adv-r5-good1.json", texts.one);
  await g.page.setInputFiles(T("import-file"), "/tmp/adv-r5-good1.json"); await g.page.waitForTimeout(200);
  check("importing over an occupied slot asks first and names who is lost", /Alpha/.test(await g.page.locator(T("slot-confirm-title")).innerText().catch(() => "")) || /Alpha/.test(await g.page.locator(T("slot-confirm-text")).innerText().catch(() => "")));
  await g.page.click(T("slot-confirm-yes"));
  check("after the confirmed import slot 1 holds the imported character and the old one is the undo copy", (await lsJson(g.page, "office-crawler.slot.1")).name === "Factory One" && (await lsJson(g.page, "office-crawler.slot.1.prev")).name === "Alpha");
  await g.page.click(T("slot-undo-1"));
  check("Undo of the replace restores Alpha", (await lsJson(g.page, "office-crawler.slot.1")).name === "Alpha");
  // rename: invalid names, then valid
  await g.page.click(T("slot-rename-2"));
  for (const bad of ["", "<script>", "ab\u202ecd"]) { await g.page.fill(T("slot-rename-input"), bad); await g.page.click(T("slot-rename-save")); check(`rename to ${JSON.stringify(bad)} is refused, slot unchanged`, (await lsJson(g.page, "office-crawler.slot.2")).name === "Bravo"); }
  await g.page.fill(T("slot-rename-input"), "  Bra  vo  Two "); await g.page.click(T("slot-rename-save"));
  check("a valid rename trims and collapses spaces and keeps level, class and items", (await lsJson(g.page, "office-crawler.slot.2")).name === "Bra vo Two" && (await lsJson(g.page, "office-crawler.slot.2")).class === CL.it);
  // fifth slot full: New game with all slots used
  for (const n of [4, 5]) { await g.page.click(T(`slot-new-${n}`)); await g.page.fill(T("create-name"), `Fill${n}`); await g.page.click(T("create-start")); await g.app("save.write"); await toTitle(g); await g.page.click(T("load-game")); }
  check("five characters in five slots", (await states(g)) === "ok,ok,ok,ok,ok");
  await g.page.click(T("slots-close")); await g.page.click(T("new-game"));
  check("with all five slots used, New game says the slots are full or asks which to replace", /full|replace|slot/i.test(await g.page.locator(T("create-slot-note")).innerText()), await g.page.locator(T("create-slot-note")).innerText());
  await g.page.fill(T("create-name"), "Sixth"); await g.page.click(T("create-start"));
  await g.page.waitForTimeout(150);
  check("Start with no free slot starts nothing (confirm to replace or the slot list opens)", (await states(g)) === "ok,ok,ok,ok,ok" && !(await g.state()).player || (await g.page.locator(T("create-confirm-title")).count()) > 0 || (await g.state()).ui.menu === "slots");
  check("no page error in the slot manager scenario", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- pause: load another slot, overwrite, rename the running character, quit, resume
{
  const g = await lobby();
  await startNew(g.page, { name: "Run One", cls: CL.sr }); await g.app("save.write");
  await g.app("pause");
  await g.page.click(T("pause-slots"));
  const dis = await g.page.evaluate(() => ["slot-delete-1", "slot-import-1", "slot-new-1", "slot-load-1"].map((id) => document.querySelector(`[data-testid="${id}"]`)?.disabled));
  check("the running character's Delete, Import, New and Load are disabled in the pause slot list", dis.every((d) => d === true), dis);
  await g.page.click(T("slot-new-2")); // New character in slot 2 while playing slot 1
  await g.page.fill(T("create-name"), "Run Two"); await g.page.click(T("create-start"));
  check("starting a new character from the pause menu switches to it", (await g.state()).player.name === "Run Two" && (await lsJson(g.page, "office-crawler.slots")).active === 2);
  await g.app("cheat.giveGold", 500);
  await g.app("pause");
  await g.page.click(T("pause-slots"));
  await g.page.click(T("slot-load-1"));
  const dlg = await g.page.locator(T("slot-load-confirm-title")).count();
  const s = await g.state();
  fixed("loading another character from the pause menu warns (names the characters) before it leaves the running game", dlg > 0 && s.player.name === "Run Two" && /Run One/.test(await g.page.locator(T("slot-load-confirm-title")).innerText()) && /Run Two/.test(await g.page.locator(T("slot-load-confirm-text")).innerText()), "ADV-R5-08", { dialogs: dlg, nowPlaying: s.player.name });
  check("the load confirmation takes focus and Tab stays inside it", await g.page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]')) && await (async () => { const r = []; for (let i = 0; i < 6; i++) { await g.page.keyboard.press("Tab"); r.push(await g.page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]'))); } return r.every(Boolean); })());
  await g.page.click(T("slot-load-confirm-no"));
  check("Cancel keeps the running game and gives focus back to the Load button", (await g.state()).player.name === "Run Two" && (await focusId(g.page)) === "slot-load-1", await focusId(g.page));
  await g.page.click(T("slot-load-1")); await g.page.click(T("slot-load-confirm-yes"));
  check("Run Two's progress was saved before the switch (gold 550 in slot 2)", (await lsJson(g.page, "office-crawler.slot.2")).player.gold === 550);
  check("the active slot is now 1 and slot 2's text is not touched by autosaves of slot 1", (await lsJson(g.page, "office-crawler.slots")).active === 1);
  await g.app("step", 30);
  // rename running character from the pause menu
  await g.app("pause");
  await g.page.click(T("pause-slots")); await g.page.click(T("slot-rename-1"));
  await g.page.fill(T("slot-rename-input"), "Renamed Live"); await g.page.click(T("slot-rename-save"));
  check("renaming the running character in the pause menu updates the game and the slot", (await g.state()).player.name === "Renamed Live" && (await lsJson(g.page, "office-crawler.slot.1")).name === "Renamed Live");
  await g.page.keyboard.press("Escape"); await g.page.keyboard.press("Escape");
  await g.app("save.write");
  check("the rename survives the next autosave", (await lsJson(g.page, "office-crawler.slot.1")).name === "Renamed Live");
  // quit and continue: most recent is slot 1
  await toTitle(g);
  const cw = await g.page.locator(T("continue-who")).innerText();
  check("Continue on the title names the most recent character", /Renamed Live/.test(cw), cw);
  await g.page.click(T("continue"));
  check("quit then Continue resumes the same character in the Lobby", (await g.state()).player.name === "Renamed Live" && (await g.state()).scene === "town");
  // rename a character that is dead (scene dead): the API says ok but the next autosave reverts it
  await g.app("cheat.teleportFloor", 1); await g.app("cheat.setHp", 0); await g.app("step", 3);
  const dead = (await g.state()).scene === "dead";
  const rn = await g.app("slots.run", { t: "renameSlot", slot: 1, name: "Dead Name" });
  await g.app("save.write");
  fixed("a rename accepted while the character is on the death screen is still there after the next autosave", dead && rn.ok && (await lsJson(g.page, "office-crawler.slot.1")).name === "Dead Name", "ADV-R5-09", { dead, rn, stored: (await lsJson(g.page, "office-crawler.slot.1")).name });
  check("no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- skill tree: prerequisites, spam, F1-F4, aura, respec only in the Lobby
{
  const g = await lobby();
  await startNew(g.page, { name: "Treehugger", cls: CL.fm });
  await g.app("cheat.setLevel", 16);
  await g.page.keyboard.press("KeyS");
  check("the S key opens the skills panel", (await g.state()).ui.panels?.skills === true);
  check("a locked tier-3 skill has a disabled Learn button and a lock reason in text", (await g.page.locator(T("learn-demolition-day")).isDisabled()) && (await g.page.locator(T("node-demolition-day")).getAttribute("aria-label")).length > 20);
  await g.page.locator(T("learn-demolition-day")).click({ force: true }).catch(() => {});
  check("forcing a click on a disabled Learn changes nothing", !("demolition-day" in (await g.state()).player.skills));
  for (let i = 0; i < 12; i++) await g.page.locator(T("learn-pallet-slam")).click({ force: true, noWaitAfter: true }).catch(() => {});
  const p1 = (await g.state()).player;
  check("12 fast clicks on Learn stop at max level 5 and spend exactly 4 points", p1.skills["pallet-slam"] === 5 && p1.skillPoints === 15 - 4, [p1.skills, p1.skillPoints]);
  await g.page.click(T("learn-dress-code")); await g.page.click(T("learn-fire-drill"));
  await g.page.click(T("aura-fire-drill"));
  check("the aura button toggles the aura on and reflects it in aria-pressed", (await g.state()).player.aura === "fire-drill" && (await g.page.getAttribute(T("aura-fire-drill"), "aria-pressed")) === "true");
  await g.page.click(T("aura-fire-drill"));
  check("and off again", (await g.state()).player.aura === null);
  await g.page.click(T("aura-fire-drill"));
  for (const [k, i] of [["F1", 0], ["F2", 1], ["F3", 2], ["F4", 3]]) { await g.page.keyboard.press(k); check(`${k} selects hotkey ${i + 1} while the skills panel is open`, (await g.state()).player.skillBar.selected === i); }
  await g.page.click(T("assign-pallet-slam-2")); await g.page.click(T("assign-pallet-slam-2"));
  check("clicking an assigned F-button again unassigns it", (await g.state()).player.skillBar.hotkeys[2] === null);
  check("Respec is enabled in the Lobby", !(await g.page.locator(T("respec")).isDisabled()));
  await g.app("cheat.teleportFloor", 1); await g.page.waitForTimeout(80);
  check("Respec is disabled on a floor and the API refuses with not-in-town", (await g.page.locator(T("respec")).isDisabled()) && (await g.app("tree.respec")).error === "not-in-town");
  await g.app("cheat.teleportFloor", 0); await g.page.waitForTimeout(80);
  await g.page.click(T("respec")); await g.page.click(T("respec-yes")); // R6: a respec with points to return asks first
  const p2 = (await g.state()).player;
  check("Respec in the Lobby returns every point (15 at level 16), clears the aura and keeps the signature", p2.aura === null && Object.keys(p2.skills).join() === "pallet-slam" && p2.skillPoints === 15, [p2.skillPoints, p2.skills, p2.aura]);
  check("after respec the bar keeps only the signature and the right mouse has a skill or an empty slot, never a removed one", p2.skillBar.hotkeys.every((h) => h === null || h === "pallet-slam"), p2.skillBar);
  check("no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- class parity and rendering smoke: every class, every skill, real frames
{
  for (const cls of Object.values(CL)) {
    const g = await lobby({ width: 1280, height: 720 }, "test=1&seed=3");
    await startNew(g.page, { name: "Smoke", cls });
    await g.app("cheat.setLevel", 30);
    const tree = await g.app("tree.get");
    const nodes = tree.branches.flatMap((b) => b.nodes);
    for (let r = 0; r < 5; r++) for (const n of nodes) await g.app("tree.learn", n.id);
    await g.app("cheat.teleportFloor", 2);
    const p = (await g.state()).player.tile;
    let spawned = 0;
    for (const type of ["zombie-intern", "printer-imp", "temp-worker", "middle-manager", "vending-machine", "consultant"]) for (let d = 2; d < 8; d++) { const r = await g.app("cheat.spawnMonster", type, { x: p.x + d, y: p.y + (spawned % 3) }); if (r && r.ok !== false) { spawned++; break; } }
    const actives = nodes.filter((n) => ["active", "aura"].includes(n.kind));
    for (const n of actives) {
      await g.app("cheat.setHp", 9999);
      await g.page.evaluate((id) => { const a = window.__app, t = a.getState().player.tile; a.input({ t: "cast", skill: id, tile: { x: t.x + 2, y: t.y } }); }, n.id);
      await g.app("step", 20);
    }
    for (const n of actives.filter((x) => x.kind === "aura")) { await g.page.evaluate((id) => window.__app.input({ t: "toggleAura", id }), n.id); await g.app("step", 30); }
    await g.app("step", 60);
    check(`${cls}: ${actives.length} active skills cast on a populated floor and rendered with no page error`, g.errors.length === 0 && ["floor", "dead"].includes((await g.state()).scene), g.errors.slice(0, 2));
    await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(80);
    check(`${cls}: the full skill tree panel renders (every node present as a button)`, (await g.page.locator('[data-testid^="node-"]').count()) === nodes.length, await g.page.locator('[data-testid^="node-"]').count());
    if (cls === CL.it) await shot(g.page, "tree-it-max");
    await g.context.close();
  }
}

// ---------------------------------------------------------------- options: key rebinding during capture does not leak into the game; options survive slot operations
{
  const g = await lobby();
  await g.page.click(T("options"));
  check("Options on the title embeds the five-slot manager", (await g.page.locator('[data-testid^="slot-"][data-state]').count()) === 5);
  await g.page.locator(T("opt-mute")).check();
  await g.page.click(T("opt-back"));
  await startNew(g.page, { name: "Opt", cls: CL.sr }); await g.app("save.write");
  await g.app("pause"); await g.page.click(T("quit"));
  await g.page.click(T("load-game")); await g.page.click(T("slot-delete-1")); await g.page.click(T("slot-confirm-yes"));
  check("deleting the only character leaves the options (mute) untouched", (await lsJson(g.page, "office-crawler.options")).muted === true);
  check("no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}


// ================================================================ ROUND 2 (after the fix round)
// ---------------------------------------------------------------- XSS: every free-text field that can reach markup, plus a tampered index
{
  const X = "<img src=x onerror=window.__xss=1>", Y = '"><svg onload=window.__xss=2>';
  const s = toSave(newGame(5, { class: CL.sr, name: "Hostile", start: "town", wearStartKit: true }));
  const w = s.equipment.weapon;
  Object.assign(w, { name: X, baseName: Y, flavour: X, rarity: "magic", affixes: [{ id: "health-t1", group: "health", kind: "prefix", stat: "hpMax", value: 6, range: [5, 10], tier: 1, name: Y }] }); // R6 fix round: a legal rollable affix on a magic item, hostile name kept
  s.inventory.items.push({ ...structuredClone(w), id: "i90", x: 0, y: 0, name: Y, flavour: Y });
  s.stash.items.push({ ...structuredClone(w), id: "i91", x: 0, y: 0, name: X });
  s.belt[0] = { id: "i92", base: "lukewarm-coffee", baseName: Y, name: X, kind: "potion", rarity: "normal", w: 1, h: 1, restore: 25, restores: "hp", slot: "potion", affixes: [] };
  const text = canonical({ ...s, checksum: checksumOf(s) });
  const seed = await buildSeed({ "office-crawler.slot.1": text });
  const idx = JSON.parse(seed["office-crawler.slots"]);
  idx.slots[0].name = X; idx.slots[0].class = Y; idx.slots[0].level = X; // a tampered index entry
  seed["office-crawler.slots"] = JSON.stringify(idx);
  const g = await seeded(seed);
  const inj = () => g.page.evaluate(() => ({ x: window.__xss ?? null, nodes: document.querySelectorAll('img[src="x"],[onerror],[onload],svg[onload]').length }));
  await g.page.click(T("load-game")); await g.page.waitForTimeout(100);
  check("tampered index entry: no script ran and no element was injected in the Load dialog or the title", JSON.stringify(await inj()) === '{"x":null,"nodes":0}', await inj());
  await g.page.keyboard.press("Escape");
  const idx2 = JSON.parse(await lsRaw(g.page, "office-crawler.slots"));
  await g.page.evaluate(() => { const i = JSON.parse(localStorage.getItem("office-crawler.slots")); i.slots[0] = { n: 1, state: "ok", name: "Hostile", class: "sales-rep", level: 1, depth: 0, deepest: 1, playSec: 0, lastPlayed: 1, bytes: 1, sum: 1 }; localStorage.setItem("office-crawler.slots", JSON.stringify(i)); });
  void idx2;
  await g.page.reload(); await goTitle(g.page);
  await g.page.click(T("continue")).catch(() => {}); await g.page.waitForTimeout(150);
  const st = await g.state();
  check("hostile item text: the character loads (text fields are allowed, length-capped)", st.scene === "town" && st.player.name === "Hostile", st.scene);
  await g.page.keyboard.press("KeyI"); await g.page.keyboard.press("KeyC"); await g.page.waitForTimeout(150);
  const n = await g.page.evaluate(async () => {
    let c = 0; window.__tips = [];
    for (const el of document.querySelectorAll("[data-tip]")) { el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); c++; window.__tips.push(document.querySelector(".tip")?.textContent ?? ""); await new Promise((r) => setTimeout(r, 15)); }
    return c;
  });
  check("hovering every item shows tooltips (equipment, inventory, belt)", n >= 3, n);
  check("hostile item names, base names, flavour and affix names in tooltips and slots are escaped: no script, no injected element", JSON.stringify(await inj()) === '{"x":null,"nodes":0}', await inj());
  check("the escaped text is visible as text in at least one tooltip", await g.page.evaluate(() => window.__tips.some((t) => t.includes("<img src=x") || t.includes("<svg"))));
  await g.app("cheat.giveItem", {});
  await g.app("save.write");
  await g.app("ui.close", "inventory"); await g.app("ui.close", "character");
  await g.app("pause");
  await g.page.click(T("pause-slots")); await g.page.waitForTimeout(100);
  check("Save slots from the pause menu with the hostile character: still no injection", JSON.stringify(await inj()) === '{"x":null,"nodes":0}', await inj());
  check("no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- dialogs: Esc closes only the confirmation, import confirm traps focus; load confirm cancel
{
  const g = await lobby();
  await startNew(g.page, { name: "Dlg", cls: CL.sr }); await g.app("save.write");
  await toTitle(g);
  await g.page.click(T("load-game"));
  await g.page.click(T("slot-delete-1"));
  await g.page.keyboard.press("Escape");
  check("Esc in the delete confirmation closes only the confirmation (the slot list stays, the slot stays)", (await g.page.locator(T("slot-confirm-title")).count()) === 0 && (await g.state()).ui.menu === "slots" && (await states(g)) === "ok,empty,empty,empty,empty", (await g.state()).ui.menu);
  check("and focus goes back to the Delete button", (await focusId(g.page)) === "slot-delete-1", await focusId(g.page));
  writeFileSync("/tmp/adv-r5b-one.json", texts.one);
  await g.page.click(T("slot-import-1"));
  await g.page.setInputFiles(T("import-file"), "/tmp/adv-r5b-one.json"); await g.page.waitForTimeout(200);
  const r = []; for (let i = 0; i < 6; i++) { await g.page.keyboard.press("Tab"); r.push(await g.page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]'))); }
  check("the import-replace confirmation traps Tab", r.every(Boolean), r);
  await g.page.keyboard.press("Escape");
  check("Esc cancels the import-replace: slot 1 unchanged", (await lsJson(g.page, "office-crawler.slot.1")).name === "Dlg" && (await g.page.locator(T("slot-confirm-title")).count()) === 0);
  check("no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---------------------------------------------------------------- clock skew: an owner beat in the future (ADV-R5-13); Take over is the way out
{
  const g = await lobby();
  await startNew(g.page, { name: "Skew" }); await g.app("save.write");
  await toTitle(g);
  await g.page.evaluate(() => { const i = JSON.parse(localStorage.getItem("office-crawler.slots")); i.owner = { id: "gone", beat: Date.now() + 3 * 86400000 }; localStorage.setItem("office-crawler.slots", JSON.stringify(i)); sessionStorage.clear(); });
  await g.page.reload(); await goTitle(g.page);
  await g.page.click(T("continue")); await g.page.waitForTimeout(150);
  fixed("an owner beat three days in the future is treated as stale (clock set back or tampered index)", (await g.state()).scene === "town", "ADV-R5-13", (await g.app("slots.view")).status);
  check("whatever the status says, 'Take over saves' is offered and works as the way out", await (async () => { if ((await g.state()).scene === "town") return true; await g.page.click(T("take-over-saves")); await g.page.click(T("take-over-yes")); await g.page.click(T("continue")); await g.page.waitForTimeout(150); return (await g.state()).scene === "town"; })());
  await g.context.close();
}

// ---------------------------------------------------------------- hostile import: an affix without `range` breaks the tooltip and the price (ADV-R5-14)
{
  const s = toSave(newGame(5, { class: CL.fm, name: "NoRange", start: "town", wearStartKit: true }));
  s.inventory.items.push({ ...structuredClone(s.equipment.weapon), id: "i90", x: 0, y: 0, affixes: [{ stat: "defense", value: 5 }] });
  const text = canonical({ ...s, checksum: checksumOf(s) });
  const g = await seeded(await buildSeed({ "office-crawler.slot.1": text }));
  await g.page.click(T("continue")).catch(() => {}); await g.page.waitForTimeout(150);
  if ((await g.state()).scene === "town") {
    await g.page.keyboard.press("KeyI"); await g.page.waitForTimeout(100);
    await g.page.evaluate(() => { for (const el of document.querySelectorAll("[data-tip]")) el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    await g.page.waitForTimeout(100);
  }
  xfail("an imported item whose affix has no range can be hovered without a page error (rejected at import or priced safely)", (await g.state()).scene !== "town" || g.errors.length === 0, "ADV-R5-14", g.errors.slice(0, 1));
  await g.context.close();
}

// ---------------------------------------------------------------- hostile import: negative hpMax/stamina affix (ADV-R5-12)
{
  const s = toSave(newGame(5, { class: CL.fm, name: "Negative", start: "town", wearStartKit: true }));
  s.equipment.weapon.affixes = [{ stat: "hpMax", value: -100 }];
  const text = canonical({ ...s, checksum: checksumOf(s) });
  const g = await seeded(await buildSeed({ "office-crawler.slot.1": text }));
  await g.page.click(T("continue")).catch(() => {}); await g.page.waitForTimeout(150);
  const st = await g.state();
  xfail("an imported item with a -100 hpMax affix does not leave the hero with negative health (rejected or clamped)", st.scene !== "town" ? true : st.player.hp >= 1 && st.player.hpMax >= 1, "ADV-R5-12", st.player && { hp: st.player.hp, hpMax: st.player.hpMax });
  await g.context.close();
}

await browser.close();
const { failed } = finish("adv-r5");
console.log(`expected failures (documented defects): ${xres.filter((x) => !x.ok).length} XFAIL, ${xres.filter((x) => x.ok).length} XPASS`);
if (failed) process.exitCode = 1;
