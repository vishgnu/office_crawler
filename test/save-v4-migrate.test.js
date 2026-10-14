// Migration 3 to 4 (R7-0.3, ADR-0006 amendment "R7 quests" point 4, AC-R-251-2, AC-R-251-3, AC-R-252-1): five legal v3 saves built from real play, the chains
// v1 to v4 and v2 to v4, no retroactive reward, no note, slot index fields and upgradeIndex.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, config } from "../src/core/index.js";
import { deserialize, serialize, check, migrate, MIGRATIONS, SAVE_KEYS, checksumOf, createSlotStore, createMemoryAdapter, slotsView } from "../src/save/index.js";
import { mainStep } from "../src/core/systems/questview.js";
import { v3Text, sealText } from "./helpers.js";

const fx = (n) => readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), "utf8");
const FIX = [["lobby", 1, 0], ["floor1", 3, 1], ["floor4", 4, 4], ["boss-unlocked", 5, 8], ["boss-defeated", 6, 9]]; // name, derived main step, milestone depth
const clock = () => { let t = 1000; return () => (t += 1000); };

test("the five v3 fixtures are legal v3 saves: version 3, every v3 key, no quests, sealed", () => {
  for (const [name] of FIX) {
    const j = JSON.parse(fx(`save-v3-${name}`));
    assert.equal(j.version, 3, name); assert.ok(!("quests" in j), name);
    assert.deepEqual(Object.keys(j).sort(), [...SAVE_KEYS.filter((k) => k !== "quests"), "checksum"].sort(), name);
    assert.equal(j.checksum, checksumOf(j), name);
  }
  const f = (n) => JSON.parse(fx(`save-v3-${n}`));
  assert.deepEqual([f("lobby").deepestDepth, f("lobby").resume.depth, f("lobby").stats.kills, Object.keys(f("lobby").explored)], [1, 0, 0, []], "the spec's deepestDepth 0 case: no sign of a descent");
  assert.ok(f("floor1").explored[1] && f("floor1").deepestDepth === 1);
  assert.equal(f("floor4").deepestDepth, 4);
  assert.ok(f("boss-unlocked").bossUnlocked && !f("boss-unlocked").bossDefeated);
  assert.ok(f("boss-defeated").bossDefeated);
});

test("the v3 test writer (helpers.v3Text) produces the same shape as the real fixtures", () => {
  const j = JSON.parse(v3Text(newGame(5, { class: "facilities-manager", name: "Shape", start: "town" })));
  assert.deepEqual(Object.keys(j).sort(), Object.keys(JSON.parse(fx("save-v3-lobby"))).sort());
  assert.equal(j.version, 3);
});

test("AC-R-251-2 each fixture loads in v4 with the derived main step, all side quests available, pinned main, empty pouch, and no note", () => {
  for (const [name, step, depth] of FIX) {
    const r = deserialize(fx(`save-v3-${name}`));
    assert.equal(r.ok, true, `${name}: ${r.message}`);
    assert.equal(r.save.version, 4);
    assert.deepEqual(r.notes, [], "no notice for 3 to 4");
    const q = r.state.quests;
    assert.equal(mainStep(q.main.m), step, name); assert.equal(q.main.m.depth, depth, name);
    assert.deepEqual([q.sq1, q.sq2, q.sq3], Array(3).fill({ s: "available", p: 0 })); assert.equal(q.pinned, "main"); assert.deepEqual(r.state.player.pouch, []);
    assert.equal(q.main.m.verdict, false); assert.equal(q.main.m.defeated, name === "boss-defeated"); assert.equal(q.main.m.unlocked, name === "boss-unlocked" || name === "boss-defeated");
    assert.equal(r.state.events.length, 0, "no quest cue on load");
  }
});

