// S3-3: save, load, autosave, export/import (R-090..R-092, NFR-D01..D03).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, step, applyInput, teleportFloor, setLevel, spawnItem, config, createRng, hashState, content } from "../src/core/index.js";
import { respawn } from "../src/core/systems/world.js";
import { damageMonster } from "../src/core/systems/damage.js";
import { serialize, deserialize, SAVE_KEYS, PLAYER_KEYS, checksumOf, toSave, rleEncode, rleDecode, createSaveStore, createMemoryAdapter, createAdapter, migrate } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";

/** A game with a level 7 hero, spent points, 3 skills, items everywhere, gold 321 and deepest floor 4 (AC-R-090-1). */
function richGame(seed = 11) {
  const s = newGame(seed, { start: "town" });
  setLevel(s, 7);
  s.player.attrs.grit += 4; s.player.attrPoints = 3; s.player.skillPoints = 1;
  for (const id of ["stapler-throw", "dress-code", "coffee-break"]) { s.player.skillPoints++; applyInput(s, { t: "learnSkill", id }); }
  s.player.gold = 321;
  for (let i = 0; i < 6; i++) { const e = spawnItem(s, { depth: 4 }, s.player.tile); applyInput(s, { t: "pickup", id: e.id }); }
  for (let i = 0; i < 6; i++) step(s);
  for (const it of s.inventory.items.slice(0, 2)) applyInput(s, { t: "equip", id: it.id });
  const st = s.inventory.items.pop(); if (st) { st.x = 0; st.y = 0; s.stash.items.push(st); }
  teleportFloor(s, 4);
  for (let i = 0; i < 90; i++) step(s);
  teleportFloor(s, 0);
  return s;
}
const SAVED = (s) => ({ level: s.player.level, xp: s.player.xp, attrs: s.player.attrs, attrPoints: s.player.attrPoints, skillPoints: s.player.skillPoints, skills: s.player.skills, skillBar: s.player.skillBar, gold: s.player.gold, cls: s.player.class,
  inventory: s.inventory, equipment: s.equipment, belt: s.belt, stash: s.stash, deepestDepth: s.deepestDepth, bossDefeated: s.bossDefeated, options: s.options });

test("AC-R-090-1 round trip keeps the character, items, stash, belt, deepest floor, boss flag and options", () => {
  const s = richGame(); s.options = { volume: 0.4, keys: { Digit1: "F1" } };
  assert.equal(s.deepestDepth, 4);
  const r = deserialize(serialize(s));
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(SAVED(r.state), SAVED(s));
  assert.equal(r.state.scene, "town"); assert.equal(r.state.depth, 0);
  assert.equal(r.state.player.hp, r.state.player.hpMax);
});

test("AC-R-090-2 the save is JSON with an integer version equal to config.saveVersion and exactly the documented keys", () => {
  const text = serialize(richGame());
  const j = JSON.parse(text);
  assert.equal(j.version, config.saveVersion); assert.ok(Number.isInteger(j.version));
  assert.deepEqual(Object.keys(j).sort(), [...SAVE_KEYS, "checksum"].sort());
  assert.deepEqual(Object.keys(j.player).sort(), [...PLAYER_KEYS].sort());
  for (const transient of ["monsters", "projectiles", "floaters", "groundItems", "floor", "events", "eventLog", "ui", "input", "vendor", "portal", "paused", "scene"]) assert.ok(!(transient in j), transient);
  assert.ok(text.length <= config.saveMaxBytes);
});

test("AC-R-090-3 200 seeded states round trip, and serialize is stable (same state, same text)", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed * 7 + 1);
    const s = newGame(seed, { start: rng.next() < 0.5 ? "town" : undefined });
    setLevel(s, rng.int(1, 12));
    if (rng.next() < 0.5) { s.player.gold = rng.int(0, 5000); const e = spawnItem(s, { depth: rng.int(1, 8) }, s.player.tile); applyInput(s, { t: "pickup", id: e.id }); }
    if (s.depth > 0 && rng.next() < 0.5) teleportFloor(s, rng.int(1, 8));
    for (let i = 0; i < rng.int(0, 60); i++) step(s);
    const text = serialize(s);
    assert.equal(serialize(s), text, "stable");
    const r = deserialize(text);
    assert.equal(r.ok, true, `seed ${seed}: ${r.message}`);
    assert.deepEqual(SAVED(r.state), SAVED(s), `seed ${seed}`);
    assert.equal(r.state.seed, s.seed); assert.equal(r.state.nextItemId, s.nextItemId);
    assert.deepEqual(r.state.rng, s.rng);
    assert.equal(serialize(r.state), serialize(deserialize(serialize(r.state)).state), "idempotent after load");
  }
});

