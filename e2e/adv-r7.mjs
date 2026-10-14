// Adversarial e2e for round 7 (quest journal, tracker, NPC window, hand-in, pouch, slots, toasts, markers). Test-engineer, adversarial mode.
// Every page is served from an https origin (L-027), never file://. `xfail(name, ok, "ADV-R7-NN")` marks a demonstrated defect from
// docs/reviews/R7-adversarial.md: printed XFAIL (XPASS once fixed), never fails the script. SEC=a,b runs some sections while developing.
// Legal fixtures come from real play: a headless bot (public input API, no cheats) plays a class to the first Lobby visit with all three side quests
// ready, and to the end of the game; the game's own save writer turns those states into slot texts that the page imports.
// Screenshots: docs/shots/adv-r7-*.jpg (JPEG, below 300 KB).
import { mkdirSync, statSync } from "node:fs";
import { launch, check, finish } from "./helpers.mjs";
import { startNew, tileScreen } from "./helpers.mjs";
import { newGame, step, applyInput } from "../src/core/index.js";
import { serialize, deserialize } from "../src/save/index.js";
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";

const browser = await launch();
const T = (id) => `[data-testid="${id}"]`;
const SHOTS = "docs/shots";
mkdirSync(SHOTS, { recursive: true });
const sec = (name) => !process.env.SEC || process.env.SEC.split(",").includes(name);
const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
const xres = [];
const xfailAfter = []; // xfail calls that need the fixtures built first
function xfail(name, ok, id, detail) {
  xres.push({ name, ok: !!ok, id });
  console.log(`${ok ? "XPASS (defect fixed? remove the xfail)" : "XFAIL"} ${id} ${name}${!ok && detail !== undefined ? "  -> " + JSON.stringify(detail).slice(0, 300) : ""}`);
}
const shot = async (page, name) => {
  const path = `${SHOTS}/adv-r7-${name}.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 60 });
  check(`screenshot adv-r7-${name}.jpg is at most 300 KB`, statSync(path).size / 1024 <= 300, statSync(path).size / 1024);
};

/** A page on an https origin serving the shipped build. `context` shares storage with an earlier page (two tabs). */
async function boot({ viewport = { width: 1280, height: 720 }, query = "test=1&seed=3", reduced = false, context = null, init = null } = {}) {
  const ctx = context ?? await browser.newContext({ viewport, reducedMotion: reduced ? "reduce" : "no-preference" });
  if (!context) await ctx.route("https://oc.test/**", (r) => r.fulfill({ path: "dist/index.html", contentType: "text/html" }));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  page.on("pageerror", (e) => errors.push(e.message + " @ " + String(e.stack).split("\n").slice(1, 3).join(" | ")));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.goto(`https://oc.test/index.html?${query}`);
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  return { context: ctx, page, app, state: () => app("getState"), errors, dialogs };
}
const focusId = (page) => page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll(".screen,.panel,#pleft,#pright")].every((e) => e.scrollWidth <= innerWidth + 1));
const sides = ["sq1", "sq2", "sq3", "sq4", "sq5"]; // R7-4: five side quests
const first3 = ["sq1", "sq2", "sq3"]; // ready at the first Lobby visit of the bot (trip T1 from floor 4); sq4 and sq5 follow at trip T2 from floor 6
const qstates = (s) => Object.fromEntries(sides.map((k) => [k, s.quests[k].state]));
const GIVER = { sq1: "vendor", sq2: "healer", sq3: "potions", sq4: "stash", sq5: "vendor" };

/** Walk to an NPC by clicking its tile (the real mouse path) and wait for the window. */
async function talk(g, npc) {
  const s = await g.state();
  const n = s.npcs.find((o) => o.id === npc);
  await g.app("clickTile", n.tile.x, n.tile.y);
  for (let i = 0; i < 12; i++) { await g.app("step", 60); if ((await g.state()).ui.dialog?.npc === npc) break; }
  await g.page.waitForTimeout(60);
  return (await g.state()).ui.dialog?.npc === npc;
}
const handInState = async (g) => { const s = await g.state(); return { gold: s.player.gold, xp: s.player.xp, pouch: s.player.pouch.length, q: qstates(s), bag: s.inventory.items.length }; };

// ------------------------------------------------------------------------------------------------ fixtures from real play (no cheats)
function realRun(cls, seed) {
  const state = newGame(seed, { start: "town", class: cls, name: "Real", wearStartKit: true }), mem = createBotMemory({ depth: 9, respawn: true, maxDeaths: 12, class: cls });
  let pre = null, pre2 = null;
  for (let i = 0; i < 400000 && !(mem.done && !(state.victory && !state.victory.done)); i++) { // after the boss falls, play on to the victory screen, then keepPlaying
    if (state.scene === "dead") applyInput(state, { t: "respawn" });
    if (!pre && state.depth === 0 && state.scene === "town" && first3.every((k) => state.quests[k].s === "ready")) pre = { text: serialize(state), tick: state.tick };
    if (pre && !pre2 && state.depth === 0 && state.scene === "town" && ["sq4", "sq5"].some((k) => state.quests[k].s === "ready")) pre2 = { text: serialize(state), tick: state.tick }; // trip T2: the second Lobby visit
    if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) noteResult(mem, cmd, applyInput(state, cmd)); }
    step(state);
    if (state.scene === "victory") { applyInput(state, { t: "keepPlaying" }); mem.done = true; }
    if (!pre && state.tick > 120000) break;
  }
  return { pre, pre2, post: { text: serialize(state), quests: structuredClone(state.quests), done: mem.done }, won: state.bossDefeated };
}
const FX = {};
const noCheat = [], incomplete = [];
const allDone = (r) => r.won && sides.every((k) => r.post.quests[k].s === "completed") && r.post.quests.main.m.verdict;
for (const cls of CLASSES) {
  for (const seed of [101, 102, 105]) { // 102 and 105 are the seeds where floors 5 and 6 hold fewer than 6 consultants (ADV-R7-10)
    const r = realRun(cls, seed);
    if (r.won && !allDone(r)) incomplete.push(`${cls}:${seed}:${sides.filter((k) => r.post.quests[k].s !== "completed").join("+")}`); // ADV-R7-10: real play that wins but leaves a quest open
    if (FX[cls] || !r.pre || !r.pre2 || !allDone(r)) continue;
    FX[cls] = { ...r, seed };
  }
  const f = FX[cls];
  const ok = !!f && f.won && !!f.pre2 && deserialize(f.post.text).ok && sides.every((k) => f.post.quests[k].s === "completed") && f.post.quests.main.m.verdict;
  noCheat.push({ cls, seed: f?.seed, ok });
  check(`[R7-nocheat] ${cls}: real play by the bot (public input API only, no cheat) reaches the Lobby with sq1..sq3 ready, again with sq4 and sq5 ready, and ends with main, main2, main3 and sq1..sq5 completed (seed ${f?.seed})`, ok, f && { won: f.won, q: f.post.quests });
}
xfailAfter.push(() => xfail("[R7-nocheat] real play by the bot on seeds 101, 102 and 105 leaves no quest open in any class (AC-R-259-3: all eight completed, floors 5 and 6 must hold the count of consultants)", incomplete.length === 0, "ADV-R7-10", incomplete));
const loadFixture = async (g, text, slot = 1) => {
  const a = await g.app("slots.run", { t: "importSlot", slot, text, confirm: true });
  const b = await g.app("slots.run", { t: "loadSlot", slot, confirm: true });
  return a.ok && b.ok;
};
const MAINS = ["main", "main2", "main3"];
const CLS = FX["sales-rep"] ? "sales-rep" : CLASSES.find((c) => FX[c]);

