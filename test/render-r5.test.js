// R5 WORLD: class hero sprite keys, the effect archetypes for every skill, status marks, the light-descriptor hook and reduced motion (pure: a recording 2D context, no DOM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, newGame, config } from "../src/core/index.js";
import { requiredKeys, keys, HERO_CLASSES, ALLY_IDS, ALLY_ANIMS, PLAYER_ANIMS, DIRS, heroType, PLAYER_CLASS, PROJECTILES } from "../src/render/keys.js";
import { palette } from "../src/render/styles/vector/palette.js";
import { FIG_DIM } from "../src/render/styles/vector/characters.js";
import { createSkillFx, skillLook, statusFlags, drawStatus, SF, TYPE_COL, FLOAT_COL } from "../src/render/draw/effects.js";
import { makeCamera } from "../src/ui/camera.js";
import { allyUnits as allies } from "../src/core/content/allies.js";

const FX_KEYS = ["fx:slam", "fx:ring", "fx:burst", "fx:ground", "fx:bolt", "fx:shard", "fx:paper", "fx:mark", "fx:glow", "fx:shield", "fx:aura", "fx:summon", "fx:dash", "fx:trap", "fx:crit"];

/** A 2D context that records every call as text (so two frames can be compared) and accepts everything else. */
function recorder() {
  const log = [];
  const fn = (name) => (...a) => { log.push(name + "(" + a.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : typeof v === "object" ? "o" : v)).join(",") + ")"); return name === "createRadialGradient" || name === "createLinearGradient" ? { addColorStop() {} } : undefined; };
  const g = new Proxy({}, { get: (t, k) => (k === "log" ? log : k in t ? t[k] : (t[k] = fn(String(k)))), set: (t, k, v) => { if (k === "fillStyle" || k === "globalAlpha") log.push(k + "=" + v); t[k] = v; return true; } });
  return g;
}
const stubFx = () => ({ reducedMotion: false, reducedFlash: false, core: null, shakeUntil: 0, proj: new Map(), parts: [], burst() {}, });

test("R5: every class has hero sprite keys for every animation in 8 directions, and allies have theirs", () => {
  const all = new Set(requiredKeys(content));
  assert.deepEqual(HERO_CLASSES, content.classes.map((c) => c.id));
  for (const c of content.classes) {
    assert.equal(c.figureKey, `hero.${c.id}`);
    for (const [anim, n] of Object.entries(PLAYER_ANIMS)) for (let d = 0; d < DIRS; d++) for (let f = 0; f < n; f++) assert.ok(all.has(keys.plr(c.id, anim, d, f)), `${c.id} ${anim} ${d} ${f}`);
    assert.ok(FIG_DIM[c.id].head > 40 && FIG_DIM[c.id].shadowR > 8, "plate and shadow metrics");
    assert.ok(palette.rims[c.id], "rim colour");
  }
  for (const id of ALLY_IDS) for (const [anim, n] of Object.entries(ALLY_ANIMS[id])) for (let f = 0; f < n; f++) assert.ok(all.has(keys.ally(id, anim, 0, f)), `${id} ${anim}`);
  for (const id of Object.keys(allies)) assert.ok(ALLY_IDS.includes(id), `ally ${id} has a figure`);
});

test("R5: an unknown or missing class falls back to the old hero; the three class rims differ", () => {
  assert.equal(heroType("it-wizard"), "it-wizard");
  assert.equal(heroType("clerk"), PLAYER_CLASS);
  assert.equal(heroType("nobody"), PLAYER_CLASS);
  assert.equal(heroType(undefined), PLAYER_CLASS);
  assert.equal(new Set(HERO_CLASSES.map((c) => palette.rims[c])).size, 3);
});

test("R5: every skill's fx.cast is a known archetype key and every projectile kind has a sprite key", () => {
  const all = new Set(requiredKeys(content));
  for (const s of Object.values(content.skills)) {
    if (s.fx?.cast) assert.ok(FX_KEYS.includes(s.fx.cast), `${s.id}: ${s.fx.cast}`);
    if (s.delivery?.kind) assert.ok(PROJECTILES.includes(s.delivery.kind), `${s.id} projectile ${s.delivery.kind}`);
  }
  for (const k of PROJECTILES) assert.ok(all.has(keys.proj(k)), k);
  for (const t of ["physical", "fire", "cold", "shock", "acid"]) assert.ok(TYPE_COL[t] && FLOAT_COL[t], t);
  assert.equal(skillLook("server-overheat").type, "fire");
  assert.equal(skillLook("cold-boot").type, "cold");
  assert.equal(skillLook("pallet-slam").fx, "fx:slam");
});

