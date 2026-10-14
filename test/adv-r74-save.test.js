// ADV-R7-4 (test-engineer, adversarial mode): save v5, the migration from every real older format, schema forgeries of the new quest rules, and the slot index
// (`qv: 5`). Written from the spec addendum and the ADR amendment without reading the implementers' tests. Legal fixtures come from the real fixture files, from
// the game's own writer (`v4Text` of helpers.js, a v4 `toSave`) or from real play; every forged fixture names the rule it violates and asserts the rejection.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { config, content, newGame, step, applyInput, enterFloor } from "../src/core/index.js";
import { toSave, checksumOf, deserialize, migrate, serialize, MIGRATIONS } from "../src/save/index.js";
import { createSlotStore, createMemoryAdapter } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";
import { itemFloorOf } from "../src/core/systems/quests.js";
import * as dmg from "../src/core/systems/damage.js";
import { setQuestStep, completeQuest } from "../src/core/cheats.js";
import { mainStep } from "../src/core/systems/questview.js";
import { slotQuestText } from "../src/ui/slots.js";
import { v4Text, v3Text, sealText } from "./helpers.js";

const FIX = new URL("./fixtures/", import.meta.url);
const read = (f) => readFileSync(new URL(f, FIX), "utf8");
const seal = (o) => { const { checksum, ...rest } = o; return canonical({ ...rest, checksum: checksumOf(rest) }); };
const fresh = (seed = 5, cls = "facilities-manager") => newGame(seed, { class: cls, name: "Adv", start: "town", wearStartKit: true });
const base = (seed = 5) => JSON.parse(serialize(fresh(seed)));
const activeFor = (d) => (d >= 6 ? "main3" : d >= 3 ? "main2" : "main");
/** A forged v5 save: a fresh hero whose world flags say `depth`, mutated by `mut`; the pin is the active arc unless `mut` changes it. */
function forge(mut, { depth = 0, seed = 5, kills } = {}) {
  const o = base(seed);
  if (depth) { o.deepestDepth = depth; o.quests.main.m.depth = depth; o.quests.main.m.memo = true; }
  o.quests.pinned = activeFor(depth);
  if (kills !== undefined) o.stats.kills = kills;
  mut(o);
  return deserialize(seal(o));
}
const ready = (id) => (o) => { o.quests[id] = { s: "ready", p: id === "sq5" ? 6 : id === "sq1" ? 8 : 1 }; if (["sq2", "sq4"].includes(id)) o.quests.pouch = [...o.quests.pouch, { id: `qi-${id}`, quest: id }]; };

