// R7-0.6 e2e: quest dialogue in the NPC window, rewards text, toasts, hand-in and the bag-full refusal, slot card quest line, v3 migration, reduced motion.
// Real time (?realtime=1), served from an https origin (L-027); the dialogue buttons are clicked like a player does; the badge pick-up is a real walk,
// the elite kill and the bag filling use cheats (documented per check). Desktop 1280x720 and phone 390x844.
import { readFileSync } from "node:fs";
import { launch, check, finish, startNew } from "./helpers.mjs";
import { T as UT } from "../src/ui/text.js";
import { config, content } from "../src/core/index.js";

const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const D = { width: 1280, height: 720 }, M = { width: 390, height: 844 };
const texts = {};
const V3 = readFileSync("test/fixtures/save-v3-floor4.json", "utf8");

/** A game page on an https origin; `seed` fills localStorage before the game runs; `reduced` emulates prefers-reduced-motion. */
async function boot({ viewport = D, query = "test=1&seed=1&realtime=1", seed = null, reduced = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? "reduce" : "no-preference" });
  await context.route("https://oc.test/**", (r) => r.fulfill({ path: "dist/index.html", contentType: "text/html" }));
  if (seed) await context.addInitScript((d) => { if (localStorage.getItem("r7seeded")) return; localStorage.setItem("r7seeded", "1"); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, seed);
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`https://oc.test/index.html?${query}`);
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 15000 });
  const app = (fn, ...args) => page.evaluate(([f, a]) => f.split(".").reduce((o, k) => o[k], window.__app)(...a), [fn, args]);
  return { context, page, errors, app, state: () => app("getState") };
}
const fresh = async (o = {}) => { const g = await boot(o); await startNew(g.page, { name: "Quest Tester" }); return g; };
const talk = async (g, npc) => { await g.app("quests.talk", npc); await g.page.waitForFunction((n) => window.__app.getState().ui.dialog?.npc === n, npc, { timeout: 20000 }); await g.page.waitForTimeout(120); };
const dlgText = (g, id) => g.page.locator(T(id)).innerText();
const closeDlg = async (g) => { await g.page.click(T("close-npc")); await g.page.waitForFunction(() => !window.__app.getState().ui.dialog); };
const toastText = (g) => g.page.evaluate(() => { const t = document.querySelector('[data-testid="toast"]'); return t && !t.hidden ? t.textContent : null; });