test("a loaded game keeps playing: new item ids do not collide, the loot stream continues, floors regenerate from the seed", () => {
  const s = richGame(); const r = deserialize(serialize(s)).state;
  const ids = new Set([...r.inventory.items, ...r.stash.items, ...Object.values(r.equipment), ...r.belt].filter(Boolean).map((i) => i.id));
  const e = spawnItem(r, { depth: 2 }, r.player.tile);
  assert.ok(!ids.has(e.id));
  assert.equal(r.floor.seed, s.floor.seed);
  teleportFloor(r, 3); teleportFloor(s, 3);
  assert.deepEqual(r.floor.tiles, s.floor.tiles);
  for (let i = 0; i < 200; i++) step(r);
  assert.ok(r.tick > s.tick - 1000);
});

test("explored maps are saved (run-length coded) and come back on re-entry; mid-floor state is not", () => {
  assert.deepEqual(rleDecode(rleEncode([0, 0, 1, 1, 1, 0, 1]), 7), [0, 0, 1, 1, 1, 0, 1]);
  assert.deepEqual(rleDecode(rleEncode([1, 1, 0]), 3), [1, 1, 0]);
  const s = newGame(9, { start: "town" }); teleportFloor(s, 2);
  for (const t of [{ x: s.floor.entry.x + 1, y: s.floor.entry.y }]) { s.player.tile = t; }
  for (let i = 0; i < 5; i++) step(s);
  const explored = s.floor.explored.slice();
  teleportFloor(s, 0);
  const j = JSON.parse(serialize(s));
  assert.ok(j.explored[2] && j.explored[2].size === explored.length);
  const r = deserialize(serialize(s)).state;
  teleportFloor(r, 2);
  assert.ok(explored.every((v, i) => !v || r.floor.explored[i] === 1));
});

test("AC-R-091-4 / QF-09-2 saved on a floor: resume at that floor's entry with its monsters at their start; saved in town: the Lobby", () => {
  const s = newGame(5, { start: "town" }); teleportFloor(s, 3);
  for (let i = 0; i < 200; i++) step(s);
  const m = s.monsters.find((o) => o.ai !== "dead"); m.hp = 1; s.player.tile = { x: s.floor.entry.x + 1, y: s.floor.entry.y }; s.player.hp = 3;
  const r = deserialize(serialize(s));
  assert.equal(r.ok, true);
  assert.equal(r.state.depth, 3); assert.equal(r.state.scene, "floor");
  assert.deepEqual(r.state.player.tile, r.state.floor.entry);
  assert.equal(r.state.player.hp, r.state.player.hpMax, "health is not restored mid-floor");
  assert.ok(r.state.monsters.every((o) => o.hp === o.hpMax && o.ai === "idle"));
  assert.equal(r.state.groundItems.length, 0);
  teleportFloor(s, 0);
  const t = deserialize(serialize(s)).state; assert.equal(t.depth, 0); assert.equal(t.scene, "town");
});

test("AC-R-091-6 saved while dead or on the victory screen: resumes in the Lobby at full health", () => {
  const s = newGame(5, { start: "town" }); teleportFloor(s, 2); s.player.hp = 0; s.scene = "dead";
  const r = deserialize(serialize(s)).state;
  assert.equal(r.scene, "town"); assert.equal(r.depth, 0); assert.equal(r.player.hp, r.player.hpMax);
  const v = newGame(5, { start: "town" }); teleportFloor(v, 9); v.scene = "victory"; v.bossDefeated = true;
  const rv = deserialize(serialize(v)).state;
  assert.equal(rv.scene, "town"); assert.equal(rv.bossDefeated, true);
  teleportFloor(rv, 9); assert.equal(rv.monsters.length, 0, "the defeated boss stays dead after a reload");
});