// ---------------------------------------------------------------------------------------------------- schema: what play cannot produce
const HOSTILE = [
  ["sq4 ready with deepestDepth 1 (the ledger is on floor 5 or 6)", { depth: 0 }, ready("sq4")],
  ["sq4 ready with deepestDepth 4 (still below both ledger floors)", { depth: 4 }, ready("sq4")],
  ["sq4 completed with deepestDepth 1", { depth: 0 }, (o) => { o.quests.sq4 = { s: "completed", p: 1 }; }],
  ["sq4 ready without its pouch entry (pouch iff ready)", { depth: 6 }, (o) => { o.quests.sq4 = { s: "ready", p: 1 }; }],
  ["sq4 active but its pouch entry present (pouch iff ready)", { depth: 6 }, (o) => { o.quests.sq4 = { s: "active", p: 0 }; o.quests.pouch = [{ id: "qi-sq4", quest: "sq4" }]; }],
  ["sq4 pouch entry carrying the id of sq2", { depth: 6 }, (o) => { o.quests.sq4 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq2", quest: "sq4" }]; }],
  ["both pouch entries swapped between sq2 and sq4", { depth: 6 }, (o) => { o.quests.sq2 = { s: "ready", p: 1 }; o.quests.sq4 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq4", quest: "sq2" }, { id: "qi-sq2", quest: "sq4" }]; }],
  ["sq4 ready with progress 0", { depth: 6 }, (o) => { o.quests.sq4 = { s: "ready", p: 0 }; o.quests.pouch = [{ id: "qi-sq4", quest: "sq4" }]; }],
  ["sq5 ready with deepestDepth 1", { depth: 0, kills: 20 }, ready("sq5")],
  ["sq5 ready on floors 1 to 4 only", { depth: 4, kills: 20 }, ready("sq5")],
  ["sq5 ready with stats.kills 0", { depth: 6, kills: 0 }, ready("sq5")],
  ["sq5 ready with stats.kills 5 (it asks for 6)", { depth: 6, kills: 5 }, ready("sq5")],
  ["sq5 completed with stats.kills 0", { depth: 6, kills: 0 }, (o) => { o.quests.sq5 = { s: "completed", p: 6 }; }],
  ["sq5 completed with deepestDepth 4", { depth: 4, kills: 20 }, (o) => { o.quests.sq5 = { s: "completed", p: 6 }; }],
  ["sq5 ready with progress 5", { depth: 6, kills: 20 }, (o) => { o.quests.sq5 = { s: "ready", p: 5 }; }],
  ["sq5 active with progress 7", { depth: 6, kills: 20 }, (o) => { o.quests.sq5 = { s: "active", p: 7 }; }],
  ["sq5 available with progress 1", { depth: 6, kills: 20 }, (o) => { o.quests.sq5 = { s: "available", p: 1 }; }],
  ["sq5 with a pouch entry (a kill quest has no item)", { depth: 6, kills: 20 }, (o) => { o.quests.sq5 = { s: "ready", p: 6 }; o.quests.pouch = [{ id: "qi-sq5", quest: "sq5" }]; }],
  ["pinned main2 at depth 0 (locked)", { depth: 0 }, (o) => { o.quests.pinned = "main2"; }],
  ["pinned main3 at depth 3 (locked, main2 is active)", { depth: 3 }, (o) => { o.quests.pinned = "main3"; }],
  ["pinned main at depth 3 (completed: the alias is stored as the active arc)", { depth: 3 }, (o) => { o.quests.pinned = "main"; }],
  ["pinned main2 at depth 6 (completed)", { depth: 6 }, (o) => { o.quests.pinned = "main2"; }],
  ["pinned a completed sq4", { depth: 6 }, (o) => { o.quests.sq4 = { s: "completed", p: 1 }; o.quests.pinned = "sq4"; }],
  ["pinned main3 when all three are completed is legal but pinned main is not", { depth: 9, kills: 0 }, (o) => { o.bossUnlocked = o.bossDefeated = true; o.quests.main.m = { memo: true, depth: 9, unlocked: true, defeated: true, verdict: true }; o.quests.pinned = "main"; }],
  ["pinned a key of Object.prototype", { depth: 0 }, (o) => { o.quests.pinned = "constructor"; }],
  ["pinned __proto__", { depth: 0 }, (o) => { o.quests.pinned = "__proto__"; }],
  ["pinned toString", { depth: 0 }, (o) => { o.quests.pinned = "toString"; }],
  ["sq6 (not a quest)", { depth: 0 }, (o) => { o.quests.sq6 = { s: "available", p: 0 }; }],
  ["main2 stored (arcs have no stored entry)", { depth: 0 }, (o) => { o.quests.main2 = { m: o.quests.main.m }; }],
  ["main.m depth 9 with the boss unlock missing from the world flags", { depth: 0 }, (o) => { o.quests.main.m.depth = 9; }],
  ["three pouch entries", { depth: 6 }, (o) => { o.quests.pouch = [{ id: "qi-sq2", quest: "sq2" }, { id: "qi-sq4", quest: "sq4" }, { id: "qi-sq4", quest: "sq4" }]; }],
  ["sq4 hostile pouch id", { depth: 6 }, (o) => { o.quests.sq4 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq4\"><img src=x onerror=alert(1)>", quest: "sq4" }]; }],
];
for (const [name, opts, mut] of HOSTILE) {
  test(`[R74-forge] rejected: ${name}`, () => {
    const r = forge(mut, opts);
    assert.equal(r.ok, false, `accepted a forged block: ${name}`);
    assert.ok(typeof r.message === "string" && r.message.length > 0);
    assert.equal(({}).p, undefined);
  });
}

// ADV-R7-08 and -09: rules the schema leaves open for the two new kill/item quests (each is a state real play cannot produce).
test("[R74-forge] ADV-R7-08 sq5 active with progress needs floors 5 or 6 reached: an active sq5 with 3 kills and deepestDepth 4 cannot come from play", { todo: "ADV-R7-08: accepted: sq5 { active, p 3 } with deepestDepth 4 and stats.kills 9 (ready and completed are tied to deepestDepth 5, a partial progress is not)" }, () => {
  const r = forge((o) => { o.quests.sq5 = { s: "active", p: 3 }; }, { depth: 4, kills: 9 });
  assert.equal(r.ok, false);
});
test("[R74-forge] ADV-R7-09 two kill quests share the one kill counter: sq1 ready (8 interns) plus sq5 ready (6 consultants) need stats.kills >= 14", { todo: "ADV-R7-09: accepted with stats.kills 8, because each kill quest is checked against the counter on its own" }, () => {
  const r = forge((o) => { o.quests.sq1 = { s: "ready", p: 8 }; o.quests.sq5 = { s: "ready", p: 6 }; }, { depth: 6, kills: 8 });
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------------------------------------------- the legal states are accepted (no false rejection)
test("[R74-legal] every combination a player can reach loads: the ledger on either floor with the badge, sq5 with exactly 6 kills, both pouch entries, the last arc complete with a pinned side quest", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = fresh(seed);
    for (const id of ["sq4", "sq2"]) { assert.ok(setQuestStep(s, id, 2).ok, id); }
    assert.equal(s.player.pouch.length, 2);
    const r = deserialize(serialize(s)); assert.ok(r.ok, `seed ${seed}: ${r.message}`);
    assert.deepEqual(r.state.player.pouch, s.player.pouch);
    assert.equal(serialize(r.state), serialize(s), "stable");
  }
  const s = fresh(3);
  assert.ok(setQuestStep(s, "sq5", 2).ok);
  assert.ok(deserialize(serialize(s)).ok);
  completeQuest(s, "main3"); assert.ok(deserialize(serialize(s)).ok, "arcs done, sq5 ready and pinned");
  const t = fresh(4); setQuestStep(t, "sq4", 3); setQuestStep(t, "sq5", 3);
  assert.ok(deserialize(serialize(t)).ok);
  for (const id of content.sideIds) setQuestStep(t, id, 3);
  completeQuest(t, "main3");
  const r = deserialize(serialize(t)); assert.ok(r.ok, r.message);
  assert.equal(r.state.quests.pinned, "main3");
});

test("[R74-legal] real bot-like play of the new quests (accept, descend, kill, pick up, hand in) writes states that all load, 3 classes", () => {
  for (const cls of ["facilities-manager", "sales-rep", "it-wizard"]) {
    const s = fresh(11, cls);
    const check = (why) => { const r = deserialize(serialize(s)); assert.ok(r.ok, `${cls} ${why}: ${r.message}`); assert.deepEqual(r.state.quests, s.quests); assert.deepEqual(r.state.player.pouch, s.player.pouch); };
    for (const [id, npc] of [["sq4", "stash"], ["sq5", "vendor"]]) {
      enterFloor(s, 0, { at: "entry" }); applyInput(s, { t: "interact", id: npc });
      for (let i = 0; i < 900 && s.ui.dialog?.npc !== npc; i++) step(s);
      assert.ok(applyInput(s, { t: "questAccept", id }).ok); check(`accept ${id}`);
    }
    for (const d of [5, 6]) {
      enterFloor(s, d, { at: "entry" });
      for (const m of s.monsters.filter((o) => o.type === "consultant")) { dmg.damageMonster(s, m, 9999, { source: "player" }); check(`floor ${d} kill ${s.quests.sq5.p}`); }
    }
  }
});

// ---------------------------------------------------------------------------------------------------- migration: v1..v4 real files to v5
const allFix = readdirSync(FIX).filter((f) => /^save-v\d.*\.json$/.test(f));
test("[R74-migrate] every real fixture file (v0..v4, 17 files) loads as version 5 with sq4 and sq5 available, nothing paid, the pouch and every other quest as saved, and the pin on an open quest", () => {
  assert.ok(allFix.length >= 15, allFix.join());
  for (const f of allFix) {
    const raw = JSON.parse(read(f)), r = deserialize(read(f));
    assert.ok(r.ok, `${f}: ${r.message}`);
    const q = r.state.quests;
    assert.deepEqual(q.sq4, { s: "available", p: 0 }, f); assert.deepEqual(q.sq5, { s: "available", p: 0 }, f);
    if (raw.version >= 4) for (const id of ["sq1", "sq2", "sq3"]) assert.deepEqual(q[id], raw.quests[id], `${f}: ${id} as saved`);
    if (raw.version >= 4) { assert.deepEqual(q.main.m, raw.quests.main.m, `${f}: milestones as saved`); assert.deepEqual(r.state.player.pouch, raw.quests.pouch); }
    const g = mainStep(q.main.m);
    if (raw.quests?.pinned === undefined || raw.quests.pinned === "main") assert.equal(q.pinned, g > 10 ? "main3" : g <= 3 ? "main" : g <= 6 ? "main2" : "main3", `${f}: the alias becomes the active arc`);
    else assert.equal(q.pinned, raw.quests.pinned, `${f}: a pinned side quest stays`);
    if (raw.player?.gold !== undefined) { assert.equal(r.state.player.gold, raw.player.gold, `${f}: gold`); assert.equal(r.state.player.xp, raw.player.xp, `${f}: xp`); }
    assert.equal(r.state.events.filter((e) => e.type.startsWith("quest.")).length, 0, `${f}: no quest event from a load`);
    assert.equal(JSON.parse(serialize(r.state)).version, config.saveVersion);
    assert.equal(serialize(deserialize(serialize(r.state)).state), serialize(r.state), `${f}: write, load, write is stable`);
  }
});

test("[R74-migrate] the five real v3 states derive the global steps 1, 3, 5, 9, 10; the five real v4 states 1, 5, 9, 10 and a pinned side quest on the right arc", () => {
  const v3 = { "save-v3-lobby.json": 1, "save-v3-floor1.json": 3, "save-v3-floor4.json": 5, "save-v3-boss-unlocked.json": 9, "save-v3-boss-defeated.json": 10 };
  for (const [f, n] of Object.entries(v3)) assert.equal(mainStep(deserialize(read(f)).state.quests.main.m), n, f);
  const v4 = { "save-v4-lobby.json": [1, "main"], "save-v4-floor4.json": [5, "main2"], "save-v4-floor8-unlocked.json": [9, "main3"], "save-v4-boss-defeated.json": [10, "main3"], "save-v4-pinned-side.json": [5, "sq1"] };
  for (const [f, [n, pin]] of Object.entries(v4)) { const s = deserialize(read(f)).state; assert.equal(mainStep(s.quests.main.m), n, f); assert.equal(s.quests.pinned, pin, f); }
});

test("[R74-migrate] v4 states made by the game's own v4 writer from REAL play (sq1 active with kills, sq2 ready with the badge in the pouch, sq3 completed, a pinned side quest, all main steps) migrate with nothing changed but sq4, sq5 and the alias pin", () => {
  const scenarios = [];
  { const s = fresh(2); enterFloor(s, 2, { at: "entry" }); setQuestStep(s, "sq1", 1); s.quests.sq1 = { s: "active", p: 3 }; s.stats.kills = 3; scenarios.push(["sq1 active", s]); }
  { const s = fresh(3); setQuestStep(s, "sq2", 2); scenarios.push(["sq2 ready", s]); }
  { const s = fresh(4); setQuestStep(s, "sq3", 3); scenarios.push(["sq3 completed", s]); }
  { const s = fresh(5); enterFloor(s, 4, { at: "entry" }); setQuestStep(s, "sq2", 1); applyInput(s, { t: "questPin", id: "sq2" }); scenarios.push(["pinned sq2", s]); }
  for (const d of [0, 1, 2, 3, 4, 5, 6, 7, 8]) { const s = fresh(6 + d); if (d) enterFloor(s, d, { at: "entry" }); scenarios.push([`depth ${d}`, s]); }
  { const s = fresh(20); completeQuest(s, "main3"); scenarios.push(["all main steps", s]); }
  for (const [name, s] of scenarios) {
    const text = v4Text(s), o = JSON.parse(text);
    assert.equal(o.version, 4); assert.equal(o.quests.sq4, undefined);
    const r = deserialize(text);
    assert.ok(r.ok, `${name}: ${r.message}`);
    const q = r.state.quests;
    assert.deepEqual(q.sq4, { s: "available", p: 0 }); assert.deepEqual(q.sq5, { s: "available", p: 0 });
    for (const id of ["sq1", "sq2", "sq3"]) assert.deepEqual(q[id], s.quests[id], `${name}: ${id}`);
    assert.deepEqual(q.main, s.quests.main, `${name}: main`);
    assert.deepEqual(r.state.player.pouch, s.player.pouch, `${name}: pouch`);
    assert.equal(r.state.player.gold, s.player.gold, `${name}: gold`); assert.equal(r.state.player.xp, s.player.xp);
    assert.equal(q.pinned, s.quests.pinned, `${name}: the pin the v5 writer had equals the derived pin`);
    assert.equal(r.state.events.filter((e) => e.type === "quest.completed").length, 0);
    // second migration is the identity
    const m1 = migrate(JSON.parse(text), config.saveVersion), m2 = migrate(m1.data, config.saveVersion);
    assert.deepEqual(m2.data, m1.data, `${name}: second migration is the identity`);
  }
});

test("[R74-migrate] v1 and v2 files run the whole chain to v5 and then play the new quests: accept sq4 and sq5, descend, save, load", () => {
  for (const f of ["save-v1.json", "save-v2-r5-fm.json", "save-v2-r5-it.json", "save-v2-r5-sales.json", "save-v0.json"]) {
    const r = deserialize(read(f));
    assert.ok(r.ok, `${f}: ${r.message}`);
    const s = r.state;
    enterFloor(s, 0, { at: "entry" });
    for (const [id, npc] of [["sq4", "stash"], ["sq5", "vendor"], ["sq1", "vendor"]]) {
      applyInput(s, { t: "interact", id: npc });
      for (let i = 0; i < 900 && s.ui.dialog?.npc !== npc; i++) step(s);
      assert.deepEqual(applyInput(s, { t: "questAccept", id }), { ok: true }, `${f} ${id}`);
    }
    enterFloor(s, itemFloorOf(s.seed, "sq4"), { at: "entry" });
    const back = deserialize(serialize(s));
    assert.ok(back.ok, `${f}: ${back.message}`);
    assert.equal(back.state.groundItems.filter((g) => g.quest === "sq4").length, 1, `${f}: the ledger is there after the reload`);
    assert.deepEqual(back.state.quests, s.quests);
  }
});

test("[R74-migrate] MIGRATIONS[4] is pure and total: it never throws on hostile input, never mutates it, and returns a version 5 object the schema then judges", () => {
  const hostile = [null, undefined, 1, "x", [], {}, { version: 4 }, { version: 4, quests: null }, { version: 4, quests: [] }, { version: 4, quests: "x" },
    { version: 4, quests: { pinned: "main", main: null } }, { version: 4, quests: { pinned: "main", main: { m: null } } }, { version: 4, quests: { pinned: "main", main: { m: [] } } },
    { version: 4, quests: { pinned: "main", main: { m: { depth: "9", memo: 1 } } } }, { version: 4, quests: { pinned: { toString: 1 }, main: { m: { depth: 1 } } } },
    { version: 4, quests: { main: { m: { depth: 99, verdict: true, defeated: true, unlocked: true, memo: true } }, pinned: "main" } }];
  for (const h of hostile) {
    if (h === null || typeof h !== "object" || Array.isArray(h)) continue; // migrate() is only ever called with a parsed object
    const frozen = JSON.stringify(h);
    let out;
    assert.doesNotThrow(() => { out = MIGRATIONS[4](structuredClone(h)); }, JSON.stringify(h));
    assert.equal(out.version, 5);
    assert.equal(JSON.stringify(h), frozen);
    assert.doesNotThrow(() => migrate(structuredClone(h), 5));
  }
  const v5 = { version: 5, quests: { sq4: { s: "active", p: 0 } } };
  assert.deepEqual(MIGRATIONS[4](structuredClone(v5)), v5, "a version 5 input is returned unchanged");
  // a v4 file that already carries sq4 (forged) is overwritten with the available state, not trusted
  const forged = JSON.parse(v4Text(fresh(3)));
  forged.quests.sq4 = { s: "completed", p: 1 }; forged.quests.sq5 = { s: "ready", p: 6 };
  const r = deserialize(seal(forged));
  if (r.ok) { assert.deepEqual(r.state.quests.sq4, { s: "available", p: 0 }); assert.deepEqual(r.state.quests.sq5, { s: "available", p: 0 }); }
});

test("[R74-migrate] a version 6 text is `newer`, a corrupt v4 text ends corrupt without an exception, a v4 text with a bad checksum is refused, and 400 mutated v4 texts never throw", () => {
  const v5 = JSON.parse(serialize(fresh(3))); v5.version = 6;
  const n = deserialize(seal(v5));
  assert.equal(n.ok, false); assert.equal(n.reason, "newer");
  const text = v4Text(fresh(3));
  assert.doesNotThrow(() => deserialize(text.slice(0, text.length >> 1)));
  assert.equal(deserialize(text.slice(0, text.length >> 1)).ok, false);
  assert.equal(deserialize(text.replace('"checksum":"', '"checksum":"0')).ok, false);
  let st = 99; const rnd = (k) => { st = (Math.imul(st, 1103515245) + 12345) >>> 0; return st % k; };
  const seeds = [v4Text(fresh(3)), ...["save-v4-lobby.json", "save-v4-floor4.json", "save-v4-pinned-side.json", "save-v4-boss-defeated.json"].map(read)];
  let accepted = 0;
  for (let i = 0; i < 400; i++) {
    const o = JSON.parse(seeds[i % seeds.length]);
    const tgt = rnd(3) ? o.quests : o.quests.main.m, keys = Object.keys(tgt), k = keys[rnd(keys.length)];
    const val = [null, "x", -1, 1e9, [], {}, true, "<script>", { s: "ready", p: 1 }, 0, "constructor", "main2", { m: {} }][rnd(13)];
    if (rnd(4) === 0) delete tgt[k]; else tgt[k] = val;
    let r;
    assert.doesNotThrow(() => { r = deserialize(rnd(2) ? seal(o) : JSON.stringify(o)); });
    if (r.ok) { accepted++; const again = deserialize(serialize(r.state)); assert.ok(again.ok, `accepted a save that does not survive a write: ${again.message}`); assert.equal(JSON.parse(serialize(r.state)).version, 5); }
  }
  assert.ok(accepted >= 0);
});

// ---------------------------------------------------------------------------------------------------- slot index (qv 5)
const IDX = config.slotIndexKey, KEY = (n) => `${config.slotKeyPrefix}${n}`;
function twoSlots() {
  const adapter = createMemoryAdapter();
  const a = fresh(3); enterFloor(a, 4, { at: "entry" }); setQuestStep(a, "sq1", 3); setQuestStep(a, "sq3", 3);
  const b = fresh(4); b.player.name = "Second"; completeQuest(b, "main3"); for (const id of content.sideIds) setQuestStep(b, id, 3);
  const c = fresh(5); c.player.name = "Third"; enterFloor(c, 9, { at: "entry" });
  const st = createSlotStore(adapter, { now: () => 1000, tabId: "t1" });
  assert.ok(st.create(1, a).ok); assert.ok(st.create(2, b).ok); assert.ok(st.create(3, c).ok);
  return { adapter, st, a, b, c };
}
test("[R74-slots] an index written by a v4 build (mainStep on the 1..6 scale, no qv) is rebuilt once: qv 5, mainStep 1..10, sidesDone 0..5, mainDone only with all three main quests; active, last, owner and lastPlayed survive; slot texts are byte-identical", () => {
  const { adapter } = twoSlots();
  const idx = JSON.parse(adapter.getItem(IDX));
  idx.active = 2; idx.last = 1; idx.owner = { id: "t1", beat: 1000 };
  idx.slots[0].lastPlayed = 111; idx.slots[1].lastPlayed = 222;
  for (const e of idx.slots) if (e.state === "ok") { delete e.qv; e.mainStep = 4; e.mainDone = false; e.sidesDone = 1; } // a v4 build wrote the 1..6 scale
  adapter.setItem(IDX, JSON.stringify(idx));
  const before = [1, 2, 3].map((n) => adapter.getItem(KEY(n)));
  const st2 = createSlotStore(adapter, { now: () => 9000, tabId: "t2" });
  const u = st2.upgradeIndex();
  assert.ok(u.ok && u.upgraded, JSON.stringify(u));
  const after = JSON.parse(adapter.getItem(IDX));
  assert.deepEqual([after.active, after.last], [2, 1]);
  assert.deepEqual(after.owner, idx.owner);
  assert.deepEqual([after.slots[0].lastPlayed, after.slots[1].lastPlayed], [111, 222]);
  for (const e of after.slots.filter((x) => x.state === "ok")) assert.equal(e.qv, 5);
  const [e1, e2, e3] = after.slots;
  assert.deepEqual([e1.mainStep, e1.mainDone, e1.sidesDone], [5, false, 2]);
  assert.deepEqual([e2.mainStep, e2.mainDone, e2.sidesDone], [10, true, 5], "all main quests done: mainStep clamps to 10 and mainDone is set");
  assert.deepEqual([e3.mainDone, e3.sidesDone], [false, 0]);
  assert.ok(e3.mainStep >= 8 && e3.mainStep <= 10);
  assert.deepEqual([1, 2, 3].map((n) => adapter.getItem(KEY(n))), before, "the slot texts are not rewritten");
  assert.deepEqual(st2.upgradeIndex(), { ok: true, skipped: true }, "once");
  assert.equal(JSON.stringify(JSON.parse(adapter.getItem(IDX))), JSON.stringify(after), "a second run changes nothing");
});

test("[R74-slots] slot texts written by a v4 build (version 4 text, v4 index) upgrade the card to the global step of the migrated save, with its completed sides", () => {
  const adapter = createMemoryAdapter();
  const s = fresh(7); enterFloor(s, 4, { at: "entry" }); setQuestStep(s, "sq1", 3);
  const st = createSlotStore(adapter, { now: () => 1000, tabId: "t1" });
  assert.ok(st.create(1, s).ok);
  const t4 = v4Text(s); adapter.setItem(KEY(1), t4);
  const idx = JSON.parse(adapter.getItem(IDX)); delete idx.slots[0].qv; idx.slots[0].mainStep = 4; idx.slots[0].sum = idx.slots[0].sum; adapter.setItem(IDX, JSON.stringify(idx));
  const st2 = createSlotStore(adapter, { now: () => 5000, tabId: "t2" });
  st2.migrateLegacy();
  const e = JSON.parse(adapter.getItem(IDX)).slots[0];
  assert.equal(e.state, "ok", JSON.stringify(e));
  assert.equal(e.qv, 5); assert.equal(e.mainStep, 5); assert.equal(e.sidesDone, 1); assert.equal(e.mainDone, false);
  assert.equal(adapter.getItem(KEY(1)), t4, "the text stays a version 4 text until the next write");
  const l = st2.load(1); assert.ok(l.ok, JSON.stringify(l)); assert.equal(l.state.quests.sq4.s, "available");
  assert.equal(slotQuestText(e), `${content.mainSteps[4].title} · 1/5`.replace(" · ", " · "), "the card line");
});

test("[R74-slots] a stale entry whose slot text is damaged keeps its old entry without quest fields; a hostile index entry (strings, floats, huge numbers) cannot break the card line", () => {
  const { adapter } = twoSlots();
  const idx = JSON.parse(adapter.getItem(IDX));
  for (const e of idx.slots) if (e.state === "ok") { delete e.qv; e.mainStep = 3; }
  adapter.setItem(IDX, JSON.stringify(idx));
  adapter.setItem(KEY(1), "{not json");
  const st = createSlotStore(adapter, { now: () => 9000, tabId: "t2" });
  let u; assert.doesNotThrow(() => { u = st.upgradeIndex(); });
  assert.ok(u.ok);
  const after = JSON.parse(adapter.getItem(IDX));
  assert.ok(after.slots[0].state !== "ok" || after.slots[0].qv === undefined, "no invented quest fields for a text that cannot vouch for them");
  assert.equal(slotQuestText(after.slots[0]), "", "no quest line, no crash");
  assert.equal(after.slots[1].qv, 5);
  for (const bad of [{ state: "ok", mainStep: "3" }, { state: "ok", mainStep: 3.5 }, { state: "ok", mainStep: 1e9, sidesDone: -4 }, { state: "ok", mainStep: -7, mainDone: "yes", sidesDone: "<img src=x onerror=alert(1)>" }, { state: "ok", mainStep: 0 }, { state: "ok", mainStep: NaN }, { state: "bad", mainStep: 3 }, null, undefined]) {
    let t; assert.doesNotThrow(() => { t = slotQuestText(bad); }, JSON.stringify(bad));
    assert.equal(typeof t, "string");
    if (bad?.state === "ok" && Number.isInteger(bad.mainStep)) assert.ok(content.mainSteps.some((x) => t.startsWith(x.title)) || t.length > 0);
  }
});
void v3Text; void sealText; void toSave;