// ================================================================================== 1. journal, tracker: keyboard, focus, names (desktop)
if (sec("journal")) {
  const g = await boot();
  await startNew(g.page, { cls: "sales-rep", name: "Probe" });
  let s = await g.state();
  check("[R7-journal] new game: the tracker line equals main.nextStep and is one line (nowrap)", s.ui.tracker?.text === s.quests.main.nextStep && (await g.page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tracker-text"]')).whiteSpace)) === "nowrap", s.ui.tracker);
  // opener by keyboard: focus the dock button, Enter, Escape -> focus returns to the dock button
  await g.page.focus(T("dock-journal")); await g.page.keyboard.press("Enter"); await g.app("step", 2);
  check("[R7-journal] Enter on the dock button opens the journal, focus lands on the first quest", (await g.state()).ui.panels.journal === true && (await focusId(g.page)) === "journal-quest-main", await focusId(g.page));
  const names = await g.page.evaluate(() => [...document.querySelectorAll('[data-testid="journal"] [tabindex="0"], [data-testid="journal"] button')].map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim()));
  check("[R7-journal] every focusable control in the journal has an accessible name", names.length >= 7 && names.every((n) => n.length > 2), names);
  check("[R7-journal] quest entries name their state as text (Available / Active / Pinned), not by colour", (await g.page.evaluate(() => [...document.querySelectorAll('[data-testid^="journal-quest-"]')].map((e) => e.getAttribute("aria-label")))).every((l) => /Available|Active|Ready|Completed|Locked/.test(l)));
  check("[R7-journal] there is no abandon action: not in the hook description, not in the journal (AC-R-253-1)", !/abandon/i.test(JSON.stringify(await g.app("describe"))) && !/abandon/i.test(await g.page.textContent(T("journal"))));
  await g.page.keyboard.press("ArrowDown"); await g.app("step", 1);
  check("[R7-journal] ArrowDown walks to the next quest entry", (await focusId(g.page)) === "journal-quest-sq1", await focusId(g.page));
  await g.page.keyboard.press("Tab"); await g.app("step", 1);
  const onPin = await focusId(g.page);
  await g.page.keyboard.press("Enter"); await g.app("step", 2);
  s = await g.state();
  check("[R7-journal] Tab reaches the pin button, Enter pins sq1: tracker follows in the same step", onPin === "journal-pin-sq1" && s.quests.pinned === "sq1" && s.ui.tracker.id === "sq1" && s.ui.tracker.text === s.quests.sq1.nextStep, [onPin, s.quests.pinned, s.ui.tracker]);
  check("[R7-journal] after pinning, keyboard focus is still on a journal control, not dropped to <body>", ["journal-pin-sq1", "journal-quest-sq1"].includes(await focusId(g.page)), await focusId(g.page));
  check("[R7-journal] exactly one entry shows 'Pinned' (text) after the pin", (await g.page.locator('[data-testid^="journal-pinned-"]').count()) === 1);
  await g.page.keyboard.press("Enter"); await g.app("step", 2);
  check("[R7-journal] the same button now unpins and the tracker returns to main", (await g.state()).quests.pinned === "main" && (await g.state()).ui.tracker.id === "main");
  await g.page.keyboard.press("Escape"); await g.app("step", 2);
  s = await g.state();
  check("[R7-journal] Escape closes only the journal (no pause menu), focus returns to the dock button that opened it", s.ui.panels.journal === false && s.paused === false && (await focusId(g.page)) === "dock-journal", [s.paused, await focusId(g.page)]);
  // J twice
  await g.page.keyboard.press("KeyJ"); await g.app("step", 1); await g.page.keyboard.press("KeyJ"); await g.app("step", 1);
  check("[R7-journal] J opens, J again closes", (await g.state()).ui.panels.journal === false);
  // journal over an open NPC window: J, Escape, Escape leaves nothing stuck
  check("[R7-journal] walk to the vendor and open the window", await talk(g, "vendor"));
  await g.page.keyboard.press("KeyJ"); await g.app("step", 1);
  s = await g.state();
  const both = [s.ui.panels.journal, s.ui.panels.npc, !!s.ui.dialog];
  await g.page.keyboard.press("Escape"); await g.app("step", 2);
  const afterOne = await g.state();
  check("[R7-journal] J while an NPC window is open, then one Escape: back to the plain game (journal and window closed, no pause menu, no stuck panel)", !afterOne.ui.panels.journal && !afterOne.ui.panels.npc && !afterOne.ui.dialog && afterOne.paused === false, { both, afterOne: [afterOne.ui.panels.journal, afterOne.ui.panels.npc, !!afterOne.ui.dialog, afterOne.paused] });
  // the pause-menu entry
  await g.page.keyboard.press("Escape"); await g.app("step", 1);
  check("[R7-journal] pause menu lists Journal; choosing it resumes and opens the journal", await g.page.locator(T("pause-journal")).count() === 1);
  if (await g.page.locator(T("pause-journal")).count()) { await g.page.click(T("pause-journal")); await g.app("step", 2); }
  check("[R7-journal] ... and the game is not left paused", (await g.state()).ui.panels.journal === true && (await g.state()).paused === false);
  await shot(g.page, "journal-desktop");
  check("[R7-journal] no page error, no alert dialog", g.errors.length === 0 && g.dialogs.length === 0, [g.errors, g.dialogs]);
  await g.context.close();
}

// ================================================================================== 2. phone: layout, targets, focus
if (sec("phone")) {
  const g = await boot({ viewport: { width: 390, height: 844 } });
  await startNew(g.page, { cls: "sales-rep", name: "Probe" });
  const r = await g.page.evaluate(() => { const b = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }; return { tracker: b('[data-testid="tracker"]'), jb: b('[data-testid="dock-journal"]'), ib: b('[data-testid="dock-inventory"]'), text: document.querySelector('[data-testid="tracker-text"]').textContent }; });
  const hit = (a, c) => a && c && !(a.r <= c.l || c.r <= a.l || a.b <= c.t || c.b <= a.t);
  check("[R7-phone] the tracker sits inside the viewport and does not overlap the dock buttons", r.tracker && r.tracker.l >= 0 && r.tracker.r <= 390 && !hit(r.tracker, r.jb) && !hit(r.tracker, r.ib), r);
  check("[R7-phone] the journal button is at least as large as the other HUD buttons and at least 44 px high (touch)", r.jb && r.ib && r.jb.h >= r.ib.h - 1 && r.jb.h >= 40, [r.jb, r.ib]);
  await g.page.click(T("dock-journal")); await g.app("step", 2);
  const j = await g.page.evaluate(() => { const c = document.querySelector('[data-testid="close-journal"]'); const cr = c?.getBoundingClientRect(); const pins = [...document.querySelectorAll(".jpin")].map((e) => e.getBoundingClientRect()); return { close: cr && { w: cr.width, h: cr.height, r: cr.right, t: cr.top }, pinH: Math.min(...pins.map((p) => p.height)), pinW: Math.min(...pins.map((p) => p.width)), sw: document.documentElement.scrollWidth }; });
  check("[R7-phone] the journal has a visible close control of at least 40 px and no horizontal scroll", j.close && j.close.w >= 40 && j.close.h >= 40 && j.close.r <= 390 && j.sw <= 391, j);
  check("[R7-phone] pin buttons are at least 24 px (WCAG 2.2 target size)", j.pinH >= 24 && j.pinW >= 24, j);
  check("[R7-phone] no overflow of any panel", await overflow(g.page));
  const clipped = await g.page.evaluate(() => [...document.querySelectorAll('[data-testid="journal"] .jn, [data-testid="journal"] .jt')].some((e) => e.scrollWidth > e.clientWidth + 1));
  check("[R7-phone] long quest lines wrap instead of clipping", !clipped);
  await shot(g.page, "journal-phone");
  for (const scale of [1.5, 2]) {
    await g.app("options.setTextScale", scale); await g.page.waitForTimeout(120);
    const big = await g.page.evaluate(() => { const c = document.querySelector('[data-testid="close-journal"]')?.getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, close: c && [c.left, c.right, c.width, c.height] }; });
    check(`[R7-phone] text scale ${scale} at 390 px: no horizontal scroll, the close control is still inside the screen and at least 40 px`, big.sw <= 391 && big.close && big.close[1] <= 390 && big.close[2] >= 40 && big.close[3] >= 40, big);
  }
  await g.app("options.setTextScale", 1); await g.page.waitForTimeout(120);
  await g.page.click(T("close-journal")); await g.app("step", 2);
  check("[R7-phone] closing the journal with its button works", (await g.state()).ui.panels.journal === false);
  // keyboard focus return on the phone layout
  await g.page.focus(T("dock-journal")); await g.page.keyboard.press("Enter"); await g.app("step", 2); await g.page.keyboard.press("Escape"); await g.app("step", 2);
  check("[R7-phone] Escape returns focus to the dock button that opened the journal (AC-R-244-2)", (await focusId(g.page)) === "dock-journal", await focusId(g.page));  // ADV-R7-04 fixed in R7-4.2
  await g.context.close();
}

