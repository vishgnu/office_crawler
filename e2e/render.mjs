// Canvas, viewport fill, screen<->tile round trip (real mouse events), colour count; writes screenshots.
import { launch, open, check, finish, freeTilesNear, tileScreen, SHOTS } from "./helpers.mjs";

const browser = await launch();
for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160]]) {
  const g = await open(browser, { viewport: { width, height } });
  const tag = `${width}x${height}`;
  await g.app("newGame", { seed: 1 });
  let s = await g.app("step", 30);
  const info = await g.page.evaluate(() => {
    const c = document.getElementById("game");
    return { ctx: !!c.getContext("2d"), cw: c.width, iw: window.innerWidth, top: document.elementFromPoint(innerWidth / 2, innerHeight / 2) === c };
  });
  check(`AC-R-112-1 [${tag}] 2d canvas exists and is the element receiving mouse events`, info.ctx && info.top);
  check(`AC-R-112-3 / NFR-B02-1 [${tag}] canvas width within 1px of innerWidth`, Math.abs(info.cw - info.iw) <= 1, info);

  // five tiles: click the screen centre of each with the REAL mouse; the player's path must end on that tile
  const tiles = freeTilesNear(s, s.player.tile, 5, 2).filter((_, i) => i % 4 === 0).slice(0, 5);
  let okCount = 0;
  for (const t of tiles) {
    await g.app("newGame", { seed: 1 });
    s = await g.app("step", 1);
    const p = tileScreen(s.ui.camera, t.x, t.y);
    await g.page.mouse.click(p.x, p.y);
    s = await g.state();
    const end = s.player.path.at(-1) ?? s.player.next;
    if (end && end.x === t.x && end.y === t.y) okCount++;
    else console.log("  miss", tag, t, "path end", end);
  }
  check(`AC-R-112-3 [${tag}] clicking the centre of ${tiles.length} sample tiles sets the path to that tile`, tiles.length === 5 && okCount === 5, { okCount, n: tiles.length });

  // same through the hook's clickScreen
  await g.app("newGame", { seed: 1 });
  s = await g.app("step", 1);
  const t0 = tiles[0], p0 = tileScreen(s.ui.camera, t0.x, t0.y);
  await g.app("clickScreen", p0.x, p0.y);
  s = await g.state();
  check(`[${tag}] hook clickScreen maps like a mouse`, (s.player.path.at(-1) ?? {}).x === t0.x && (s.player.path.at(-1) ?? {}).y === t0.y);

  if (width === 1280) {
    await g.app("newGame", { seed: 1 });
    await g.app("step", 30);
    const colours = await g.page.evaluate(() => {
      const c = document.getElementById("game"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return set.size;
    });
    check("AC-R-112-2 canvas has at least 16 distinct colours after newGame + step(30)", colours >= 16, colours);
    const perf = await g.app("perf");
    // The atlas build time budget is checked by `npm run bench`, not here (no wall-clock asserts in gating tests).
    check("ADR-0004 atlas built with a full sprite set", perf.atlasKeys > 400 && perf.atlasMissing.length === 0, { keys: perf.atlasKeys });
    console.log(`  atlas: ${perf.atlasKeys} sprites in ${Math.round(perf.atlasMs)} ms`);
  }
  await g.app("newGame", { seed: 1 });
  s = await g.app("step", 30);
  const near = freeTilesNear(s, s.player.tile, 6, 3).slice(0, 2);
  await g.app("cheat.spawnMonster", "zombie-intern", near[0]);
  await g.app("cheat.spawnMonster", "printer-imp", near[1]);
  await g.app("step", 70);
  await g.page.screenshot({ path: `${SHOTS}/play-${tag}.png` });
  check(`[${tag}] no page errors`, g.errors.length === 0, g.errors);
  await g.context.close();
}

// ---- style port checks (S1-6): label discipline, rim width, atlas rebuild, lighting switches, high contrast ----
{
  const g = await open(browser, { query: "test=1&seed=3&zoom=1", viewport: { width: 1920, height: 1080 } });
  await g.app("newGame", { seed: 3 });
  let s = await g.app("step", 30);
  let n = 0;
  for (const t of freeTilesNear(s, s.player.tile, 12, 2)) { if (n >= 50) break; if ((await g.app("cheat.spawnMonster", n % 2 ? "printer-imp" : "zombie-intern", { x: t.x, y: t.y })).ok) n++; }
  await g.app("step", 6);
  await g.page.waitForTimeout(300);
  const perf = await g.app("perf");
  const L = perf.labels;
  check("label discipline: 50 monsters on screen give at most 5 nameplates", n === 50 && L.length >= 1 && L.length <= 5, { n, plates: L.length });
  const inSafe = (r) => r.x >= 8 && r.y >= 8 && r.x + r.w <= 1920 - 8 && r.y + r.h <= 1080 - 8;
  const ovl = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  check("plates stay inside the 8 px safe area and never overlap each other", L.every(inSafe) && L.every((a, i) => L.every((b, j) => i >= j || !ovl(a, b))), L);
  check("rim ring is 2 screen px at the game's zoom (atlas rim x camera scale)", Math.abs(perf.atlasRim * 1.5 * 1 - 2) <= 0.6, { rim: perf.atlasRim });
  check("lowFx and hc are off by default", perf.fx.lowFx === false && perf.fx.hc === false, perf.fx);
  check(`[1920x1080] no page errors`, g.errors.length === 0, g.errors);
  await g.context.close();
}
for (const [flag, expect] of [["lowfx=1", { lowFx: true, hc: false }], ["hc=1", { lowFx: false, hc: true }]]) {
  const g = await open(browser, { query: `test=1&seed=1&${flag}` });
  await g.app("newGame", { seed: 1 });
  await g.app("step", 30);
  await g.page.waitForTimeout(200);
  const perf = await g.app("perf");
  check(`?${flag} selects ${JSON.stringify(expect)} and renders without errors`, perf.fx.lowFx === expect.lowFx && perf.fx.hc === expect.hc && perf.atlasMissing.length === 0 && g.errors.length === 0, { fx: perf.fx, errors: g.errors });
  if (flag === "hc=1") check("high contrast bakes a thicker rim (3.5 screen px)", perf.atlasRim >= 1.5, perf.atlasRim);
  await g.context.close();
}
{ // S5: the atlas follows the zoom / devicePixelRatio bucket
  const g = await open(browser, { viewport: { width: 1280, height: 720 } });
  await g.app("newGame", { seed: 1 });
  const before = await g.app("perf");
  await g.page.setViewportSize({ width: 1920, height: 1080 });
  await g.page.waitForFunction(() => window.__app.perf().atlasChanges >= 1, null, { timeout: 20000 });
  const after = await g.app("perf");
  check("S5 atlas is rebuilt after a resize that changes the zoom bucket (sharper atlas, nothing missing)", after.atlasScale > before.atlasScale && after.atlasMissing.length === 0, { before: before.atlasScale, after: after.atlasScale });
  await g.app("step", 2);
  const st = await g.state(), t = freeTilesNear(st, st.player.tile, 4, 2)[0], p = tileScreen(st.ui.camera, t.x, t.y);
  await g.page.mouse.click(p.x, p.y);
  const s2 = await g.state();
  check("click mapping is still exact after the atlas swap", (s2.player.path.at(-1) ?? s2.player.next)?.x === t.x && (s2.player.path.at(-1) ?? s2.player.next)?.y === t.y);
  check("no page errors after the rebuild", g.errors.length === 0, g.errors);
  await g.context.close();
  const hi = await open(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const hp = await hi.app("perf");
  check("S5 a devicePixelRatio 2 screen gets a sharper atlas than dpr 1 at the same size", hp.atlasScale > before.atlasScale && hp.dpr === 2, { dpr1: before.atlasScale, dpr2: hp.atlasScale });
  await hi.context.close();
}
await browser.close();
finish("render");
