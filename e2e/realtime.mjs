// Real-time loop (?realtime=1): fixed-step accumulator runs on its own, pause stops it, input still works.
import { launch, open, check, finish, freeTilesNear, tileScreen, SHOTS } from "./helpers.mjs";

const browser = await launch();
const g = await open(browser, { query: "test=1&seed=1&realtime=1" });
const frames = (n) => g.page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await g.page.click('[data-testid="new-game"]');
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
await browser.close();
finish("realtime");
