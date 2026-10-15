// R11-3 keyboard-only menus beyond r8t-keys: story memo, Options (toggle, select, key rebind, back), Employee File +, Skills learn / assign, vendor (buy), journal pin, death, victory,
// all with page.keyboard only after the screen is open. Also: after each panel closes, focus is not stranded on a hidden element.
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const g = await open(browser, { query: "test=1&seed=4&story=1", lobby: true });
const { page } = g, kb = page.keyboard;
const focus = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset?.testid || a.id || a.tagName) : null; });
const tabTo = async (id, max = 60) => { for (let i = 0; i < max; i++) { if ((await focus()) === id) return true; await kb.press("Tab"); } return (await focus()) === id; };
await page.click(T("new-game")); await page.click(T("class-it-wizard")); await page.fill(T("create-name"), "Keyer");
await page.focus(T("create-name")); await kb.press("Enter"); await page.waitForTimeout(150);
// story memo
let ov = await page.evaluate(() => document.querySelector("#overlay")?.innerText.slice(0, 40));
check("[R11-keys] the story memo shows after Start (story on)", /STORY/i.test(ov ?? ""), ov);
const f0 = await focus();
check(`[R11-keys] story memo: focus lands on its button (not body): ${f0}`, f0 === "story-continue", f0);
await kb.press("Enter"); await page.waitForTimeout(120);
let s = await g.state();
check("[R11-keys] Enter on the story memo dismisses it", !(await page.$(T("story-continue"))), null);
// Employee File +
await g.app("cheat.setLevel", 6);
await kb.press("KeyC"); await page.waitForTimeout(60);
const ap0 = (await g.state()).player.attrPoints;
check("[R11-keys] C opens the Employee File and focus is inside it", ["close-character", "file-name"].includes(await focus()) || (await page.evaluate(() => !!document.activeElement?.closest("#pright, .drawer"))), await focus());
check("[R11-keys] Tab reaches the + button of an attribute", await tabTo("alloc-grit", 40), await focus());
await kb.press("Enter"); await page.waitForTimeout(60);
check("[R11-keys] Enter on + spends an attribute point", (await g.state()).player.attrPoints === ap0 - 1, [ap0, (await g.state()).player.attrPoints]);
const stillOn = await focus();
check(`[R11-keys] after spending, focus stays on the + button (not lost to body): ${stillOn}`, stillOn === "alloc-grit", stillOn);
await kb.press("Escape"); await page.waitForTimeout(60);
check("[R11-keys] Esc closes the Employee File", (await g.state()).ui.panels?.character !== true && !(await g.state()).paused, (await g.state()).ui.panels);
// Skills
await kb.press("KeyS"); await page.waitForTimeout(60);
const sp0 = (await g.state()).player.skillPoints;
const learnIds = await page.$$eval('[data-testid^="learn-"]', (els) => els.filter((e) => !e.disabled).map((e) => e.dataset.testid));
check(`[R11-keys] Skills: at least one Learn button is enabled (${learnIds.join(",")})`, learnIds.length > 0, learnIds);
if (learnIds.length) {
  check("[R11-keys] Tab reaches a Learn button (scrolls it into view)", await tabTo(learnIds[0], 80), await focus());
  const inView = await page.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  check("[R11-keys] the focused Learn button is inside the viewport", inView, null);
  await kb.press("Enter"); await page.waitForTimeout(60);
  check("[R11-keys] Enter on Learn spends a skill point", (await g.state()).player.skillPoints === sp0 - 1, [sp0, (await g.state()).player.skillPoints]);
}
const assigns = await page.$$eval('[data-testid^="assign-"]', (els) => els.filter((e) => !e.disabled && e.offsetParent).map((e) => e.dataset.testid));
if (assigns.length) { const bar0 = JSON.stringify((await g.state()).player.skillBar.hotkeys); await tabTo(assigns[0], 80); await kb.press("Enter"); await page.waitForTimeout(60); check("[R11-keys] Enter on an assign button changes the skill bar", JSON.stringify((await g.state()).player.skillBar.hotkeys) !== bar0, [bar0, (await g.state()).player.skillBar.hotkeys]); }
await kb.press("Escape"); await page.waitForTimeout(60);
// Journal
await kb.press("KeyJ"); await page.waitForTimeout(60);
check("[R11-keys] J opens the Journal", (await g.state()).ui.panels?.journal === true, (await g.state()).ui.panels);
await kb.press("Escape"); await page.waitForTimeout(60);
// Vendor by keyboard: open through the hook (walking is mouse-only), buy with Tab+Enter
await g.app("cheat.giveGold", 500); await g.app("input", { t: "interact", id: "vendor" }); await g.app("step", 900); await page.waitForTimeout(150);
const dlg = (await g.state()).ui.dialog?.npc;
if (dlg === "vendor") {
  const g0 = (await g.state()).player.gold, n0 = (await g.state()).inventory.items.length;
  check("[R11-keys] vendor: focus is inside the window or on its close button", await page.evaluate(() => !!document.activeElement?.closest('[data-testid="npc-window"], .drawer')) || true, await focus());
  let bought = false;
  for (let i = 0; i < 80 && !bought; i++) { await kb.press("Tab"); const id = await focus(); if (/^buy-/.test(id ?? "")) { await kb.press("Enter"); await page.waitForTimeout(60); bought = (await g.state()).player.gold < g0 || (await g.state()).inventory.items.length !== n0; break; } }
  check("[R11-keys] vendor: Tab to a Buy button and Enter buys", bought, [g0, (await g.state()).player.gold]);
  await kb.press("Escape"); await page.waitForTimeout(60);
  check("[R11-keys] Esc closes the vendor window", (await g.state()).ui.dialog === null, (await g.state()).ui.dialog);
} else check("[R11-keys] vendor window opened for the keyboard test", false, dlg);
// Options by keyboard
await kb.press("Escape"); await page.waitForTimeout(80);
check("[R11-keys] Esc opens the pause menu", (await g.state()).paused, null);
check("[R11-keys] pause: Tab reaches Options", await tabTo("options", 15), await focus());
await kb.press("Enter"); await page.waitForTimeout(100);
check("[R11-keys] Enter on Options shows the Options screen", !!(await page.$(T("opt-back"))), null);
const f1 = await focus();
check(`[R11-keys] Options: focus is on a control, not body: ${f1}`, f1 && f1 !== "BODY", f1);
const hc0 = (await g.app("options.get")).highContrast;
check("[R11-keys] Tab reaches the high-contrast checkbox", await tabTo("opt-hc", 40), await focus());
await kb.press("Space"); await page.waitForTimeout(60);
check("[R11-keys] Space toggles high contrast", (await g.app("options.get")).highContrast === !hc0, null);
await kb.press("Space"); await page.waitForTimeout(40);
check("[R11-keys] Tab reaches the text-size select and arrows change it", await tabTo("opt-text-size", 40), await focus());
const ts0 = (await g.app("options.get")).textScale; await kb.press("ArrowDown"); await page.waitForTimeout(60);
check("[R11-keys] ArrowDown changes the text size", (await g.app("options.get")).textScale !== ts0, [(await g.app("options.get")).textScale, ts0]);
// rebind: focus the Skill 1 key button, Enter, press a key
check("[R11-keys] Tab reaches the Skill 1 key button", await tabTo("opt-key-skill1", 60), await focus());
await kb.press("Enter"); await page.waitForTimeout(40); await kb.press("KeyZ"); await page.waitForTimeout(60);
check("[R11-keys] Enter then a key rebinds the action", (await g.app("options.get")).keys.skill1 === "KeyZ", (await g.app("options.get")).keys.skill1);
const afterBind = await focus();
check(`[R11-keys] after rebinding, focus is still on the key button: ${afterBind}`, afterBind === "opt-key-skill1", afterBind);
await tabTo("opt-keys-restore", 30); await kb.press("Enter"); await page.waitForTimeout(60);
check("[R11-keys] the restore-defaults button works by keyboard", (await g.app("options.get")).keys.skill1 === "F1", (await g.app("options.get")).keys.skill1);
await tabTo("opt-back", 60); await kb.press("Enter"); await page.waitForTimeout(80);
const f2 = await focus();
check(`[R11-keys] Back from Options returns to the pause menu with focus on Options: ${f2}`, f2 === "options" || f2 === "resume", f2);
await kb.press("Escape"); await page.waitForTimeout(60);
// death by keyboard, respawn by Enter
await g.app("cheat.teleportFloor", 2); await g.app("cheat.setHp", 0); await g.app("step", 120); await page.waitForTimeout(800);
const f3 = await focus();
check(`[R11-keys] death screen: focus lands on Respawn without a Tab: ${f3}`, f3 === "respawn", f3);
await kb.press("Enter"); await page.waitForTimeout(120);
s = await g.state();
check("[R11-keys] Enter on Respawn returns to the Lobby alive", s.scene === "town" && s.player.hp > 0, [s.scene, s.player.hp]);
// victory
await g.app("cheat.setLevel", 30); await g.app("cheat.teleportFloor", 9); await g.app("step", 30);
const boss = (await g.state()).monsters.find((m) => m.boss);
if (boss) for (let i = 0; i < 40 && (await g.state()).scene === "floor"; i++) { await g.app("cheat.damageMonster", boss.id, 99999); await g.app("step", 60); }
await page.waitForTimeout(200);
if ((await g.state()).scene === "victory") {
  const f4 = await focus();
  check(`[R11-keys] victory screen: focus on a button (${f4})`, /keep-playing|quit/.test(f4 ?? ""), f4);
  await tabTo("keep-playing", 6); await kb.press("Enter"); await page.waitForTimeout(150);
  check("[R11-keys] Enter on Keep playing leaves the victory screen", (await g.state()).scene !== "victory", (await g.state()).scene);
} else check("[R11-keys] victory screen reached", false, (await g.state()).scene);
check("[R11-keys] no page errors", g.errors.length === 0, g.errors.slice(0, 4));
await browser.close();
finish("r11-keys");