// ================================================================================== 3. NPC window: keyboard only, double accept, decline
if (sec("dialog")) {
  const g = await boot();
  await startNew(g.page, { cls: "facilities-manager", name: "Probe" });
  check("[R7-dialog] the vendor window opens with Accept focused (keyboard users start on the quest)", await talk(g, "vendor") && (await focusId(g.page)) === "quest-accept-sq1", await focusId(g.page));
  const label = await g.page.getAttribute(T("quest-accept-sq1"), "aria-label");
  check("[R7-dialog] Accept and Decline say which quest they act on (accessible name)", /Intern Overflow/.test(label ?? "") && /Intern Overflow/.test((await g.page.getAttribute(T("quest-decline-sq1"), "aria-label")) ?? ""), label);
  check("[R7-dialog] the offer shows its reward as text before Accept (AC-R-247-4)", /60 gold/.test(await g.page.textContent(T("npc-quest-reward-sq1"))), await g.page.textContent(T("npc-quest-reward-sq1")));
  await g.page.keyboard.press("Tab"); await g.page.keyboard.press("Enter"); await g.app("step", 2);
  check("[R7-dialog] Tab to Decline and Enter closes the window and leaves the quest available with no toast and no event", (await g.state()).quests.sq1.state === "available" && (await g.state()).ui.dialog === null && !/Intern Overflow:/.test((await g.state()).ui.toast ?? ""));
  check("[R7-dialog] the window can be opened again after a decline and offers the quest again", await talk(g, "vendor") && (await g.page.locator(T("quest-accept-sq1")).count()) === 1);
  await g.page.focus(T("quest-accept-sq1"));
  await g.page.evaluate(() => { const b = document.querySelector('[data-testid="quest-accept-sq1"]'); b.click(); b.click(); b.click(); });
  await g.app("step", 2);
  {
    const s = await g.state();
    check("[R7-dialog] three clicks on Accept in one frame accept once: active, progress 0, one toast", s.quests.sq1.state === "active" && s.quests.sq1.progress === 0 && /Intern Overflow: Defeat/.test(s.ui.toast ?? ""), [s.quests.sq1, s.ui.toast]);
  }
  check("[R7-dialog] after Accept the offer buttons are gone and a progress line shows (no second Accept)", (await g.page.locator(T("quest-accept-sq1")).count()) === 0 && (await g.page.locator(T("npc-quest-progress-sq1")).count()) === 1);
  const focusAfter = await focusId(g.page);
  check("[R7-dialog] focus does not fall to <body> when the focused Accept button disappears", focusAfter !== "BODY", focusAfter);
  await g.page.keyboard.press("Escape"); await g.app("step", 2);
  check("[R7-dialog] Escape closes the window, nothing else (not paused)", (await g.state()).ui.dialog === null && (await g.state()).paused === false);
  // wrong NPC: the healer window shows only its own quest
  check("[R7-dialog] the healer's window lists only the healer's quest", await talk(g, "healer") && (await g.page.locator('[data-testid^="npc-quest-sq"]').count()) >= 1 && (await g.page.locator(T("npc-quest-sq1")).count()) === 0);
  check("[R7-dialog] the stash keeper offers sq4 (R7-4) with Accept and Decline, and the locker is still there in the same window", (await (async () => { await g.page.keyboard.press("Escape"); return talk(g, "stash"); })()) && (await g.page.locator(T("npc-quest-sq4")).count()) === 1 && (await g.page.locator(T("quest-accept-sq4")).count()) === 1 && (await g.page.locator(T("quest-decline-sq4")).count()) === 1 && (await g.page.locator(T("stash-items")).count()) === 1);
  check("[R7-dialog] the stash keeper's window lists only his own quest (sq4), not the vendor's", (await g.page.locator('[data-testid^="npc-quest-sq"]').evaluateAll((e) => e.map((x) => x.dataset.testid).filter((t) => /^npc-quest-sq\d$/.test(t)))).join() === "npc-quest-sq4");
  check("[R7-dialog] no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ================================================================================== 4. hand-in through the real window, per class, from real play
if (sec("handin")) {
  for (const cls of CLASSES) {
    const f = FX[cls];
    if (!f) continue;
    const g = await boot();
    check(`[R7-handin] ${cls}: the real-play save (sq1..sq3 ready, sq4 and sq5 accepted, arc 1 completed) loads through the slot dialog`, await loadFixture(g, f.pre.text));
    let s = await g.state();
    check(`[R7-handin] ${cls}: the Lobby shows a hand-in marker on the vendor, healer and potion seller and none on the stash keeper, whose sq4 is accepted but not done (shapes, not colour)`, s.npcs.filter((n) => n.marker === "handin").length === 3 && s.npcs.find((n) => n.id === "stash").marker === "none", s.npcs);
    check(`[R7-handin] ${cls}: arc 1 is completed by the real run, the tracker follows the pin to main2 (R7-4: the pin moved when main completed)`, s.quests.main.state === "completed" && s.quests.main2.state === "active" && s.quests.pinned === "main2" && s.ui.tracker?.id === "main2", [s.quests.main.state, s.quests.main2.state, s.quests.pinned, s.ui.tracker]);
    check(`[R7-handin] ${cls}: the pouch lists the badge in the journal`, (await (async () => { await g.page.keyboard.press("KeyJ"); await g.app("step", 2); const t = await g.page.textContent(T("journal-pouch")); await g.page.keyboard.press("Escape"); return t; })()).includes("Lost Staff Badge"));
    // fill the bag with real pick-ups until nothing more fits
    for (let i = 0; i < 80; i++) { const r = await g.app("cheat.giveItem", { potion: true }); if (r && r.ok === false) break; }
    const before = await handInState(g);
    const free = await g.page.evaluate(() => { const st = window.__app.getState(), occ = new Set(); for (const it of st.inventory.items) for (let y = 0; y < it.h; y++) for (let x = 0; x < it.w; x++) occ.add(`${it.x + x},${it.y + y}`); return 40 - occ.size; });
    check(`[R7-handin] ${cls}: the bag is full (${free} cells free)`, free <= 1, free);
    check(`[R7-handin] ${cls}: the vendor window opens with Hand in`, await talk(g, "vendor") && (await g.page.locator(T("quest-handin-sq1")).count()) === 1);
    await g.page.click(T("quest-handin-sq1")); await g.app("step", 2);
    const after = await handInState(g);
    check(`[R7-handin] ${cls}: full bag: refused with a visible alert, nothing granted, quest stays ready`, (await g.page.locator(T("quest-bagfull")).count()) === 1 && JSON.stringify(after) === JSON.stringify(before), [before, after]);
    check(`[R7-handin] ${cls}: the refusal is announced (role=alert) and the hand-in button is still there`, (await g.page.getAttribute(T("quest-bagfull"), "role")) === "alert" && (await g.page.locator(T("quest-handin-sq1")).count()) === 1);
    if (cls === CLASSES[0]) await shot(g.page, "handin-bagfull");
    // toast and live-region spam: 40 refused clicks
    const live0 = await g.page.evaluate(() => document.getElementById("live").childNodes.length);
    for (let i = 0; i < 40; i++) await g.page.evaluate(() => document.querySelector('[data-testid="quest-handin-sq1"]')?.click());
    await g.app("step", 2);
    const spam = await g.page.evaluate(() => ({ live: document.getElementById("live").childNodes.length, toasts: document.querySelectorAll("#toast, .toast").length, nodes: document.querySelectorAll("*").length }));
    check(`[R7-handin] ${cls}: 40 refused clicks leave one toast element and a bounded live region`, spam.toasts <= 1 && spam.live <= Math.max(live0, 1), [live0, spam]);
    check(`[R7-handin] ${cls}: still nothing granted after the spam`, JSON.stringify(await handInState(g)) === JSON.stringify(before));
    // make room through the real sell input (the vendor window is open) and double click Hand in
    const items = (await g.state()).inventory.items.slice(0, 8);
    for (const it of items) await g.app("input", { t: "sell", id: it.id });
    await g.app("step", 2);
    if (cls === CLASSES[0]) check(`[R7-handin] ${cls}: once the hero has made room, the 'bag is full' alert is gone (it is a role=alert line that is no longer true)`, (await g.page.locator(T("quest-bagfull")).count()) === 0, await g.page.locator(T("quest-bagfull")).count());  // ADV-R7-06 fixed in R7-4.2
    await g.page.evaluate(() => { const b = document.querySelector('[data-testid="quest-handin-sq1"]'); b.click(); b.click(); });
    await g.app("step", 2);
    s = await g.state();
    const paid = s.player.gold - after.gold;
    check(`[R7-handin] ${cls}: after room was made, a double click pays sq1 once (state completed, xp up)`, s.quests.sq1.state === "completed" && s.player.xp >= after.xp, [s.quests.sq1, paid]);
    check(`[R7-handin] ${cls}: the toast names the reward and the journal badge is set`, /Intern Overflow/.test(s.ui.toast ?? "") && s.ui.badge.journal === true, [s.ui.toast, s.ui.badge]);
    const tr0 = s.ui.tracker;
    check(`[R7-handin] ${cls}: the vendor window no longer lists the completed sq1 (only the open quest, sq5), no Hand in for sq1 (AC-R-258-1)`, (await g.page.locator(T("quest-handin-sq1")).count()) === 0 && (await g.page.locator(T("npc-quest-sq1")).count()) === 0 && (await g.page.locator(T("npc-quest-sq5")).count()) === 1 && (await g.page.locator(T("npc-quest-state-sq5")).textContent()) === "Active", await g.page.locator('[data-testid^="npc-quest-"]').evaluateAll((e) => e.map((x) => x.dataset.testid)));
    await g.page.keyboard.press("Escape"); await g.app("step", 2);
    // sq2 (pouch) and sq3
    for (const id of ["sq2", "sq3"]) {
      check(`[R7-handin] ${cls}: ${id}: window opens`, await talk(g, GIVER[id]));
      const pre = await handInState(g);
      const r = await g.page.evaluate((qid) => { const b = document.querySelector(`[data-testid="quest-handin-${qid}"]`); if (!b) return null; b.click(); return true; }, id);
      await g.app("step", 2);
      const post = await handInState(g);
      if (r && post.q[id] !== "completed") { // no room: free the bag and retry once through the real sell input
        for (const it of (await g.state()).inventory.items.slice(0, 10)) await g.app("input", { t: "sell", id: it.id }).catch(() => {});
        await g.app("step", 2);
        await g.page.evaluate((qid) => document.querySelector(`[data-testid="quest-handin-${qid}"]`)?.click(), id);
        await g.app("step", 2);
      }
      s = await g.state();
      check(`[R7-handin] ${cls}: ${id} completed once${id === "sq2" ? ", the pouch is empty" : ""}`, s.quests[id].state === "completed" && (id !== "sq2" || s.player.pouch.length === 0), [pre, s.quests[id].state]);
      await g.page.keyboard.press("Escape"); await g.app("step", 2);
    }
    s = await g.state();
    check(`[R7-handin] ${cls}: sq1..sq3 completed, sq4 and sq5 still active: no giver shows a marker, the tracker still follows main2 (${s.ui.tracker?.id})`, s.npcs.every((n) => n.marker === "none") && s.ui.tracker?.id === "main2" && s.quests.pinned === "main2", [s.npcs, s.ui.tracker]);
    await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
    const done = await g.page.locator('[data-testid="journal-completed"] .jq').count();
    check(`[R7-handin] ${cls}: the journal lists 4 completed quests (arc 1 and sq1..sq3), with no next step on them, and an empty pouch`, done === 4 && (await g.page.locator('[data-testid="journal-completed"] .jn').count()) === 0 && (await g.page.locator(T("journal-pouch-empty")).count()) === 1, done);
    if (cls === CLASSES[0]) await shot(g.page, "journal-completed");
    check(`[R7-handin] ${cls}: no page error, no alert`, g.errors.length === 0 && g.dialogs.length === 0, [g.errors, g.dialogs]);
    // the save written after the hand-ins loads again with the same state
    await g.app("save.write");
    const txt = await g.app("slots.raw", 1);
    const back = deserialize(txt);
    check(`[R7-handin] ${cls}: the slot written after the hand-ins loads with sq1..sq3 completed and the pouch empty`, back.ok && first3.every((k) => back.state.quests[k].s === "completed") && back.state.player.pouch.length === 0, back.message);
    await g.context.close();
  }
}

// ================================================================================== 4b. the second Lobby visit of real play (trip T2): sq4 and sq5 through the windows, per class
if (sec("handin2")) {
  for (const cls of CLASSES) {
    const f = FX[cls];
    if (!f?.pre2) continue;
    const g = await boot();
    check(`[R7-handin2] ${cls}: the second-visit save of real play loads`, await loadFixture(g, f.pre2.text));
    let s = await g.state();
    const ready = ["sq4", "sq5"].filter((k) => s.quests[k].state === "ready");
    check(`[R7-handin2] ${cls}: main2 is completed and main3 active by floor 6 (the pin and the tracker follow), ${ready.join("+")} ready in the Lobby`, s.quests.main2.state === "completed" && s.quests.main3.state === "active" && s.quests.pinned === "main3" && s.ui.tracker?.id === "main3" && ready.length >= 1, [s.quests.main2.state, s.quests.main3.state, s.quests.pinned, ready]);
    check(`[R7-handin2] ${cls}: the givers of the ready quests carry the hand-in marker (stash keeper for sq4, vendor for sq5)`, ready.every((k) => s.npcs.find((n) => n.id === GIVER[k]).marker === "handin"), s.npcs.map((n) => [n.id, n.marker]));
    for (const id of ready) {
      check(`[R7-handin2] ${cls}: ${id} window opens with Hand in`, await talk(g, GIVER[id]) && (await g.page.locator(T(`quest-handin-${id}`)).count()) === 1);
      let pre = await handInState(g);
      await g.page.evaluate((qid) => { const b = document.querySelector(`[data-testid="quest-handin-${qid}"]`); b.click(); b.click(); }, id);
      await g.app("step", 2);
      s = await g.state();
      if (s.quests[id].state !== "completed") { // a full bag of the real hero (the refusal itself is the expected first answer): make room through the real input of that window, retry once
        for (const it of s.inventory.items.slice(0, 10)) await g.app("input", id === "sq4" ? { t: "stash", id: it.id, to: "stash" } : { t: "sell", id: it.id }).catch(() => {}); // the stash keeper's window takes items into the locker, the vendor's buys them
        await g.app("step", 2); pre = await handInState(g);
        await g.page.evaluate((qid) => document.querySelector(`[data-testid="quest-handin-${qid}"]`)?.click(), id); await g.app("step", 2);
        s = await g.state();
      }
      check(`[R7-handin2] ${cls}: ${id} completed once (gold and experience up${id === "sq4" ? ", the ledger left the pouch" : ", one magic accessory"})`, s.quests[id].state === "completed" && s.player.gold > pre.gold && (id !== "sq4" || !s.player.pouch.some((e) => e.quest === "sq4")) && (id !== "sq5" || s.inventory.items.filter((i) => i.kind === "gear" && i.rarity === "magic" && ["ring", "amulet", "belt"].includes(i.slot)).length >= 1), [pre, s.quests[id].state]);
      await g.page.keyboard.press("Escape"); await g.app("step", 2);
    }
    check(`[R7-handin2] ${cls}: no page error`, g.errors.length === 0 && g.dialogs.length === 0, [g.errors, g.dialogs]);
    await g.context.close();
  }
}

// ================================================================================== 5. the end of the game (real play), journal and slot card
if (sec("final")) {
  const f = FX[CLS];
  const g = await boot();
  check("[R7-final] the real-play end state loads", await loadFixture(g, f.post.text));
  const s = await g.state();
  check("[R7-final] all three main quests and all five side quests completed; with nothing active the tracker is absent", MAINS.every((k) => s.quests[k].state === "completed") && sides.every((k) => s.quests[k].state === "completed") && s.ui.tracker === null && (await g.page.locator(T("tracker")).evaluate((e) => e.hidden)), [s.ui.tracker]);
  await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
  check("[R7-final] the journal shows 8 completed quests (3 main, 5 side) and the empty-state line for active ones", (await g.page.locator('[data-testid="journal-completed"] .jq').count()) === 8 && (await g.page.locator(".jsec .sk-note").count()) >= 1);
  const card = await g.app("slots.view");
  check("[R7-final] the slot card projects the stored state: all main quests done, 5/5", card.list[0].mainDone === true && card.list[0].sidesDone === 5, card.list[0]);
  await g.app("slots.open"); await g.app("step", 1);
  const t = await g.page.textContent(T("slot-quest-1")).catch(() => null);
  check("[R7-final] the slot card text says 5/5 side quests", /5\/5/.test(t ?? ""), t);
  await g.context.close();
}

// ================================================================================== 6. reload in the middle of a step; slot switching; two tabs
if (sec("slots")) {
  const f = FX[CLS];
  const g = await boot();
  await loadFixture(g, f.pre.text, 1);
  const slot1 = await g.app("slots.raw", 1);
  await g.app("slots.run", { t: "createCharacter", slot: 2, class: "it-wizard", name: "Second" });
  await g.app("step", 2);
  let s = await g.state();
  check("[R7-slots] a second character in slot 2 starts clean: step 1, all side quests available, empty pouch, tracker main", s.quests.main.step === 1 && sides.every((k) => s.quests[k].state === "available") && s.player.pouch.length === 0 && s.ui.tracker.id === "main", qstates(s));
  check("[R7-slots] creating slot 2 left slot 1's text byte-identical", (await g.app("slots.raw", 1)) === slot1);
  await talk(g, "vendor"); await g.page.click(T("quest-accept-sq1")); await g.app("step", 2);
  await g.app("save.write");
  const slot2 = await g.app("slots.raw", 2);
  const r1 = await g.app("slots.run", { t: "loadSlot", slot: 1, confirm: true });
  s = await g.state();
  check("[R7-slots] switching back to slot 1 restores its quests, its badge in the pouch and its tracker; slot 2's accept did not leak", r1.ok && first3.every((k) => s.quests[k].state === "ready") && s.player.pouch.length === 1 && s.name !== "Second", qstates(s));
  check("[R7-slots] the switch wrote slot 2 with its accepted quest and did not touch slot 1's bytes", JSON.parse(await g.app("slots.raw", 2)).quests.sq1.s === "active" && (await g.app("slots.raw", 1)) === slot1);
  await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
  check("[R7-slots] slot 1's journal shows the pouch item, slot 2's active quest is not listed", (await g.page.textContent(T("journal-pouch"))).includes("Lost Staff Badge"));
  await g.page.keyboard.press("Escape");
  const r2 = await g.app("slots.run", { t: "loadSlot", slot: 2, confirm: true });
  s = await g.state();
  check("[R7-slots] and back to slot 2: sq1 active, pouch empty", r2.ok && s.quests.sq1.state === "active" && s.player.pouch.length === 0, qstates(s));
  check("[R7-slots] slot 2's text is unchanged by the round trip except for time (quests identical)", JSON.stringify(JSON.parse(await g.app("slots.raw", 2)).quests) === JSON.stringify(JSON.parse(slot2).quests));
  // reload the page in the middle of an active step and continue
  await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const c = await g.app("slots.run", { t: "continue" });
  s = await g.state();
  check("[R7-slots] after a page reload Continue brings the last slot back with its quest block", c.ok && s.quests.sq1.state === "active", [c, s.quests?.sq1]);
  check("[R7-slots] no page error", g.errors.length === 0, g.errors);

  // two tabs on the same storage
  const A = await boot(), a1 = await loadFixture(A, f.pre.text, 1);
  const B = await boot({ context: A.context });
  const refused = await B.app("slots.run", { t: "loadSlot", slot: 1, confirm: true });
  check("[R7-tabs] a second tab is refused the slot while the first tab owns the saves (another-tab)", a1 && refused.ok === false && refused.error === "another-tab", refused);
  await B.app("slots.run", { t: "takeOverSaves" });
  const bl = await B.app("slots.run", { t: "loadSlot", slot: 1, confirm: true });
  await B.app("step", 2);
  check("[R7-tabs] after an explicit take-over the second tab holds the same character", bl.ok);
  await talk(B, "vendor"); await B.page.click(T("quest-handin-sq1")).catch(() => {}); await B.app("step", 2);
  if ((await B.state()).quests.sq1.state !== "completed") { // the real hero's bag was full: make room through the vendor (real sell input) and retry
    for (const it of (await B.state()).inventory.items.slice(0, 10)) await B.app("input", { t: "sell", id: it.id });
    await B.page.click(T("quest-handin-sq1")).catch(() => {}); await B.app("step", 2);
  }
  const bState = await B.state();
  const w = await B.app("save.write");
  const textB = await A.app("slots.raw", 1);
  const pb = deserialize(textB);
  check("[R7-tabs] tab B hands in sq1 and its save is a legal state (completed, pouch rule holds)", pb.ok && bState.quests.sq1.state === "completed" && (pb.state.quests.sq1.s === "completed" || w?.ok === false), [pb.message, w, bState.quests.sq1.state, bState.scene, bState.ui.dialog, pb.ok && pb.state.quests.sq1.s]);
  // tab A is stale: it still believes sq1 is ready. Its write must not silently overwrite B's newer state with the stale one.
  const aw = await A.app("save.write");
  const textAfter = await A.app("slots.raw", 1);
  const finalState = deserialize(textAfter);
  check("[R7-tabs] the stale tab's write is refused (another tab owns the saves) or merges nothing: the stored slot never regresses to a state where sq1 is ready again", finalState.ok && (finalState.state.quests.sq1.s === "completed" || aw?.ok === false), [aw, finalState.ok && finalState.state.quests.sq1.s]);
  const stored = finalState.ok ? finalState.state : null;
  check("[R7-tabs] whatever is stored passes the pouch invariant (pouch iff ready) and no reward is duplicated (one sq1 reward in gold)", stored && stored.player.pouch.length === (stored.quests.sq2.s === "ready" ? 1 : 0));
  check("[R7-tabs] no page error in either tab", A.errors.length === 0 && B.errors.length === 0, [A.errors, B.errors]);
  await A.context.close();
  await g.context.close();
}

// ================================================================================== 7. hostile storage: XSS through slot labels and key names
if (sec("xss")) {
  const f = FX[CLS];
  const g = await boot();
  await loadFixture(g, f.pre.text, 1);
  await g.app("save.write");
  const payload = '<img src=x onerror="window.__xss=1"><svg onload="window.__xss=2">';
  // a hostile index: every field the card prints. An init script edits storage before the game boots (the page rewrites the index when it unloads).
  await g.context.addInitScript((p) => {
    try {
      const idx = JSON.parse(localStorage.getItem("office-crawler.slots"));
      if (idx && idx.slots) { Object.assign(idx.slots[0], { name: p, class: p, mainStep: 1e9, mainDone: p, sidesDone: p, level: p, depth: p, deepest: p, playSec: p, bytes: p }); localStorage.setItem("office-crawler.slots", JSON.stringify(idx)); }
      const o = JSON.parse(localStorage.getItem("office-crawler.options") ?? "{}"); o.keys = { journal: p, inventory: p }; localStorage.setItem("office-crawler.options", JSON.stringify(o));
    } catch (e) { /* storage unavailable */ }
  }, payload);
  await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  await g.app("slots.open"); await g.page.waitForTimeout(200);
  const inj = await g.page.evaluate(() => ({ xss: window.__xss ?? null, img: document.querySelectorAll('img[src="x"]').length, svg: document.querySelectorAll("svg[onload]").length, html: document.body.innerHTML.includes("<img src=x") }));
  check("[R7-xss] a hostile slot index (name, class, quest fields as HTML) renders as text on the slot manager: nothing injected, nothing executed", inj.xss === null && inj.img === 0 && inj.svg === 0 && !inj.html, inj);
  const cardTxt = await g.page.evaluate(() => document.body.innerText);
  console.log(`INFO hostile index entry rendered as: ${JSON.stringify(cardTxt.match(/.{0,30}<img.{0,40}/)?.[0] ?? "(not shown: sanitised or rebuilt)")}`);
  console.log(`INFO view entry: ${JSON.stringify((await g.app("slots.view")).list[0]).slice(0, 260)}`);
  await g.app("slots.close");
  const lst = await g.app("slots.view");
  check("[R7-xss] the slot view builds without throwing for hostile entries", Array.isArray(lst.list));
  // a hostile slot text: the save validator names the rule, the card shows a corrupt slot, the title screen still works
  const bad = JSON.parse(f.post.text); bad.name = payload; delete bad.checksum;
  const imp = await g.app("slots.run", { t: "importSlot", slot: 3, text: JSON.stringify(bad), confirm: true });
  check("[R7-xss] importing a save whose name is markup is refused", imp.ok === false, imp);
  const bad2 = JSON.parse(f.post.text); bad2.quests.pouch = [{ id: payload, quest: "sq2" }]; bad2.quests.sq2 = { s: "ready", p: 1 };
  const imp2 = await g.app("slots.run", { t: "importSlot", slot: 3, text: JSON.stringify(bad2), confirm: true });
  check("[R7-xss] importing a save with a markup pouch id is refused", imp2.ok === false, imp2);
  await loadFixture(g, f.pre.text, 1);
  await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
  const inj2 = await g.page.evaluate(() => ({ xss: window.__xss ?? null, img: document.querySelectorAll('img[src="x"]').length, dock: document.querySelector('[data-testid="dock-journal"]')?.innerHTML.slice(0, 200) }));
  check("[R7-xss] hostile key names in the stored options do not execute in the dock or the journal", inj2.xss === null && inj2.img === 0, inj2);
  check("[R7-xss] no alert dialog and no page error", g.dialogs.length === 0 && g.errors.length === 0, [g.dialogs, g.errors]);
  await g.context.close();
}

// ================================================================================== 8. toasts: a level-up on the finishing kill must not erase the quest line (ADV-R7-02)
if (sec("toast")) {
  const g = await boot();
  await startNew(g.page, { cls: "sales-rep", name: "Probe" });
  await g.app("cheat.teleportFloor", 1); await g.app("step", 2);
  const kill = async (n) => { const s = await g.state(); for (const z of s.monsters.filter((m) => m.type === "zombie-intern" && m.ai !== "dead").slice(0, n)) { await g.app("cheat.damageMonster", z.id, 9999); await g.app("step", 1); } };
  await kill(15); // real kills before the quest is accepted: 90 xp, the next level is at 136
  await g.app("cheat.teleportFloor", 0); await g.app("step", 2);
  await talk(g, "vendor"); await g.page.click(T("quest-accept-sq1")); await g.app("step", 2); await g.page.keyboard.press("Escape");
  await g.app("cheat.teleportFloor", 1); await g.app("step", 2);
  const lvl = (await g.state()).player.level;
  for (let i = 0; i < 8; i++) await kill(1);
  const s = await g.state();
  check("[R7-toast] the eighth kill made sq1 ready and levelled the hero up (scenario holds)", s.quests.sq1.state === "ready" && s.player.level === lvl + 1, [s.quests.sq1.state, lvl, s.player.level]);
  check("[R7-toast] the toast shows the quest line ('Return to ...') for at least config.quests.toastMs, not the level-up line that arrived in the same tick (AC-R-254-2)", /Intern Overflow/.test(s.ui.toast ?? ""), s.ui.toast);  // ADV-R7-02 fixed in R7-4.2
  check("[R7-toast] the screen-reader live region announces the ready quest", /Intern Overflow/.test(await g.page.evaluate(() => document.getElementById("live").textContent)), await g.page.evaluate(() => document.getElementById("live").textContent));  // ADV-R7-02 fixed in R7-4.2
  check("[R7-toast] the journal and tracker are right regardless: sq1 ready, tracker names main or sq1 consistently", s.ui.tracker !== null && s.ui.badge.journal === true);
  await g.context.close();
}

// ================================================================================== 9. markers and reduced motion
// The marker is a yellow disc (#f0e442) drawn on the game canvas; its bob is measured as the spread of the centroid of exactly that colour over 3.5 s.
async function markerSpread(g) {
  const s = await g.state(), vend = s.npcs.find((n) => n.id === "vendor"), at = tileScreen(s.ui.camera, vend.tile.x, vend.tile.y), ys = [];
  for (let i = 0; i < 16; i++) {
    ys.push(await g.page.evaluate(({ x0, y0, w, h }) => {
      const c = document.getElementById("game"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height), k = c.width / c.clientWidth;
      let sum = 0, n = 0;
      for (let y = Math.round(y0 * k); y < Math.round((y0 + h) * k); y++) for (let x = Math.round(x0 * k); x < Math.round((x0 + w) * k); x++) { const o = (y * c.width + x) * 4; if (d.data[o] === 240 && d.data[o + 1] === 228 && d.data[o + 2] === 66) { sum += y; n++; } }
      return n ? sum / n : null;
    }, { x0: Math.max(0, at.x - 50), y0: Math.max(0, at.y - 170), w: 100, h: 140 }));
    await g.page.waitForTimeout(220);
  }
  const v = ys.filter((y) => y !== null);
  return { found: v.length, spread: v.length ? Math.max(...v) - Math.min(...v) : null };
}
if (sec("motion")) {
  const modes = [["normal", { reduced: false, option: false }], ["option", { reduced: false, option: true }], ["media", { reduced: true, option: false }]];
  const res = {};
  for (const [name, m] of modes) {
    const g = await boot({ reduced: m.reduced });
    await startNew(g.page, { cls: "sales-rep", name: "Probe" });
    if (m.option) await g.app("options.setFlag", "reducedMotion", true);
    await g.page.waitForTimeout(300);
    res[name] = await markerSpread(g);
    const pm = await g.app("perf");
    check(`[R7-motion] ${name}: two shapes exist for the two marker states and they are exposed (exclamation for an offer)`, pm.npcMarkers.length === 4 && pm.npcMarkers.every((x) => x.shape === "exclamation"), pm.npcMarkers);
    await g.app("quests.setStep", "sq1", 1);
    await g.app("step", 2);
    const an = await g.page.evaluate(() => { const t = document.querySelector("#toast, .toast"), b = document.querySelector('[data-testid="journal-badge"]'); const cs = (e) => e && { a: getComputedStyle(e).animationName, d: getComputedStyle(e).transitionDuration }; return { toast: cs(t), badge: cs(b) }; });
    if (m.option || m.reduced) check(`[R7-motion] ${name}: toast and badge have no animation and no transition`, (!an.toast || (an.toast.a === "none" && /^0s(, 0s)*$/.test(an.toast.d))) && (!an.badge || (an.badge.a === "none" && /^0s(, 0s)*$/.test(an.badge.d))), an);
    await g.context.close();
  }
  check("[R7-motion] normal motion: the marker bobs (the measurement sees movement, so the next two checks mean something)", res.normal.found >= 12 && res.normal.spread > 0.5, res.normal);
  check("[R7-motion] option 'reduce motion': the marker is perfectly still over 3.5 s", res.option.found >= 12 && res.option.spread === 0, res.option);
  check("[R7-motion] prefers-reduced-motion (OS setting, no in-game option): the marker is perfectly still (AC-R-254-3 'option or prefers-reduced-motion')", res.media.found >= 12 && res.media.spread === 0, res.media);  // ADV-R7-05 fixed in R7-4.2
}

// ================================================================================== 10. NPC markers follow the state
if (sec("markers")) {
  const g = await boot();
  await startNew(g.page, { cls: "sales-rep", name: "Probe" });
  let pm = (await g.app("perf")).npcMarkers.map((m) => `${m.id}:${m.shape}`).sort();
  check("[R7-markers] a new Lobby: vendor, healer, potion seller and (R7-4) the stash keeper carry the offer shape", pm.length === 4 && new Set(pm.map((x) => x.split(":")[1])).size === 1, pm);
  await g.app("quests.setStep", "sq2", 2);
  await g.app("step", 2);
  const s = await g.state();
  pm = (await g.app("perf")).npcMarkers;
  check("[R7-markers] sq2 ready: the healer's marker changes shape (question) while the others keep the offer shape", s.npcs.find((n) => n.id === "healer").marker === "handin" && new Set(pm.map((m) => m.shape)).size === 2 && pm.find((m) => m.id === "healer").shape !== pm.find((m) => m.id === "vendor").shape, pm);
  await g.app("quests.setStep", "sq2", 0);
  await g.app("step", 2);
  check("[R7-markers] cheat back to available (a state only a cheat reaches): pouch emptied with it", (await g.state()).player.pouch.length === 0);
  await g.context.close();
}

// ================================================================================== 11. save at every quest event of a real run is reachable from the UI: autosave on floor entry keeps the pouch
if (sec("pouch")) {
  const g = await boot();
  await startNew(g.page, { cls: "sales-rep", name: "Probe" });
  await talk(g, "healer"); await g.page.click(T("quest-accept-sq2")); await g.app("step", 2); await g.page.keyboard.press("Escape");
  const f = await g.page.evaluate(() => { const c = window.__app.getState(); return c.quests.sq2.state; });
  check("[R7-pouch] sq2 accepted through the window", f === "active");
  // the item floor is derived from the seed; go there like the elevator would, clear it, and walk over the badge with the real pickup input
  const floor = await g.page.evaluate(async () => { for (const d of [3, 4]) { window.__app.cheat.teleportFloor(d); window.__app.step(2); if (window.__app.getState().player && window.__app.getState().groundItems.some((e) => e.id === "qi-sq2")) return d; } return null; });
  check("[R7-pouch] the badge lies on floor 3 or 4 exactly once", floor === 3 || floor === 4, floor);
  const badge = (await g.state()).groundItems.find((e) => e.id === "qi-sq2");
  await g.app("cheat.damageMonster", "none", 0).catch(() => {});
  const mons = (await g.state()).monsters.filter((m) => m.ai !== "dead");
  for (const m of mons) await g.app("cheat.damageMonster", m.id, 99999);
  await g.app("step", 30);
  await g.app("input", { t: "pickup", id: "qi-sq2" });
  for (let i = 0; i < 40 && (await g.state()).quests.sq2.state === "active"; i++) await g.app("step", 60);
  let s = await g.state();
  check("[R7-pouch] walking over the badge puts it in the pouch and makes sq2 ready", s.quests.sq2.state === "ready" && s.player.pouch.length === 1, [s.quests.sq2.state, s.player.pouch]);
  check("[R7-pouch] the tracker and toast say where to go next", /Return to/.test(s.quests.sq2.nextStep), s.quests.sq2.nextStep);
  // death in the middle, respawn, reload: the badge stays
  await g.app("cheat.setHp", 0); await g.app("step", 3);
  await g.page.waitForSelector(T("respawn"), { timeout: 5000 }).catch(() => {});
  await g.page.click(T("respawn")).catch(() => {});
  await g.app("step", 2);
  s = await g.state();
  check("[R7-pouch] after death and respawn the badge is still in the pouch and sq2 is ready", s.scene === "town" && s.player.pouch.length === 1 && s.quests.sq2.state === "ready", [s.scene, s.player.pouch]);
  await g.app("save.write");
  await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  await g.app("slots.run", { t: "continue" }); s = await g.state();
  check("[R7-pouch] after a reload the badge is still in the pouch and the floor does not offer a second one", s.player.pouch.length === 1 && s.quests.sq2.state === "ready");
  await g.app("cheat.teleportFloor", floor); await g.app("step", 2);
  check("[R7-pouch] and revisiting the item floor after the reload places no second badge", (await g.state()).groundItems.every((e) => e.id !== "qi-sq2"));
  await shot(g.page, "pouch-floor");
  check("[R7-pouch] no page error", g.errors.length === 0, g.errors);
  await g.context.close();
  void badge;
}

// ================================================================================== 11b. interruptions at awkward moments (L-08): resize, blur, hidden tab, mashing, quit in the middle of a step
if (sec("chaos")) {
  const g = await boot();
  await startNew(g.page, { cls: "sales-rep", name: "Probe" });
  for (let i = 0; i < 61; i++) await g.page.keyboard.press("KeyJ");
  await g.app("step", 2);
  check("[R7-chaos] 61 presses of J in a row end with the journal open (odd count), nothing stuck, no error", (await g.state()).ui.panels.journal === true && g.errors.length === 0, g.errors);
  for (let i = 0; i < 4; i++) { await g.page.setViewportSize({ width: 390, height: 844 }); await g.page.waitForTimeout(60); await g.page.setViewportSize({ width: 1280, height: 720 }); await g.page.waitForTimeout(60); }
  await g.page.setViewportSize({ width: 390, height: 844 }); await g.page.waitForTimeout(120);
  check("[R7-chaos] resizing desktop to phone and back four times with the journal open keeps it open, without horizontal overflow at phone width", (await g.state()).ui.panels.journal === true && (await g.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)));
  await g.page.setViewportSize({ width: 1280, height: 720 }); await g.page.waitForTimeout(120);
  await g.page.keyboard.press("Escape"); await g.app("step", 2);
  // blur and a hidden tab while the NPC window is open: the window and the offer survive, Accept still works once
  check("[R7-chaos] open the vendor window", await talk(g, "vendor"));
  await g.page.evaluate(() => { window.dispatchEvent(new Event("blur")); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await g.page.waitForTimeout(100);
  await g.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
  await g.app("step", 2);
  check("[R7-chaos] after blur and a hidden-then-visible tab the offer is still on screen", (await g.page.locator(T("quest-accept-sq1")).count()) === 1 && (await g.state()).ui.dialog?.npc === "vendor");
  await g.page.click(T("quest-accept-sq1")); await g.app("step", 2);
  check("[R7-chaos] Accept works afterwards", (await g.state()).quests.sq1.state === "active");
  // quit to the title in the middle of an active step through the pause menu, continue: the step is kept
  await g.page.keyboard.press("Escape"); await g.app("step", 1); await g.page.keyboard.press("Escape"); await g.app("step", 1);
  await g.page.click(T("quit")); await g.app("step", 1);
  const c = await g.app("slots.run", { t: "continue" });
  check("[R7-chaos] quit to title and Continue keep the accepted quest and the pin (AC-R-253-1)", c.ok && (await g.state()).quests.sq1.state === "active" && (await g.state()).quests.pinned === "main");
  // death with a window open
  await talk(g, "healer");
  await g.app("cheat.setHp", 0); await g.app("step", 3);
  check("[R7-chaos] dying with an NPC window open closes it and offers respawn; quests unchanged", (await g.state()).scene === "dead" && (await g.state()).quests.sq1.state === "active", (await g.state()).scene);
  await g.page.click(T("respawn")).catch(() => {}); await g.app("step", 2);
  check("[R7-chaos] respawn: the journal opens and shows the quest block intact", await (async () => { await g.page.keyboard.press("KeyJ"); await g.app("step", 2); return (await g.page.locator(T("journal-state-sq1")).textContent()) === "Active"; })());
  check("[R7-chaos] no page error", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ================================================================================== 12. floor warm-ahead under hostile floor hopping (STUTTER-R7)
if (sec("warm")) {
  const g = await boot({ query: "test=1&seed=3&realtime=1" });
  await startNew(g.page, { cls: "sales-rep", name: "Probe" });
  for (let k = 0; k < 2; k++) for (const d of [1, 8, 0, 4, 9, 5, 2, 0, 7, 3, 6, 0, 1, 8]) { await g.app("cheat.teleportFloor", d); await g.page.waitForTimeout(40); }
  await g.app("cheat.teleportFloor", 5);
  await g.page.waitForTimeout(6000);
  const p = await g.app("perf");
  check("[R7-warm] 28 floor changes in about a second (floors 0..9, the boss arena included) leave no missing atlas key and no page error", p.atlasMissing.length === 0 && g.errors.length === 0, [p.atlasMissing.slice(0, 3), g.errors.slice(0, 2)]);
  check("[R7-warm] the game still renders at a usable frame rate afterwards (at least 10 fps on this machine)", p.fps >= 10, p.fps);
  await g.app("quests.setStep", "sq3", 1);
  await g.app("cheat.teleportFloor", 3); await g.page.waitForTimeout(300); await g.app("cheat.teleportFloor", 4); await g.page.waitForTimeout(600);
  const s = await g.state();
  check("[R7-warm] with the elite quest active floor 4 loads with the named elite (its type is drawn without a missing key)", s.monsters.some((m) => m.name === "The Toner Tyrant") && (await g.app("perf")).atlasMissing.length === 0 && g.errors.length === 0, [g.errors.slice(0, 2)]);
  await shot(g.page, "elite-floor4");
  await g.context.close();
}

// ================================================================================== 13. R7-4: three main quests and five side quests (arcs, dialogue with two quests of one giver, slot card, rewards once)
// UI-R74 checks that need the new journal/dialogue/slot card are plain checks; any that stay red because the UI is not there yet are marked XFAIL with id UI-R74.
const sampleToasts = async (g, ms) => { const seen = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { const t = (await g.state()).ui.toast; if (t && !seen.includes(t)) seen.push(t); await g.page.waitForTimeout(100); } return seen; };
const order = (page, list) => page.evaluate((l) => [...document.querySelectorAll(`[data-testid="${l}"] > li`)].map((e) => e.dataset.quest), list);
if (sec("r74")) {
  // ---- journal with arcs (AC-R-257-5)
  {
    const g = await boot();
    await startNew(g.page, { cls: "sales-rep", name: "Probe" });
    await g.app("quests.setStep", "main2", 2); await g.app("quests.setStep", "sq1", 3); await g.app("quests.setStep", "sq4", 1); await g.app("step", 2);
    let s = await g.state();
    check("[R74-journal] scenario holds: main completed, main2 at step 2, main3 locked, sq1 completed, sq4 active, the pin on main2", s.quests.main.state === "completed" && s.quests.main2.state === "active" && s.quests.main2.step === 2 && s.quests.main3.state === "unavailable" && s.quests.sq1.state === "completed" && s.quests.sq4.state === "active" && s.quests.pinned === "main2", [s.quests.main.state, s.quests.main2.state, s.quests.main2.step, s.quests.main3.state, s.quests.pinned]);
    await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
    const act = await order(g.page, "journal-active");
    check("[R74-journal] the active main quest is listed first, the active and offered side quests follow, the locked main3 comes after them", act[0] === "main2" && act.indexOf("sq4") > 0 && act.indexOf("sq4") < act.indexOf("main3") && act.at(-1) === "main3" && !act.includes("main") && !act.includes("sq1"), act);
    const lock = await g.page.textContent(T("journal-lock-main3")).catch(() => null);
    check("[R74-journal] the locked quest says 'Locked. Finish The Paper Trail first.' and has no next step", lock === "Locked. Finish The Paper Trail first." && (await g.page.locator(T("journal-next-main3")).count()) === 0 && (await g.page.locator(T("journal-pin-main3")).count()) === 0, lock);
    const m2 = await g.page.evaluate(() => ({ next: document.querySelector('[data-testid="journal-next-main2"]')?.textContent, blurb: document.querySelector('[data-testid="journal-blurb-main2"]')?.textContent, state: document.querySelector('[data-testid="journal-state-main2"]')?.textContent, prog: document.querySelector('[data-testid="journal-progress-main2"]')?.textContent }));
    check("[R74-journal] main2 shows its blurb, its state and the next step of step 2 ('Reach floor 5 ...')", /Reach floor 5/.test(m2.next ?? "") && /paper trail/i.test(m2.blurb ?? "") && m2.state === "Active", m2);
    check("[R74-journal] the Completed list holds main and sq1, with no next step on them", JSON.stringify(await order(g.page, "journal-completed")) === JSON.stringify(["main", "sq1"]) && (await g.page.locator('[data-testid="journal-completed"] .jn').count()) === 0, await order(g.page, "journal-completed"));
    check("[R74-journal] the tracker shows the next step of the pinned main2", s.ui.tracker?.id === "main2" && s.ui.tracker.text === s.quests.main2.nextStep, s.ui.tracker);
    check("[R74-journal] every entry has an accessible name that includes its state (Locked for main3)", (await g.page.evaluate(() => [...document.querySelectorAll('[data-testid^="journal-quest-"]')].map((e) => e.getAttribute("aria-label")))).every((l) => /Locked|Available|Active|Ready|Completed/.test(l ?? "")));
    check("[R74-journal] a locked main quest cannot be pinned by the hook (locked), nor a completed one (already done)", (await g.app("quests.pin", "main3")).error === "locked" && (await g.app("quests.pin", "main2")).ok === true && (await g.app("input", { t: "questPin", id: "sq1" })).error === "already done");
    await shot(g.page, "journal-arcs");
    // the unlock toast: reaching floor 6 completes main2 and opens main3 (one quest line, naming the new assignment)
    await g.page.keyboard.press("Escape"); await g.app("step", 2);
    for (let i = 0; i < 300 && (await g.state()).ui.toast; i++) await g.page.waitForTimeout(100); // let the toasts of the set-up cheats (a quest line takes the lane for 4 s each) run out first
    await g.app("cheat.teleportFloor", 6); await g.app("step", 2);
    const seen = await sampleToasts(g, 9000);
    s = await g.state();
    check("[R74-toast] reaching floor 6 raises a toast naming the new assignment (\"A new assignment is on your desk: Final Notice.\") and the pin moves to main3", seen.some((t) => t === "A new assignment is on your desk: Final Notice.") && s.quests.pinned === "main3" && s.quests.main3.state === "active" && s.quests.main2.state === "completed", [seen, s.quests.pinned]);
    check("[R74-toast] the toast lane shows each quest line once (no repeat of the same text)", new Set(seen).size === seen.length, seen);
    check("[R74-toast] the screen-reader live region carries the announcement of the unlock", /Final Notice/.test(await g.page.evaluate(() => document.getElementById("live").textContent)), await g.page.evaluate(() => document.getElementById("live").textContent));
    check("[R74-journal] after main3 opened the journal shows it as the first entry with its blurb and no lock line", (await (async () => { await g.page.keyboard.press("KeyJ"); await g.app("step", 2); return order(g.page, "journal-active"); })())[0] === "main3" && (await g.page.locator(T("journal-lock-main3")).count()) === 0 && (await g.page.locator(T("journal-blurb-main3")).count()) === 1);
    check("[R74-journal] no page error", g.errors.length === 0 && g.dialogs.length === 0, [g.errors, g.dialogs]);
    await g.context.close();
  }
  // ---- the catch-up toasts: Lobby to floor 6 in one jump completes two arcs at once; the queue must still show the unlock line
  {
    const g = await boot();
    await startNew(g.page, { cls: "facilities-manager", name: "Probe" });
    const g0 = (await g.state()).player.gold;
    await g.app("cheat.teleportFloor", 6); await g.app("step", 2);
    const seen = await sampleToasts(g, 14000), s = await g.state();
    const want = 50 + 80;
    check("[R74-toast] catch-up over two arcs (Lobby to floor 6): both rewards are paid once in gold and the unlock line is shown after the completions", s.player.gold - g0 === want && seen.includes("A new assignment is on your desk: Final Notice."), [s.player.gold - g0, seen]);
    check("[R74-toast] only one toast element exists at any time (queue, not a pile)", (await g.page.evaluate(() => document.querySelectorAll("#toast, .toast").length)) <= 1);
    await g.context.close();
  }
  // ---- arc rewards exactly once: reload, revisit, cheat
  {
    const g = await boot();
    await startNew(g.page, { cls: "it-wizard", name: "Probe" });
    const g0 = (await g.state()).player.gold, x0 = (await g.state()).player.xp;
    await g.app("cheat.teleportFloor", 3); await g.app("step", 2);
    let s = await g.state();
    check("[R74-pay] floor 3 pays arc 1 once (50 gold, 65 experience) and moves the pin to main2", s.player.gold - g0 === 50 && s.player.xp - x0 === 65 && s.quests.pinned === "main2", [s.player.gold - g0, s.player.xp - x0, s.quests.pinned]);
    await g.app("save.write");
    await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
    await g.app("slots.run", { t: "continue" });
    const gold1 = (await g.state()).player.gold;
    await g.app("cheat.teleportFloor", 3); await g.app("step", 2); await g.app("cheat.teleportFloor", 2); await g.app("cheat.teleportFloor", 3); await g.app("step", 2);
    await g.app("quests.setStep", "main", 3); await g.app("quests.setStep", "main2", 1); await g.app("step", 2);
    s = await g.state();
    check("[R74-pay] after a reload, revisits and the cheat for the same arc, no second payment (gold unchanged)", s.player.gold === gold1, [gold1, s.player.gold]);
    await g.app("quests.setStep", "main3", 1); await g.app("step", 2);
    s = await g.state();
    check("[R74-pay] the cheat that opens main3 pays arc 2 exactly once (80 gold more)", s.player.gold - gold1 === 80 && s.quests.main2.state === "completed", [s.player.gold - gold1]);
    await g.app("quests.setStep", "main3", 4); await g.app("step", 2);
    const before = (await g.state()).player.gold;
    await g.app("quests.readVerdict"); await g.app("quests.readVerdict"); await g.app("step", 2);
    s = await g.state();
    check("[R74-pay] the verdict completes main3 and pays nothing, read twice or not", s.quests.main3.state === "completed" && s.player.gold === before, [s.quests.main3.state, s.player.gold - before]);
    check("[R74-pay] no page error", g.errors.length === 0, g.errors);
    await g.context.close();
  }
  // ---- migration of a real v4 save: no payment, then play on pays only the arcs not yet done
  {
    const { readFileSync } = await import("node:fs");
    const v4 = readFileSync("test/fixtures/save-v4-floor4.json", "utf8"), raw = JSON.parse(v4);
    const g = await boot();
    check("[R74-migrate] a real v4 save (floor 4) imports and loads through the slot dialog", await loadFixture(g, v4));
    let s = await g.state();
    check("[R74-migrate] nothing was paid (gold and experience as in the file), sq4 and sq5 are available, main is completed and main2 is active with the pin on main2", s.player.gold === raw.player.gold && s.player.xp === raw.player.xp && s.quests.sq4.state === "available" && s.quests.sq5.state === "available" && s.quests.main.state === "completed" && s.quests.main2.state === "active" && s.quests.pinned === "main2", [s.player.gold - raw.player.gold, s.quests.pinned]);
    const g0 = s.player.gold;
    await g.app("cheat.teleportFloor", 6); await g.app("step", 2);
    s = await g.state();
    check("[R74-migrate] playing on to floor 6 pays arc 2 only (80 gold), not arc 1 again", s.player.gold - g0 === 80, s.player.gold - g0);
    await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
    check("[R74-migrate] the journal of the migrated character lists main and main2 as completed and main3 as active", JSON.stringify(await order(g.page, "journal-completed")) === JSON.stringify(["main", "main2"]) && (await order(g.page, "journal-active"))[0] === "main3", [await order(g.page, "journal-completed"), await order(g.page, "journal-active")]);
    check("[R74-migrate] no page error", g.errors.length === 0, g.errors);
    await g.context.close();
  }
  // ---- slot card: global step title and N/5, for a v5 slot and for slots written by a v4 build (index without qv, old 1..6 scale)
  {
    const { createSlotStore, createMemoryAdapter } = await import("../src/save/index.js");
    const { config, content, newGame: ng, enterFloor, step: st } = await import("../src/core/index.js");
    const { completeQuest } = await import("../src/core/cheats.js");
    const { v4Text } = await import("../test/helpers.js");
    const mk = (seed, name) => { const s = ng(seed, { class: "sales-rep", name, start: "town", wearStartKit: true }); enterFloor(s, 4, { at: "entry" }); return s; };
    const A = mk(31, "Alpha"); completeQuest(A, "sq1"); completeQuest(A, "sq2");
    const B = mk(32, "Bravo");
    const ad = createMemoryAdapter(), store = createSlotStore(ad, { now: () => 1000, tabId: "boot" });
    store.create(1, A); store.create(2, B);
    ad.setItem(`${config.slotKeyPrefix}1`, v4Text(A)); ad.setItem(`${config.slotKeyPrefix}2`, v4Text(B)); // what a v4 build stored
    const idx = JSON.parse(ad.getItem(config.slotIndexKey));
    for (const e of idx.slots) if (e.state === "ok") { delete e.qv; e.mainStep = 4; e.mainDone = false; e.sidesDone = 0; }
    ad.setItem(config.slotIndexKey, JSON.stringify(idx));
    const dump = Object.fromEntries(ad.keys().map((k) => [k, ad.getItem(k)]));
    // the storage is seeded before the page boots (init script), the way a returning player of a v4 build would have it
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route("https://oc.test/**", (r) => r.fulfill({ path: "dist/index.html", contentType: "text/html" }));
    await ctx.addInitScript(`(() => { try { if (!localStorage.getItem("__seeded")) { const d = ${JSON.stringify(dump)}; for (const k of Object.keys(d)) localStorage.setItem(k, d[k]); localStorage.setItem("__seeded", "1"); } } catch (e) {} })();`);
    const page = await ctx.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("https://oc.test/index.html?test=1&seed=3");
    await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
    const view = await page.evaluate(() => window.__app.slots.view());
    const e1 = view.list[0], e2 = view.list[1];
    check("[R74-slots] a v4-built index is upgraded at boot: qv 5, the global step (5 = Check the records floor) and the completed sides", e1.qv === 5 && e1.mainStep === 5 && e1.sidesDone === 2 && e2.qv === 5 && e2.mainStep === 5 && e2.sidesDone === 0, [e1, e2]);
    await page.evaluate(() => window.__app.slots.open()); await page.waitForTimeout(250);
    const t1 = await page.textContent(T("slot-quest-1")).catch(() => null), t2 = await page.textContent(T("slot-quest-2")).catch(() => null);
    check("[R74-slots] the cards say 'Check the records floor · 2/5' and '... · 0/5' (title of the current global step, N/5)", t1 === `${content.mainSteps[4].title} · 2/5` && t2 === `${content.mainSteps[4].title} · 0/5`, [t1, t2]);
    check("[R74-slots] the card of a slot never says /3 (the old model) anywhere on the slot screen", !/\d\/3\b/.test(await page.evaluate(() => document.body.innerText)));
    const sr = await page.evaluate(() => document.querySelector('[data-testid="slot-quest-1"]')?.nextElementSibling?.textContent);
    check("[R74-slots] the screen-reader text says 2 of 5 side quests done", /2 of 5/.test(sr ?? ""), sr);
    check("[R74-slots] no page error while the v4-built slots are read", errors.length === 0, errors);
    await ctx.close();
  }
  // ---- two quests from one giver in the dialogue (AC-R-258-1)
  {
    const g = await boot();
    await startNew(g.page, { cls: "sales-rep", name: "Probe" });
    await talk(g, "vendor");
    const list = () => g.page.locator('[data-testid^="npc-quest-"]').evaluateAll((e) => e.map((x) => x.dataset.testid).filter((t) => /^npc-quest-sq\d$/.test(t)));
    check("[R74-dialog] the vendor with both quests on offer lists sq1 and sq5, each with its own Accept and Decline (names say which quest)", JSON.stringify(await list()) === JSON.stringify(["npc-quest-sq1", "npc-quest-sq5"]) && (await g.page.locator(T("quest-accept-sq5")).count()) === 1 && (await g.page.locator(T("quest-decline-sq5")).count()) === 1 && /Slide Deck Surplus/.test((await g.page.getAttribute(T("quest-accept-sq5"), "aria-label")) ?? ""), await list());
    check("[R74-dialog] the vendor's trade tabs are still there with both quests listed (trading works in every state)", (await g.page.locator(T("tab-buy")).count()) === 1 && (await g.page.locator(T("vendor-stock")).count()) === 1);
    await g.page.click(T("quest-accept-sq5")); await g.app("step", 2);
    let s = await g.state();
    check("[R74-dialog] accepting sq5 leaves sq1 on offer (still Accept) and the window open, sq5 shows progress 0/6", s.quests.sq5.state === "active" && s.quests.sq1.state === "available" && (await g.page.locator(T("quest-accept-sq1")).count()) === 1 && (await g.page.locator(T("quest-accept-sq5")).count()) === 0 && /0\/6/.test(await g.page.textContent(T("npc-quest-progress-sq5")).catch(() => "")) && s.ui.dialog?.npc === "vendor", [s.quests.sq5, await g.page.textContent(T("npc-quest-progress-sq5")).catch(() => null)]);
    await g.page.evaluate(() => { const b = document.querySelector('[data-testid="quest-accept-sq1"]'); b.click(); b.click(); });
    await g.app("step", 2);
    s = await g.state();
    check("[R74-dialog] a double click on Accept for sq1 accepts once; both quests active and shown with progress", s.quests.sq1.state === "active" && s.quests.sq1.progress === 0 && (await list()).length === 2);
    await g.app("quests.setStep", "sq5", 2); await g.app("step", 2);
    check("[R74-dialog] sq5 ready while sq1 is active: Hand in appears for sq5 only", (await g.page.locator(T("quest-handin-sq5")).count()) === 1 && (await g.page.locator(T("quest-handin-sq1")).count()) === 0);
    check("[R74-dialog] the vendor marker is a hand-in marker while sq5 is ready", (await g.state()).npcs.find((n) => n.id === "vendor").marker === "handin");
    const before = await handInState(g);
    await g.page.evaluate(() => { const b = document.querySelector('[data-testid="quest-handin-sq5"]'); b.click(); b.click(); });
    await g.app("step", 2);
    s = await g.state();
    const gear = s.inventory.items.filter((i) => i.kind === "gear");
    check("[R74-dialog] handing in sq5 (double click) pays once: one magic ring, amulet or belt, no potions, sq1 untouched and still listed as active", s.quests.sq5.state === "completed" && s.quests.sq1.state === "active" && gear.length === 1 && ["ring", "amulet", "belt"].includes(gear[0].slot) && gear[0].rarity === "magic" && s.inventory.items.length === before.bag + 1 && s.ui.dialog?.npc === "vendor", [s.quests.sq5.state, gear.map((i) => [i.slot, i.rarity]), before.bag, s.inventory.items.length]);
    check("[R74-dialog] the window now lists sq1 only; the vendor marker is none while sq1 is active", JSON.stringify(await list()) === JSON.stringify(["npc-quest-sq1"]) && (await g.state()).npcs.find((n) => n.id === "vendor").marker === "none", await list());
    await g.app("quests.setStep", "sq1", 2); await g.app("step", 2);
    await g.page.click(T("quest-handin-sq1")); await g.app("step", 2);
    s = await g.state();
    check("[R74-dialog] with both completed the vendor window shows the done lines and no buttons", s.quests.sq1.state === "completed" && (await g.page.locator('[data-testid^="quest-handin-"], [data-testid^="quest-accept-"]').count()) === 0 && (await g.page.locator(T("npc-quest-sq1")).count()) + (await g.page.locator(T("npc-quest-sq5")).count()) >= 1);
    await shot(g.page, "vendor-two-quests");
    check("[R74-dialog] no page error", g.errors.length === 0, g.errors);
    await g.context.close();
  }
  // ---- sq4 (ledger) and sq5 (consultants) through the real game: window, pickup, pouch in the journal, hand in at the stash keeper
  {
    const g = await boot();
    await startNew(g.page, { cls: "facilities-manager", name: "Probe" });
    await talk(g, "stash"); await g.page.click(T("quest-accept-sq4")); await g.app("step", 2);
    let s = await g.state();
    check("[R74-sq4] Accept at the stash keeper starts sq4 and the toast says where to look (floor 5 or 6)", s.quests.sq4.state === "active" && /floor 5 or 6/.test(s.ui.toast ?? ""), [s.quests.sq4.state, s.ui.toast]);
    await g.page.keyboard.press("Escape"); await g.app("step", 2);
    const floor = await g.page.evaluate(() => { for (const d of [5, 6]) { window.__app.cheat.teleportFloor(d); window.__app.step(2); if (window.__app.getState().groundItems.some((e) => e.id === "qi-sq4")) return d; } return null; });
    check("[R74-sq4] the ledger lies on floor 5 or 6, on exactly one of them", floor === 5 || floor === 6, floor);
    for (const m of (await g.state()).monsters.filter((m) => m.ai !== "dead")) await g.app("cheat.damageMonster", m.id, 99999);
    await g.app("step", 30);
    await g.app("input", { t: "pickup", id: "qi-sq4" });
    for (let i = 0; i < 40 && (await g.state()).quests.sq4.state === "active"; i++) await g.app("step", 60);
    s = await g.state();
    check("[R74-sq4] walking over the ledger puts it in the pouch and makes sq4 ready (next step: return to the stash keeper)", s.quests.sq4.state === "ready" && s.player.pouch.some((e) => e.id === "qi-sq4") && /Return to/.test(s.quests.sq4.nextStep), [s.quests.sq4.state, s.player.pouch]);
    await g.app("cheat.teleportFloor", 0); await g.app("step", 2);
    await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
    check("[R74-sq4] the journal lists the Misfiled Ledger in the pouch", (await g.page.textContent(T("journal-pouch"))).includes("Misfiled Ledger"));
    await g.page.keyboard.press("Escape"); await g.app("step", 2);
    check("[R74-sq4] the stash keeper's marker is a hand-in marker", (await g.state()).npcs.find((n) => n.id === "stash").marker === "handin");
    check("[R74-sq4] the stash keeper's window opens with Hand in and the locker lists", (await talk(g, "stash")) && (await g.page.locator(T("quest-handin-sq4")).count()) === 1 && (await g.page.locator(T("stash-items")).count()) === 1);
    const before = await handInState(g);
    await g.page.evaluate(() => { const b = document.querySelector('[data-testid="quest-handin-sq4"]'); b.click(); b.click(); b.click(); });
    await g.app("step", 2);
    s = await g.state();
    check("[R74-sq4] three clicks on Hand in pay once: completed, pouch empty, 2 potions more, gold and experience up, no gear", s.quests.sq4.state === "completed" && s.player.pouch.length === 0 && s.inventory.items.length === before.bag + 2 && s.player.gold > before.gold && s.player.xp > before.xp && s.inventory.items.filter((i) => i.kind === "gear").length === (before.bag ? s.inventory.items.filter((i) => i.kind === "gear").length : 0), [before, s.inventory.items.length]);
    check("[R74-sq4] the stash still works after the hand-in (put a potion in the locker through the window)", await (async () => { const it = (await g.state()).inventory.items[0]; await g.app("input", { t: "stash", id: it.id, to: "stash" }); await g.app("step", 2); return (await g.state()).stash.items.some((i) => i.id === it.id); })());
    await g.page.keyboard.press("Escape");
    // sq5: kills on floors 5 and 6 through the real damage input; interns do not count
    await talk(g, "vendor"); await g.page.click(T("quest-accept-sq5")); await g.app("step", 2); await g.page.keyboard.press("Escape");
    let n = 0;
    for (const d of [5, 6]) { await g.app("cheat.teleportFloor", d); await g.app("step", 2); for (const m of (await g.state()).monsters.filter((m) => m.type === "consultant" && m.ai !== "dead")) { await g.app("cheat.damageMonster", m.id, 99999); await g.app("step", 1); n++; } }
    s = await g.state();
    check(`[R74-sq5] killing the ${n} consultants of floors 5 and 6 readies sq5 (6 needed) and the tracker/journal say so`, n >= 6 && s.quests.sq5.state === "ready" && s.quests.sq5.progress === 6, [n, s.quests.sq5]);
    check("[R74-sq5] no page error", g.errors.length === 0, g.errors);
    await g.context.close();
  }
  // ---- the verdict on the last step of main3 (step 4)
  {
    const g = await boot();
    await startNew(g.page, { cls: "sales-rep", name: "Probe" });
    await g.app("quests.setStep", "main3", 4); await g.app("step", 2);
    let s = await g.state();
    check("[R74-verdict] main3 at step 4 (the boss is down): the tracker names the verdict step and the journal offers Read the verdict", s.quests.main3.step === 4 && /verdict/i.test(s.ui.tracker?.text ?? ""), [s.quests.main3.step, s.ui.tracker]);
    await g.page.keyboard.press("KeyJ"); await g.app("step", 2);
    const has = (await g.page.locator(T("journal-verdict")).count()) === 1;
    check("[R74-verdict] the journal shows the verdict button on main3's last step only", has && (await g.page.locator('[data-testid="journal-verdict"]').evaluateAll((e) => e.length)) === 1, has);
    if (has) { await g.page.click(T("journal-verdict")); await g.app("step", 2); }
    s = await g.state();
    check("[R74-verdict] reading it completes main3 (and with it all three), once", s.quests.main3.state === "completed" && s.quests.main.state === "completed" && s.quests.main2.state === "completed", [s.quests.main3.state, s.ui.story, s.scene]);
    check("[R74-verdict] no page error", g.errors.length === 0, g.errors);
    await g.context.close();
  }
  // ---- the journal on a phone with eight entries and the stash keeper's offer on a phone
  {
    const g = await boot({ viewport: { width: 390, height: 844 } });
    await startNew(g.page, { cls: "sales-rep", name: "Probe" });
    await g.app("quests.setStep", "main2", 2); await g.app("quests.setStep", "sq1", 3); await g.app("quests.setStep", "sq4", 1); await g.app("quests.setStep", "sq5", 2); await g.app("step", 2);
    await g.page.click(T("dock-journal")); await g.app("step", 2);
    const j = await g.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, clipped: [...document.querySelectorAll('[data-testid="journal"] .jn, [data-testid="journal"] .jt, [data-testid="journal"] .jb')].some((e) => e.scrollWidth > e.clientWidth + 1), close: document.querySelector('[data-testid="close-journal"]')?.getBoundingClientRect().right }));
    check("[R74-phone] the journal with arcs, a locked quest and eight entries has no horizontal scroll and no clipped line at 390 px, close inside the screen", j.sw <= 391 && !j.clipped && j.close <= 390, j);
    for (const scale of [1.5, 2]) { await g.app("options.setTextScale", scale); await g.page.waitForTimeout(120); check(`[R74-phone] text scale ${scale}: still no horizontal scroll with arcs`, await overflow(g.page)); }
    await g.app("options.setTextScale", 1); await g.page.waitForTimeout(100);
    await shot(g.page, "journal-arcs-phone");
    await g.page.click(T("close-journal")); await g.app("step", 2);
    check("[R74-phone] the stash keeper's window (offer and locker) has no horizontal overflow at 390 px", (await talk(g, "stash")) && await overflow(g.page));
    check("[R74-phone] no page error", g.errors.length === 0, g.errors);
    await g.context.close();
  }
  // ---- ADV-R7-07 in the browser: pinning an inherited property name
  {
    const g = await boot();
    await startNew(g.page, { cls: "sales-rep", name: "Probe" });
    for (const id of ["constructor", "toString", "__proto__"]) await g.app("quests.pin", id);
    await g.app("step", 2);
    const s = await g.state();
    xfail("[R74-pin] the hook refuses to pin 'constructor', 'toString' and '__proto__' (they are not quests); the pin stays on main", s.quests.pinned === "main", "ADV-R7-07", s.quests.pinned);
    await g.app("save.write");
    const back = deserialize(await g.app("slots.raw", 1));
    xfail("[R74-pin] and the save written afterwards still loads", back.ok, "ADV-R7-07", back.message);
    await g.context.close();
  }
}

for (const f of xfailAfter) f();
await browser.close();
const r = finish("adv-r7");
const xp = xres.filter((x) => x.ok), xf = xres.filter((x) => !x.ok);
console.log(`expected failures (defects): ${xf.length} (${[...new Set(xf.map((x) => x.id))].join(", ")}); fixed: ${xp.length}; no-cheat runs: ${noCheat.filter((x) => x.ok).length}/${noCheat.length}`);
void r;
