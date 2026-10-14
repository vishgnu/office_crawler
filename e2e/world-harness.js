// WORLD debug scene (S2): drives the real renderer modules (style atlas, drawWorld, fx, lighting, labels) against hand-staged core states.
// It does not use the game shell or the test hook, so it keeps working while the UI package changes. Bundled by e2e/world-shots.mjs.
import { newGame, step, applyInput, content, config, spawnMonster, teleportFloor, spawnItem, dropGold, setLevel, fireProjectile, castSkill, learnSkill } from "../src/core/index.js";
import { getStyle } from "../src/render/style.js";
import { drawWorld, actorPos } from "../src/render/world.js";
import { createFx } from "../src/render/fx.js";
import { createLighting } from "../src/render/light.js";
import { createLabels } from "../src/render/labels.js";
import { makeCamera, worldScale } from "../src/ui/camera.js";
import { viewConfig } from "../src/ui/layout.js";
import { posOf } from "../src/core/pos.js";
import { hasLineOfSight } from "../src/core/los.js";
import { getCtx } from "../src/core/ctx.js";
import { requiredKeys, HERO_CLASSES } from "../src/render/keys.js";
import { drawFigure, figureKeys } from "../src/render/figure.js";
import { damageMonster } from "../src/core/systems/damage.js";

const W = { atlas: null, fx: null, light: null, labels: null, core: null, rs: { facing: new Map() }, size: { w: 1920, h: 1080 }, now: 1000 };
window.W = W;

W.init = async (w = 1920, h = 1080, zoom = viewConfig.zoom) => {
  viewConfig.zoom = zoom; // the bench scene plays at zoom 1, the game at 1.8
  W.size = { w, h };
  const canvas = document.getElementById("game");
  canvas.width = w; canvas.height = h;
  const style = getStyle("vector");
  const z = worldScale(w, h);
  const params = { scale: Math.min(2.5, Math.max(1, Math.ceil(z * 2 - 0.01) / 2)), rim: Math.min(3, Math.max(0.5, Math.round((2 / z) * 4) / 4)), hc: false };
  const t0 = performance.now();
  let tl = t0; W.steps = [];
  W.atlas = await style.build(() => { const n = performance.now(); W.steps.push(Math.round(n - tl)); tl = n; }, params);
  W.buildMs = performance.now() - t0;
  W.style = style; W.fx = createFx(style); W.light = createLighting(style); W.labels = createLabels(style);
  W.missing = requiredKeys(content).filter((k) => !W.atlas.has(k));
  return { buildMs: W.buildMs, steps: W.steps.join(","), keys: W.atlas.keys().length, missing: W.missing.slice(0, 10), missingN: W.missing.length, scale: params.scale };
};

const free = (s, c, r, min = 1) => {
  const { w, h, tiles, props } = s.floor, blocked = new Set(props.filter((p) => p.blocks).map((p) => p.y * w + p.x)), out = [];
  const occ = new Set(s.monsters.map((m) => `${m.tile.x},${m.tile.y}`).concat(s.groundItems.map((g) => `${g.tile.x},${g.tile.y}`)));
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const d = Math.max(Math.abs(x - c.x), Math.abs(y - c.y)), code = tiles[y * w + x];
    if ((code !== 1 && code !== 3) || blocked.has(y * w + x) || occ.has(`${x},${y}`) || d < min) continue;
    out.push({ x, y, d, k: Math.hypot(x - c.x, y - c.y) });
  }
  return out.sort((a, b) => a.k - b.k || a.y - b.y || a.x - b.x);
};
W.free = free;

const dispatch = (from = 0) => { const ev = W.core.events; for (let i = from; i < ev.length; i++) W.fx.handle(ev[i], W.core, W.now); };
W.live = true; // render after every tick, like the real loop, so fx sees projectile positions
W.step = (n = 1) => { for (let i = 0; i < n; i++) { step(W.core); dispatch(0); W.now += 1000 / config.tickHz; if (W.live) W.render(); } };

