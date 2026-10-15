// R11-3 probe: are the Learn buttons of the Skills panel reachable by a plain mouse click (no auto-scroll) at the levels a player first spends points (2-6), 1280x720 and 1366x768?
import { launch, open, startNew, check, finish } from "./helpers.mjs";
const browser = await launch();
for (const [W, H] of [[1280, 720], [1366, 768]]) for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) for (const lvl of [3, 6, 10]) {
  const g = await open(browser, { query: "test=1&seed=3", viewport: { width: W, height: H }, lobby: true });
  await startNew(g.page, { cls, name: "Learn" });
  await g.app("cheat.setLevel", lvl); await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(80);
  const r = await g.page.evaluate(() => [...document.querySelectorAll('[data-testid^="learn-"]')].filter((e) => !e.disabled).map((e) => { const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); let sc = null; for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 1) { sc = p; break; } const sr = sc && sc.getBoundingClientRect(); return { id: e.dataset.testid, y: Math.round(b.y), bottom: Math.round(b.bottom), ok: t === e || e.contains(t), by: t ? (t.dataset?.testid || t.className || t.tagName).toString().slice(0, 40) : null, scroller: sr ? [Math.round(sr.top), Math.round(sr.bottom)] : null, scrollTop: sc?.scrollTop }; }));
  const bad = r.filter((x) => !x.ok);
  check(`[R11-learn] ${W}x${H} ${cls} lvl ${lvl}: ${r.length} enabled Learn buttons, all hit by a plain click at rest`, bad.length === 0, bad.slice(0, 3));
  await g.context.close();
}
await browser.close(); finish("r11-learn");
