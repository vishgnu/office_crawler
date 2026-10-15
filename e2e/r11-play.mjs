// R11-3 real-mouse play per class through floors 1-4 (real mouse clicks, real keys, the real UI for spending points; the policy of the bot decides what, a human-like translator decides where to click).
// Usage: node e2e/r11-play.mjs <class> <mode: spend|nospend|nudge> [seed=1] [lastFloor=4] [clock: real|manual=real]
//   spend   : unspent points are spent at once through the Employee File / Skills panel with real clicks
//   nospend : the player never spends points (floor 2 re-measure "without")
//   nudge   : the player ignores points (also the level-up hint on floor 1) until the floor 2 nudge toast shows, then spends through the UI (does the nudge help?)
// Env: STORY=0 turns the story memo off (default on, like production). Output: one JSON line + SHOTS/r11-play-<class>-<mode>-<seed>.json
import { launch, open, startNew, SHOTS } from "./helpers.mjs";
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
const [cls = "facilities-manager", mode = "spend", seedS = "1", lastS = "4", clock = "real"] = process.argv.slice(2);
const seed = Number(seedS), last = Number(lastS), manual = clock === "manual";
const T = (id) => `[data-testid="${id}"]`;
const t0 = Date.now();
const browser = await launch();
const g = await open(browser, { query: `test=1&seed=${seed}${manual ? "" : "&realtime=1"}${process.env.STORY === "0" ? "" : "&story=1"}`, lobby: true });
const { page } = g;
await startNew(page, { cls, name: "Walker" });
const bundle = (await build({ entryPoints: ["e2e/r11-inpage.js"], bundle: true, format: "iife", write: false, target: "es2022" })).outputFiles[0].text;
await page.evaluate(bundle);
await page.evaluate(([d, c]) => window.__r11.init({ depth: d, respawn: true, class: c }), [last, cls]);
const dismissStory = async () => { const b = await page.$(T("story-continue")); if (b) { await b.click().catch(() => {}); return true; } return false; };
await page.waitForTimeout(200); await dismissStory();