test("the boss flags survive: bossUnlocked opens the floor 8 stairs after a reload", () => {
  const s = newGame(4, { start: "town" }); s.bossUnlocked = true; s.deepestDepth = 8;
  const r = deserialize(serialize(s)).state;
  assert.equal(r.bossUnlocked, true);
  teleportFloor(r, 8); r.monsters.length = 0; r.player.tile = { ...r.floor.exit };
  assert.equal(applyInput(r, { t: "useStairs", dir: "down" }).ok, true);
  assert.equal(r.depth, 9);
});

// ---- validation ----
test("NFR-D03-2 a save from a newer version is refused with reason newer and left untouched in the store", () => {
  const s = richGame(); const j = JSON.parse(serialize(s)); j.version = config.saveVersion + 1;
  const text = JSON.stringify(j);
  assert.deepEqual(Object.assign({}, deserialize(text), { message: undefined }), { ok: false, reason: "newer", message: undefined });
  const notes = []; const store = createSaveStore(createMemoryAdapter({ [config.saveKey]: text }), { onNotice: (k) => notes.push(k) });
  const r = store.load();
  assert.equal(r.ok, false); assert.equal(r.reason, "newer");
  assert.equal(store.read(), text); assert.deepEqual(notes, ["saveTooNew"]);
  assert.ok(content.strings.saveTooNew);
});

test("NFR-D03-3 a corrupt save: no throw, reason given, the text is kept as the backup and exportable, the slot is cleared, New game still works", () => {
  const good = serialize(richGame());
  const bads = [good.slice(0, good.length >> 1), good.replace('"level":7', '"level":"7"'), "garbage", "", "null", "[]", '{"version":1}', good.replace(/"checksum":"[0-9a-f]+"/, '"checksum":"0000000000000000"')];
  for (const bad of bads) {
    const store = createSaveStore(createMemoryAdapter({ [config.saveKey]: bad }));
    const r = store.load();
    assert.equal(r.ok, false, bad.slice(0, 30)); assert.ok(r.reason && r.message);
    assert.equal(store.has(), false, "Continue is gone");
    assert.equal(store.exportText("corrupt"), bad);
    assert.equal(store.save(newGame(1)).ok, true, "a new game can save without touching the backup");
    assert.equal(store.exportText("corrupt"), bad);
  }
  assert.equal(deserialize(undefined).ok, false); assert.equal(deserialize(42).ok, false);
});

test("NFR-D03-4 20 randomly mutated copies never throw: a valid state or a typed error", () => {
  const good = serialize(richGame()), rng = createRng(77);
  let rejected = 0;
  for (let n = 0; n < 20; n++) {
    let text = good;
    if (n % 2 === 0) { const chars = [...text]; for (let k = 0; k < 1 + rng.int(0, 3); k++) chars[rng.int(0, chars.length - 1)] = String.fromCharCode(33 + rng.int(0, 90)); text = chars.join(""); }
    else { const j = JSON.parse(text); const keys = Object.keys(j); delete j[keys[rng.int(0, keys.length - 1)]]; text = JSON.stringify(j); }
    let r;
    assert.doesNotThrow(() => { r = deserialize(text); });
    assert.ok(r.ok === true ? !!r.state : (typeof r.reason === "string" && typeof r.message === "string"));
    if (!r.ok) rejected++;
  }
  assert.ok(rejected >= 15);
});

test("structurally wrong saves are rejected even with a matching checksum (schema check)", () => {
  const base = JSON.parse(serialize(richGame()));
  const tamper = (fn) => { const j = structuredClone(base); fn(j); delete j.checksum; j.checksum = checksumOf(j); return deserialize(JSON.stringify(j)); };
  for (const [name, fn] of Object.entries({
    level: (j) => { j.player.level = 99; }, class: (j) => { j.class = "wizard"; }, skill: (j) => { j.player.skills["nope"] = 1; },
    overlap: (j) => { j.inventory.items.push({ ...j.inventory.items[0], id: "iX" }); }, dupId: (j) => { j.stash.items.push({ ...j.inventory.items[0] }); },
    slot: (j) => { j.equipment.tail = null; }, belt: (j) => { j.belt.pop(); }, extra: (j) => { j.monsters = []; }, rng: (j) => { j.rng.loot.s = -1; },
    depth: (j) => { j.resume.depth = 40; }, explored: (j) => { j.explored[1] = { size: 10, runs: [3] }; }, gold: (j) => { j.player.gold = -5; },
  })) { const r = tamper(fn); assert.equal(r.ok, false, name); assert.equal(r.reason, "schema", name); }
  assert.equal(tamper(() => {}).ok, true, "the untampered control passes");
});