W.render = (focus = null, opts = {}) => {
  const canvas = document.getElementById("game"), g = canvas.getContext("2d"), { w, h } = W.size, core = W.core;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#07080c"; g.fillRect(0, 0, w, h);
  const p = actorPos(core.player), f = focus ?? W.focus ?? { x: p.x, y: p.y };
  const cam = makeCamera(w, h, f.x + 0.5, f.y + 0.5);
  W.light.ensure(cam, false, false);
  const env = { lighting: W.light, style: W.style, lowFx: false, hc: false };
  const T = W.timing ?? (W.timing = { world: 0, light: 0, labels: 0, fx: 0 });
  let t = performance.now();
  const lap = (k) => { const n = performance.now(); T[k] += n - t; t = n; };
  const out = drawWorld(g, cam, W.atlas, core, new Map(), 1, W.fx, W.now, W.rs, env); lap("world");
  W.light.draw(g, cam, out.heroScreen, W.now); lap("light");
  W.labels.place(out.actors, cam, Math.min(w / 1280, h / 720), core.player.target, null, out.heroScreen, [], false, 1);
  W.labels.draw(g); lap("labels");
  W.fx.draw(g, cam, W.atlas, W.now, out.heroDir);
  W.fx.drawHurt(g, w, h, W.now); lap("fx");
  return { labels: W.labels.count };
};

const placeHero = (tile) => { W.core.player.tile = { ...tile }; };

W.scene = (name, seed = 3) => {
  W.now = 1000; W.fx.reset(); W.rs.facing.clear();
  const s = (W.core = newGame(seed, { start: "town" }));
  if (name === "lobby") {
    placeHero({ x: 9, y: 7 });
    W.step(2);
    return { depth: s.depth, theme: s.floor.theme, npcs: s.floor.npcs.length };
  }
  const depth = { basement: 6, champions: 2, loot: 2, monsters: 5, lineup: 6 }[name] ?? 1;
  teleportFloor(s, depth);
  s.monsters.length = 0; // staged scenes start empty
  W.core.floor.spawns = [];
  const hero = s.player.tile;
  const near = free(s, hero, 8, 2).filter((t) => t.x + t.y <= hero.x + hero.y + 1); // staging: nothing in front of the hero, so no wall hides it
  const at = (i) => near[i] ?? near[near.length - 1];
  if (name === "lineup") { // every new monster idle, facing the viewer, in a row close to the hero (for art review)
    const types = ["temp-worker", "printer-demon", "middle-manager", "vending-machine", "consultant", "auditor", "zombie-intern", "printer-imp"];
    const row = free(s, hero, 6, 1).filter((t) => t.y - hero.y === 2).slice(0, 8);
    types.forEach((t, i) => { const tt = row[i] ?? near[i]; spawnMonster(s, t, tt, null, { level: depth }); });
    return { depth, row: row.length, monsters: s.monsters.map((m) => m.type) };
  }
  if (name === "basement" || name === "monsters") {
    const types = ["temp-worker", "printer-demon", "middle-manager", "vending-machine", "consultant", "auditor"];
    const offs = [at(2), at(5), at(8), at(11), at(14), at(17)];
    types.forEach((t, i) => spawnMonster(s, t, offs[i], null, { level: depth }));
    W.step(24);
    const demon = s.monsters.find((m) => m.type === "printer-demon"), cons = s.monsters.find((m) => m.type === "consultant");
    for (const [m, kind, speed] of [[demon, "toner", 0.22], [cons, "slide", 0.26]]) {
      if (!m) continue;
      fireProjectile(s, posOf(m), posOf(s.player), { owner: m.id, kind, speed, range: 12, dmg: { min: 1, max: 2 }, att: { level: 1, attackRating: 10 } });
    }
    fireProjectile(s, posOf(s.player), posOf(s.monsters[2] ?? s.monsters[0]), { owner: "player", kind: "stapler", speed: 0.35, range: 12, dmg: { min: 1, max: 2 }, att: s.player, skill: "stapler-throw" });
    W.step(5);
  } else if (name === "champions") {
    const specs = [["zombie-intern", ["burly", "vicious"]], ["printer-imp", ["caffeinated"]], ["temp-worker", ["armored", "regenerating"]], ["middle-manager", ["burly"]]];
    specs.forEach(([t, mods], i) => spawnMonster(s, t, at(2 + i * 3), null, { tier: "champion", mods, level: depth }));
    spawnMonster(s, "zombie-intern", at(14), null, { level: depth });
    spawnMonster(s, "zombie-intern", at(16), null, { level: depth });
    spawnMonster(s, "printer-imp", at(18), null, { level: depth });
    spawnMonster(s, "temp-worker", at(20), null, { level: depth });
    W.step(10);
    // state visuals: stagger, flee, muted, a hit flash
    const [a, b, c] = s.monsters.slice(4);
    if (a) { a.ai = "stagger"; a.staggerT = 12; a.flashTicks = 6; }
    if (b) { b.ai = "flee"; b.fleeT = 100; }
    if (c) { c.muteT = 90; }
  } else if (name === "loot") {
    const rar = [["normal"], ["magic"], ["rare"], ["unique"], ["magic"], ["rare"], ["normal"], ["unique"], ["rare"]];
    const o = at(9); // the pile lies a few tiles from the hero
    rar.forEach(([r], i) => { spawnItem(s, { rarity: r }, o); });
    dropGold(s, 12, o); dropGold(s, 55, o); dropGold(s, 240, o);
    spawnItem(s, { potion: true }, o);
    W.step(1);
  }
  return { depth: s.depth, theme: s.floor.theme, monsters: s.monsters.map((m) => `${m.type}:${m.ai}`), ground: s.groundItems.map((g) => `${g.rarity ?? "gold"}:${g.label}`) };
};