const floors = {}, deaths = [], toasts = [], events = [], uiFail = [];
const F = (d) => (floors[d] ??= { visits: 0, ticks: 0, minHp: 1e9, minRatio: 1, dmg: 0, potions: 0, arrive: null, nudge: null, spentAt: null, levelStart: null, levelEnd: null, unspentOnArrival: null, deaths: 0 });
let prev = null, lastDepth = -1, nudgeSeen = false, nudgeTick = null, step = 0, endWhy = "";
let stall = { k: "", n: 0 }, lvlSeen = 0, lvlToasts = 0, pendingLvl = [];
const spendUi = async (kind, arg) => {
  const key = kind === "alloc" ? "KeyC" : "KeyS", sel = kind === "alloc" ? T(`alloc-${arg}`) : T(`learn-${arg}`);
  await page.keyboard.press(key);
  const el = await page.waitForSelector(sel, { timeout: 1500, state: "visible" }).catch(() => null);
  let ok = false;
  if (el) {
    const dis = await el.evaluate((e) => e.disabled);
    if (!dis) { const box = await el.boundingBox(); const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return !!e && (e === document.querySelector(s) || document.querySelector(s).contains(e)); }, [box.x + box.width / 2, box.y + box.height / 2, sel]); if (!hit) uiFail.push({ kind, arg, why: "covered", tick: prev?.tick }); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); ok = hit; }
  } else uiFail.push({ kind, arg, why: "no button", tick: prev?.tick });
  await page.keyboard.press("Escape");
  const still = await page.evaluate(() => { const s = window.__app.getState(); return { paused: s.paused, panels: s.ui.panels }; });
  if (still.paused) await page.keyboard.press("Escape"); // the Esc closed nothing and paused: undo
  return ok;
};
let guard = 0;
for (;;) {
  if (++guard > 200000) { endWhy = "guard"; break; }
  if (Date.now() - t0 > Number(process.env.PLAY_WALL_MIN ?? 20) * 60 * 1000) { endWhy = "wall-timeout"; break; }
  const mask = mode === "nospend" || (mode === "nudge" && !nudgeSeen) ? { points: true } : null;
  const _t = Date.now(); let pl = await page.evaluate((m) => window.__r11.plan(m), mask); if (process.env.DBG) console.log("plan", Date.now() - _t, JSON.stringify(pl).slice(0, 100));
  if (pl.kind === "done") { endWhy = pl.why; break; }
  if (pl.kind === "dead") {
    const o = await page.evaluate(() => window.__r11.obs());
    if (o.scene === "dead") {
      deaths.push({ depth: o.depth, level: o.level, tick: o.tick, hpMaxLvl: o.hpMax }); F(prevDepth()).deaths++;
      await page.waitForTimeout(750);
      const b = await page.$(T("respawn")); if (b) await b.click(); else await page.evaluate(() => window.__app.input({ t: "respawn" }));
      await page.waitForTimeout(150);
      if (deaths.length >= 10) { endWhy = "10 deaths"; break; }
    }
    continue;
  }
  function prevDepth() { return prev?.depth ?? 1; }
  if (pl.kind === "click") await page.mouse.click(pl.x, pl.y);
  else if (pl.kind === "cast") { if (pl.key && !pl.selected) await page.keyboard.press(pl.key); await page.mouse.click(pl.x, pl.y, { button: "right" }); }
  else if (pl.kind === "key") await page.keyboard.press(pl.code);
  else if (pl.kind === "alloc" || pl.kind === "learn") { const ok = await spendUi(pl.kind, pl.attr ?? pl.id); await page.evaluate(([c, o]) => window.__r11.noteUi(c, o), [pl.cmd, ok]); if (!ok) await page.evaluate((c) => window.__app.input(c), pl.cmd); F(prevDepth()).spentAt ??= prev?.tick; }
  if (!manual) await page.waitForTimeout(70);
  const o = await page.evaluate((m) => { if (m) window.__app.step(6); return window.__r11.obs(); }, manual);
  step++;
  if (o.story) await dismissStory();
  // bookkeeping
  if (o.scene === "floor" || o.scene === "town") {
    const f = F(o.depth);
    if (o.depth !== lastDepth) {
      lastDepth = o.depth; f.visits++; f.arrive ??= o.tick; f.levelStart ??= o.level; f.unspentOnArrival = [o.ap, o.sp];
      events.push({ tick: o.tick, e: "enter", depth: o.depth, level: o.level, hp: o.hp, ap: o.ap, sp: o.sp });
      if (o.depth === 2) { nudgeTick = null; (f.arrivals ??= []).push({ tick: o.tick, ap: o.ap, sp: o.sp, nudge: false }); }
    }
    f.levelEnd = o.level;
    if (prev && prev.depth === o.depth && prev.scene === o.scene) { f.ticks += Math.max(0, o.tick - prev.tick); if (o.hp < prev.hp) f.dmg += prev.hp - o.hp; if (o.belt < prev.belt) f.potions += prev.belt - o.belt; }
    if (o.depth > 0) { f.minHp = Math.min(f.minHp, o.hp); f.minRatio = Math.min(f.minRatio, o.hp / o.hpMax); }
    if (o.depth > last) { endWhy = `reached floor ${o.depth}`; break; }
  }
  if (o.level > lvlSeen) { for (let l = lvlSeen + 1; l <= o.level; l++) pendingLvl.push({ lvl: l, tick: o.tick }); lvlSeen = o.level; }
  if (o.toast && o.toast !== toasts[toasts.length - 1]?.text) {
    toasts.push({ tick: o.tick, depth: o.depth, text: o.toast });
    if (/points to spend/i.test(o.toast)) { if (o.depth === 2) nudgeSeen = true; const a = floors[2]?.arrivals?.at(-1); if (o.depth === 2 && a && !a.nudge) { a.nudge = true; a.nudgeAfter = o.tick - a.tick; } }
    if (/^Level \d+/i.test(o.toast) || /level/i.test(o.toast)) lvlToasts++;
  }
  { const k = `${o.depth}:${o.tx},${o.ty}:${o.xp}`; if (k === stall.k) stall.n++; else stall = { k, n: 0 }; if (stall.n >= 700 && o.scene === "floor") { endWhy = `stalled ${stall.n} steps at ${k} (last plan ${JSON.stringify(pl).slice(0, 120)})`; events.push({ e: "stalled", k, pl }); break; } }
  prev = o;
  if (step % 20 === 0) console.log(`step ${step} tick ${o.tick} depth ${o.depth} scene ${o.scene} lvl ${o.level} hp ${o.hp}/${o.hpMax} mons ${o.mons} deaths ${deaths.length} wall ${Math.round((Date.now() - t0) / 1000)}s`);
  if (o.scene === "floor" && o.depth === last && o.mons === 0 && mode === "x") break;
}
const st = await page.evaluate(() => window.__r11.stats());
await page.screenshot({ path: `${SHOTS}/r11-play-${cls}-${mode}-${seed}.png` });
for (const f of Object.values(floors)) { if (f.minHp > 1e8) f.minHp = null; f.minRatio = +f.minRatio.toFixed(2); f.min = +(f.ticks / 3600).toFixed(1); }
const final = await page.evaluate(() => window.__r11.obs());
const summary = { cls, mode, seed, clock, endWhy, wallSec: Math.round((Date.now() - t0) / 1000), finalTick: final.tick, finalLevel: final.level, deaths, steps: step, floors, floor2Arrivals: floors[2]?.arrivals ?? [], levelUps: lvlSeen - 1, levelToastsSeen: lvlToasts, toastSample: toasts.filter((t) => /level|skill|learn|points/i.test(t.text)).slice(0, 25), uiFail, stats: st, pageErrors: g.errors.slice(0, 5) };
console.log(JSON.stringify(summary));
writeFileSync(`${SHOTS}/r11-play-${cls}-${mode}-${seed}.json`, JSON.stringify({ ...summary, toasts, events }, null, 1));
await browser.close();