test("NFR-D03-1 a version 0 fixture is migrated to the current schema and keeps the character", () => {
  const v0 = JSON.parse(readFileSync("test/fixtures/save-v0.json", "utf8"));
  assert.equal(v0.version, 0);
  const m = migrate(v0, config.saveVersion);
  assert.equal(m.ok, true); assert.equal(m.data.version, config.saveVersion);
  const r = deserialize(JSON.stringify(v0));
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.player.level, 5); assert.equal(r.state.player.gold, 250); assert.equal(r.state.player.attrs.grit, v0.hero.attrs.grit);
  assert.deepEqual(r.state.inventory.items.map((i) => i.id), v0.inventory.items.map((i) => i.id));
  assert.ok(r.state.nextItemId > Math.max(...r.state.inventory.items.map((i) => Number(i.id.slice(1)))));
  assert.equal(JSON.parse(serialize(r.state)).version, config.saveVersion);
  assert.equal(migrate({ version: -1 }, 1).ok, false);
  assert.equal(deserialize(JSON.stringify({ ...v0, version: 0.5 })).ok, false);
});

// ---- storage ----
test("AC-R-090-4/-5 one documented key, within the size cap; without a save there is nothing to continue", () => {
  const a = createMemoryAdapter(), store = createSaveStore(a);
  assert.equal(store.has(), false); assert.equal(store.load().reason, "empty");
  assert.equal(store.save(richGame()).ok, true);
  assert.deepEqual(a.keys(), [config.saveKey]);
  assert.ok(a.getItem(config.saveKey).length <= config.saveMaxBytes);
  assert.equal(store.load().ok, true);
  // a full bag, stash, belt and worn gear still fits
  const s = newGame(3, { start: "town" });
  for (let i = 0; i < 200; i++) { const e = spawnItem(s, { depth: 8, rarity: "rare" }, s.player.tile); applyInput(s, { t: "pickup", id: e.id }); step(s); }
  assert.ok(serialize(s).length <= config.saveMaxBytes);
});

test("AC-R-090-6 a write that throws keeps the game running, tells the player and leaves the last good save untouched", () => {
  const a = createMemoryAdapter(), notes = [], store = createSaveStore(a, { onNotice: (k) => notes.push(k) });
  const s = richGame();
  assert.equal(store.save(s).ok, true);
  const before = store.read();
  a.failWrites = true; s.tick += 100; s.player.gold += 5;
  const r = store.save(s, { force: true });
  assert.equal(r.ok, false); assert.equal(s.scene, "town");
  assert.equal(s.ui.notice.key, "saveFailed"); assert.equal(s.ui.notice.text, content.strings.saveFailed);
  assert.deepEqual(notes, ["saveFailed"]);
  assert.equal(store.read(), before);
  a.failWrites = false;
  assert.equal(store.save(s, { force: true }).ok, true);
});

test("AC-R-091-5 a burst of 100 autosave triggers writes once (coalesced), keeps one key, and a later tick writes again", () => {
  const a = createMemoryAdapter(); let writes = 0; const set = a.setItem.bind(a); a.setItem = (k, v) => { writes++; set(k, v); };
  const store = createSaveStore(a), s = richGame();
  for (let i = 0; i < 100; i++) store.save(s);
  assert.equal(writes, 1); assert.equal(a.keys().length, 1);
  s.tick += config.autosaveMinTicks; store.save(s); assert.equal(writes, 2);
  store.save(s, { force: true }); assert.equal(writes, 3, "exit saves are never skipped");
  assert.equal(a.keys().length, 1);
});