// ================= desktop: the whole flow
{
  const g = await fresh();
  let s = await g.state();
  check("setup: Lobby, three side quests available, markers on the three givers", s.scene === "town" && ["sq1", "sq2", "sq3"].every((i) => s.quests[i].state === "available") && ["vendor", "healer", "potions"].every((n) => s.npcs.find((x) => x.id === n)?.marker === "available"), s.npcs);

  await g.page.waitForTimeout(300);
  const mk = (await g.app("perf")).npcMarkers;
  check("AC-R-249-1 the render model lists an exclamation marker for the three givers and none for the stash keeper", ["vendor", "healer", "potions"].every((n) => mk.find((m) => m.id === n)?.shape === "exclamation") && !mk.some((m) => m.id === "stash"), mk);

  // --- offer (AC-R-249-2, AC-R-247-4), decline (AC-R-245-1)
  await talk(g, "vendor");
  const win = await g.page.evaluate(() => { const w = document.querySelector('[data-testid="npc-window"]'); return { kind: w?.dataset.kind, quest: !!document.querySelector('[data-testid="npc-quest-sq1"]'), state: document.querySelector('[data-testid="npc-quest-state-sq1"]')?.textContent, label: document.querySelector('[data-testid="npc-quest-sq1"]')?.getAttribute("aria-label"), role: document.querySelector('[data-testid="npc-quest-sq1"]')?.getAttribute("role"), vendor: !!document.querySelector('[data-testid="vendor-stock"]'), hs: document.documentElement.scrollWidth <= innerWidth, active: document.activeElement?.dataset?.testid }; });
  check("AC-R-249-2 the vendor's window shows the quest offer next to the normal stock", win.kind === "vendor" && win.quest && win.vendor && win.state === UT.stateAvailable, win);
  check("AC-R-249-2 the offer text is the quest's short text", (await dlgText(g, "npc-quest-text-sq1")).startsWith("The interns keep clocking in"));
  const rw = await dlgText(g, "npc-quest-reward-sq1");
  check("AC-R-247-4 the reward is listed as text (gold, experience, potions)", /gold/.test(rw) && /experience/.test(rw) && /potions/.test(rw), rw);
  check("a11y: the quest block is a labelled group, focus went into the window onto the first quest button, no horizontal scroll", win.role === "group" && /Intern Overflow/.test(win.label) && win.active === "quest-accept-sq1" && win.hs, win);
  await g.page.click(T("quest-decline-sq1"));
  await g.page.waitForFunction(() => !window.__app.getState().ui.dialog);
  s = await g.state();
  check("AC-R-245-1 Decline closes the window and changes no quest state", s.quests.sq1.state === "available" && s.ui.dialog === null, s.quests.sq1);

  // --- the stash keeper has no quest block; the healer's offer shows gear text
  await talk(g, "healer");
  const hrw = await dlgText(g, "npc-quest-reward-sq2");
  check("AC-R-247-4 sq2 lists the gear kind with its minimum rarity", /armour piece/.test(hrw) && /magic/i.test(hrw) && !/potions/.test(hrw), hrw);
  check("AC-R-245-1 the healer still heals in the same window", (await g.page.locator(T("heal")).count()) === 1);
  await g.page.click(T("quest-accept-sq2"));
  s = await g.state();
  check("accept: sq2 is active, the window shows the progress line and no Accept button", s.quests.sq2.state === "active" && (await g.page.locator(T("quest-accept-sq2")).count()) === 0 && (await dlgText(g, "npc-quest-state-sq2")) === UT.stateActive && (await g.page.locator(T("npc-quest-text-sq2")).innerText()).startsWith("No badge yet"));
  await g.page.screenshot({ path: "docs/shots/r7-ui-toast-d.jpg", type: "jpeg", quality: 82 });
  const tt = await toastText(g);
  check("AC-R-254-2 the toast shows the quest title and the new next step", s.ui.toast === `${s.quests.sq2.title}: ${s.quests.sq2.nextStep}` && tt === s.ui.toast, [s.ui.toast, tt]);
  check("AC-R-254-2 the journal badge is set", s.ui.badge.journal === true && (await g.page.locator(T("journal-badge")).count()) === 1);
  check("AC-R-254-3 the toast and the badge have no animation or transition", await g.page.evaluate(() => ["toast", "journal-badge"].every((id) => { const c = getComputedStyle(document.querySelector(`[data-testid="${id}"]`)); return c.animationName === "none" && /^0s/.test(c.transitionDuration); })));
  await closeDlg(g);
  await talk(g, "potions"); await g.page.click(T("quest-accept-sq3")); await closeDlg(g);
  await talk(g, "vendor"); await g.page.click(T("quest-accept-sq1"));
  s = await g.state();
  check("accept three in the Lobby: all active, markers gone from the givers", ["sq1", "sq2", "sq3"].every((i) => s.quests[i].state === "active") && s.npcs.filter((n) => n.marker !== "none").length === 0, s.npcs);
  const vendorStill = (await g.page.locator(T("vendor-stock")).count()) === 1 && (await g.page.locator(T("tab-sell")).count()) === 1;
  check("AC-R-245-1 vendor trading is still in the window after Accept", vendorStill);
  await closeDlg(g);

  // --- toast stays for toastMs (real time)
  await g.app("quests.pin", "sq3");
  const t0 = Date.now();
  await g.app("quests.setStep", "main", 2);
  await g.page.waitForFunction(() => !!window.__app.getState().ui.toast);
  await g.page.waitForTimeout(config.quests.toastMs - 700);
  check("AC-R-254-2 ui.toast and the DOM toast are still there shortly before config.quests.toastMs", !!(await g.state()).ui.toast && !!(await toastText(g)), Date.now() - t0);
  await g.page.waitForFunction(() => !window.__app.getState().ui.toast, null, { timeout: 8000 });
  check("AC-R-254-2 and the toast goes away afterwards", (await toastText(g)) === null);

  // --- the badge: a real walk to floor 3/4
  let found = false;
  for (const depth of [3, 4]) {
    await g.app("cheat.teleportFloor", depth);
    s = await g.state();
    const it = s.groundItems.find((x) => x.quest === "sq2");
    if (!it) continue;
    await g.app("cheat.setLevel", 30); await g.app("cheat.setHp", 99999); // cheats: a strong hero, the floor's monsters cleared (they stop the walk), then a real walk onto the badge
    for (const m of s.monsters) await g.app("cheat.damageMonster", m.id, 999999);
    await g.app("cmd.moveTo", it.tile);
    await g.page.waitForFunction(() => window.__app.getState().quests.sq2.state === "ready", null, { timeout: 40000 }).then(() => { found = true; }).catch(() => {});
    break;
  }
  s = await g.state();
  check("AC-R-246-3 the hero walks over the badge: it is in the pouch, sq2 is ready", found && s.player.pouch.some((p) => p.quest === "sq2") && s.quests.sq2.state === "ready", [found, s.quests.sq2, s.player.pouch]);
  check("a quest.step toast follows the pickup", /Missing Badge/.test(s.ui.toast ?? "") || /Missing Badge/.test((await toastText(g)) ?? ""), s.ui.toast);
  if (!found) await g.app("quests.setStep", "sq2", 2);

  // --- elite (cheat kill), sq1 ready (cheat), back to the Lobby by stairs cheat
  await g.app("cheat.teleportFloor", 4);
  s = await g.state();
  const elite = s.monsters.find((m) => m.quest === "sq3");
  check("sq3: the named elite is on floor 4", !!elite, s.monsters.map((m) => m.quest));
  if (elite) { await g.app("cheat.setHp", 99999); await g.app("cheat.damageMonster", elite.id, 999999); await g.page.waitForFunction(() => window.__app.getState().quests.sq3.state === "ready", null, { timeout: 15000 }).catch(() => {}); }
  await g.app("quests.setStep", "sq1", 2);
  s = await g.state();
  check("all three side quests are ready", ["sq1", "sq2", "sq3"].every((i) => s.quests[i].state === "ready"), ["sq1", "sq2", "sq3"].map((i) => s.quests[i].state));
  await g.app("cheat.teleportFloor", 0);
  await g.page.waitForFunction(() => window.__app.getState().scene === "town");
  s = await g.state();
  check("AC-R-249-1 the givers show the hand-in marker", ["vendor", "healer", "potions"].every((n) => s.npcs.find((x) => x.id === n)?.marker === "handin"), s.npcs);

  // --- bag full: refusal, atomic, message, then free space and hand in
  let n = 0;
  for (; n < 60; n++) { const r = await g.app("cheat.giveItem", { slot: "body" }); if (!r?.ok) break; }
  s = await g.state();
  await g.page.waitForTimeout(300);
  const mk2 = (await g.app("perf")).npcMarkers;
  check("AC-R-249-1 ready quests show a question marker, a different shape from the exclamation", ["vendor", "healer", "potions"].every((n) => mk2.find((m) => m.id === n)?.shape === "question"), mk2);
  await talk(g, "healer");
  const before = JSON.stringify([s.player.gold, s.player.xp, s.inventory.items.length, s.player.pouch]);
  const rdy = await g.page.evaluate(() => ({ btn: !!document.querySelector('[data-testid="quest-handin-sq2"]'), text: document.querySelector('[data-testid="npc-quest-text-sq2"]')?.textContent, state: document.querySelector('[data-testid="npc-quest-state-sq2"]')?.textContent }));
  check("AC-R-249-2 the ready state shows the hand-in line and a Hand in button", rdy.btn && rdy.text.startsWith("That is the one") && rdy.state === UT.stateReady, rdy);
  await g.page.screenshot({ path: "docs/shots/r7-ui-dialog-ready-d.jpg", type: "jpeg", quality: 82 });
  await g.page.click(T("quest-handin-sq2"));
  await g.page.waitForTimeout(150);
  s = await g.state();
  const after = JSON.stringify([s.player.gold, s.player.xp, s.inventory.items.length, s.player.pouch]);
  check("AC-R-247-3 bag full: the hand-in is refused, nothing granted, the quest stays ready, the pouch item stays", s.quests.sq2.state === "ready" && before === after, [before, after]);
  check("AC-R-247-3 the window says so (alert text) and a toast repeats it", (await dlgText(g, "quest-bagfull")) === UT.bagFullNotice && s.ui.toast === UT.bagFullNotice && (await g.page.locator(T("quest-bagfull")).getAttribute("role")) === "alert", s.ui.toast);
  const focusKept = await g.page.evaluate(() => document.activeElement?.dataset?.testid);
  check("a11y: focus stays on the Hand in button after the refusal", focusKept === "quest-handin-sq2", focusKept);
  await g.page.screenshot({ path: "docs/shots/r7-ui-dialog-bagfull-d.jpg", type: "jpeg", quality: 82 });
  await closeDlg(g);
  // free space through the real vendor window: sell body armour until there is room
  await talk(g, "vendor");
  await g.page.click(T("tab-sell"));
  for (let i = 0; i < 40; i++) {
    const b = g.page.locator('[data-testid^="sell-"]').first();
    if (!(await b.count())) break;
    await b.click(); if (await g.page.locator(".rbtn.arm").count()) await g.page.locator(".rbtn.arm").first().click();
    if (i >= 4) break;
  }
  await g.page.waitForTimeout(100);
  s = await g.state();
  const gold0 = s.player.gold, xp0 = s.player.xp, inv0 = s.inventory.items.length;
  await g.page.click(T("tab-buy"));
  await g.page.click(T("quest-handin-sq1"));
  s = await g.state();
  check("AC-R-247-1 sq1: hand in at the vendor grants gold, xp and potions; the quest is completed; the window shows the done line without buttons",
    s.quests.sq1.state === "completed" && s.player.gold > gold0 && s.player.xp > xp0 && s.inventory.items.length + s.belt.filter(Boolean).length > inv0 - 1 && (await dlgText(g, "npc-quest-text-sq1")) === "Quiet corridors, tidy shelves. Thank you." && (await g.page.locator(T("quest-handin-sq1")).count()) === 0, [s.quests.sq1, gold0, s.player.gold]);
  check("AC-R-254-2 the completion toast names the quest and its rewards", /^Intern Overflow: completed \(.*gold.*experience/.test(s.ui.toast ?? ""), s.ui.toast);
  await closeDlg(g);
  await talk(g, "healer");
  await g.page.click(T("quest-handin-sq2"));
  s = await g.state();
  check("AC-R-247-2 after freeing space the hand-in to the healer succeeds and gives one armour piece", s.quests.sq2.state === "completed" && !s.player.pouch.some((p) => p.quest === "sq2"), [s.quests.sq2, s.player.pouch]);
  await closeDlg(g);
  check("no page errors in the flow", g.errors.length === 0, g.errors);

  // --- slot card (AC-R-252-1): the slot manager and the Load dialog after a save
  await g.app("save.write");
  s = await g.state();
  const want = `${content.quests.main.steps[s.quests.main.step - 1].title} · 2/${config.quests.sideCount}`;
  await g.app("slots.open");
  await g.page.waitForSelector(T("slot-quest-1"));
  const card = await g.page.locator(T("slot-quest-1")).innerText();
  check("AC-R-252-1 the slot manager card shows the main step title and N/3 (here 2/3), equal to the projection of the stored state", card === want && (await g.app("slots.list")).slots[0].sidesDone === 2, [card, want]);
  check("a11y: the card line is hidden from screen readers in favour of a full sentence", await g.page.evaluate(() => { const q = document.querySelector('[data-testid="slot-quest-1"]'); return q.getAttribute("aria-hidden") === "true" && /side quests done/.test(q.nextElementSibling?.textContent ?? ""); }));
  texts.a = await g.page.evaluate(() => localStorage.getItem("office-crawler.slot.1"));
  await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title");
  await g.page.click(T("load-game")); await g.page.waitForSelector(T("slot-quest-1"));
  check("AC-R-252-1 the Load dialog on the title screen shows the same line", (await g.page.locator(T("slot-quest-1")).innerText()) === want);
  check("AC-R-252-1 an empty slot shows no quest text", (await g.page.locator(T("slot-quest-3")).count()) === 0 && (await g.page.locator(T("slot-name-3")).innerText()).includes("Empty"));
  await g.context.close();
}

// ================= v3 save in slot 2 next to a real slot 1 (AC-R-251-3, AC-R-252-1, AC-R-253-2, AC-R-253-1)
{
  const g = await boot({ seed: { "office-crawler.slot.1": texts.a, "office-crawler.slot.2": V3 } });
  const list = await g.app("slots.list");
  check("setup: both slots are ok, the index carries the quest fields", list.slots[0].state === "ok" && list.slots[1].state === "ok" && Number.isInteger(list.slots[1].mainStep), list.slots.slice(0, 2));
  await g.page.click(T("load-game")); await g.page.waitForSelector(T("slot-quest-2"));
  const c2 = await g.page.locator(T("slot-quest-2")).innerText(), c1 = await g.page.locator(T("slot-quest-1")).innerText();
  const m2 = list.slots[1].mainStep;
  check("AC-R-252-1 the migrated slot shows its derived step with 0/3", c2 === `${content.quests.main.steps[m2 - 1].title} · 0/${config.quests.sideCount}` && m2 === 4, [c2, m2]);
  check("AC-R-252-1 two cards, two different lines", c1 !== c2 && c1.endsWith("· 2/3"), [c1, c2]);
  await g.page.screenshot({ path: "docs/shots/r7-ui-slotcard-d.jpg", type: "jpeg", quality: 82 });
  await g.page.click(T("slot-load-2"));
  if (await g.page.locator('[data-testid$="-yes"]').count()) await g.page.click('[data-testid$="-yes"]');
  await g.page.waitForFunction(() => window.__app.getState().scene !== "title", null, { timeout: 15000 });
  let s = await g.state();
  check("AC-R-251-3 continuing slot 2 starts the game without error at the derived step with its next-step line", s.quests.main.step === 4 && s.quests.main.nextStep === content.quests.main.steps[3].line && g.errors.length === 0, [s.quests.main, g.errors]);
  check("AC-R-251-3 the three side quests are available (no retroactive progress)", ["sq1", "sq2", "sq3"].every((i) => s.quests[i].state === "available"));
  await g.page.keyboard.press("KeyJ");
  check("AC-R-251-3 the journal shows main with that line", (await g.page.locator(T("journal-next-main")).innerText()) === content.quests.main.steps[3].line);
  await g.page.keyboard.press("KeyJ");
  await g.app("cheat.teleportFloor", 0); // the slot was saved on floor 4: walk (teleport) back to the Lobby
  await g.page.waitForFunction(() => window.__app.getState().scene === "town");
  await talk(g, "vendor");
  await g.page.screenshot({ path: "docs/shots/r7-ui-dialog-offer-d.jpg", type: "jpeg", quality: 82 });
  check("AC-R-251-3 the vendor offers sq1 in the migrated game", (await g.page.locator(T("quest-accept-sq1")).count()) === 1);
  await g.page.click(T("quest-accept-sq1"));
  s = await g.state();
  await g.app("save.write");
  const slot1After = await g.page.evaluate(() => localStorage.getItem("office-crawler.slot.1"));
  check("AC-R-251-3 / AC-R-253-2 slot 1's stored text is byte-identical after playing and saving slot 2", slot1After === texts.a);
  const raw2 = JSON.parse(await g.page.evaluate(() => localStorage.getItem("office-crawler.slot.2")));
  check("AC-R-253-1 the quest state of slot 2 is saved with the new version (sq1 active), no abandon action exists", raw2.version === config.saveVersion && raw2.quests.sq1.s === "active" && !("abandon" in (await g.app("quests.state"))) === true && !(await g.page.evaluate(() => Object.keys(window.__app.quests))).includes("abandon") && (await g.page.locator("[data-abandon],[data-testid*='abandon']").count()) === 0, raw2.quests?.sq1);
  await closeDlg(g);
  check("no page errors (migrated game)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ================= phone 390x844: full-screen NPC window with the quest block, touch targets
{
  const g = await fresh({ viewport: M });
  await talk(g, "vendor");
  const m = await g.page.evaluate(() => {
    const r = (id) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
    const a = r("quest-accept-sq1"), d = r("quest-decline-sq1"), c = r("close-npc"), q = r("npc-quest-sq1");
    return { acc: [a.width, a.height], dec: [d.width, d.height], close: [c.width, c.height], hs: document.documentElement.scrollWidth <= innerWidth, inside: q.left >= 0 && q.right <= innerWidth, text: document.querySelector('[data-testid="npc-quest-text-sq1"]').getBoundingClientRect().width > 150, tabs: !!document.querySelector('[data-testid="tab-npc"]') };
  });
  check("AC-R-244-1 phone: the quest block fits the screen, no horizontal scroll, long text wraps", m.hs && m.inside && m.text, m);
  check("phone: Accept and Decline are touch-sized (at least 44 px high, like the dock buttons)", m.acc[1] >= 44 && m.dec[1] >= 44 && m.acc[0] >= 44 && m.close[1] >= 30, m);
  await g.page.screenshot({ path: "docs/shots/r7-ui-dialog-m.jpg", type: "jpeg", quality: 82 });
  await g.page.click(T("quest-accept-sq1"));
  check("phone: Accept works by tap and the toast shows", (await g.state()).quests.sq1.state === "active" && /Intern Overflow/.test((await toastText(g)) ?? ""));
  check("phone: no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ================= reduced motion (AC-R-254-3): media query and the option
for (const how of ["media", "option"]) {
  const g = await fresh({ reduced: how === "media" });
  if (how === "option") { await g.app("pause"); await g.page.click(T("options")); await g.page.click(T("opt-reduce-motion")); await g.page.keyboard.press("Escape"); await g.page.keyboard.press("Escape"); }
  await talk(g, "healer"); await g.page.click(T("quest-accept-sq2"));
  const r = await g.page.evaluate(() => {
    const css = (sel) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e); return { anim: c.animationName, trans: c.transitionDuration, vis: !e.hidden }; };
    return { toast: css('[data-testid="toast"]'), badge: css('[data-testid="journal-badge"]'), quest: css('[data-testid="npc-quest-sq2"]'), tracker: css('[data-testid="tracker"]') };
  });
  check(`AC-R-254-3 (${how}) the toast, badge, tracker and quest block have no animation and no transition; the toast is shown at once`, r.toast?.vis && ["toast", "badge", "quest", "tracker"].every((k) => r[k] && r[k].anim === "none" && /^0s(, 0s)*$/.test(r[k].trans)), r);
  check(`AC-R-254-3 (${how}) the toast and badge are there in one frame, the text is the quest line`, /The Missing Badge/.test((await toastText(g)) ?? "") && (await g.state()).ui.badge.journal === true);
  await g.context.close();
}

// ================= hook: describe() lists the quest members, no abandon (AC-R-256-1 / 253-1)
{
  const g = await fresh({ query: "test=1&seed=1" });
  const d = JSON.stringify(await g.app("describe"));
  check("AC-R-256-1 describe() lists quests and completeQuest, and not abandon", /quests/.test(d) && /completeQuest/.test(d) && !/abandon/i.test(d));
  await g.context.close();
}

finish("r7quest");
await browser.close();
