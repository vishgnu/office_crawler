// R7-0.5 e2e: journal panel (J, dock button, pause entry), key remap, tracker, pin, badge, phone layout, memo read, Read the verdict, quest ground entries.
// Real-time pages are not needed here: the manual clock is enough for the UI wiring (the NPC and toast flows are R7-0.6, e2e/r7quest.mjs).
import { launch, open, startNew, check, finish } from "./helpers.mjs";
import { T as UT } from "../src/ui/text.js";

const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const D = { width: 1280, height: 720 }, M = { width: 390, height: 844 };
const quests = (g) => g.app("quests.state");
const fresh = async (viewport = D, query = "test=1&seed=1") => { const g = await open(browser, { query, viewport, lobby: true }); await startNew(g.page, { name: "Tester" }); return g; };

// ---- AC-R-243-1: three ways to open, J / Escape / dock close, no extra pause
for (const how of ["key", "dock", "pause"]) {
  const g = await fresh();
  const inv = await (async () => { await g.app("ui.open", "inventory"); const p = (await g.state()).paused; await g.app("ui.close", "inventory"); return p; })();
  if (how === "key") await g.page.keyboard.press("KeyJ");
  else if (how === "dock") await g.page.click(T("dock-journal"));
  else { await g.app("pause"); await g.page.click(T("pause-journal")); }
  let s = await g.state();
  check(`AC-R-243-1 (${how}) the journal opens: ui.panels.journal is true, left drawer is the journal`, s.ui.panels.journal === true && (await g.page.locator(T("journal")).count()) === 1, s.ui.panels);
  check(`AC-R-243-1 (${how}) opening adds no pause beyond the inventory panel`, s.paused === inv, [s.paused, inv]);
  if (how === "key") {
    await g.page.keyboard.press("KeyJ");
    check("AC-R-243-1 J again closes the journal", (await g.state()).ui.panels.journal === false);
    await g.page.keyboard.press("KeyJ"); await g.page.keyboard.press("Escape");
    s = await g.state();
    check("AC-R-243-1 Escape closes the journal and does not pause", s.ui.panels.journal === false && s.paused === false && s.ui.menu === null, [s.ui.panels, s.paused]);
  }
  if (how === "dock") { await g.page.click(T("close-journal")); check("AC-R-243-1 the close button closes it", (await g.state()).ui.panels.journal === false); }
  check(`B1 no page errors (open ${how})`, g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---- AC-R-243-3: Options key list and remap
{
  const g = await fresh();
  await g.app("pause"); await g.page.click(T("options"));
  const label = await g.page.locator(T("opt-key-journal")).innerText();
  check("AC-R-243-3 the Options keys list has the journal key, default J", label === "J" && (await g.state()).options.keys.journal === "KeyJ", label);
  await g.page.click(T("opt-key-journal")); await g.page.keyboard.press("KeyI");
  const s1 = await g.state();
  check("AC-R-243-3 a conflicting key (I) is rejected, keys unchanged", s1.options.keys.journal === "KeyJ" && (await g.page.locator(T("opt-key-msg")).innerText()).includes(UT.optKeysConflict), s1.options.keys);
  await g.page.click(T("opt-key-journal")); await g.page.keyboard.press("KeyH");
  check("AC-R-243-3 remapping to a free key works", (await g.state()).options.keys.journal === "KeyH");
  await g.page.keyboard.press("Escape"); await g.page.keyboard.press("Escape");
  let s = await g.state();
  check("setup: back in the game", s.ui.menu === null && s.paused === false, [s.ui.menu, s.paused]);
  await g.page.keyboard.press("KeyJ");
  check("AC-R-243-3 the old key does nothing", (await g.state()).ui.panels.journal === false);
  await g.page.keyboard.press("KeyH");
  check("AC-R-243-3 the new key opens the journal", (await g.state()).ui.panels.journal === true);
  check("the dock key badge follows the binding", (await g.page.locator(`${T("dock-journal")} kbd`).innerText()) === "H");
  await g.context.close();
}

// ---- AC-R-243-2, AC-R-248-1/2: content, next step equals snapshot, pin, tracker, update without reopening
{
  const g = await fresh();
  let s = await g.state();
  check("AC-R-248-1 new game: tracker is the main next step", s.ui.tracker?.id === "main" && s.ui.tracker.text === "Take the lift down." && s.ui.tracker.text === s.quests.main.nextStep, s.ui.tracker);
  check("AC-R-248-1 the tracker DOM line shows it, in one line, with the full text as title", await g.page.evaluate(() => { const t = document.querySelector('[data-testid="tracker"]'), x = t.querySelector('[data-testid="tracker-text"]'); return !t.hidden && x.textContent === "Take the lift down." && t.title.includes("Take the lift down.") && x.getBoundingClientRect().height < 30; }));
  await g.app("quests.setStep", "main", 3); await g.app("quests.setStep", "sq2", 1); await g.app("quests.setStep", "sq1", 3);
  await g.app("ui.open", "journal");
  s = await g.state();
  const q = s.quests;
  const dom = await g.page.evaluate(() => {
    const t = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
    return { order: [...document.querySelectorAll('[data-testid="journal-active"] > li')].map((l) => l.dataset.quest), done: [...document.querySelectorAll('[data-testid="journal-completed"] > li')].map((l) => l.dataset.quest), next: ["main", "sq2", "sq3"].map((i) => t(`journal-next-${i}`)), prog: t("journal-progress-sq2"), progMain: t("journal-progress-main"), giver: t("journal-giver-sq2"), pinned: !!document.querySelector('[data-testid="journal-pinned-main"]'), doneNext: t("journal-next-sq1"), state: ["main", "sq2", "sq3", "sq1"].map((i) => t(`journal-state-${i}`)), hs: document.documentElement.scrollWidth <= innerWidth };
  });
  check("AC-R-243-2 active list: main first, then the side quests; completed list holds sq1", JSON.stringify(dom.order) === '["main","sq2","sq3"]' && JSON.stringify(dom.done) === '["sq1"]', dom);
  check("AC-R-243-2 next-step lines equal quests[id].nextStep; completed has none", dom.next[0] === q.main.nextStep && dom.next[1] === q.sq2.nextStep && dom.next[2] === q.sq3.nextStep && dom.doneNext === null, dom);
  check("AC-R-243-2 progress, giver, pin state and state words are text", dom.prog === "0/1" && dom.progMain === "Step 3/6" && dom.giver === q.sq2.giver && dom.pinned && dom.state.join() === "Active,Active,Available,Completed", dom);
  check("AC-R-244-1 desktop: a side panel, no horizontal scroll", dom.hs && (await g.page.evaluate(() => { const r = document.querySelector("#pleft").getBoundingClientRect(); return r.left <= 0 && r.width < 400; })));
  const tr = await g.page.evaluate(() => { const t = document.querySelector('[data-testid="tracker"]').getBoundingClientRect(), p = document.querySelector("#pleft").getBoundingClientRect(), ctl = [...document.querySelectorAll("#pleft button")].map((b) => b.getBoundingClientRect()); return { clear: ctl.every((c) => c.right <= t.left || t.right <= c.left || c.bottom <= t.top || t.bottom <= c.top) && (t.left >= p.right - 1 || t.right <= p.left || t.bottom <= p.top), box: [t.left, t.top, t.right, t.bottom] }; });
  check("AC-R-244-1 the tracker does not overlap the open journal", tr.clear, tr);
  // pin
  await g.page.click(T("journal-pin-sq2"));
  s = await g.state();
  check("AC-R-248-2 pinning sq2 shows its next step on the tracker; exactly one pinned", s.quests.pinned === "sq2" && s.ui.tracker.id === "sq2" && s.ui.tracker.text === s.quests.sq2.nextStep && (await g.page.locator(".jq.pinned").count()) === 1, s.ui.tracker);
  check("AC-R-248-2 the tracker DOM line follows", (await g.page.locator(T("tracker-text")).innerText()) === s.quests.sq2.nextStep);
  await g.page.click(T("journal-pin-sq2"));
  s = await g.state();
  check("AC-R-248-2 unpinning returns the tracker to main", s.quests.pinned === "main" && s.ui.tracker.id === "main", s.quests.pinned);
  await g.page.click(T("journal-pin-sq3"));
  await g.app("quests.setStep", "main", 4);
  check("AC-R-243-2 the open journal updates without reopening when a step completes", (await g.page.locator(T("journal-next-main")).innerText()) === (await quests(g)).main.nextStep && (await g.page.locator(T("journal-progress-main")).innerText()) === "Step 4/6");
  await g.app("cheat.completeQuest", "sq3");
  s = await g.state();
  check("AC-R-248-2 a pinned quest that completes reverts the tracker to main", s.quests.sq3.state === "completed" && s.quests.pinned === "main" && s.ui.tracker.id === "main", [s.quests.pinned, s.ui.tracker]);
  // pin survives save and reload
  await g.page.click(T("journal-pin-sq2"));
  await g.app("save.write");
  await g.page.reload(); await g.page.waitForFunction(() => window.__app?.getState().scene === "title");
  await g.page.click(T("continue")); await g.page.waitForTimeout(200);
  s = await g.state();
  check("AC-R-248-2 the pin survives save and reload; the tracker shows it", s.quests.pinned === "sq2" && s.ui.tracker?.id === "sq2", [s.quests.pinned, s.ui.tracker]);
  check("AC-R-253-1 the journal has no abandon control and the hook has no abandon", (await g.page.locator("button", { hasText: /abandon/i }).count()) === 0 && !(await g.page.evaluate(() => "abandon" in window.__app.quests)));
  check("B1 no page errors (journal)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---- badge (AC-R-254 share: the badge lives here, the toast is 0.6)
{
  const g = await fresh();
  check("badge: none on a new game", (await g.state()).ui.badge.journal === false && (await g.page.locator(T("journal-badge")).count()) === 0);
  await g.app("quests.setStep", "main", 2);
  let s = await g.state();
  check("badge: a quest step sets it (state and text badge on the dock button)", s.ui.badge.journal === true && (await g.page.locator(T("journal-badge")).count()) === 1, s.ui.badge);
  await g.page.keyboard.press("KeyJ");
  check("badge: opening the journal clears it", (await g.state()).ui.badge.journal === false && (await g.page.locator(T("journal-badge")).count()) === 0);
  await g.app("quests.setStep", "main", 3);
  check("badge: a step while the journal is open does not set it", (await g.state()).ui.badge.journal === false);
  await g.context.close();
}

// ---- keyboard: focus into the journal, arrows over entries, Enter on a pin control, Escape returns focus
{
  const g = await fresh();
  await g.app("quests.setStep", "sq2", 1);
  await g.page.focus(T("dock-inventory"));
  await g.page.keyboard.press("KeyJ");
  const f1 = await g.page.evaluate(() => document.activeElement?.dataset?.quest ?? document.activeElement?.className);
  check("AC-R-244-2 J puts focus on the first quest entry", f1 === "main", f1);
  await g.page.keyboard.press("ArrowDown");
  check("AC-R-244-2 ArrowDown moves to the next entry", (await g.page.evaluate(() => document.activeElement?.dataset?.quest)) === "sq1");
  await g.page.focus(T("journal-pin-sq2")); await g.page.keyboard.press("Enter");
  check("AC-R-244-2 Enter on a pin control pins", (await g.state()).quests.pinned === "sq2");
  const names = await g.page.evaluate(() => [...document.querySelectorAll(".jq")].map((l) => l.getAttribute("aria-label")));
  check("AC-R-244-2 every quest state is in the accessible name as text", names.length === 4 && /Active/.test(names[2]) && /Available/.test(names[1]) && /Pinned/.test(names[2]), names);
  await g.page.keyboard.press("Escape");
  const back = await g.page.evaluate(() => document.activeElement?.dataset?.testid);
  check("AC-R-244-2 Escape closes and returns focus to the previous element", (await g.state()).ui.panels.journal === false && back === "dock-inventory", back);
  await g.context.close();
}

// ---- AC-R-244-1 phone
{
  const g = await fresh(M);
  const dock = await g.page.evaluate(() => { const b = document.querySelector('[data-testid="dock-journal"]').getBoundingClientRect(), o = document.querySelector('[data-testid="dock-inventory"]').getBoundingClientRect(); return { w: b.width, h: b.height, ow: o.width, oh: o.height, inside: b.left >= 0 && b.right <= innerWidth }; });
  check("AC-R-244-1 phone: the journal button is as large as the other HUD buttons and on screen", dock.h >= dock.oh && dock.w >= 44 && dock.inside, dock);
  const t0 = await g.page.evaluate(() => { const t = document.querySelector('[data-testid="tracker"]'); const x = t.querySelector('[data-testid="tracker-text"]'); return { hidden: t.hidden, h: x.getBoundingClientRect().height, w: t.getBoundingClientRect().width, ok: t.getBoundingClientRect().right <= innerWidth && document.documentElement.scrollWidth <= innerWidth }; });
  check("AC-R-248-1 phone: tracker is one line within the screen", !t0.hidden && t0.h < 30 && t0.ok, t0);
  await g.app("quests.setStep", "main", 4); await g.app("quests.setStep", "sq2", 1);
  await g.page.click(T("dock-journal"));
  const r = await g.page.evaluate(() => { const d = document.querySelector("#pleft").getBoundingClientRect(), x = document.querySelector('[data-testid="close-journal"]').getBoundingClientRect(), pb = document.querySelector("#pleft .pb"); return { full: d.width >= innerWidth - 16 && d.height > innerHeight * 0.5, close: x.width >= 44 && x.height >= 44 && x.right <= innerWidth && x.top >= 0, hs: document.documentElement.scrollWidth <= innerWidth, overflowX: pb.scrollWidth <= pb.clientWidth + 1, scroll: pb.scrollHeight >= pb.clientHeight }; });
  check("AC-R-244-1 phone: full-screen panel, visible 44 px close, no horizontal scroll", r.full && r.close && r.hs && r.overflowX, r);
  check("AC-R-244-1 phone: pin buttons are 44 px targets", await g.page.evaluate(() => [...document.querySelectorAll(".jpin")].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; })));
  await g.page.click(T("close-journal"));
  check("AC-R-244-1 phone: the close control closes", (await g.state()).ui.panels.journal === false);
  check("B1 no page errors (phone)", g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---- memo read: dismissStory sends storyRead start; Read the verdict
{
  const g = await open(browser, { query: "test=1&seed=1&story=1", lobby: true });
  await startNew(g.page);
  check("setup: story overlay shown, memo not read", (await g.state()).ui.menu === "story" && (await g.state()).quests.main.m.memo === false);
  await g.page.click(T("story-continue"));
  const s = await g.state();
  check("AC-R-241 dismissing the start story sends storyRead: main step 1 is done (memo)", s.quests.main.m.memo === true && s.quests.main.step === 2, s.quests.main);
  await g.app("quests.setStep", "main", 6);
  await g.page.keyboard.press("KeyJ");
  check("journal: step 6 offers Read the verdict", (await g.page.locator(T("journal-verdict")).count()) === 1);
  await g.page.click(T("journal-verdict"));
  const s2 = await g.state();
  check("journal: Read the verdict completes the main quest and shows the closing text", s2.quests.main.state === "completed" && s2.ui.menu === "story" && (await g.page.locator(".screen.story-screen").count()) === 1, [s2.quests.main.state, s2.ui.menu]);
  await g.page.click(T("story-continue"));
  check("journal: afterwards no verdict action, main is under Completed", (await g.page.locator(T("journal-verdict")).count()) === 0 && (await g.page.locator(`${T("journal-completed")} [data-quest="main"]`).count()) === 1);
  check("B1 no page errors (story)", g.errors.length === 0, g.errors);
  await g.context.close();
}
{
  const g = await fresh();
  const r = await g.app("quests.readVerdict");
  check("hook readVerdict before the boss is refused (not defeated)", r.ok === false && r.error === "not defeated", r);
  await g.context.close();
}

// ---- ground entries without item or gold: hover and click must not throw (contract 4.4)
{
  const g = await fresh();
  await g.app("quests.setStep", "sq2", 1);
  let entry = null;
  for (const d of [3, 4]) { await g.app("cheat.teleportFloor", d); const s = await g.state(); entry = (s.groundItems ?? []).find((e) => e.quest === "sq2"); if (entry) break; }
  check("setup: the quest item lies on floor 3 or 4 as a ground entry without item and gold", !!entry && !("item" in entry) && !("gold" in entry), entry);
  if (entry) {
    const s = await g.state(), cam = s.ui.camera, sx = cam.ox + ((entry.tile.x + 0.5) - (entry.tile.y + 0.5)) * 32 * cam.z, sy = cam.oy + ((entry.tile.x + 0.5) + (entry.tile.y + 0.5)) * 16 * cam.z;
    await g.page.mouse.move(Math.min(1270, Math.max(5, sx)), Math.min(700, Math.max(5, sy))); await g.page.waitForTimeout(100);
    await g.app("step", 2);
    await g.page.keyboard.down("Alt"); await g.page.waitForTimeout(100); await g.page.keyboard.up("Alt");
    check("hovering and Alt-showing a quest ground entry does not throw", g.errors.length === 0, g.errors);
    check("the quest ground entry is still on the floor after hover", ((await g.state()).groundItems ?? []).some((e) => e.id === entry.id));
  }
  await g.context.close();
}
finish("r7journal");
await browser.close();