test("no retroactive reward and nothing else is touched: the v4 save equals the v3 fixture except version, quests and checksum (deep-equal)", () => {
  for (const [name] of FIX) {
    const old = JSON.parse(fx(`save-v3-${name}`)), r = deserialize(fx(`save-v3-${name}`));
    const { checksum: c1, version: v1, ...a } = old, { checksum: c2, version: v2, quests, ...b } = r.save;
    assert.deepEqual(b, a, name);
    assert.equal(quests.pouch.length, 0);
    const p = r.state.player;
    assert.deepEqual([p.gold, p.xp, p.level, p.skillPoints, r.state.nextItemId], [old.player.gold, old.player.xp, old.player.level, old.player.skillPoints, old.nextItemId]);
    assert.deepEqual(r.state.inventory.items.map((i) => i.id), old.inventory.items.map((i) => i.id));
  }
});

test("MIGRATIONS[3] is pure and idempotent: a version 4 input comes back unchanged, the v3 input is not mutated, and its output re-saves as the same text", () => {
  const old = JSON.parse(fx("save-v3-floor4")), copy = structuredClone(old);
  const m = MIGRATIONS[3](structuredClone(old));
  assert.deepEqual(old, copy); assert.equal(m.version, 4);
  assert.deepEqual(MIGRATIONS[3](structuredClone(m)), m);
  migrate(old, 4); assert.deepEqual(old, copy);
  const r = deserialize(fx("save-v3-floor4")), again = deserialize(serialize(r.state));
  assert.equal(again.ok, true); assert.deepEqual(again.notes, []); assert.equal(serialize(again.state), serialize(r.state));
});

test("derived depth rule: 'ever descended' is deepestDepth >= 2, explored[1], resume.depth >= 1 or stats.kills > 0; each sign alone gives depth 1, none gives 0", () => {
  const lobby = JSON.parse(fx("save-v3-lobby")), f1 = JSON.parse(fx("save-v3-floor1"));
  const depthOf = (mut) => { const j = structuredClone(lobby); mut(j); const r = deserialize(sealText(j)); assert.equal(r.ok, true, r.message); return r.state.quests.main.m.depth; };
  assert.equal(depthOf(() => {}), 0);
  assert.equal(depthOf((j) => { j.explored = f1.explored; }), 1, "explored[1]");
  assert.equal(depthOf((j) => { j.resume.depth = 1; }), 1, "resume.depth");
  assert.equal(depthOf((j) => { j.stats.kills = 2; }), 1, "kills");
  assert.equal(depthOf((j) => { j.deepestDepth = 2; }), 2, "deepestDepth 2");
  assert.equal(depthOf((j) => { j.deepestDepth = 6; }), 6);
  const defeated = depthOf((j) => { j.bossDefeated = true; j.bossUnlocked = true; j.deepestDepth = config.bossDepth; });
  assert.equal(defeated, config.bossDepth);
  const flags = (mut) => { const j = structuredClone(lobby); mut(j); const m = deserialize(sealText(j)).state.quests.main.m; return [m.memo, m.unlocked, m.defeated, m.verdict]; };
  assert.deepEqual(flags(() => {}), [false, false, false, false]);
  assert.deepEqual(flags((j) => { j.stats.kills = 1; }), [true, false, false, false]);
  assert.deepEqual(flags((j) => { j.bossUnlocked = true; j.deepestDepth = 8; }), [true, true, false, false]);
});

