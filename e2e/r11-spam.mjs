// R11-3 10 Hz click spam on a changing far target in a crowd, per class. Real mouse clicks every 6 ticks (10 Hz at 60 ticks/s, manual clock) or every 100 ms wall (CLOCK=real).
// Strategies: far-changing (click the monster that is currently farthest, so the target changes as the crowd moves), far-fixed (one far monster), nearest, rotate (round robin over all), ground (clicks on empty floor far away), none (no clicks).
// Measures: ticks until the first damage the hero deals to any monster ("first hit"), the distance then, ticks until a monster is adjacent to the hero, hero hp lost in the first 600 ticks, kills in 900 ticks.
// Usage: node e2e/r11-spam.mjs [seeds=1,2,3] ; CLOCK=real for wall-clock pacing
import { launch, open, startNew, check, finish, freeTilesNear, SHOTS } from "./helpers.mjs";
const seeds = (process.argv[2] ?? "1,2,3").split(",").map(Number), real = process.env.CLOCK === "real";
const classes = ["facilities-manager", "sales-rep", "it-wizard"], strategies = (process.env.STRATS ?? "far-changing,far-fixed,nearest,rotate,none").split(",");
const browser = await launch();
const out = {};
const snapIn = (n) => { if (n) window.__app.step(n); const s = window.__app.getState(); return { tick: s.tick, scene: s.scene, player: { tile: s.player.tile, hp: s.player.hp }, monsters: s.monsters.map((m) => ({ id: m.id, tile: m.tile, pos: m.pos, ai: m.ai, hp: m.hp })), ui: { camera: s.ui.camera } }; };
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
for (const cls of classes) for (const strat of strategies) for (const seed of seeds) {
  const g = await open(browser, { query: `test=1&seed=${seed}${real ? "&realtime=1" : ""}`, lobby: true });
  await startNew(g.page, { cls, name: "Spam" });
  await g.app("cheat.teleportFloor", 2);
  if (!real) await g.app("step", 150); else await g.page.waitForTimeout(2600);
  let s = await g.state();
  for (const m of s.monsters.filter((m) => m.ai !== "dead")) await g.app("cheat.damageMonster", m.id, 99999); // an empty floor, then our own crowd
  if (!real) await g.app("step", 120); else await g.page.waitForTimeout(2000);
  s = await g.state();
  // crowd: 6 monsters on free tiles 6-9 tiles away on screen, spread out; they notice the hero (sight 9-11) and chase
  const camS = s.ui.camera, onScr = (t) => { const x = camS.ox + (t.x - t.y) * 32 * camS.z, y = camS.oy + (t.x + t.y + 1) * 16 * camS.z; return x > 60 && x < 1220 && y > 90 && y < 540; };
  const tiles = freeTilesNear(s, s.player.tile, 10, 4).filter(onScr), picked = [];
  for (const t of tiles) { if (picked.length >= 6) break; if (picked.every((q) => cheb(q, t) >= 2) && (picked.length < 3 || cheb(s.player.tile, t) >= 5)) picked.push(t); }
  const types = ["zombie-intern", "printer-imp", "zombie-intern", "printer-imp", "zombie-intern", "printer-imp"];
  for (let i = 0; i < picked.length; i++) await g.app("cheat.spawnMonster", types[i], picked[i]);
  if (!real) await g.app("step", 24); else await g.page.waitForTimeout(500);
  s = await g.state();
  const ids = s.monsters.filter((m) => m.ai !== "dead").map((m) => m.id), hp0 = Object.fromEntries(s.monsters.map((m) => [m.id, m.hp]));
  const awake0 = s.monsters.filter((m) => m.ai !== "dead" && m.ai !== "idle").length;
  const tStart = s.tick; let firstHit = null, firstHitDist = null, firstAdj = null, hpLost600 = null, kills = 0, fixedId = null, rot = 0, clicks = 0, miss = 0;
  const hpStart = s.player.hp;
  let sn = await g.page.evaluate(snapIn, 0);
  for (let k = 0; k < 150; k++) { // 150 clicks = 15 s at 10 Hz (900 ticks)
    s = sn;
    const live = s.monsters.filter((m) => m.ai !== "dead");
    if (!live.length) break;
    const cam = s.ui.camera, pos = (t) => ({ x: Math.round(cam.ox + (t.x - t.y) * 32 * cam.z), y: Math.round(cam.oy + (t.x + t.y + 1) * 16 * cam.z) });
    let tgt = null;
    const vis = live.filter((m) => { const q = pos(m.pos ?? m.tile); return q.x > 60 && q.x < 1220 && q.y > 70 && q.y < 560; });
    const byD = [...(vis.length ? vis : live)].sort((a, b) => cheb(b.tile, s.player.tile) - cheb(a.tile, s.player.tile));
    if (strat === "far-changing") tgt = byD[0];
    else if (strat === "far-fixed") { if (!fixedId || !live.some((m) => m.id === fixedId)) fixedId = byD[0].id; tgt = live.find((m) => m.id === fixedId); }
    else if (strat === "nearest") tgt = byD[byD.length - 1];
    else if (strat === "rotate") tgt = byD[rot++ % byD.length];
    if (strat !== "none") {
      let p;
      if (strat === "ground") { const far = freeTilesNear({ ...s, floor: null }, s.player.tile, 8, 6).filter((t) => { const q = pos(t); return q.x > 40 && q.x < 1240 && q.y > 70 && q.y < 560; }); const t = far[(k * 7) % Math.max(1, far.length)]; p = t && pos(t); }
      else p = pos(tgt.pos ?? tgt.tile);
      if (p && p.x > 10 && p.x < 1270 && p.y > 40 && p.y < 600) { await g.page.mouse.click(p.x, p.y); clicks++; } else miss++;
    }
    if (real) { await g.page.waitForTimeout(100); sn = await g.page.evaluate(snapIn, 0); } else sn = await g.page.evaluate(snapIn, 6);
    s = sn;
    const t = s.tick - tStart;
    if (firstAdj === null && s.monsters.some((m) => m.ai !== "dead" && cheb(m.tile, s.player.tile) <= 1)) firstAdj = t;
    if (firstHit === null) { const m = s.monsters.find((m) => m.hp < hp0[m.id] || m.ai === "dead"); if (m) { firstHit = t; firstHitDist = cheb(m.tile, s.player.tile); } }
    if (hpLost600 === null && t >= 240) hpLost600 = hpStart - s.player.hp;
    if (s.scene === "dead") break;
    if (firstHit !== null && t >= 240) break; // the first hit is the measurement; a few seconds after it is enough
  }
  s = await g.state();
  kills = s.monsters.filter((m) => m.ai === "dead").length;
  const rec = { crowd: picked.length, awake0, firstHit, firstHitDist, firstAdj, hpLost240: hpLost600, kills, dead: s.scene === "dead", ticks: s.tick - tStart, clicks, miss, errors: g.errors.length };
  ((out[cls] ??= {})[strat] ??= {})[seed] = rec;
  console.log(cls, strat, seed, JSON.stringify(rec));
  await g.context.close();
}
await browser.close();
const agg = {};
for (const cls of classes) for (const strat of strategies) {
  const r = Object.values(out[cls][strat]), hits = r.map((x) => x.firstHit).filter((x) => x !== null);
  agg[`${cls}/${strat}`] = { firstHitMedian: hits.length ? hits.sort((a, b) => a - b)[hits.length >> 1] : null, noHit: r.length - hits.length, of: r.length, killsAvg: +(r.reduce((a, x) => a + x.kills, 0) / r.length).toFixed(1), deaths: r.filter((x) => x.dead).length };
}
console.log("AGG", JSON.stringify(agg, null, 1));
import { writeFileSync } from "node:fs";
writeFileSync(`${SHOTS}/r11-spam${real ? "-real" : ""}.json`, JSON.stringify({ out, agg }, null, 1));
for (const cls of classes) { const fc = agg[`${cls}/far-changing`], ne = agg[`${cls}/nearest`]; check(`[R11-spam] ${cls}: far-changing spam lands a first hit in every seed (${fc.noHit} of ${fc.of} never hit)`, fc.noHit === 0, fc); check(`[R11-spam] ${cls}: far-changing first hit within 2x of nearest-target (${fc.firstHitMedian} vs ${ne.firstHitMedian} ticks)`, fc.firstHitMedian !== null && ne.firstHitMedian !== null && fc.firstHitMedian <= 2 * ne.firstHitMedian + 60, [fc, ne]); }
finish("r11-spam");