test("R5: monster status fields map to distinct mark flags (stun, mute and freeze share muteT and differ by statusKind)", () => {
  assert.equal(statusFlags({}), 0);
  assert.equal(statusFlags({ muteT: 5, statusKind: "stun" }), SF.stun);
  assert.equal(statusFlags({ muteT: 5, statusKind: "freeze" }), SF.freeze);
  assert.equal(statusFlags({ muteT: 5 }), SF.mute);
  assert.equal(statusFlags({ slowT: 3, weakenT: 3, burnT: 3 }), SF.slow | SF.weaken | SF.burn);
  const g = recorder();
  drawStatus(g, 0, 100, 100, 50, 1.8, 0, false);
  assert.equal(g.log.length, 0, "no flags, no drawing");
  for (const f of [SF.stun, SF.freeze, SF.slow, SF.weaken, SF.burn]) { const r = recorder(); drawStatus(r, f, 100, 100, 50, 1.8, 0, false); assert.ok(r.log.length > 8, `flag ${f} draws`); }
  const a = recorder(), b = recorder(); drawStatus(a, SF.stun, 100, 100, 50, 1.8, 0, true); drawStatus(b, SF.stun, 100, 100, 50, 1.8, 9999, true);
  assert.deepEqual(a.log, b.log, "reduced motion: the stun stars hold still");
});

function stage() {
  const core = newGame(3, { class: "it-wizard", start: "town" });
  core.zones.push({ id: 1, kind: "field", skill: "server-overheat", level: 3, tile: { x: core.player.tile.x + 2, y: core.player.tile.y }, radius: 2.2, armT: 0, ttl: 100 });
  core.zones.push({ id: 2, kind: "trap", skill: "wet-floor", level: 3, tile: { x: core.player.tile.x - 2, y: core.player.tile.y }, radius: 1.2, armT: 5, ttl: 100 });
  core.player.aura = "fire-drill"; core.player.skills["fire-drill"] = 2;
  core.player.absorb = { amount: 30, t: 100, reflect: 0, skill: "firewall" };
  core.projectiles.push({ id: 9, pos: { x: core.player.tile.x + 3, y: core.player.tile.y }, dir: { x: 1, y: 0 }, speed: 0.4, kind: "bolt", owner: "player" });
  return core;
}