test("chains: version 0, 1 and 2 saves end as version 4 with a quest block (v1 to v4, v2 to v4), and a Clerk save still reports its refund note", () => {
  for (const f of ["save-v0", "save-v1", "save-v2-r5-fm", "save-v2-r5-it", "save-v2-r5-sales"]) {
    const old = JSON.parse(fx(f)), r = deserialize(fx(f));
    assert.equal(r.ok, true, `${f}: ${r.message}`);
    assert.equal(r.save.version, 4, f); assert.ok(r.save.quests, f);
    assert.equal(mainStep(r.state.quests.main.m) >= 1, true);
    assert.deepEqual(r.state.quests.pinned, "main");
    const again = deserialize(serialize(r.state)); assert.equal(again.ok, true, f); assert.deepEqual(again.notes, [], f);
    if (f.startsWith("save-v2")) assert.deepEqual(r.notes.map((n) => n.from), f === "save-v2-r5-fm" ? [] : [2], f);
    if (f === "save-v1") assert.deepEqual(r.notes.map((n) => n.from), [1]);
    if (old.deepestDepth >= 2) assert.equal(r.state.quests.main.m.depth, old.deepestDepth, f);
  }
  const v2 = migrate(JSON.parse(fx("save-v2-r5-it")), 4); assert.equal(v2.ok, true); assert.equal(v2.data.version, 4);
  const v1 = migrate(JSON.parse(fx("save-v1")), 4); assert.equal(v1.ok, true); assert.deepEqual(v1.notes.map((n) => n.from), [1]);
});

test("a corrupt v3 text still ends as corrupt or schema without an exception; malformed fields never crash the migration", () => {
  const good = JSON.parse(fx("save-v3-floor4"));
  const bad = [
    (j) => { j.deepestDepth = "4"; }, (j) => { j.explored = "x"; }, (j) => { j.resume = null; }, (j) => { j.stats = null; }, (j) => { delete j.stats; },
    (j) => { j.bossUnlocked = "yes"; }, (j) => { j.deepestDepth = 99; }, (j) => { j.deepestDepth = -3; }, (j) => { j.explored = []; j.resume = []; j.stats = []; },
  ];
  for (const mut of bad) {
    const j = structuredClone(good); mut(j);
    let r; assert.doesNotThrow(() => { r = deserialize(sealText(j)); });
    assert.equal(r.ok, false); assert.ok(["schema", "no-migration"].includes(r.reason), r.reason);
  }
  assert.doesNotThrow(() => MIGRATIONS[3]({ version: 3 }));
  for (const text of [fx("save-v3-floor4").slice(0, 400), fx("save-v3-floor4").replace('"version":3', '"version":3,"x":'), JSON.stringify({ ...good, checksum: "bad" })]) {
    const r = deserialize(text); assert.equal(r.ok, false); assert.ok(["parse", "checksum"].includes(r.reason), r.reason);
  }
});

// ---- slots: index fields (ADR-0006 amendment point 6) -------------------------------------------------------------------------

const mk = () => { const adapter = createMemoryAdapter(); return { adapter, store: createSlotStore(adapter, { now: clock() }) }; };

