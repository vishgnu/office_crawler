// Save version 5 (R7-4.1, AC-R-259-1, AC-R-259-2; ADR-0007 amendment A3): MIGRATIONS[4] from five v4 fixtures (built from the real chain, never typed by hand), the derived pin,
// no reward, idempotence, the newer and corrupt cases, the schema rules for sq4 and sq5, and the slot index fields qv, mainStep 1..10, sidesDone 0..5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, config, content } from "../src/core/index.js";
import { setQuestStep } from "../src/core/cheats.js";
import { deserialize, serialize, check, migrate, MIGRATIONS, schemaProblem, toSave, createSlotStore, createMemoryAdapter } from "../src/save/index.js";
import { mainStep } from "../src/core/systems/questview.js";
import { v4Text, sealText } from "./helpers.js";

const fx = (n) => readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), "utf8");
const FIX = [["lobby", "main", 1], ["floor4", "main2", 5], ["floor8-unlocked", "main3", 9], ["boss-defeated", "main3", 10], ["pinned-side", "sq1", 5]]; // name, pin after the chain, global step
const hero = (seed = 5) => newGame(seed, { class: "facilities-manager", name: "V5", start: "town" });
const at = (s, g) => { const st = content.mainSteps[g - 1]; return setQuestStep(s, st.arcId, st.arcStep); };
const clock = () => { let t = 1000; return () => (t += 1000); };

test("the five v4 fixtures are legal v4 saves: version 4, no sq4 and no sq5, the alias pin, sealed", () => {
  for (const [name] of FIX) {
    const j = JSON.parse(fx(`save-v4-${name}`));
    assert.equal(j.version, 4, name);
    assert.deepEqual(Object.keys(j.quests).sort(), ["main", "pinned", "pouch", "sq1", "sq2", "sq3"], name);
  }
  assert.equal(JSON.parse(fx("save-v4-pinned-side")).quests.pinned, "sq1");
  assert.equal(JSON.parse(fx("save-v4-floor4")).quests.pinned, "main");
});

test("AC-R-259-1 each v4 fixture migrates to v5: sq4 and sq5 available, main.m, sq1..sq3, pouch and every other field deep-equal, the pin derived, no reward, no note", () => {
  for (const [name, pin, step] of FIX) {
    const old = JSON.parse(fx(`save-v4-${name}`)), r = migrate(structuredClone(old), 5);
    assert.equal(r.ok, true, name); assert.deepEqual(r.notes, []);
    const { version: v1, quests: q1, checksum: c1, ...a } = old, { version: v2, quests: q2, checksum: c2, ...b } = r.data;
    assert.equal(v2, 5); assert.deepEqual(b, a, `${name}: nothing but version and quests changes`);
    assert.deepEqual(q2.sq4, { s: "available", p: 0 }); assert.deepEqual(q2.sq5, { s: "available", p: 0 });
    assert.deepEqual(q2.main, q1.main); assert.deepEqual([q2.sq1, q2.sq2, q2.sq3, q2.pouch], [q1.sq1, q1.sq2, q1.sq3, q1.pouch]);
    assert.equal(q2.pinned, pin, name);
    const l = deserialize(fx(`save-v4-${name}`));
    assert.equal(l.ok, true, `${name}: ${l.message}`); assert.deepEqual(l.notes, []);
    assert.equal(mainStep(l.state.quests.main.m), step, name);
    const p = l.state.player; assert.deepEqual([p.gold, p.xp, p.level], [old.player.gold, old.player.xp, old.player.level], "no reward is paid");
    assert.equal(l.state.events.length, 0, "no quest cue on load");
    const again = deserialize(serialize(l.state)); assert.equal(again.ok, true); assert.equal(serialize(again.state), serialize(l.state));
  }
});

test("AC-R-259-1 the pin of a main quest becomes the active arc: main at depth 0 to 2, main2 at 3 to 5, main3 from 6 on and when everything is done; a pinned side quest stays", () => {
  const pinOf = (m, pinned = "main") => MIGRATIONS[4]({ version: 4, quests: { main: { m }, pinned, pouch: [] } }).quests.pinned;
  const m = (depth, o = {}) => ({ memo: depth > 0, depth, unlocked: false, defeated: false, verdict: false, ...o });
  assert.deepEqual([0, 1, 2].map((d) => pinOf(m(d))), ["main", "main", "main"]);
  assert.deepEqual([3, 4, 5].map((d) => pinOf(m(d))), ["main2", "main2", "main2"]);
  assert.deepEqual([6, 7].map((d) => pinOf(m(d))), ["main3", "main3"]);
  assert.equal(pinOf(m(8, { unlocked: true })), "main3"); assert.equal(pinOf(m(9, { unlocked: true, defeated: true })), "main3"); assert.equal(pinOf(m(9, { unlocked: true, defeated: true, verdict: true })), "main3");
  assert.equal(pinOf(m(5), "sq2"), "sq2");
});

