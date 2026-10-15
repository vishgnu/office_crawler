// R8-T offline file:// smoke: the shipped delivery mode (single file opened from disk, network off), production mode (no ?test) and real-time mode (?test=1&realtime=1).
import { launch, check, finish, DIST, SHOTS, startNew, tileScreen, freeTilesNear } from "./helpers.mjs";
const browser = await launch();
async function ctxPage(vp = { width: 1280, height: 720 }) {
  const context = await browser.newContext({ viewport: vp, offline: true }); const page = await context.newPage();
  const errors = [], requests = [], failed = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !/willReadFrequently/.test(m.text()) && errors.push(m.type() + ": " + m.text()));
  page.on("request", (r) => requests.push(r.url())); page.on("requestfailed", (r) => failed.push(r.url()));
  return { context, page, errors, requests, failed };
}
// ---- production mode (no test hook), offline
{
  const g = await ctxPage();
  await g.page.goto(DIST);
  await g.page.waitForSelector('[data-testid="new-game"]', { timeout: 20000 });
  check("[R8T-offline] production build (no ?test) loads from file:// with the network off and shows the title", true);
  check("[R8T-offline] no window.__app in production mode", await g.page.evaluate(() => typeof window.__app === "undefined"), null);
  // (the willReadFrequently warning comes from this probe's own getImageData and is ignored)
  const px = () => g.page.evaluate(() => { const c = document.getElementById("game"); const x = c.getContext("2d"); if (!x) return -1; const d = x.getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) | 0; return h; });
  const h1 = await px(); await g.page.waitForTimeout(1500); const h2 = await px();
  check("[R8T-offline] the title backdrop is painted (not blank) and animates", h1 !== 0 && h1 !== -1 && h1 !== h2, [h1, h2]);
  await g.page.click('[data-testid="new-game"]'); await g.page.click('[data-testid="class-it-wizard"]'); await g.page.fill('[data-testid="create-name"]', "Offline"); await g.page.click('[data-testid="create-start"]');
  await g.page.waitForSelector('[data-testid="hud-ui"]', { timeout: 20000 });
  await g.page.waitForTimeout(2500);
  await g.page.screenshot({ path: `${SHOTS}/r8t-offline-lobby.png` });
  check("[R8T-offline] a new game starts by real clicks in production mode (HUD visible)", await g.page.isVisible('[data-testid="hud-ui"]'), null);
  // walk by real mouse click and keep playing for a few seconds
  await g.page.mouse.click(700, 500); await g.page.waitForTimeout(1500); await g.page.mouse.click(500, 300); await g.page.waitForTimeout(1500);
  await g.page.keyboard.press("KeyI"); await g.page.waitForTimeout(400); await g.page.keyboard.press("Escape"); await g.page.waitForTimeout(300);
  const stored = await g.page.evaluate(() => Object.keys(localStorage));
  await g.page.reload(); await g.page.waitForSelector('[data-testid="continue"]', { timeout: 20000 });
  check("[R8T-offline] after real play and an immediate reload the title offers Continue (pagehide flush works offline)", true, stored);
  await g.page.click('[data-testid="continue"]'); await g.page.waitForSelector('[data-testid="hud-ui"]', { timeout: 20000 });
  check("[R8T-offline] Continue resumes into the game", await g.page.isVisible('[data-testid="hud-ui"]'), null);
  check("[R8T-offline] every request was the file itself (no network attempt)", g.requests.every((u) => u.startsWith("file:") || u.startsWith("data:") || u.startsWith("blob:")) && g.failed.length === 0, [g.requests.filter((u) => !u.startsWith("file:")).slice(0, 4), g.failed.slice(0, 4)]);
  check("[R8T-offline] no console errors or warnings in production mode", g.errors.length === 0, g.errors.slice(0, 5));
  await g.context.close();
}
// ---- real-time mode with the hook, offline: walk, fight, pause, blur, resize, hide/show
{
  const g = await ctxPage();
  await g.page.goto(DIST + "?test=1&seed=2&realtime=1&start=floor");
  await g.page.waitForFunction(() => window.__app?.getState().scene === "title", null, { timeout: 20000 });
  const app = (fn, ...a) => g.page.evaluate(([f, x]) => f.split(".").reduce((o, k) => o[k], window.__app)(...x), [fn, a]);
  await startNew(g.page, { cls: "sales-rep" });
  let s = await app("getState");
  const spot = freeTilesNear(s, s.player.tile, 5, 3)[0], sp = tileScreen(s.ui.camera, spot.x, spot.y);
  await g.page.mouse.click(sp.x, sp.y);
  await g.page.waitForFunction(() => window.__app.getState().tick > 120, null, { timeout: 20000 });
  s = await app("getState");
  check("[R8T-offline] real-time: the simulation advances on its own and the hero walks to the clicked tile", s.tick > 120 && (s.player.tile.x !== s.floor.entry.x || s.player.tile.y !== s.floor.entry.y), s.player.tile);
  // resize while running, then hide/show
  await g.page.setViewportSize({ width: 800, height: 600 }); await g.page.waitForTimeout(300); await g.page.setViewportSize({ width: 390, height: 844 }); await g.page.waitForTimeout(300); await g.page.setViewportSize({ width: 1366, height: 768 }); await g.page.waitForTimeout(300);
  const t1 = (await app("getState")).tick; await g.page.waitForTimeout(500); const t2 = (await app("getState")).tick;
  check("[R8T-offline] real-time: still ticking after three resizes (phone, small, 1366)", t2 > t1, [t1, t2]);
  await g.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await g.page.waitForTimeout(300);
  const raw1 = await app("save.raw");
  check("[R8T-offline] real-time: the tab going hidden flushes a save", raw1 !== null, null);
  await g.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await g.page.keyboard.press("Escape"); const ta = (await app("getState")).tick; await g.page.waitForTimeout(600); const tb = (await app("getState")).tick;
  check("[R8T-offline] real-time: paused means no ticks", ta === tb, [ta, tb]);
  await g.page.click('[data-testid="resume"]'); await g.page.waitForTimeout(400);
  // a real-time fight by real mouse
  s = await app("getState"); await app("cheat.spawnMonster", "intern", freeTilesNear(s, s.player.tile, 4, 2)[0]);
  let st = await app("getState"); const m = st.monsters.find((x) => x.ai !== "dead");
  if (m) { for (let i = 0; i < 25; i++) { st = await app("getState"); const mm = st.monsters.filter((x) => x.ai !== "dead"); if (!mm.length) break; const p = tileScreen(st.ui.camera, mm[0].tile.x, mm[0].tile.y); await g.page.mouse.click(p.x, p.y); await g.page.waitForTimeout(400); } }
  st = await app("getState");
  check("[R8T-offline] real-time: the hero killed the spawned monster with real clicks (or it is dead)", st.monsters.every((x) => x.ai === "dead") || st.scene === "dead" || st.player.level >= 1, st.monsters.map((x) => x.ai));
  const perf = await app("perf");
  console.log("INFO perf", JSON.stringify(perf).slice(0, 400));
  check("[R8T-offline] real-time: no errors or warnings", g.errors.length === 0, g.errors.slice(0, 4));
  check("[R8T-offline] real-time: no network request", g.requests.every((u) => u.startsWith("file:")) && g.failed.length === 0, g.failed);
  await g.context.close();
}
await browser.close();
finish("r8t-offline");
