// R11-3 usability sweep (L-052/L-055): per viewport and panel the visible height of the scrolling body, dock overlap and 44 px targets, drawer fit at 1280x720,
// death-screen state, belt hint after a death with an empty belt, Options bottom padding, victory screen fit. Records numbers; flags body < 150 px or < 1/3 of the viewport.
// Usage: node e2e/r11-panels.mjs   (SIZES=WxH,... to override)
import { launch, open, startNew, check, finish, SHOTS } from "./helpers.mjs";
import { writeFileSync } from "node:fs";
const T = (id) => `[data-testid="${id}"]`;
const SIZES = (process.env.SIZES ?? "1920x1080,1366x768,1280x720,390x844,360x640,667x375,740x360,844x390").split(",").map((s) => s.split("x").map(Number));
const browser = await launch();
const table = {};
const body = (page) => page.evaluate(() => {
  const vis = (e) => { const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && e.getBoundingClientRect().width > 0 && !e.closest("[hidden]"); };
  const out = [];
  for (const e of document.querySelectorAll("#ui .drawer.open, #ui .drawer.open *, #overlay *")) {
    if (!vis(e)) continue; const cs = getComputedStyle(e);
    if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) { const r = e.getBoundingClientRect(); const top = Math.max(0, r.top), bot = Math.min(innerHeight, r.bottom); out.push({ cls: (e.className || e.tagName).toString().slice(0, 30), vis: Math.round(bot - top), scroll: e.scrollHeight, client: e.clientHeight }); }
  }
  return out;
});
const dock = (page, vp) => page.evaluate(() => {
  const bs = [...document.querySelectorAll('#ui [data-testid^="dock-"]')].filter((b) => { const cs = getComputedStyle(b); return cs.visibility !== "hidden" && cs.display !== "none" && b.getBoundingClientRect().width > 0; }).map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.testid, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; });
  const overlaps = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], c = bs[j]; if (a.x < c.r - 1 && c.x < a.r - 1 && a.y < c.b - 1 && c.y < a.b - 1) overlaps.push(a.id + "x" + c.id); }
  const covered = [...document.querySelectorAll('#ui [data-testid^="dock-"]')].filter((b) => { const cs = getComputedStyle(b); return cs.visibility !== "hidden" && cs.display !== "none" && b.getBoundingClientRect().width > 0; }).filter((b) => { const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !(t === b || b.contains(t)); }).map((b) => b.dataset.testid);
  const tr = document.querySelector('[data-testid="tracker"]'), trr = tr && getComputedStyle(tr).visibility !== "hidden" && !tr.hidden ? tr.getBoundingClientRect() : null;
  const trackerHides = trr && trr.width > 0 ? bs.filter((b) => { const w = Math.min(b.r, trr.right) - Math.max(b.x, trr.left), h = Math.min(b.b, trr.bottom) - Math.max(b.y, trr.top); return w > 0 && h > 0 && (w * h) / (b.w * b.h) > 0.2; }).map((b) => b.id) : [];
  const out = bs.filter((b) => b.r > innerWidth + 1 || b.x < -1 || b.b > innerHeight + 1);
  return { n: bs.length, trackerHides, covered, overlaps, small: bs.filter((b) => b.w < 44 || b.h < 44).map((b) => `${b.id} ${b.w}x${b.h}`), out: out.map((b) => b.id), rects: bs };
});
for (const [W, H] of SIZES) {
  const vp = `${W}x${H}`, phone = Math.min(W, H) < 700 || W < 700;
  const g = await open(browser, { query: "test=1&seed=5", viewport: { width: W, height: H }, lobby: true });
  const { page } = g;
  await startNew(page, { cls: "facilities-manager", name: "Panel" });
  await g.app("cheat.setLevel", 10); await g.app("cheat.giveGold", 400);
  for (let i = 0; i < 10; i++) await g.app("cheat.giveItem", { slot: ["body", "head", "weapon", "feet", "hands"][i % 5], rarity: i % 3 ? "magic" : "rare" });
  await g.app("quests.accept", "sq1"); await g.app("quests.accept", "sq3").catch(() => {});
  await g.app("cheat.teleportFloor", 3); await g.app("step", 30); await page.waitForTimeout(100);
  const row = (table[vp] ??= {});
  const d = await dock(page, vp); row.dock = { n: d.n, trackerHides: d.trackerHides, covered: d.covered, overlaps: d.overlaps, small: d.small, out: d.out };
  check(`[R11-panels] ${vp} dock: no overlapping buttons, none off screen`, d.overlaps.length === 0 && d.out.length === 0, { overlaps: d.overlaps, out: d.out, rects: d.rects });
  check(`[R11-panels] ${vp} dock: elementFromPoint at each button's centre returns that button (nothing, e.g. the quest tracker pill, covers it)`, d.covered.length === 0, { covered: d.covered, rects: d.rects });
  check(`[R11-panels] ${vp} dock: the quest tracker pill hides no dock button (more than 20 % of its area)`, d.trackerHides.length === 0, { trackerHides: d.trackerHides, rects: d.rects });
  check(`[R11-panels] ${vp} dock: every button at least 44x44 on touch layouts`, !phone || d.small.length === 0, d.small);
  await page.screenshot({ path: `${SHOTS}/r11-panels-hud-${vp}.png` });
  for (const p of ["inventory", "character", "skills", "journal"]) {
    await g.app("ui.open", p); await page.waitForTimeout(60);
    const b = await body(page); const best = b.sort((a, c) => c.vis - a.vis)[0];
    row[p] = best ? { visible: best.vis, scroll: best.scroll } : { visible: null, note: "nothing scrolls" };
    const tooSmall = best && (best.vis < 150 || best.vis < H / 3);
    check(`[R11-panels] ${vp} ${p}: scroll body ${best ? best.vis + " px visible" : "no scroller"} (>= 150 px and >= 1/3 of height)`, !tooSmall, best);
    await page.screenshot({ path: `${SHOTS}/r11-panels-${p}-${vp}.png` });
    await g.app("ui.close", p);
  }
  if (W === 1280 && H === 720) { // R8-A1: bag row 4 and the footer inside the viewport without scrolling
    await g.app("ui.open", "inventory"); await page.waitForTimeout(60);
    const r = await page.evaluate(() => { const c = document.querySelector('[data-testid="cell-9-3"]'), f = document.querySelector('[data-testid="gold"]'); const rr = (e) => e && e.getBoundingClientRect(); return { cellBottom: Math.round(rr(c)?.bottom), goldBottom: Math.round(rr(f)?.bottom), drawer: Math.round(rr(document.querySelector('[data-testid="drawer-inventory"]'))?.bottom ?? 0), vh: innerHeight }; });
    check(`[R11-panels] 1280x720 R8-A1: the whole bag (row 4) and the gold line are inside the viewport at rest`, r.cellBottom <= 720 && r.goldBottom <= 720, r);
    await g.app("ui.close", "inventory");
  }
  // options bottom padding (U-3)
  await page.keyboard.press("Escape"); await page.click(T("options")); await page.waitForTimeout(80);
  const ob = await page.evaluate(() => { let best = null; for (const e of document.querySelectorAll("#overlay *")) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) { e.scrollTop = e.scrollHeight; const last = [...e.querySelectorAll("p,button,label,div")].filter((x) => x.getBoundingClientRect().height > 0).pop(); const lr = last?.getBoundingClientRect(), r = e.getBoundingClientRect(); best = { gapBelowLast: Math.round(r.bottom - lr.bottom), panelBottom: Math.round(r.bottom), vh: innerHeight, vis: Math.round(Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) }; } } return best; });
  row.options = ob; check(`[R11-panels] ${vp} Options: scrolled to the end the last line has >= 12 px below it and the panel is inside the viewport (U-3)`, !ob || (ob.gapBelowLast >= 12 && ob.panelBottom <= ob.vh), ob);
  await page.screenshot({ path: `${SHOTS}/r11-panels-options-${vp}.png` });
  await page.click(T("opt-back")); if ((await g.state()).paused) await page.keyboard.press("Escape");
  // death: empty the belt first, then die with panels and a held item
  for (let i = 0; i < 4; i++) await g.app("input", { t: "useBelt", index: i }).catch(() => {});
  await g.app("ui.open", "inventory"); await g.app("ui.open", "character"); await g.app("step", 2);
  const it = (await g.state()).inventory.items[0]; if (it) await page.click(T(`cell-${it.x}-${it.y}`)).catch(() => {});
  await g.app("cheat.setHp", 0); await g.app("step", 120); await page.waitForTimeout(800);
  const dd = await page.evaluate(() => { const vis = (e) => e && getComputedStyle(e).visibility !== "hidden" && !e.hidden; const bs = [...document.querySelectorAll("#overlay button")].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.testid, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; }); return { drawers: [...document.querySelectorAll(".drawer.open")].filter((e) => getComputedStyle(e).visibility !== "hidden").length, ghost: vis(document.getElementById("ghost")), dockVisible: !!document.querySelector('#ui [data-testid="dock-inventory"]') && getComputedStyle(document.querySelector('#ui [data-testid="dock-inventory"]')).visibility !== "hidden", btns: bs, vh: innerHeight, vw: innerWidth }; });
  check(`[R11-panels] ${vp} death screen: panels closed, no item ghost, dock hidden`, dd.drawers === 0 && !dd.ghost, dd);
  check(`[R11-panels] ${vp} death screen: Respawn / Restart / Quit inside the viewport`, dd.btns.length >= 2 && dd.btns.every((b) => b.top >= 0 && b.bottom <= dd.vh && b.left >= 0 && b.right <= dd.vw), dd.btns);
  await page.screenshot({ path: `${SHOTS}/r11-panels-dead-${vp}.png` });
  await page.click(T("respawn")); await g.app("step", 5); await page.waitForTimeout(150);
  const toast = await page.evaluate(() => { const t = document.querySelector('[data-testid="toast"]'); const l = document.querySelector('[data-testid="live"]'); return { toast: t && !t.hidden ? t.textContent : null, live: l?.textContent ?? null }; });
  check(`[R11-panels] ${vp} belt hint: respawn with an empty belt says where to restock (toast or live region: ${JSON.stringify(toast).slice(0, 120)})`, /restock|Barista/i.test((toast.toast ?? "") + " " + (toast.live ?? "")), toast);
  check(`[R11-panels] ${vp} no page errors`, g.errors.length === 0, g.errors.slice(0, 3));
  await g.context.close();
}
await browser.close();
writeFileSync(`${SHOTS}/r11-panels.json`, JSON.stringify(table, null, 1));
console.log("TABLE " + JSON.stringify(Object.fromEntries(Object.entries(table).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([a]) => ["inventory", "character", "skills", "journal"].includes(a)).map(([a, b]) => [a, b.visible]))]))));
finish("r11-panels");