test("AC-R-091-1/-2 the core emits an autosave event on every floor change and town entry (the shell writes the save)", () => {
  const s = newGame(2, { start: "town" });
  const seen = [];
  const note = () => { for (const e of s.events) if (e.type === "autosave") seen.push(`${e.reason}:${e.depth}`); s.events.length = 0; };
  applyInput(s, { t: "useStairs", dir: "down" }); note();
  for (let i = 0; i < 900 && s.depth === 0; i++) { step(s); note(); }
  assert.equal(s.depth, 1);
  teleportFloor(s, 2); note();
  s.player.hp = 0; s.scene = "dead"; respawn(s); note();
  assert.deepEqual(seen, ["floor:1", "floor:2", "town:0"]);
  // wired to a store: the arrival state is what gets saved
  const store = createSaveStore(createMemoryAdapter());
  teleportFloor(s, 3);
  for (const e of s.events) if (e.type === "autosave") store.autosave(s, e);
  assert.equal(JSON.parse(store.read()).resume.depth, 3);
});

test("AC-R-092-1..-3 export gives the stored text; importing it elsewhere restores the character; garbage and tampered files are refused", () => {
  const s = richGame(), a = createSaveStore(createMemoryAdapter());
  a.save(s);
  const text = a.exportText();
  assert.equal(text, a.read()); assert.equal(a.exportName(), config.saveFileName);
  const notes = [], b = createSaveStore(createMemoryAdapter(), { onNotice: (k) => notes.push(k) });
  assert.equal(b.importText(text).ok, true);
  assert.deepEqual(SAVED(b.load().state), SAVED(s));
  assert.deepEqual(notes, ["importDone"]);
  const keep = b.read();
  for (const bad of ["not json", "{}", text.replace('"gold":321', '"gold":99321'), JSON.stringify({ ...JSON.parse(text), checksum: "x" }), text.slice(0, 100), 5, null]) {
    const r = b.importText(bad);
    assert.equal(r.ok, false); assert.equal(b.read(), keep, "the existing save is unchanged");
  }
  assert.ok(notes.includes("importFailed"));
  // importing a pretty-printed copy is fine and is stored in canonical form
  assert.equal(b.importText(JSON.stringify(JSON.parse(text), null, 2)).ok, true);
  assert.equal(b.read(), text);
});

test("NFR-D02 / QF-09-4 deleting the character removes the save but keeps the options; options are stored apart from the save", () => {
  const a = createMemoryAdapter(), store = createSaveStore(a);
  assert.deepEqual(store.loadOptions(), {});
  store.saveOptions({ volume: 0.5, textSize: 2 });
  store.save(richGame());
  assert.deepEqual(a.keys().sort(), [config.optionsKey, config.saveKey].sort());
  store.remove();
  assert.equal(store.has(), false); assert.deepEqual(store.loadOptions(), { volume: 0.5, textSize: 2 });
  assert.deepEqual(a.keys(), [config.optionsKey]);
  a.setItem(config.optionsKey, "{broken"); assert.deepEqual(store.loadOptions(), {});
});

test("storage that is unavailable falls back to memory; the real adapter never throws", () => {
  const blocked = { get localStorage() { throw new Error("blocked"); } };
  const ad = createAdapter(blocked);
  assert.equal(ad.kind, "memory"); assert.equal(ad.fallback, true);
  assert.equal(createAdapter({}).kind, "memory");
  const quota = { localStorage: { setItem() { throw new Error("quota"); }, removeItem() {}, getItem: () => null } };
  assert.equal(createAdapter(quota).kind, "memory");
  const ok = new Map(); const fine = { localStorage: { setItem: (k, v) => ok.set(k, v), getItem: (k) => ok.get(k) ?? null, removeItem: (k) => ok.delete(k) } };
  const ls = createAdapter(fine); assert.equal(ls.kind, "localStorage");
  const store = createSaveStore(ls); assert.equal(store.save(richGame()).ok, true); assert.equal(store.load().ok, true);
  assert.deepEqual([...ok.keys()], [config.saveKey]);
  assert.equal(createAdapter().kind, "memory", "Node has no localStorage");
});

test("determinism: serialising does not change the state, and loading twice gives identical states", () => {
  const s = richGame(), h = hashState(s);
  const t = serialize(s); assert.equal(hashState(s), h);
  assert.equal(hashState(deserialize(t).state), hashState(deserialize(t).state));
  assert.equal(canonical(JSON.parse(t)), t, "the text is canonical JSON");
  assert.equal(checksumOf(JSON.parse(t)), JSON.parse(t).checksum);
  assert.ok(toSave(s).version === config.saveVersion);
});
