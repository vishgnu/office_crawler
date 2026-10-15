// FIX-R8T-2 checks: N1 short landscape phones, N2 death screen closes panels and returns the held item, N3 phone dock >= 44x44, N4 wide name in the Employee File header.
// Screenshots go to E2E_SHOTS (a temp dir, L-042), never docs/shots.
import { launch, open, startNew, check, finish, DIST, SHOTS } from "./helpers.mjs";
const T = (id) => `[data-testid="${id}"]`;
const browser = await launch();
const inView = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return { missing: true }; const r = e.getBoundingClientRect(); return { ok: r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5, r: [r.x, r.y, r.width, r.height].map(Math.round), vh: innerHeight }; }, sel);

// N1: nothing the player needs is outside the viewport at rest (no scroll needed) on the three short landscape phones
for (const [W, H] of [[667, 375], [740, 360], [844, 390]]) {
  const g = await open(browser, { lobby: true, query: "test=1&seed=7", viewport: { width: W, height: H } });
  const L = `[R8T2-N1] ${W}x${H}`;
  const o = await inView(g.page, T("options")); check(`${L} title: Options button inside the viewport`, o.ok, o);
  await g.page.screenshot({ path: `${SHOTS}/r8t2-title-${W}x${H}.png` });
  await g.page.click(T("new-game")); await g.page.waitForSelector(T("create-screen"));
  await g.page.click(T("class-it-wizard")); await g.page.fill(T("create-name"), "Short");
  for (const id of ["create-load", "create-back", "create-start", "create-name"]) { const r = await inView(g.page, T(id)); check(`${L} create: ${id} inside the viewport`, r.ok, r); }
  await g.page.screenshot({ path: `${SHOTS}/r8t2-create-${W}x${H}.png` });
  await g.page.click(T("create-start")); await g.page.waitForSelector(T("hud-ui"));
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  for (const id of ["respawn", "restart", "quit"]) { const r = await inView(g.page, T(id)); check(`${L} death: ${id} inside the viewport`, r.ok, r); }
  const h = await g.page.evaluate(() => { const r = document.querySelector(".screen.dead h2").getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  check(`${L} death: heading not clipped at the top`, h.top >= 0, h);
  await g.page.screenshot({ path: `${SHOTS}/r8t2-dead-${W}x${H}.png` });
  check(`${L} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}
// the screens still scroll when the room is smaller than the content (e.g. a 320x300 window)
{
  const g = await open(browser, { lobby: true, query: "test=1&seed=7", viewport: { width: 640, height: 280 } });
  const sc = await g.page.evaluate(() => { const s = document.querySelector(".screen.title"); return { scrolls: s.scrollHeight > s.clientHeight, ov: getComputedStyle(s).overflowY }; });
  check("[R8T2-N1] 640x280 title: the screen scrolls (overflow-y auto) instead of clipping", sc.ov === "auto" || sc.ov === "scroll", sc);
  await g.context.close();
}

// N2: death closes the drawers and the held item goes back (bag or floor), once
{
  const g = await open(browser, { lobby: true, query: "test=1&seed=21" });
  await startNew(g.page, { cls: "facilities-manager", name: "Dead" });
  await g.app("cheat.giveItem", { slot: "body", rarity: "rare" });
  await g.app("ui.open", "inventory"); await g.app("ui.open", "character"); await g.app("step", 2);
  const it = (await g.state()).inventory.items[0];
  await g.page.click(T(`cell-${it.x}-${it.y}`)); await g.app("step", 1);
  const held = (await g.state()).cursorItem?.id;
  check("[R8T2-N2] an item is in the hand before death", !!held, held);
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  const d = await g.page.evaluate(() => ({ drawers: document.querySelectorAll(".drawer.open").length, ghost: !document.getElementById("ghost").hidden, dockVisible: (() => { const e = document.querySelector('[data-testid="hud-ui"]'); return !!e && !e.closest("[hidden]") && getComputedStyle(e.closest("#ui") ?? e).display !== "none" && !document.getElementById("ui").hasAttribute("inert") ? "interactive" : "inert"; })() }));
  check("[R8T2-N2] death: both drawers closed and no ghost over the death screen", d.drawers === 0 && !d.ghost, d);
  check("[R8T2-N2] death: the dock is inert behind the death screen", d.dockVisible === "inert", d);
  const dockVis = await g.page.evaluate(() => getComputedStyle(document.querySelector("#ui .dock")).visibility);
  check("[R8T2-N2] death: the dock is hidden behind the death screen", dockVis === "hidden", dockVis);
  await g.page.screenshot({ path: `${SHOTS}/r8t2-dead-with-panels.png` });
  let s = await g.state();
  const count = (st) => (st.inventory.items.some((i) => i.id === held) ? 1 : 0) + (st.cursorItem?.id === held ? 1 : 0) + (st.groundItems.some((e) => (e.item?.id ?? e.id) === held) ? 1 : 0);
  check("[R8T2-N2] death: the item is not in the hand and exists exactly once (bag or floor)", !s.cursorItem && count(s) === 1, { cursor: s.cursorItem?.id, n: count(s) });
  await g.page.click(T("respawn")); await g.app("step", 5); s = await g.state();
  check("[R8T2-N2] respawn: no item in the hand, item not lost or duplicated", !s.cursorItem && count(s) <= 1 && (count(s) === 1 || s.inventory.items.length > 0), { cursor: s.cursorItem?.id, n: count(s) });
  check("[R8T2-N2] no page errors", g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}

// N3 + N4 on the phone
for (const [W, H] of [[390, 844], [360, 640]]) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(DIST + "?test=1&seed=5");
  await page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 20000 });
  await page.tap(T("new-game")); await page.waitForSelector(T("create-screen"));
  await page.tap(T("class-it-wizard")); await page.fill(T("create-name"), "WWWWWWWWWWWWWWWW");
  await page.tap(T("create-start")); await page.waitForSelector(T("hud-ui")); await page.waitForTimeout(200);
  const dk = await page.evaluate(() => [...document.querySelectorAll("#ui .dock .hbtn")].filter((e) => getComputedStyle(e).display !== "none").map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.testid, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; }));
  check(`[R8T2-N3] ${W}x${H}: every dock button is at least 44x44`, dk.length >= 4 && dk.every(([, w, h]) => w >= 44 && h >= 44), dk);
  const ch = dk.find(([id]) => id === "dock-character"); check(`[R8T2-N3] ${W}x${H}: dock-character >= 44x44`, !!ch && ch[1] >= 44 && ch[2] >= 44, ch);
  const dockIn = await page.evaluate(() => { const r = document.querySelector("#ui .dock").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; });
  check(`[R8T2-N3] ${W}x${H}: the dock stays inside the viewport width`, dockIn, null);
  await page.screenshot({ path: `${SHOTS}/r8t2-dock-${W}x${H}.png` });
  await page.tap(T("dock-character")); await page.waitForTimeout(300);
  const ov = await page.evaluate(() => { const vw = innerWidth, bad = []; for (const id of ["file-name", "file-class"]) { const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(); if (r.right > vw + 0.5 || r.left < -0.5) bad.push(id + ":" + Math.round(r.left) + "-" + Math.round(r.right)); } return { bad, sw: document.documentElement.scrollWidth, vw }; });
  check(`[R8T2-N4] ${W}x${H}: a 16-char wide name stays inside the Employee File header`, ov.bad.length === 0 && ov.sw <= ov.vw + 1, ov);
  await page.screenshot({ path: `${SHOTS}/r8t2-file-wide-name-${W}x${H}.png` });
  check(`[R8T2] ${W}x${H}: no page errors`, errors.length === 0, errors.slice(0, 3));
  await context.close();
}
// desktop: the header and the dead screen at the two minimum sizes
for (const [W, H] of [[1280, 720], [1366, 768]]) {
  const g = await open(browser, { lobby: true, query: "test=1&seed=3", viewport: { width: W, height: H } });
  await startNew(g.page, { cls: "sales-rep", name: "WWWWWWWWWWWWWWWW" });
  await g.app("ui.open", "character"); await g.app("step", 2);
  const r = await g.page.evaluate(() => { const d = document.getElementById("pleft").getBoundingClientRect(), n = document.querySelector('[data-testid="file-name"]').getBoundingClientRect(); return { inside: n.right <= d.right + 0.5 && n.left >= d.left - 0.5, d: [d.left, d.right].map(Math.round), n: [n.left, n.right].map(Math.round) }; });
  check(`[R8T2-N4] ${W}x${H}: wide name inside the drawer`, r.inside, r);
  await g.page.screenshot({ path: `${SHOTS}/r8t2-file-wide-name-${W}x${H}.png` });
  await g.app("cheat.setHp", 0); await g.app("step", 120); await g.page.waitForTimeout(700);
  for (const id of ["respawn", "quit"]) { const v = await inView(g.page, T(id)); check(`[R8T2-N1] ${W}x${H} death: ${id} inside the viewport`, v.ok, v); }
  await g.page.screenshot({ path: `${SHOTS}/r8t2-dead-${W}x${H}.png` });
  await g.context.close();
}
await browser.close();
finish("r8t2-fix");