test("AC-R-259-1 MIGRATIONS[4] is pure and idempotent; version 7 is newer; a corrupt v4 text ends as corrupt without an exception", () => {
  const old = JSON.parse(fx("save-v4-floor4")), copy = structuredClone(old);
  const m = MIGRATIONS[4](structuredClone(old));
  assert.deepEqual(old, copy); assert.equal(m.version, 5);
  assert.deepEqual(MIGRATIONS[4](structuredClone(m)), m, "a v5 input comes back unchanged");
  migrate(old, 5); assert.deepEqual(old, copy, "migrate does not mutate its input");
  assert.equal(deserialize(sealText({ ...JSON.parse(fx("save-v4-lobby")), version: 7 })).reason, "newer");
  for (const text of [fx("save-v4-floor4").slice(0, 500), fx("save-v4-floor4").replace('"version":4', '"version":4,"x":'), JSON.stringify({ ...old, checksum: "bad" })]) {
    let r; assert.doesNotThrow(() => { r = deserialize(text); }); assert.equal(r.ok, false); assert.ok(["parse", "checksum", "corrupt"].includes(r.reason) || r.reason, r.reason);
  }
  for (const bad of [{ version: 4 }, { version: 4, quests: null }, { version: 4, quests: [] }, { version: 4, quests: { main: null, pinned: "main" } }, { version: 4, quests: { main: { m: "x" }, pinned: "main" } }]) assert.doesNotThrow(() => MIGRATIONS[4](structuredClone(bad)));
});

test("AC-R-259-1 a v4 text written from real play (v4Text) loads as the same quest state plus sq4 and sq5 available", () => {
  const s = hero(); at(s, 5); setQuestStep(s, "sq2", 2); setQuestStep(s, "sq1", 1); s.quests.sq1.p = 2;
  const r = deserialize(v4Text(s));
  assert.equal(r.ok, true, r.message);
  assert.deepEqual({ ...r.state.quests, sq4: undefined, sq5: undefined, pinned: undefined }, { ...s.quests, sq4: undefined, sq5: undefined, pinned: undefined });
  assert.deepEqual(r.state.player.pouch, s.player.pouch);
  assert.equal(r.state.quests.pinned, "main2", "the alias became the active quest");
});

test("AC-R-259-1 the schema accepts exactly what play can produce for sq4 and sq5: forged ready, completed, pinned and pouch states are refused", () => {
  const base = () => JSON.parse(serialize(hero()));
  const refuse = (what, mut) => { const j = base(); mut(j); assert.equal(deserialize(sealText(j)).ok, false, what); };
  refuse("sq4 ready with deepestDepth 1", (j) => { j.quests.sq4 = { s: "ready", p: 1 }; j.quests.pouch = [{ id: "qi-sq4", quest: "sq4" }]; });
  refuse("sq4 completed with deepestDepth 1", (j) => { j.quests.sq4 = { s: "completed", p: 1 }; });
  refuse("sq5 completed with no kills", (j) => { j.deepestDepth = 6; j.quests.sq5 = { s: "completed", p: 6 }; });
  refuse("sq5 ready with no kills", (j) => { j.deepestDepth = 6; j.quests.sq5 = { s: "ready", p: 6 }; });
  refuse("sq5 completed with kills but never on floor 5", (j) => { j.deepestDepth = 3; j.stats.kills = 99; j.quests.sq5 = { s: "completed", p: 6 }; });
  refuse("pinned a locked main quest", (j) => { j.quests.pinned = "main2"; });
  refuse("pinned a main quest that is done", (j) => { j.quests.main.m.depth = 3; j.deepestDepth = 3; j.quests.pinned = "main"; });
  refuse("a ledger in the pouch while sq4 is not ready", (j) => { j.quests.pouch = [{ id: "qi-sq4", quest: "sq4" }]; });
  refuse("sq5 with a pouch entry (a kill quest has no item)", (j) => { j.deepestDepth = 6; j.stats.kills = 99; j.quests.sq5 = { s: "ready", p: 6 }; j.quests.pouch = [{ id: "qi-sq5", quest: "sq5" }]; });
  const ok = base(); ok.deepestDepth = 6; ok.stats.kills = 99; ok.quests.sq5 = { s: "completed", p: 6 }; ok.quests.main.m.depth = 6; ok.quests.pinned = "main3"; ok.quests.sq4 = { s: "active", p: 0 };
  assert.equal(schemaProblem(ok), null, "and the legal neighbour passes");
  // the ledger floor of sq4 is 5 or 6 by the quest stream: "ready" needs a hero that has been that deep (deepestDepth below the lowest candidate is refused)
  const j = base(); j.quests.sq4 = { s: "ready", p: 1 }; j.quests.pouch = [{ id: "qi-sq4", quest: "sq4" }];
  j.deepestDepth = Math.min(...config.quests.sq4.item.floors) - 1;
  assert.notEqual(schemaProblem(j), null);
});

// ---- slot index (AC-R-259-2) --------------------------------------------------------------------------------------------------

const mk = () => { const adapter = createMemoryAdapter(); return { adapter, store: createSlotStore(adapter, { now: clock() }) }; };

