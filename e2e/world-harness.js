// WORLD debug scene (S2): drives the real renderer modules (style atlas, drawWorld, fx, lighting, labels) against hand-staged core states.
// It does not use the game shell or the test hook, so it keeps working while the UI package changes. Bundled by e2e/world-shots.mjs.
import { newGame, step, content, config, spawnMonster, teleportFloor, spawnItem, dropGold, setLevel, fireProjectile, castSkill, learnSkill } from "../src/core/index.js";
import { getStyle } from "../src/render/style.js";
import { drawWorld, actorPos } from "../src/render/world.js";
import { createFx } from "../src/render/fx.js";
import { createLighting } from "../src/render/light.js";
import { createLabels } from "../src/render/labels.js";
import { makeCamera, worldScale } from "../src/ui/camera.js";
import { viewConfig } from "../src/ui/layout.js";
import { posOf } from "../src/core/pos.js";
import { requiredKeys, HERO_CLASSES } from "../src/render/keys.js";
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
  W.atlas = await style.build(() => {}, params);
  W.buildMs = performance.now() - t0;
  W.style = style; W.fx = createFx(style); W.light = createLighting(style); W.labels = createLabels(style);
  W.missing = requiredKeys(content).filter((k) => !W.atlas.has(k));
  return { buildMs: W.buildMs, keys: W.atlas.keys().length, missing: W.missing.slice(0, 10), missingN: W.missing.length, scale: params.scale };
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
  const p = actorPos(core.player), f = focus ?? { x: p.x, y: p.y };
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