test("R5: the light hook lists {x, y, r, colour, intensity} for zones, aura, shield and shots, and nothing when idle", () => {
  const idle = newGame(3, { class: "sales-rep", start: "town" }), cam = makeCamera(1920, 1080, 10, 10);
  const fx = stubFx(); fx.core = idle;
  const sk = createSkillFx(fx);
  sk.drawGround(recorder(), cam, 1000);
  assert.equal(sk.lights.length, 0, "nothing burning, nothing lit");
  const core = stage(); fx.core = core;
  sk.drawGround(recorder(), cam, 1000);
  assert.ok(sk.lights.length >= 4, `lights: ${sk.lights.length}`);
  for (const l of sk.lights) {
    assert.ok(Number.isFinite(l.x) && Number.isFinite(l.y) && l.r > 0 && l.intensity > 0 && l.intensity <= 1.2 && /^#[0-9a-f]{6}$/i.test(l.colour), JSON.stringify(l));
  }
  assert.ok(sk.lights.some((l) => l.colour === "#ff7a2a"), "the overheat field glows orange");
});

test("R5: every R4 effect event is handled and drawn without throwing, and effects expire", () => {
  const core = stage(), cam = makeCamera(1920, 1080, 10, 10), fx = stubFx(); fx.core = core;
  const sk = createSkillFx(fx), p = core.player.tile, tile = { x: p.x + 2, y: p.y + 1 };
  const m = { id: "m1", type: "temp-worker", tile: { x: p.x + 1, y: p.y }, ai: "idle", hp: 5, hpMax: 5, muteT: 40, statusKind: "freeze", burnT: 10 };
  core.monsters.push(m);
  const events = [
    { type: "cast", skill: "pallet-slam", level: 2, tile, archetype: "area", fx: "fx:slam" }, { type: "burst", skill: "pallet-slam", tile, radius: 2.5 },
    { type: "cast", skill: "blue-screen", level: 1, tile, archetype: "area", fx: "fx:burst" }, { type: "cast", skill: "floor-buffer", level: 1, tile: null, archetype: "area", fx: "fx:ring" },
    { type: "cast", skill: "coffee-break", level: 1, tile: null, archetype: "self", fx: "fx:glow" }, { type: "cast", skill: "lockout", level: 1, tile: null, archetype: "buff", fx: "fx:shield" },
    { type: "cast", skill: "power-surge", level: 1, tile, archetype: "projectile", fx: "fx:bolt" }, { type: "hit", target: "m1", skill: "power-surge", value: 5 }, { type: "projectileChain", id: 9, from: tile, to: m.tile },
    { type: "crit", target: "m1" }, { type: "status", target: "m1", kind: "freeze", ticks: 100 }, { type: "dotTick", target: "m1", kind: "burn", value: 2 }, { type: "dotTick", target: "player", kind: "hot", value: 2 },
    { type: "absorb", skill: "firewall", amount: 5, remaining: 25 }, { type: "buffStart", skill: "hustle", stat: "attackRating", ticks: 100 }, { type: "aura", skill: "fire-drill", on: true },
    { type: "summon", skill: "intern", unit: "intern", id: "a1", tile }, { type: "summon", skill: "traffic-cone", unit: "cone", id: "a2", tile }, { type: "allyDied", id: "a1" },
    { type: "zoneStart", id: 5, skill: "wet-floor", kind: "trap", tile, radius: 1.2 }, { type: "zoneTrigger", id: 5 }, { type: "zoneStart", id: 6, skill: "server-overheat", kind: "field", tile, radius: 2 }, { type: "zoneEnd", id: 6 },
    { type: "dash", skill: "dolly-charge", from: { x: p.x, y: p.y }, to: { x: p.x + 4, y: p.y } },
  ];
  for (const ev of events) sk.handle(ev, core, 1000);
  assert.ok(sk.efx.length >= 15, `effects: ${sk.efx.length}`);
  const kinds = new Set(sk.efx.map((e) => e.k));
  for (const k of ["slam", "burst", "ring", "glow", "arc", "crit", "statusPop", "puff", "thump", "splash", "dash", "buff", "shieldFlash"]) assert.ok(kinds.has(k), `effect ${k}`);
  const g = recorder();
  sk.drawGround(g, cam, 1100); sk.drawAir(g, cam, 1100, 0);
  assert.ok(g.log.length > 200);
  sk.drawGround(recorder(), cam, 1e6);
  assert.equal(sk.efx.length, 0, "every transient effect expires");
});

test("R5: reduced motion holds the state-backed effects still (zone flames, aura, shield) and reduced flash drops the white flash", () => {
  const core = stage(), cam = makeCamera(1920, 1080, 10, 10), fx = stubFx(); fx.core = core; fx.reducedMotion = true;
  const sk = createSkillFx(fx), a = recorder(), b = recorder();
  sk.drawGround(a, cam, 1000); sk.drawAir(a, cam, 1000, 0);
  sk.drawGround(b, cam, 98765); sk.drawAir(b, cam, 98765, 0);
  assert.deepEqual(a.log, b.log, "same frame at any time");
  const run = (reducedFlash) => {
    const sk2 = createSkillFx({ ...stubFx(), core, reducedFlash }), g = recorder();
    sk2.handle({ type: "crit", target: "player" }, core, 1000); sk2.handle({ type: "absorb", skill: "firewall", amount: 1, remaining: 10 }, core, 1000);
    sk2.drawAir(g, cam, 1050, 0);
    return g.log;
  };
  assert.ok(run(false).includes("fillStyle=#ffffff"), "full flash uses a white star");
  assert.ok(!run(true).includes("fillStyle=#ffffff"), "reduced flash: no white fills");
});