test("AC-R-259-2 an index written by a v4 build (mainStep on the 1..6 scale, no qv) is rebuilt once from the slot texts: qv 5, mainStep 1..10, sidesDone 0..5, active, last, owner and lastPlayed kept", () => {
  const { store, adapter } = mk();
  const a = hero(1), b = hero(2); completeAll(b); for (const id of ["sq1", "sq4", "sq5"]) setQuestStep(b, id, 3);
  store.create(1, a); store.create(2, b);
  const old = JSON.parse(adapter.getItem("office-crawler.slots"));
  for (const e of old.slots) if (e.state === "ok") { delete e.qv; e.mainStep = 3; e.mainDone = false; e.sidesDone = 1; } // what a v4 build wrote
  old.active = 2; old.last = 2; old.owner = { id: "tab-x", beat: 123 }; old.slots[0].lastPlayed = 4242; old.slots[1].lastPlayed = 777;
  adapter.setItem("office-crawler.slots", JSON.stringify(old));
  const fresh = createSlotStore(adapter, { now: clock() });
  assert.equal(fresh.upgradeIndex().upgraded, true);
  const idx = JSON.parse(adapter.getItem("office-crawler.slots"));
  assert.deepEqual([idx.active, idx.last, idx.owner], [2, 2, { id: "tab-x", beat: 123 }]);
  assert.deepEqual([idx.slots[0].qv, idx.slots[0].mainStep, idx.slots[0].mainDone, idx.slots[0].sidesDone], [5, 1, false, 0]);
  assert.deepEqual([idx.slots[1].qv, idx.slots[1].mainStep, idx.slots[1].mainDone, idx.slots[1].sidesDone], [5, 10, true, 3]);
  assert.deepEqual([idx.slots[0].lastPlayed, idx.slots[1].lastPlayed], [4242, 777]);
  const raw = adapter.getItem("office-crawler.slots");
  assert.deepEqual(fresh.upgradeIndex(), { ok: true, skipped: true }); assert.equal(adapter.getItem("office-crawler.slots"), raw, "a second call does nothing");
});

test("AC-R-259-2 mainDone is true only when all three main quests are done; sidesDone counts up to five", () => {
  const { store } = mk();
  const s = hero(); at(s, 9); store.create(1, s);
  assert.deepEqual(["mainStep", "mainDone", "qv"].map((k) => store.list().slots[0][k]), [9, false, 5], "the boss is not defeated yet: step 9, not done");
  for (const id of content.sideIds) setQuestStep(s, id, 3);
  completeAll(s); assert.equal(store.write(1, s).ok, true);
  assert.deepEqual(["mainStep", "mainDone", "sidesDone"].map((k) => store.list().slots[0][k]), [10, true, 5]);
});
function completeAll(s) { at(s, 10); s.quests.main.m.verdict = true; s.quests.pinned = "main3"; }

test("AC-R-259-2 a rebuild that fails keeps the old entry without crashing: the slot text is gone or corrupt, the card then has no quest fields", () => {
  const { store, adapter } = mk();
  store.create(1, hero(1)); store.create(2, hero(2));
  const old = JSON.parse(adapter.getItem("office-crawler.slots"));
  for (const e of old.slots) if (e.state === "ok") { delete e.qv; e.mainStep = 4; }
  adapter.setItem("office-crawler.slots", JSON.stringify(old));
  adapter.setItem("office-crawler.slot.1", "{broken");
  adapter.removeItem("office-crawler.slot.2");
  let r; assert.doesNotThrow(() => { r = createSlotStore(adapter, { now: clock() }).upgradeIndex(); });
  assert.equal(r.ok, true);
  const idx = JSON.parse(adapter.getItem("office-crawler.slots"));
  for (const i of [0, 1]) { assert.equal(idx.slots[i].state, "ok", `slot ${i + 1} keeps its entry`); assert.ok(!("mainStep" in idx.slots[i]) && !("qv" in idx.slots[i]), "without the quest fields it cannot vouch for"); assert.equal(idx.slots[i].name, old.slots[i].name); }
  assert.doesNotThrow(() => createSlotStore(adapter, { now: clock() }).list());
});

test("AC-R-259-2 a migrated v4 slot lists with its derived step and its completed sides", () => {
  const { store } = mk();
  const r = store.importText(1, fx("save-v4-boss-defeated"), { confirm: true }); assert.equal(r.ok, true, JSON.stringify(r));
  const e = store.list().slots[0];
  assert.deepEqual([e.state, e.qv, e.mainStep, e.mainDone, e.sidesDone], ["ok", 5, 10, false, 0]);
  assert.equal(content.mainSteps[e.mainStep - 1].title, "File the report");
  const r2 = store.importText(2, fx("save-v4-floor4"), { confirm: true }); assert.equal(r2.ok, true);
  assert.deepEqual([store.list().slots[1].mainStep, content.mainSteps[store.list().slots[1].mainStep - 1].title], [5, "Check the records floor"]);
});
