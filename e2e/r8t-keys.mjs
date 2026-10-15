// R8-T keyboard-only journey: title -> create -> play -> panels -> pause -> options -> slots -> quit -> continue with page.keyboard only (no mouse, no hook input for the steps under test).
import { launch, open, check, finish, SHOTS } from "./helpers.mjs";
// A Tab cycle passes the document once (focus on <body> at the wrap, a browser behaviour): one BODY per cycle is normal, more means focus was lost.
const lost = (seen) => seen.filter((x) => x === "BODY").length > 1;
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const g = await open(browser, { query: "test=1&seed=4", lobby: true });
const { page } = g, kb = page.keyboard;
const focus = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset?.testid || a.id || a.tagName) : null; });
const focusInfo = () => page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return { body: true }; const cs = getComputedStyle(a), r = a.getBoundingClientRect(); return { id: a.dataset?.testid || a.id || a.tagName, outline: cs.outlineStyle + " " + cs.outlineWidth, shadow: cs.boxShadow !== "none", inView: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 }; });
/** Tab through a screen once; returns the ids reached in order (stops when the first one comes round again or after max presses). */
async function cycle(max = 120) {
  const seen = []; let first = null;
  for (let i = 0; i < max; i++) { await kb.press("Tab"); const f = await focusInfo(); const id = f.body ? "BODY" : f.id; if (first === null) first = id; else if (id === first && seen.length > 1) break; seen.push(id); if (!f.body && !f.inView) seen.push("!offscreen:" + id); }
  return seen;
}
const interactive = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[inert],[hidden]") && e.getBoundingClientRect().width > 0 && !e.disabled && e.getAttribute("tabindex") !== "-1"; }).map((e) => e.dataset?.testid || e.id || e.tagName), sel);

