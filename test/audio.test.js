// Audio: event -> cue mapping, voice limiter, spatial maths and the engine against a fake AudioContext (no real audio, no wall clock).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { content } from "../src/core/index.js";
import { createBus } from "../src/bus.js";
import { mapEvent, mappedEventTypes, EVENT_MAP, SILENT_EVENTS, SFX_IDS, MONSTER_VOICE, SKILL_CUE, ambientZone, ZONES, COOLDOWNS } from "../src/audio/cues.js";
import { createVoiceLimiter } from "../src/audio/limiter.js";
import { distanceGain, panFor, place } from "../src/audio/spatial.js";
import { audioConfig } from "../src/audio/config.js";
import { createAudio, KIT_IDS } from "../src/audio/index.js";

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

const state = (extra = {}) => ({
  tick: 7, scene: "floor", depth: 1, floor: { theme: "open-plan" }, paused: false,
  player: { tile: { x: 10, y: 10 } },
  monsters: [{ id: "m1", type: "zombie-intern", tile: { x: 12, y: 10 } }, { id: "m2", type: "printer-imp", tile: { x: 10, y: 30 } }, { id: "m3", type: "auditor", tile: { x: 11, y: 11 } }],
  projectiles: [], ...extra,
});

test("every event type the core emits has a cue or a documented reason to be silent", () => {
  const types = new Set();
  for (const f of files("src/core").filter((x) => x.endsWith(".js"))) for (const m of strip(readFileSync(f, "utf8")).matchAll(/emit\([a-zA-Z.]+,\s*\{\s*type:\s*"([^"]+)"/g)) types.add(m[1]);
  assert.ok(types.size > 30, "found the core event types");
  // S3 core events (boss, finale, autosave) that the audio package maps in the UI/audio slice (docs/reviews/S3-core-notes.md,
  // render_needs). They are emitted by the core now; delete an entry here when src/audio/cues.js maps it. Anything else must be mapped.
  const PENDING_AUDIO_S3 = new Set(["bossTelegraph", "bossSlam", "bossVolley", "bossSummon", "bossPhase", "bossEngage", "bossDefeated", "stairsUnlocked", "victory", "keepPlaying", "autosave", "resisted"]);
  for (const t of PENDING_AUDIO_S3) assert.ok(types.has(t), `${t} is listed as pending but the core no longer emits it`);
  const missing = [...types].filter((t) => !(t in EVENT_MAP) && !(t in SILENT_EVENTS) && !PENDING_AUDIO_S3.has(t));
  assert.deepEqual(missing, []);
  for (const t of Object.keys(SILENT_EVENTS)) assert.ok(!(t in EVENT_MAP), `${t} is both mapped and silent`);
});

test("the events named in the spec produce the spec's cues", () => {
  const s = state();
  const names = (ev) => mapEvent(ev, s).map((d) => d.name);
  assert.ok(names({ type: "hit", source: "player", target: "m1", value: 5 }).includes("attack"));
  assert.ok(names({ type: "hit", source: "player", target: "m1", value: 5 }).includes("hit"));
  assert.deepEqual(names({ type: "kill", source: "player", target: "m1", xp: 5 }), ["death"]);
  assert.deepEqual(names({ type: "pickup", id: "i1", rarity: "normal" }), ["pickup"]);
  assert.deepEqual(names({ type: "ui:click" }), ["uiClick"]);
  assert.deepEqual(names({ type: "levelup", level: 2 }), ["levelUp"]);
  assert.deepEqual(names({ type: "potion", slot: 0 }), ["potion"]);
});

test("AC-R-080-4: a miss never plays a hit cue", () => {
  const out = mapEvent({ type: "miss", source: "player", target: "m1" }, state());
  assert.deepEqual(out.map((d) => d.cue), ["miss"]);
  assert.ok(!out.some((d) => d.name === "hit" || d.cue.startsWith("hit")));
});

test("cue ids are real sounds; the sound list matches the measured kits", () => {
  for (const v of "ABC") {
    const ids = Object.keys(JSON.parse(readFileSync(`docs/product/variants/sound-direction/measure-${v}.json`, "utf8")).sfx);
    assert.deepEqual([...ids].sort(), [...SFX_IDS].sort(), `kit ${v}`);
  }
  const s = state();
  const samples = [{ type: "hit", source: "player", target: "m1" }, { type: "hit", source: "m1", target: "player" }, { type: "kill", target: "m2" }, { type: "death", target: "player" },
    { type: "cast", skill: "mute" }, { type: "projectile", id: "j1", owner: "m1" }, { type: "pickup", rarity: "unique" }];
  for (const ev of samples) for (const d of mapEvent(ev, s)) assert.ok(SFX_IDS.includes(d.cue), d.cue);
});

test("every monster type and every active skill has a voice / cast cue", () => {
  for (const type of Object.keys(content.monsters)) assert.ok(MONSTER_VOICE[type], `monster ${type} has no voice`);
  for (const sk of Object.values(content.skills ?? {})) if (sk.kind === "active") assert.ok(SKILL_CUE[sk.id], `skill ${sk.id} has no cast cue`);
  const s = state();
  for (const type of Object.keys(content.monsters)) {
    s.monsters.push({ id: `x-${type}`, type, tile: { x: 11, y: 10 } });
    const k = mapEvent({ type: "kill", target: `x-${type}` }, s)[0];
    assert.match(k.cue, /^death(Zombie|Imp|Manager)$/);
  }
});

test("rarity picks the pickup cue; gold is a coin; unknown rarity is a plain pickup", () => {
  const cue = (ev) => mapEvent(ev, state())[0].cue;
  assert.equal(cue({ type: "pickup", rarity: "magic" }), "pickupItem");
  assert.equal(cue({ type: "pickup", rarity: "rare" }), "pickupRare");
  assert.equal(cue({ type: "pickup", rarity: "unique" }), "pickupUnique");
  assert.equal(cue({ type: "pickup", rarity: "weird" }), "pickupItem");
  assert.equal(cue({ type: "gold", value: 3 }), "coin");
});

test("unknown, malformed and silent events are ignored without throwing", () => {
  for (const ev of [{ type: "nope" }, {}, null, undefined, { type: 5 }, { type: "toString" }, { type: "__proto__" }, { type: "burst", skill: "reply-all" }, { type: "ui:lowhp", low: true }])
    assert.deepEqual(mapEvent(ev, state()), []);
  assert.deepEqual(mapEvent({ type: "kill", target: "ghost" }, state()).map((d) => d.cue), ["deathImp"], "unknown target falls back, no throw");
  assert.doesNotThrow(() => mapEvent({ type: "hit", target: "m1" }, null));
});

test("a hit on a monster carries its tile, a cast does not", () => {
  const hit = mapEvent({ type: "hit", source: "player", target: "m1" }, state());
  assert.ok(hit.every((d) => d.tile && d.tile.x === 12));
  assert.equal(mapEvent({ type: "cast", skill: "reply-all" }, state())[0].tile, null);
});

test("ambient zone follows the scene: title lobby bed, floor zones, none when dead", () => {
  assert.equal(ambientZone(null), "lobby");
  assert.equal(ambientZone({ scene: "title" }), "lobby");
  assert.equal(ambientZone({ scene: "dead", depth: 3 }), null);
  assert.equal(ambientZone({ scene: "town", depth: 0, floor: { theme: "lobby" } }), "lobby");
  assert.equal(ambientZone({ scene: "floor", depth: 2, floor: { theme: "open-plan" } }), "open-plan");
  assert.equal(ambientZone({ scene: "floor", depth: 6 }), "basement");
  assert.ok(ZONES.includes(ambientZone({ scene: "floor", depth: 1, floor: { theme: "???" } })));
});

test("voice limiter: cooldown, cap, critical reserve, expiry (time is injected)", () => {
  const L = createVoiceLimiter({ maxVoices: 4, criticalReserve: 1, defaultCooldown: 0.1, cooldowns: { a: 0 } });
  assert.equal(L.tryPlay("x", 3, 0, 1).ok, true);
  assert.deepEqual(L.tryPlay("x", 3, 0.05, 1), { ok: false, reason: "cooldown" });
  assert.equal(L.tryPlay("x", 3, 0.2, 1).ok, true);
  assert.equal(L.tryPlay("a", 3, 0.2, 1).ok, true);          // cooldown 0 allows stacking
  assert.equal(L.active(0.2), 3);
  assert.deepEqual(L.tryPlay("y", 3, 0.2, 1), { ok: false, reason: "full" }, "normal cues stop one slot early");
  assert.equal(L.tryPlay("crit", 9, 0.2, 1).ok, true, "critical cue uses the reserve");
  assert.equal(L.tryPlay("crit2", 9, 0.2, 1).ok, false, "hard cap is maxVoices");
  assert.equal(L.active(5), 0, "voices expire");
  assert.equal(L.tryPlay("y", 3, 5, 1).ok, true);
});

test("AC-R-080-5: 20 hits in one frame never exceed maxVoices", () => {
  const L = createVoiceLimiter({ cooldowns: {} });
  let ok = 0;
  for (let i = 0; i < 20; i++) if (L.tryPlay(`hit${i % 5}`, 5, 1, 0.3).ok) ok++;
  assert.ok(L.active(1) <= audioConfig.maxVoices);
  assert.ok(ok <= audioConfig.maxVoices);
  const L2 = createVoiceLimiter({ cooldowns: COOLDOWNS });
  let same = 0;
  for (let i = 0; i < 20; i++) if (L2.tryPlay("hitFlesh", 5, 1, 0.3).ok) same++;
  assert.equal(same, 1, "same cue in one instant plays once");
});

test("spatial: gain falls with distance, culls beyond hearing, pan follows screen x", () => {
  assert.equal(distanceGain(0), 1);
  assert.equal(distanceGain(audioConfig.fullTiles), 1);
  assert.ok(distanceGain(10) < 1 && distanceGain(10) > audioConfig.minDistGain);
  assert.ok(Math.abs(distanceGain(audioConfig.hearTiles) - audioConfig.minDistGain) < 1e-9);
  assert.equal(distanceGain(audioConfig.hearTiles + 1), 0);
  const hero = { x: 10, y: 10 };
  assert.ok(panFor(hero, { x: 14, y: 10 }) > 0 && panFor(hero, { x: 10, y: 14 }) < 0);
  assert.equal(panFor(hero, { x: 10, y: 10 }), 0);
  assert.ok(Math.abs(panFor(hero, { x: 99, y: 10 })) <= audioConfig.maxPan);
  assert.deepEqual(place(null, { x: 1, y: 1 }), { gain: 1, pan: 0 });
  assert.deepEqual(place(hero, null), { gain: 1, pan: 0 });
  assert.equal(place(hero, { x: 10, y: 40 }).gain, 0);
});

// ---- engine against fakes ----
function fakes() {
  const log = [];
  class FakeCtx {
    constructor() { this.currentTime = 1; this.state = "suspended"; this.destination = { n: "dest" }; log.push(["ctx"]); }
    createGain() { return { gain: { value: 1, setTargetAtTime() {} }, connect() {}, disconnect() {} }; }
    resume() { this.state = "running"; log.push(["resume"]); return Promise.resolve(); }
    suspend() { this.state = "suspended"; log.push(["suspend"]); return Promise.resolve(); }
    close() { this.state = "closed"; log.push(["close"]); return Promise.resolve(); }
  }
  const mk = (id) => () => {
    const k = { id, vol: {}, muted: false,
      play(cue, when, sp) { log.push(["play", id, cue, sp]); return when + 0.3; },
      startAmbient(zone) { log.push(["amb", id, zone]); return { stop() { log.push(["ambstop", id, zone]); } }; },
      setVolume(c, v) { k.vol[c] = v; }, setMuted(m) { k.muted = m; } };
    log.push(["kit", id]);
    return k;
  };
  return { log, FakeCtx, kits: { gothic: mk("gothic"), chiptune: mk("chiptune"), foley: mk("foley") } };
}
const boot = (st = state(), options = {}) => {
  const f = fakes(), bus = createBus();
  let t = 0, cur = st;
  const audio = createAudio({ bus, getState: () => cur, options, deps: { AudioContext: f.FakeCtx, kits: f.kits, now: () => t, pollMs: 0 } });
  return { ...f, bus, audio, setState: (s) => { cur = s; }, tick: (dt) => { t += dt; } };
};

test("engine: no AudioContext before unlock; cues are logged anyway; defaults follow the decision", () => {
  const b = boot();
  assert.equal(b.log.length, 0);
  b.bus.emit({ type: "levelup", level: 2 });
  const s = b.audio.getState();
  assert.equal(s.unlocked, false);
  assert.equal(s.cueLog.length, 1);
  assert.deepEqual([s.cueLog[0].tick, s.cueLog[0].cue, s.cueLog[0].name], [7, "levelUp", "levelUp"]);
  assert.deepEqual([s.kit, s.master, s.sfx, s.ambient, s.muted], ["foley", 0.6, 0.8, 0.5, false]);
  assert.ok(!b.log.some((e) => e[0] === "play"));
});

test("engine: unlock creates the context once, starts the kit and the title lobby bed; sound plays afterwards", () => {
  const b = boot({ scene: "title" });
  assert.equal(b.audio.unlock(), true);
  b.audio.unlock();
  assert.equal(b.log.filter((e) => e[0] === "ctx").length, 1);
  assert.deepEqual(b.log.filter((e) => e[0] === "amb"), [["amb", "foley", "lobby"]]);
  assert.equal(b.audio.getState().ambientId, "ambient:lobby");
  b.bus.emit({ type: "pickup", rarity: "rare", id: "i1" });
  assert.deepEqual(b.log.filter((e) => e[0] === "play").map((e) => e[2]), ["pickupRare"]);
});

test("engine: ambient crossfades per zone and stops on death (AC-R-081-2/4)", () => {
  const b = boot(state({ scene: "town", depth: 0, floor: { theme: "lobby" } }));
  b.audio.unlock();
  b.setState(state({ depth: 6, floor: { theme: "basement" } })); b.audio.sync();
  assert.equal(b.audio.getState().ambientId, "ambient:basement");
  b.setState(state({ scene: "dead" })); b.audio.sync();
  assert.equal(b.audio.getState().ambientId, null);
  assert.deepEqual(b.log.filter((e) => e[0] === "amb" || e[0] === "ambstop").map((e) => e.slice(0, 1).concat(e[2])), [["amb", "lobby"], ["ambstop", "lobby"], ["amb", "basement"], ["ambstop", "basement"]]);
});

test("engine: positional cues are attenuated and panned; far cues are culled", () => {
  const b = boot();
  b.audio.unlock();
  b.bus.emit({ type: "kill", target: "m1", xp: 1 });        // 2 tiles east
  b.tick(1);
  b.bus.emit({ type: "kill", target: "m2", xp: 1 });        // 20 tiles away: culled
  const plays = b.log.filter((e) => e[0] === "play");
  assert.equal(plays.length, 1);
  assert.equal(plays[0][2], "deathZombie");
  assert.equal(plays[0][3].gain, 1);
  assert.ok(plays[0][3].pan > 0);
  assert.equal(b.audio.getState().cueLog.length, 1);
});

test("engine: 20 hits in one tick stay inside the polyphony cap and do not throw", () => {
  const b = boot();
  b.audio.unlock();
  assert.doesNotThrow(() => { for (let i = 0; i < 20; i++) b.bus.emit({ type: "hit", source: "player", target: i % 2 ? "m1" : "m3", value: 3 }); });
  const s = b.audio.getState();
  assert.ok(s.voices <= audioConfig.maxVoices);
  assert.ok(b.log.filter((e) => e[0] === "play").length <= audioConfig.maxVoices);
  assert.ok(s.cueLog.length >= 1);
});

test("engine: volume clamps, effective gain = master x bus, mute zeroes without losing sliders, options are written back (AC-R-082)", () => {
  const options = {};
  const b = boot(state(), options);
  b.audio.setVolume("master", 0.3); b.audio.setVolume("effects", 0.5); b.audio.setVolume("ambient", 0.8);
  let s = b.audio.getState();
  assert.deepEqual([s.master, s.sfx, s.ambient], [0.3, 0.5, 0.8]);
  assert.ok(Math.abs(s.effectiveGain.sfx - 0.15) < 1e-3 && Math.abs(s.effectiveGain.ambient - 0.24) < 1e-3);
  b.audio.setVolume("master", -0.5); assert.equal(b.audio.getState().master, 0);
  b.audio.setVolume("master", 3); assert.equal(b.audio.getState().master, 1);
  assert.equal(b.audio.setVolume("master", "x"), false);
  assert.equal(b.audio.setVolume("bogus", 1), false);
  b.audio.setVolume("master", 0.3);
  b.audio.setMuted(true);
  s = b.audio.getState();
  assert.deepEqual([s.effectiveGain.master, s.effectiveGain.sfx, s.effectiveGain.ambient, s.master, s.sfx, s.ambient], [0, 0, 0, 0.3, 0.5, 0.8]);
  b.audio.setMuted(false);
  assert.ok(Math.abs(b.audio.getState().effectiveGain.sfx - 0.15) < 1e-3);
  assert.deepEqual(options.volume, { master: 0.3, sfx: 0.5, ambient: 0.8 });
  assert.equal(options.muted, false);
  // reload: a new engine reads the same options
  const again = boot(state(), options).audio.getState();
  assert.deepEqual([again.master, again.sfx, again.ambient], [0.3, 0.5, 0.8]);
});

test("engine: volumes reach the kit after unlock; muted engine logs cues but plays nothing", () => {
  const b = boot(state(), { volume: { master: 0.4, sfx: 0.7, ambient: 0.2 }, muted: true });
  b.audio.unlock();
  b.bus.emit({ type: "levelup", level: 3 });
  assert.equal(b.log.filter((e) => e[0] === "play").length, 0);
  assert.equal(b.audio.getState().cueLog.length, 1);
  b.audio.setMuted(false);
  b.tick(5);
  b.bus.emit({ type: "levelup", level: 4 });
  assert.equal(b.log.filter((e) => e[0] === "play").length, 1);
});

test("engine: setKit swaps all three kits behind one interface and restarts the ambient", () => {
  const b = boot(state(), { kit: "gothic" });
  assert.equal(b.audio.getState().kit, "gothic");
  b.audio.unlock();
  assert.deepEqual(KIT_IDS.sort(), ["chiptune", "foley", "gothic"]);
  assert.equal(b.audio.setKit("nope"), false);
  assert.equal(b.audio.setKit("chiptune"), true);
  assert.equal(b.audio.getState().kit, "chiptune");
  assert.deepEqual(b.log.filter((e) => e[0] === "amb").map((e) => e[1]), ["gothic", "chiptune"]);
  b.bus.emit({ type: "potion", slot: 0 });
  assert.deepEqual(b.log.filter((e) => e[0] === "play").map((e) => e[1]), ["chiptune"]);
});

test("engine: pause suspends the context, resume restores it; dispose closes it and ignores later events", () => {
  const b = boot();
  b.audio.unlock();
  b.setState(state({ paused: true })); b.audio.sync();
  assert.ok(b.log.some((e) => e[0] === "suspend"));
  b.setState(state({ paused: false })); b.audio.sync();
  assert.ok(b.log.filter((e) => e[0] === "resume").length >= 2);
  b.audio.dispose();
  assert.ok(b.log.some((e) => e[0] === "close"));
  const n = b.audio.getState().cueLog.length;
  b.bus.emit({ type: "levelup", level: 9 });
  assert.equal(b.audio.getState().cueLog.length, n);
});

test("engine: without Web Audio, unlock fails softly and nothing throws", () => {
  const bus = createBus();
  const a = createAudio({ bus, getState: () => null, deps: { AudioContext: null, pollMs: 0 } });
  const saved = globalThis.AudioContext; // Node has none
  assert.equal(a.unlock(), saved ? true : false);
  assert.doesNotThrow(() => bus.emit({ type: "hit", target: "player" }));
});

test("audio sources: only AudioContext APIs, no DOM, no files, no core imports", () => {
  for (const f of files("src/audio").filter((x) => x.endsWith(".js"))) {
    const src = strip(readFileSync(f, "utf8"));
    assert.ok(!/\b(document|window|navigator|localStorage|fetch|XMLHttpRequest|Image)\b|Math\.random/.test(src), `${f} uses a forbidden global`);
    for (const m of src.matchAll(/from\s+"([^"]+)"/g)) assert.ok(m[1].startsWith("./"), `${f} imports ${m[1]}`);
  }
});
