// Canvas, viewport fill, screen<->tile round trip (real mouse events), colour count; writes screenshots.
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
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
// ---- R8-0.1 gear visuals: signature, cache, perf fields, hero pixels follow equip / swap / unequip (AC-R-260-4 pipeline part, AC-R-262-3) ----
{
  const g = await open(browser, { query: "test=1&seed=3&zoom=1.8", viewport: { width: 1280, height: 720 } });
  const p0 = await g.app("perf");
  check("AC-R-262-3 cold load: atlasMs under 5000 and no gear sprite built before a game frame", p0.atlasMs < 5000 && p0.gearCache.builds === 0 && p0.gearSig === "-|-|-|-|-|-", { atlasMs: p0.atlasMs, gear: p0.gearCache, sig: p0.gearSig });
  await g.app("newGame", { seed: 3 });
  await g.app("cheat.setLevel", 20);
  await g.app("step", 5);
  // The canvas around the hero is noisy (grain, light flicker change every pixel every frame), so the probe is perf().heroDigest: a hash of the sprite the hero was drawn from.
  // A state is the set of digests over ~1.2 s (the idle animation loops through a few frames).
  const sample = async () => { const set = new Set(); for (let i = 0; i < 40; i++) { set.add((await g.app("perf")).heroDigest); await g.page.waitForTimeout(30); } return [...set]; };
  const overlap = (a, b) => a.some((x) => b.includes(x));
  const empty = await sample();
  const wear = async (base, rarity) => { const r = await g.app("cheat.giveItem", { base, rarity }); const e = await g.app("input", { t: "equip", id: r.id }); return { r, e }; };
  const a = await wear("hard-hat", "rare");
  const p1 = await g.app("perf");
  const worn = await sample();
  check("AC-R-260-4 equipping a head item changes the hero pixels and the signature (c.. rare)", a.r.ok && a.e.ok !== false && !overlap(empty, worn) && p1.gearSig.split("|")[0] === "h2", { sig: p1.gearSig, e: a.e });
  const b = await wear("visor-cap", "magic");
  const p2 = await g.app("perf");
  const swapped = await sample();
  check("AC-R-260-4 swapping to another category changes the pixels again", b.r.ok && p2.gearSig.split("|")[0] === "c1" && !overlap(worn, swapped) && !overlap(empty, swapped), { sig: p2.gearSig });
  const held = await g.app("cheat.giveItem", { base: "steel-toe-boots", rarity: "rare" }); // carried, not worn
  await g.page.waitForTimeout(1500); // the pick-up floater fades
  const carried = await sample();
  const pc = await g.app("perf");
  check("AC-R-260-4 carrying an unworn item changes nothing", held.ok && overlap(swapped, carried) && pc.gearSig === p2.gearSig, { sig: pc.gearSig });
  const u = await g.app("input", { t: "unequip", slot: "head" });
  const back = await sample();
  const p3 = await g.app("perf");
  check("AC-R-260-4 unequipping returns to the empty look pixels and signature", u.ok !== false && overlap(empty, back) && p3.gearSig === "-|-|-|-|-|-", { sig: p3.gearSig, u });
  // every visible slot at once, walking: the cache stays under its cap, builds only on signature changes, no page error
  for (const [base, rarity] of [["hard-hat", "rare"], ["cardigan", "rare"], ["wrist-brace", "magic"], ["sneakers", "rare"], ["ruler-rapier", "rare"], ["clipboard-shield", "magic"]]) await wear(base, rarity);
  await g.app("step", 30);
  await g.page.waitForTimeout(800);
  const p4 = await g.app("perf");
  const b1 = p4.gearCache.builds;
  await g.page.waitForTimeout(800);
  const p5 = await g.app("perf");
  check("AC-R-262-3 gear cache: under 32 MB, frames built, no fallback, no new builds while the signature stays", p4.gearCache.bytes > 0 && p4.gearCache.bytes <= 32 * 1024 * 1024 && p4.gearCache.fallbacks === 0 && p5.gearCache.builds - b1 <= 80 && p4.gearSig.split("|").filter((x) => x !== "-").length === 6, { gear: p4.gearCache, sig: p4.gearSig, b1, b2: p5.gearCache.builds });
  check("AC-R-262-4 on-demand builds: at most one in any frame", p5.gearCache.maxBuildsPerFrame <= 1, p5.gearCache);
  check("gear visuals: no page errors", g.errors.length === 0, g.errors);
  await g.context.close();
}
// ---- R8-0.2 gear part art, pixel level (real canvases, own browser page): 21 categories x 3 classes x 8 facings x idle/walk/attack/cast/death (frame 0 + last) differ from the
// empty slot and from each other (AC-R-260-2); the four tiers differ pairwise, also in grey-scale (AC-R-261-1); the sprites are not clipped by the 104 x 96 cell outside death.
{
  let r;
  try { r = JSON.parse(execFileSync(process.execPath, ["e2e/art-sheet.mjs", tmpdir(), "check"], { encoding: "utf8", timeout: 180000 }).trim().split("\n").at(-1)); } catch (e) { r = { ok: false, failures: [String(e.message).slice(0, 200)], stats: {} }; }
  check("AC-R-260-2 / 261-1 gear part pixels: every category differs from the empty slot and from its slot mates; four tiers differ pairwise (colour and grey-scale)", r.ok, r.failures);
  check("gear parts stay inside the 104 x 96 sprite cell in idle, walk, attack and cast", (r.stats.clipped ?? 1) === 0, r.stats);
}
await browser.close();
finish("render");