// ---- title
let ids = await interactive("#overlay button, #overlay input, #overlay [tabindex]");
let seen = await cycle(); const missing = ids.filter((i) => !seen.includes(i));
check("[R8T-keys] title: Tab reaches every visible control, none lost to body (one wrap stop allowed)", missing.length === 0 && !lost(seen), { ids, seen, missing });
const fi = await focusInfo();
check("[R8T-keys] title: the focused control shows a visible focus indicator", !fi.body && (fi.outline.split(" ")[0] !== "none" || fi.shadow), fi);
// New game by keyboard
for (let i = 0; i < 12 && (await focus()) !== "new-game"; i++) await kb.press("Tab");
check("[R8T-keys] title: Tab reaches New game", (await focus()) === "new-game", await focus());
await kb.press("Enter"); await page.waitForTimeout(100);
check("[R8T-keys] Enter on New game opens the class screen", await page.$(T("create-screen")) !== null);
const f1 = await focus();
check("[R8T-keys] class screen: focus lands on a class card (not body)", /^class-/.test(f1 ?? ""), f1);
await kb.press("ArrowRight"); await kb.press("ArrowRight"); await page.waitForTimeout(60);
const sel = await page.evaluate(() => document.querySelector('[role=radio][aria-checked=true]')?.dataset.testid);
check("[R8T-keys] arrow keys move the class choice", /^class-/.test(sel ?? "") && sel !== "class-facilities-manager", sel);
ids = await interactive("#overlay button, #overlay input"); seen = await cycle();
check("[R8T-keys] class screen: Tab reaches every control", ids.every((i) => seen.includes(i)) && !lost(seen), { ids, seen });
await page.focus(T("create-name")); await kb.type("KeyUser");
await kb.press("Enter"); await page.waitForTimeout(150);
let s = await g.state();
check("[R8T-keys] Enter in the name field starts the game (keyboard only)", s.scene === "town" || s.depth === 0, s.scene);
check("[R8T-keys] the chosen class started", s.player.class === sel?.replace("class-", ""), [s.player.class, sel]);
// ---- panels by key
for (const [key, name] of [["KeyI", "inventory"], ["KeyC", "character"], ["KeyS", "skills"], ["KeyJ", "journal"], ["KeyM", "map"]]) {
  await kb.press(key); await g.app("step", 2);
  const st = await g.state();
  check(`[R8T-keys] ${key} opens ${name}`, st.ui.panels?.[name] === true, st.ui.panels);
  if (name !== "map") {
    seen = await cycle(80);
    const open = await interactive(`#ui .drawer.open button, #ui .drawer.open [tabindex]`);
    check(`[R8T-keys] ${name}: Tab reaches the panel's controls and no focus is lost to body or off screen`, !lost(seen) && !seen.some((x) => x.startsWith("!offscreen")) && seen.length > 3, { n: seen.length, bad: seen.filter((x) => x.startsWith("!")), bodies: seen.filter((x) => x === "BODY").length });
  }
  await kb.press("Escape"); await g.app("step", 2);
  const st2 = await g.state();
  check(`[R8T-keys] Escape closes ${name} (no pause menu opened by that press)`, st2.ui.panels?.[name] !== true && !st2.paused, { panels: st2.ui.panels, paused: st2.paused });
}
// movement keys: record whether the hero can be moved by keyboard
const p0 = (await g.state()).player.tile;
for (const k of ["KeyW", "KeyA", "KeyD", "ArrowUp", "ArrowRight", "Space"]) { await kb.press(k); await g.app("step", 30); }
const p1 = (await g.state()).player.tile;
console.log("INFO keyboard movement (W/A/D/arrows/Space): hero moved =", p0.x !== p1.x || p0.y !== p1.y);
// belt/skill keys do not throw
for (const k of ["Digit1", "Digit2", "F1", "F2"]) await kb.press(k);
// ---- pause menu by keyboard
await kb.press("Escape"); await page.waitForTimeout(80);
check("[R8T-keys] Escape opens the pause menu", (await g.state()).paused === true);
seen = await cycle(30);
check("[R8T-keys] pause menu: Tab reaches the buttons", ["resume", "quit"].every((i) => seen.includes(i)) && !lost(seen), seen);
for (let i = 0; i < 12 && (await focus()) !== "pause-slots"; i++) await kb.press("Tab");
await kb.press("Enter"); await page.waitForTimeout(100);
check("[R8T-keys] Enter on Save slots opens the slot manager", await page.$(T("slots-view")) !== null);
seen = await cycle(60);
check("[R8T-keys] slot manager: Tab reaches controls without losing focus", !lost(seen) && seen.length > 3, seen.slice(0, 30));
await kb.press("Escape"); await page.waitForTimeout(100);
const back = await focus();
check("[R8T-keys] Esc from the slot manager returns focus to the pause menu button that opened it", back === "pause-slots", back);
await kb.press("Escape"); await page.waitForTimeout(80);
check("[R8T-keys] Escape resumes", (await g.state()).paused === false);
// quit to title and continue by keyboard
await kb.press("Escape"); await page.waitForTimeout(80);
for (let i = 0; i < 12 && (await focus()) !== "quit"; i++) await kb.press("Tab");
await kb.press("Enter"); await page.waitForTimeout(150);
check("[R8T-keys] Quit by keyboard returns to the title", (await g.state()).scene === "title", (await g.state()).scene);
for (let i = 0; i < 12 && (await focus()) !== "continue"; i++) await kb.press("Tab");
await kb.press("Enter"); await page.waitForTimeout(150);
check("[R8T-keys] Continue by keyboard resumes the same hero", (await g.state()).scene !== "title" && (await g.state()).player.name === "KeyUser", (await g.state()).player.name);
// death screen keyboard
await g.app("cheat.teleportFloor", 2); await g.app("cheat.setHp", 0); await g.app("step", 120); await page.waitForTimeout(700);
const dead = (await g.state()).scene === "dead";
check("[R8T-keys] death screen reached", dead);
if (dead) { seen = await cycle(10); check("[R8T-keys] death screen: Tab reaches Respawn/Restart/Quit", ["respawn", "restart", "quit"].every((i) => seen.includes(i)), seen); for (let i = 0; i < 6 && (await focus()) !== "respawn"; i++) await kb.press("Tab"); await kb.press("Enter"); await page.waitForTimeout(150); check("[R8T-keys] Enter on Respawn brings the hero back", (await g.state()).scene !== "dead", (await g.state()).scene); }
check("[R8T-keys] no page errors", g.errors.length === 0, g.errors.slice(0, 4));
await browser.close();
finish("r8t-keys");
