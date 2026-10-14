// Test hook contract (ADR-0003 S1 subset): describe, getState, step, click paths, cmd validation, cheats, determinism.
import { launch, open, check, finish, freeTilesNear } from "./helpers.mjs";

const browser = await launch();
const g = await open(browser, { query: "test=1&seed=12345" });
const { app, state } = g;

const members = await app("describe");
const names = members.map((m) => m.name);
const expected = ["describe", "getState", "newGame", "setSeed", "step", "click", "clickTile", "clickScreen", "mouseMove", "mouseUp", "key", "pause", "input", "cmd", "cheat", "ui", "pick", "perf", "audio", "save", "options"]; // audio, save, options: S3; ui: S2 panels; pick: S1-6 addition (read-only: what a click at a screen point means)
check("AC-R-121-1 describe() lists exactly the documented members", JSON.stringify([...names].sort()) === JSON.stringify([...expected].sort()), names);
check("AC-R-121-1 every listed function exists", await g.page.evaluate((ms) => ms.every((m) => (m.kind === "fn" ? typeof window.__app[m.name] === "function" : typeof window.__app[m.name] === "object")), members));

let s = await app("newGame", { seed: 12345 });
check("AC-R-120-1 getState().seed === 12345", s.seed === 12345);
const first = { tiles: s.floor.tiles, monsters: s.monsters };
const g2 = await open(browser, { query: "test=1&seed=12345" });
const s2 = await g2.app("newGame", { seed: 12345 });
check("AC-R-120-1 second load, same URL: deep-equal floor.tiles and monsters", JSON.stringify(first) === JSON.stringify({ tiles: s2.floor.tiles, monsters: s2.monsters }));
await g2.context.close();

check("AC-R-121-2 getState() survives a JSON round trip", await g.page.evaluate(() => { const a = JSON.stringify(window.__app.getState()); return JSON.stringify(JSON.parse(a)) === a; }));
s = await app("step", 120);
check("AC-R-001-1 newGame + step(120): scene floor, tick 120, hp > 0", s.scene === "floor" && s.tick === 120 && s.player.hp > 0, { scene: s.scene, tick: s.tick });
for (const n of [1, 10, 250]) {
  const before = (await state()).tick, after = (await app("step", n)).tick;
  check(`AC-R-121-3 step(${n}) advances tick by exactly ${n}`, after === before + n, { before, after });
}

// AC-R-123-2 spawn cheat
s = await app("newGame", { seed: 1 });
const free = freeTilesNear(s, s.player.tile, 8, 3)[0];
const n0 = s.monsters.length;
const sp = await app("cheat.spawnMonster", "zombie-intern", free);
s = await state();
check("AC-R-123-2 spawnMonster adds one monster of that type at that tile", sp.ok && s.monsters.length === n0 + 1 && s.monsters.some((m) => m.type === "zombie-intern" && m.tile.x === free.x && m.tile.y === free.y), sp);
const dup = await app("cheat.spawnMonster", "zombie-intern", free);
check("spawnMonster on an occupied tile is rejected", dup.ok === false && dup.error.length > 0);

// AC-R-121-4: cmd.moveTo equals click({tile}) after step(100)
s = await app("newGame", { seed: 1 });
const T = freeTilesNear(s, s.player.tile, 6, 4);
await app("cmd.moveTo", T); const hA = (await app("step", 100)).hash;
await app("newGame", { seed: 1 });
await app("click", { tile: T }); const hB = (await app("step", 100)).hash;
check("AC-R-121-4 cmd.moveTo and click({tile}) give equal hashes after step(100)", hA === hB, { hA, hB });

// AC-R-121-5 / 121-7
s = await app("newGame", { seed: 1 });
const near = freeTilesNear(s, s.player.tile, 5, 2)[0];
const spawned = await app("cheat.spawnMonster", "zombie-intern", near);
const m0 = (await state()).monsters.find((m) => m.id === spawned.id);
const r = await app("cmd.attack", spawned.id);
const after = (await app("step", 200)).monsters.find((m) => m.id === spawned.id);
check("AC-R-121-5 cmd.attack then step(200): monster hurt or dead", r.ok && (!after || after.hp < m0.hp || after.ai === "dead"), { r, m0: m0.hp, after: after?.hp });
const hBefore = (await state()).hash;
const bad1 = await app("cmd.moveTo", { x: -5, y: -5 }), bad2 = await app("cmd.attack", "nope"), bad3 = await app("cmd.moveTo", "x");
check("AC-R-121-7 invalid arguments return {ok:false,error} and do not change the state", [bad1, bad2, bad3].every((b) => b.ok === false && typeof b.error === "string" && b.error.length > 0) && (await state()).hash === hBefore, { bad1, bad2, bad3 });

// HUD contract (AC-R-070-x)
s = await app("newGame", { seed: 1 });
const hud = s.ui.hud, vp = { w: 1280, h: 720 };
check("AC-R-070-1 hud values equal player hp/mp and ratios match", hud.health.value === s.player.hp && hud.health.max === s.player.hpMax && hud.mana.value === s.player.mp && hud.mana.max === s.player.mpMax && Math.abs(hud.health.ratio - s.player.hp / s.player.hpMax) < 0.01);
check("AC-R-070-3 gauge shapes differ and labels read 'value / max'", hud.health.shape !== hud.mana.shape && hud.health.label === `${s.player.hp} / ${s.player.hpMax}` && hud.mana.label === `${s.player.mp} / ${s.player.mpMax}`, hud);
const inside = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.w && r.y + r.h <= vp.h;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
check("AC-R-070-5 gauge rects are inside the viewport and do not overlap", inside(hud.health.rect) && inside(hud.mana.rect) && !overlap(hud.health.rect, hud.mana.rect));
// AC-R-070-2: damage shows in the same snapshot
s = await app("newGame", { seed: 1 });
const adj = freeTilesNear(s, s.player.tile, 3, 1).find((t) => Math.max(Math.abs(t.x - s.player.tile.x), Math.abs(t.y - s.player.tile.y)) === 1);
await app("cheat.spawnMonster", "zombie-intern", adj);
let hp0 = s.player.hp, t = null;
for (let i = 0; i < 400 && !t; i++) { s = await app("step", 1); if (s.player.hp < hp0) t = s; }
check("AC-R-070-2 hud.health.value equals the new player.hp right after the hit", !!t && t.ui.hud.health.value === t.player.hp, t && t.ui.hud.health);

// AC-R-113-3 frame-rate independence: CPU throttle x4 gives the same hash
const run = async () => { await app("newGame", { seed: 3 }); await app("click", { tile: freeTilesNear(await state(), (await state()).player.tile, 6, 3)[0] }); return (await app("step", 300)).hash; };
const hFree = await run();
const cdp = await g.context.newCDPSession(g.page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const hSlow = await run();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
check("AC-R-113-3 step(300) hash is the same with CPU throttled x4", hFree === hSlow, { hFree, hSlow });

check("atlas has a sprite for every registry id / key (AC-R-101-3 / ADR-0004)", (await app("perf")).atlasMissing.length === 0, (await app("perf")).atlasMissing.slice(0, 5));
check("no page errors", g.errors.length === 0, g.errors);
await g.context.close();
await browser.close();
finish("hook");