// ---- WORLD-G scenes (graphics detail round): the five review shots at real game scale ----
// office: depth 1 (open plan), hero in a room, zombie / imp / temp worker around; basement: depth 6; lobby: the town; boardroom: the Executive Suite, boss idle.
W.gScene = (name, seed = 3) => {
  if (name === "boardroom") { const r = W.boss("idle"); W.focus = W.focusBoss(); W.focus.y -= 2.5; return r; }
  W.focus = null;
  if (name === "lobby") return W.scene("lobby");
  W.now = 1000; W.fx.reset(); W.rs.facing.clear();
  const s = (W.core = newGame(seed, { start: "town" }));
  teleportFloor(s, name === "basement" ? 6 : 1);
  s.monsters.length = 0; W.core.floor.spawns = [];
  const hero = s.player.tile;
  const near = free(s, hero, 8, 2).filter((t) => t.x + t.y <= hero.x + hero.y + 1);
  const at = (i) => near[i] ?? near[near.length - 1];
  const types = name === "basement" ? ["temp-worker", "printer-demon", "middle-manager", "vending-machine", "consultant", "auditor"] : ["zombie-intern", "printer-imp", "temp-worker", "zombie-intern", "middle-manager"];
  types.forEach((t, i) => spawnMonster(s, t, at(2 + i * 3), null, { level: s.depth }));
  W.step(24);
  return { depth: s.depth, theme: s.floor.theme, monsters: s.monsters.map((m) => m.type) };
};

W.castDemo = () => { // cast pose + rune ring + burst + heal + levelup
  const s = W.core;
  setLevel(s, 5);
  learnSkill(s, "reply-all"); learnSkill(s, "coffee-break");
  s.player.mp = s.player.mpMax;
  castSkill(s, "reply-all", { x: s.player.tile.x + 1, y: s.player.tile.y });
  dispatch(0);
};
W.cast = (id) => { const s = W.core; s.player.mp = s.player.mpMax; const r = castSkill(s, id, { x: s.player.tile.x + 2, y: s.player.tile.y + 1 }); dispatch(0); return r; };
W.levelup = () => { const s = W.core; s.events.push({ type: "levelup", level: 2, levels: 1 }); dispatch(0); };
W.learn = (id) => learnSkill(W.core, id);
W.setLevel = (n) => setLevel(W.core, n);
W.setNow = (t) => { W.now = t; };
W.tilePos = () => ({ ...W.core.player.tile });

