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
    check("ADR-0004 atlas built (sprite count recorded; budget is loose, not a unit threshold)", perf.atlasKeys > 400 && perf.atlasMs < 5000, { keys: perf.atlasKeys, ms: Math.round(perf.atlasMs) });
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
await browser.close();
finish("render");
