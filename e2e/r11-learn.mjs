// R11-3 probe, adapted for R11-FIX2-UI F-06: the Skills panel scrolls at 1280x720 / 1366x768 (tier 2 and 3 cards sit below the fold, a plain mouse click at their
// resting position hits nothing). Discovery is what must work: opening the panel (S) focuses the first enabled Learn button and scrolls it into view, and
// every enabled Learn button, once focused (Tab), is inside the scroller's visible area and hit by a plain click at that position.
import { launch, open, startNew, check, finish } from "./helpers.mjs";
const browser = await launch();
const probe = (e) => { const b = e.getBoundingClientRect(); let sc = null; for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 1) { sc = p; break; } const sr = sc?.getBoundingClientRect(), t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { id: e.dataset.testid, y: Math.round(b.y), ok: !!t && (t === e || e.contains(t)), inScroller: !sr || (b.top >= sr.top - 1 && b.bottom <= sr.bottom + 1), scrollTop: sc?.scrollTop }; };
for (const [W, H] of [[1280, 720], [1366, 768]]) for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) for (const lvl of [3, 6, 10]) {
  const g = await open(browser, { query: "test=1&seed=3", viewport: { width: W, height: H }, lobby: true });
  await startNew(g.page, { cls, name: "Learn" });
  await g.app("cheat.setLevel", lvl); await g.page.keyboard.press("KeyS"); await g.page.waitForTimeout(120);
  const tag = `[R11-learn] ${W}x${H} ${cls} lvl ${lvl}`;
  const ids = await g.page.$$eval('[data-testid^="learn-"]', (els) => els.filter((e) => !e.disabled).map((e) => e.dataset.testid));
  const first = await g.page.evaluate((p) => { const a = document.activeElement; return a?.dataset?.testid ? [a.dataset.testid, ...Object.values((0, eval)(`(${p})`)(a))] : [null]; }, probe.toString());
  check(`${tag}: ${ids.length} enabled Learn buttons; opening the panel focuses the first one, in view and hit by a plain click`, ids.length > 0 && first[0] === ids[0] && first[3] === true && first[4] === true, [ids[0], first]);
  const bad = [];
  for (const id of ids) {
    await g.page.focus(`[data-testid="${id}"]`); await g.page.waitForTimeout(30);
    const r = await g.page.evaluate(([i, p]) => (0, eval)(`(${p})`)(document.querySelector(`[data-testid="${i}"]`)), [id, probe.toString()]);
    if (!r.ok || !r.inScroller) bad.push(r);
  }
  check(`${tag}: every enabled Learn button is in view and clickable once focused`, bad.length === 0, bad.slice(0, 3));
  await g.context.close();
}
await browser.close(); finish("r11-learn");