// Contact sheet of figure sprites (art review): rows = types, columns = [anim:dir:frame] specs, drawn on the basement floor colour.
W.sheet = (types, specs, k = 2.2, bg = "#2b3647") => {
  const canvas = document.getElementById("game"), g = canvas.getContext("2d"), { w, h } = W.size;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const cw = Math.floor(w / specs.length), ch = Math.floor(h / types.length);
  types.forEach((type, r) => specs.forEach(([anim, dir, f], c) => {
    const key = type === "clerk" || HERO_CLASSES.includes(type) ? `plr:${type}:${anim}:${dir}:${f}` : type.startsWith("ally.") ? `ally:${type.slice(5)}:${anim}:${dir}:${f}` : type.startsWith("npc-") ? `npc:${type.slice(4)}:${f}` : `mon:${type}:${anim}:${dir}:${f}`;
    const e = W.atlas.get(key);
    if (!e) { g.fillStyle = "#f00"; g.fillText("missing " + key, c * cw + 10, r * ch + 20); return; }
    const x = c * cw + cw / 2, y = r * ch + ch * 0.78;
    g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(x, y, 20 * k, 8 * k, 0, 0, 7); g.fill();
    g.drawImage(e.img, Math.round(x - e.ox * k), Math.round(y - e.oy * k), Math.round(e.w * k), Math.round(e.h * k));
  }));
};

// Render cost with a crowd: 50 monsters (a fifth of them champions), 20 ground items and a few projectiles in view. Returns ms per frame.
W.perf = (frames = 60, o = {}) => {
  const opt = { n: 50, champ: true, loot: true, proj: true, scene: "monsters", ...o };
  W.scene(opt.scene, 11);
  const s = W.core, types = Object.keys(content.monsters);
  s.monsters.length = 0;
  const spots = free(s, s.player.tile, 9, 1);
  for (let i = 0; i < opt.n && i < spots.length; i++) spawnMonster(s, types[i % types.length], spots[i], null, opt.champ && i % 5 === 0 ? { tier: "champion", mods: ["burly", "vicious"] } : {});
  if (opt.loot) for (let i = 0; i < 20; i++) spawnItem(s, { rarity: ["normal", "magic", "rare", "unique"][i % 4] }, spots[(i * 7) % spots.length]);
  W.live = false;
  W.step(30);
  if (opt.proj) for (let i = 0; i < 4; i++) { const m = s.monsters[i]; if (m) fireProjectile(s, posOf(m), posOf(s.player), { owner: m.id, kind: ["toner", "slide", "stapler", "toner"][i], speed: 0.2, range: 12, dmg: { min: 1, max: 2 }, att: { level: 1, attackRating: 10 } }); }
  W.render(); W.timing = null; // warm the lazy silhouette caches first
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) { W.now += 16; W.render(); }
  // force the GPU queue to drain so the wall time is honest
  document.getElementById("game").getContext("2d").getImageData(0, 0, 1, 1);
  const ms = (performance.now() - t0) / frames;
  return { ...opt, msPerFrame: +ms.toFixed(1), fps: +(1000 / ms).toFixed(1), monsters: s.monsters.filter((m) => m.ai !== "dead").length, ground: s.groundItems.length, projectiles: s.projectiles.length };
};

