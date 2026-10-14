// Real-time loop (?realtime=1): fixed-step accumulator runs on its own, pause stops it, input still works.
import { launch, open, check, finish, freeTilesNear, tileScreen, SHOTS, startNew } from "./helpers.mjs";

const browser = await launch();
const g = await open(browser, { query: "test=1&seed=1&realtime=1" });
const frames = (n) => g.page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await startNew(g.page);
let s = await g.state();
const T = freeTilesNear(s, s.player.tile, 6, 4)[0], p = tileScreen(s.ui.camera, T.x, T.y);
await g.page.mouse.click(p.x, p.y);
await g.page.waitForFunction(() => window.__app.getState().tick >= 90, null, { timeout: 20000 });
s = await g.state();
check("the loop advances the simulation without step()", s.tick >= 90);
check("the hero has moved towards the clicked tile", s.player.tile.x !== s.floor.entry.x || s.player.tile.y !== s.floor.entry.y);
await g.page.keyboard.press("Escape");
const t1 = (await g.state()).tick;
await frames(30);
const t2 = (await g.state()).tick;
check("AC-NFR-A02-1 (real time) no ticks while paused", t1 === t2 && (await g.state()).paused === true, { t1, t2 });
await g.page.click('[data-testid="resume"]');
await g.page.waitForFunction((t) => window.__app.getState().tick > t, t2, { timeout: 20000 });
check("ticks resume after Resume", true);
// a fight in real time
s = await g.state();
const sp = freeTilesNear(s, s.player.tile, 4, 2)[0];
const m = await g.app("cheat.spawnMonster", "printer-imp", sp);
await g.page.waitForFunction((id) => window.__app.getState().monsters.find((x) => x.id === id)?.ai !== "idle", m.id, { timeout: 20000 });
await frames(120);
await g.page.screenshot({ path: `${SHOTS}/realtime.png` });
check("no page errors during real-time play", g.errors.length === 0, g.errors);
check("AC-NFR-O02-1 only file:/data: requests", g.requests.every((u) => /^(file|data|blob):/.test(u)), g.requests);
await g.context.close();
{ // a fresh quiet game: the hero walks on its own for a second
  const g2 = await open(browser, { query: "test=1&seed=1&realtime=1" });
  await startNew(g2.page);
// camera easing keeps the click mapping exact: the camera the hook reports is the one on screen, and picking in the same
// task goes through it, however far the eased camera lags behind the moving hero (the hero is walking here)
{ const s0 = await g2.state(), far = freeTilesNear(s0, s0.player.tile, 10, 7)[0]; await g2.app("clickTile", far.x, far.y); }
const exact = await g2.page.evaluate(async () => {
  const app = window.__app;
  let ok = 0, n = 0, lagged = 0, maxLag = 0;
  for (let f = 0; f < 40; f++) {
    await new Promise((r) => requestAnimationFrame(r)); // sample right after a frame: the camera on screen is the one the hook reports
    const st = app.getState(), c = st.ui.camera, p = st.player.pos;
    const lag = Math.hypot(c.ox + (p.x - p.y) * 32 * c.z - c.w / 2, c.oy + (p.x + p.y + 1) * 16 * c.z - (c.h / 2 + 12 * c.z));
    if (lag > 2) lagged++;
    maxLag = Math.max(maxLag, Math.round(lag));
    for (const [dx, dy] of [[2, 0], [-2, 1], [1, -2]]) {
      const t = { x: st.player.tile.x + dx, y: st.player.tile.y + dy };
      if (st.monsters.some((m) => m.ai !== "dead" && Math.abs(m.pos.x - t.x) < 2 && Math.abs(m.pos.y - t.y) < 2)) continue;
      const x = c.ox + (t.x - t.y) * 32 * c.z, y = c.oy + (t.x + t.y + 1) * 16 * c.z, pk = app.pick(x, y);
      n++; if (pk.tile.x === t.x && pk.tile.y === t.y && pk.monsterId === null) ok++;
    }
  }
  return { ok, n, lagged, maxLag };
});
check("camera easing: pick() through the reported camera lands on the intended tile (moving hero, eased camera)", exact.n >= 30 && exact.ok === exact.n && exact.lagged >= 3, exact); // lagged: the camera really trails the walking hero in at least 3 samples
  check("no page errors while the camera eases", g2.errors.length === 0, g2.errors);
  await g2.context.close();
}
await browser.close();
finish("realtime");