test("AC-R-252-1 a v3 slot lists with its derived step, mainDone false and 0 side quests; importing it keeps the fields in the index", () => {
  const { store } = mk();
  FIX.forEach(([name, step], i) => {
    const r = store.importText(i + 1, fx(`save-v3-${name}`), { confirm: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    const e = store.list().slots[i];
    assert.deepEqual([e.state, e.mainStep, e.mainDone, e.sidesDone], ["ok", step, false, 0], name);
  });
});

test("entryFromState: a saved game writes the fields; completed side quests are counted and a finished main quest is mainDone", () => {
  const { store } = mk(), s = newGame(5, { class: "sales-rep", name: "Cards", start: "town" });
  assert.equal(store.create(1, s).ok, true);
  assert.deepEqual(["mainStep", "mainDone", "sidesDone"].map((k) => store.list().slots[0][k]), [1, false, 0]);
  s.quests.main.m = { memo: true, depth: 9, unlocked: true, defeated: true, verdict: true }; s.bossDefeated = true; s.bossUnlocked = true; s.deepestDepth = 9;
  s.quests.sq1 = { s: "completed", p: 8 }; s.quests.sq3 = { s: "completed", p: 1 };
  assert.equal(store.write(1, s).ok, true);
  assert.deepEqual(["mainStep", "mainDone", "sidesDone"].map((k) => store.list().slots[0][k]), [6, true, 2]);
});

test("slotsView().list carries the three fields for ok entries and none for empty, bad and newer entries", () => {
  const { store, adapter } = mk();
  store.importText(1, fx("save-v3-floor4"), { confirm: true });
  adapter.setItem("office-crawler.slot.3", "{not json"); adapter.setItem("office-crawler.slot.4", JSON.stringify({ ...JSON.parse(fx("save-v3-lobby")), version: 9 }));
  const idx = JSON.parse(adapter.getItem("office-crawler.slots")); idx.slots[2] = { n: 3, state: "bad", reason: "parse", bytes: 10 }; idx.slots[3] = { n: 4, state: "newer" }; adapter.setItem("office-crawler.slots", JSON.stringify(idx));
  const list = slotsView(createSlotStore(adapter, { now: clock() })).list;
  assert.deepEqual([list[0].mainStep, list[0].mainDone, list[0].sidesDone], [4, false, 0]);
  for (const i of [1, 2, 3]) assert.ok(!("mainStep" in list[i]) && !("mainDone" in list[i]) && !("sidesDone" in list[i]), `slot ${i + 1}: ${list[i].state}`);
});

test("upgradeIndex: an index written by R5 or R6 (no quest fields) is rebuilt at boot, keeping active, last, owner and lastPlayed; a second call does nothing", () => {
  const { store, adapter } = mk();
  store.importText(1, fx("save-v3-floor1"), { confirm: true }); store.importText(2, fx("save-v3-boss-defeated"), { confirm: true });
  const old = JSON.parse(adapter.getItem("office-crawler.slots"));
  for (const e of old.slots) { delete e.mainStep; delete e.mainDone; delete e.sidesDone; }
  old.active = 2; old.last = 2; old.owner = { id: "tab-x", beat: 123 }; old.slots[0].lastPlayed = 4242; old.slots[1].lastPlayed = 777;
  adapter.setItem("office-crawler.slots", JSON.stringify(old));
  const fresh = createSlotStore(adapter, { now: clock() });
  const r = fresh.migrateLegacy();
  assert.equal(r.ok, true); assert.equal(r.skipped, true); assert.equal(r.upgraded, true);
  const idx = JSON.parse(adapter.getItem("office-crawler.slots"));
  assert.deepEqual([idx.active, idx.last, idx.owner], [2, 2, { id: "tab-x", beat: 123 }]);
  assert.deepEqual([idx.slots[0].mainStep, idx.slots[1].mainStep, idx.slots[1].mainDone, idx.slots[0].sidesDone], [3, 6, false, 0]);
  assert.deepEqual([idx.slots[0].lastPlayed, idx.slots[1].lastPlayed], [4242, 777]);
  assert.deepEqual(idx.slots.slice(2).map((e) => e.state), ["empty", "empty", "empty"]);
  const raw = adapter.getItem("office-crawler.slots");
  assert.deepEqual(fresh.upgradeIndex(), { ok: true, skipped: true }); assert.equal(adapter.getItem("office-crawler.slots"), raw);
  assert.deepEqual(createSlotStore(adapter, { now: clock() }).migrateLegacy(), { ok: true, skipped: true });
});

test("upgradeIndex leaves a damaged or missing index to the normal repair and never throws", () => {
  const { store, adapter } = mk();
  assert.deepEqual(store.upgradeIndex(), { ok: true, skipped: true });
  adapter.setItem("office-crawler.slots", "{{{"); assert.doesNotThrow(() => store.upgradeIndex());
  assert.equal(store.list().slots.length, 5);
});

test("AC-R-251-3 a v3 floor-4 save beside a valid v4 slot: both are listed ok, each with its own step", () => {
  const { store } = mk();
  store.create(1, newGame(5, { class: "it-wizard", name: "Fresh", start: "town" }));
  store.importText(2, fx("save-v3-floor4"), { confirm: true });
  const l = store.list().slots;
  assert.deepEqual([l[0].state, l[0].mainStep, l[1].state, l[1].mainStep], ["ok", 1, "ok", 4]);
  const r = store.load(2); assert.equal(r.ok, true); assert.equal(mainStep(r.state.quests.main.m), 4);
});