// ---- S3 boss staging (the Executive Suite, depth 9) ----
// stage: "idle" (phase 1, engaged, nothing winding up), "slam" / "volley" / "summon" (that telegraph at `at` progress 0..1), "phase2" (jacket off, the roar), "victory" (the boss dies, confetti)
const bossOf = () => W.core.monsters.find((m) => m.tier === "boss");
W.boss = (stage = "idle", at = 0.6, seed = 3) => {
  W.now = 1000; W.fx.reset(); W.rs.facing.clear();
  const s = (W.core = newGame(seed, { start: "town" }));
  teleportFloor(s, 9);
  s.player.hpMax = s.player.hp = 1e7;
  const b = bossOf();
  s.player.tile = { x: b.tile.x + 1, y: b.tile.y + 6 };
  W.live = false;
  const run = (n) => { for (let i = 0; i < n; i++) { step(s); dispatch(0); W.now += 1000 / config.tickHz; } };
  run(60);
  if (stage === "idle") { b.boss.cd = 1e6; run(2); }
  else if (stage === "slam" || stage === "volley" || stage === "summon") {
    if (stage !== "slam") { b.hp = Math.floor(b.hpMax * 0.4); run(2); }
    b.boss.cd = 0; b.boss.seq = stage === "volley" ? 1 : 0; b.boss.summonCd = stage === "summon" ? 0 : 1e6;
    for (let i = 0; i < 300 && !(b.boss.windup?.kind === stage); i++) run(1);
    const w = b.boss.windup; if (w) run(Math.floor(w.total * at));
  } else if (stage === "phase2") {
    b.hp = Math.floor(b.hpMax * 0.45); b.boss.cd = 1e6; b.boss.summonCd = 0; run(1); // the phase event fires; summon winds up next
    run(80); // the summon lands: temp staff around the boss
  } else if (stage === "victory") {
    damageMonster(s, b, b.hp + 1, { source: "player" });
    dispatch(0); // the kill events (emitted outside step) reach fx
    run(26);
  }
  const w = b.boss.windup;
  return { stage, phase: b.boss.phase, windup: w ? { kind: w.kind, t: w.t, total: w.total } : null, hero: { ...s.player.tile }, boss: { ...b.tile }, ai: b.ai, summoned: s.monsters.filter((m) => m.summoned).length, scene: s.scene, defeated: s.bossDefeated, events: s.events.map((e) => e.type) };
};
W.focusBoss = () => { const b = bossOf(), p = W.core.player.tile; if (b) W.bossTile = { ...b.tile }; const t = W.bossTile; return { x: (t.x * 0.55 + p.x * 0.45), y: (t.y * 0.55 + p.y * 0.45) }; };
W.renderBoss = (zoomFocus = true, dy = 0) => { const f = W.focusBoss(); W.render(zoomFocus ? { x: f.x, y: f.y + dy } : null); };
W.floor8Stairs = (unlocked) => {
  W.now = 1000; W.fx.reset();
  const s = (W.core = newGame(3, { start: "town" }));
  teleportFloor(s, 8); s.monsters.length = 0; s.bossUnlocked = !!unlocked;
  const st = s.floor.exit ?? null;
  if (st) s.player.tile = { x: st.x, y: st.y + 2 };
  return { exit: st, bossStairs: s.floor.bossStairs };
};

// ---- R5 class fights: real core states (class heroes, real casts), staged around the hero ----
// W.fight(cls): the hero stands in the basement with a ring of monsters at 3-5 tiles. W.skill(id): grants the skill and casts it at the nearest monster.
// W.panel(i, cols, rows, [ox, oy]): copies the hero-centred crop of the current frame into cell i of a contact sheet; W.panelsShow() draws the sheet to the canvas.
W.fight = (cls, o = {}) => {
  const opt = { seed: 5, depth: 4, n: 5, types: ["temp-worker", "zombie-intern", "printer-imp", "middle-manager", "consultant", "temp-worker", "zombie-intern", "printer-imp"], r: [2, 4], ...o };
  W.now = 1000; W.fx.reset(); W.rs.facing.clear();
  const s = (W.core = newGame(opt.seed, { class: cls, start: "town" }));
  teleportFloor(s, opt.depth);
  s.monsters.length = 0; W.core.floor.spawns = [];
  setLevel(s, 30);
  s.player.hpMax = s.player.hp = 1e6; s.player.mpMax = s.player.mp = 1e5;
  { // stand in the most open spot of the floor, so no wall hides the fight
    const { w, h, tiles, props } = s.floor, blocked = new Set(props.filter((p) => p.blocks).map((p) => p.y * w + p.x));
    const ok = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (tiles[y * w + x] === 1 || tiles[y * w + x] === 3) && !blocked.has(y * w + x);
    let best = null, bs = -1;
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      if (!ok(x, y)) continue;
      let n = 0; for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (ok(x + dx, y + dy)) n++;
      if (n > bs) { bs = n; best = { x, y }; }
    }
    if (best) s.player.tile = best;
  }
  const hero = s.player.tile;
  // candidates inside the hero-centred frame (screen offsets of at most 3 tiles across), in line of sight, none right in front of the hero (it would fade him)
  const ring = free(s, hero, 7, 2).filter((t) => { const dx = t.x - hero.x, dy = t.y - hero.y, sx = dx - dy, sy = dx + dy; return Math.abs(sx) <= 4 && sy >= -6 && sy <= 2 && (sy <= 0 || Math.abs(sx) >= 3) && hasLineOfSight(getCtx(s).grid, hero.x, hero.y, t.x, t.y); });
  ring.sort((a, b) => Math.atan2((a.y - hero.y) + (a.x - hero.x), (a.x - hero.x) - (a.y - hero.y)) - Math.atan2((b.y - hero.y) + (b.x - hero.x), (b.x - hero.x) - (b.y - hero.y)));
  const step = Math.max(1, Math.floor(ring.length / opt.n));
  for (let i = 0; i < opt.n; i++) { const t = ring[(i * step) % ring.length]; if (t) spawnMonster(s, opt.types[i % opt.types.length], t, null, { level: opt.depth }); }
  for (const m of s.monsters) { m.hp = m.hpMax = 1e5; }
  W.live = true; W.step(3);
  return { class: s.player.class, hero: { ...hero }, monsters: s.monsters.length };
};
W.nearest = () => { const s = W.core, p = s.player.tile; return s.monsters.filter((m) => m.ai !== "dead").sort((a, b) => Math.hypot(a.tile.x - p.x, a.tile.y - p.y) - Math.hypot(b.tile.x - p.x, b.tile.y - p.y))[0]; };
W.skill = (id, level = 3, rel = null) => {
  const s = W.core, p = s.player;
  p.skills[id] = level; p.mp = p.mpMax;
  const m = W.nearest();
  const tile = rel ? { x: p.tile.x + rel[0], y: p.tile.y + rel[1] } : m ? { ...m.tile } : { x: p.tile.x + 3, y: p.tile.y + 2 };
  const r = castSkill(s, id, tile);
  dispatch(0);
  return { id, ok: r?.ok ?? r, error: r?.error ?? null, target: tile };
};
W.aura = (id, level = 3) => { const s = W.core; s.player.skills[id] = level; s.player.mp = s.player.mpMax; const r = applyInput(s, { t: "toggleAura", id }); dispatch(0); return r; };
W.setStatus = (kinds) => { // stage statuses on the monsters, one kind per monster in order
  const s = W.core, ms = s.monsters.filter((m) => m.ai !== "dead");
  kinds.forEach((k, i) => {
    const m = ms[i]; if (!m || !k) return;
    for (const kk of [].concat(k)) {
      if (kk === "stun" || kk === "mute" || kk === "freeze") { m.muteT = 600; m.statusKind = kk; }
      else if (kk === "slow") { m.slowT = 600; m.slowMag = 30; } else if (kk === "weaken") { m.weakenT = 600; m.weakenMag = 30; } else if (kk === "burn") { m.burnT = 600; m.burnDmg = 1; }
    }
  });
};
W.crit = () => { const s = W.core, m = W.nearest(); if (!m) return; s.events.push({ type: "crit", target: m.id }); s.floaters.push({ value: 48, tile: { ...m.tile }, target: m.id, kind: "crit", dmgType: "physical", life: config.floaterTicks }); dispatch(0); };
W.unflash = () => { for (const m of W.core.monsters) m.flashTicks = 0; W.core.player.flashTicks = 0; };
W.hold = () => { for (const m of W.core.monsters) { m.ai = "idle"; } };
W.panelSheet = null;
W.panel = (i, cols, rows, o = {}) => {
  const main = document.getElementById("game"), { w, h } = W.size, cw = Math.floor(w / cols), ch = Math.floor(h / rows);
  if (!W.panelSheet || W.panelSheet.cols !== cols || W.panelSheet.rows !== rows) { const c = document.createElement("canvas"); c.width = w; c.height = h; W.panelSheet = { c, cols, rows }; const g = c.getContext("2d"); g.fillStyle = "#07080c"; g.fillRect(0, 0, w, h); }
  const g = W.panelSheet.c.getContext("2d"), sx = Math.round(w / 2 + (o.ox ?? 0) - cw / 2), sy = Math.round(h * 0.56 + (o.oy ?? 0) - ch / 2);
  g.drawImage(main, sx, sy, cw, ch, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
  g.strokeStyle = "#07080c"; g.lineWidth = 3; g.strokeRect((i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
  return { sx, sy, cw, ch };
};
W.panelsShow = (k = 1) => { const main = document.getElementById("game"), g = main.getContext("2d"); g.fillStyle = "#07080c"; g.fillRect(0, 0, main.width, main.height); g.drawImage(W.panelSheet.c, 0, 0, Math.round(main.width * k), Math.round(main.height * k)); W.panelSheet = null; };
W.render2 = () => { W.render(); };
W.dumpEvents = () => W.core.events.map((e) => e.type).join(",");

// Distinguishability at ~60 px (decision.md, character select): downscale each class's sprite to 60 px tall and compare mean colour and silhouette.
W.distinct = (h = 60) => {
  const ids = ["facilities-manager", "sales-rep", "it-wizard"], feats = {};
  for (const id of ids) {
    const acc = { mask: null, rgb: [0, 0, 0], n: 0 }, size = Math.round(h * 1.1);
    for (const [anim, dir, f] of [["idle", 0, 0], ["idle", 2, 1], ["walk", 6, 2], ["idle", 4, 0], ["attack", 0, 2]]) {
      const e = W.atlas.get(`plr:${id}:${anim}:${dir}:${f}`), c = document.createElement("canvas"), k = h / 76; // 76 logical px = feet to the top of the canvas
      c.width = size; c.height = size; const g = c.getContext("2d");
      g.drawImage(e.img, 0, 0, e.img.width, e.img.height, size / 2 - e.ox * k, size - 6 - e.oy * k, e.w * k, e.h * k);
      const d = g.getImageData(0, 0, size, size).data, m = new Uint8Array(size * size);
      for (let i = 0; i < size * size; i++) if (d[i * 4 + 3] > 120) { m[i] = 1; acc.rgb[0] += d[i * 4]; acc.rgb[1] += d[i * 4 + 1]; acc.rgb[2] += d[i * 4 + 2]; acc.n++; }
      acc.mask = acc.mask ? acc.mask.map((v, i) => v + m[i]) : Array.from(m);
    }
    feats[id] = { mask: acc.mask.map((v) => (v >= 2 ? 1 : 0)), rgb: acc.rgb.map((v) => Math.round(v / acc.n)) };
  }
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = feats[ids[i]], b = feats[ids[j]]; let inter = 0, uni = 0;
    for (let k = 0; k < a.mask.length; k++) { inter += a.mask[k] & b.mask[k]; uni += a.mask[k] | b.mask[k]; }
    out.push({ pair: `${ids[i]} / ${ids[j]}`, iou: +(inter / uni).toFixed(2), colourDist: Math.round(Math.hypot(a.rgb[0] - b.rgb[0], a.rgb[1] - b.rgb[1], a.rgb[2] - b.rgb[2])) });
  }
  return { rgb: Object.fromEntries(ids.map((id) => [id, feats[id].rgb])), pairs: out };
};

// drawFigure(canvas, figureKey, opts) for DOM screens: every figure key, portrait and card-idle, on the main canvas (check of render/figure.js)
W.figures = () => {
  const main = document.getElementById("game"), g = main.getContext("2d"), keysList = figureKeys();
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#2b3647"; g.fillRect(0, 0, main.width, main.height);
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  keysList.forEach((k, i) => ["portrait", "card-idle"].forEach((anim, j) => { drawFigure(c, k, { anim, t: 0.6 }); g.drawImage(c, 40 + i * 270, 40 + j * 270); }));
  return keysList;
};
