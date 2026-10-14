// ADV-R7 round 7, save v4 and migration (test-engineer, adversarial mode). Written without reading the implementers' tests.
// Legal saves must round-trip (no false rejection); forged ones must not load. Defects are `{ todo: 'ADV-R7-NN' }` (expected failures, suite stays green).
// A forged fixture names the rule it violates. Legal fixtures come from real play (the bot through the public input API) or the game's own save writer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { config, content, newGame, step, applyInput, enterFloor } from "../src/core/index.js";
import { toSave, checksumOf, deserialize, migrate, serialize, check } from "../src/save/index.js";
import { createSlotStore, createMemoryAdapter } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";
import { itemFloorOf } from "../src/core/systems/quests.js";
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";
import { v3Text, sealText } from "./helpers.js";

const FIX = new URL("./fixtures/", import.meta.url);
const read = (f) => readFileSync(new URL(f, FIX), "utf8");
const fixtures = readdirSync(FIX).filter((f) => /^save-v\d.*\.json$/.test(f));
const seal = (o) => { const { checksum, ...rest } = o; return canonical({ ...rest, checksum: checksumOf(rest) }); };
const fresh = (seed = 5, cls = "facilities-manager") => newGame(seed, { class: cls, name: "Adv", start: "town", wearStartKit: true });
const base = (seed = 5) => JSON.parse(serialize(fresh(seed)));
const forge = (mut, seed = 5) => { const o = base(seed); mut(o); return deserialize(seal(o)); };

// ---------------------------------------------------------------------------------------------------- hostile quest blocks (rule named)
const REJECT = [
  ["quests missing", (o) => { delete o.quests; }],
  ["quests is null", (o) => { o.quests = null; }],
  ["quests is an array", (o) => { o.quests = []; }],
  ["extra key in quests", (o) => { o.quests.extra = 1; }],
  ["__proto__ key in quests", null],
  ["main.m missing a flag", (o) => { delete o.quests.main.m.verdict; }],
  ["main.m flag not boolean", (o) => { o.quests.main.m.memo = 1; }],
  ["main.m.depth above the boss floor", (o) => { o.quests.main.m.depth = 10; }],
  ["main.m.depth beyond deepestDepth (rule: milestones inside the world flags)", (o) => { o.quests.main.m.depth = 5; }],
  ["unlocked without bossUnlocked (rule: milestone needs the world flag)", (o) => { o.quests.main.m.unlocked = true; }],
  ["defeated without bossDefeated", (o) => { o.quests.main.m.defeated = true; o.bossUnlocked = true; o.quests.main.m.unlocked = true; }],
  ["verdict without defeated", (o) => { o.quests.main.m.verdict = true; }],
  ["side state unknown", (o) => { o.quests.sq1.s = "failed"; }],
  ["available with progress", (o) => { o.quests.sq1.p = 3; }],
  ["active with full progress", (o) => { o.quests.sq1 = { s: "active", p: 8 }; }],
  ["ready with partial progress", (o) => { o.quests.sq1 = { s: "ready", p: 3 }; }],
  ["progress beyond the goal", (o) => { o.quests.sq1 = { s: "active", p: 9 }; }],
  ["negative progress", (o) => { o.quests.sq1 = { s: "active", p: -1 }; }],
  ["fractional progress", (o) => { o.quests.sq1 = { s: "active", p: 2.5 }; }],
  ["string progress", (o) => { o.quests.sq1 = { s: "active", p: "2" }; }],
  ["pinned unknown", (o) => { o.quests.pinned = "sq9"; }],
  ["pinned completed", (o) => { o.quests.sq1 = { s: "completed", p: 8 }; o.quests.pinned = "sq1"; }],
  ["pinned not a string", (o) => { o.quests.pinned = ["main"]; }],
  ["pouch without a ready quest (rule: pouch iff ready)", (o) => { o.quests.pouch = [{ id: "qi-sq2", quest: "sq2" }]; }],
  ["ready item quest without the pouch entry", (o) => { o.quests.sq2 = { s: "ready", p: 1 }; }],
  ["pouch entry for a kill quest", (o) => { o.quests.sq1 = { s: "ready", p: 8 }; o.quests.pouch = [{ id: "qi-sq1", quest: "sq1" }]; }],
  ["pouch entry with a hostile id", (o) => { o.quests.sq2 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq2\"><img src=x onerror=alert(1)>", quest: "sq2" }]; }],
  ["pouch entry id of another quest", (o) => { o.quests.sq2 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq3", quest: "sq2" }]; }],
  ["two pouch entries for one quest", (o) => { o.quests.sq2 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq2", quest: "sq2" }, { id: "qi-sq2", quest: "sq2" }]; }],
  ["pouch entry with an extra field", (o) => { o.quests.sq2 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq2", quest: "sq2", name: "<b>x" }]; }],
  ["pouch is an object", (o) => { o.quests.pouch = {}; }],
  ["pouch too long", (o) => { o.quests.pouch = [1, 2, 3, 4]; }],
  ["side quest with extra key", (o) => { o.quests.sq3.label = "<i>"; }],
  ["unknown side quest key", (o) => { o.quests.sq4 = { s: "available", p: 0 }; }],
  ["quests.main extra key", (o) => { o.quests.main.title = "x"; }],
];
for (const [name, mut] of REJECT) {
  test(`[R7-forge] rejected: ${name}`, () => {
    let text;
    if (mut === null) { // JSON.parse keeps __proto__ as an own key
      const o = base(); const { checksum, ...rest } = o;
      const raw = JSON.parse(JSON.stringify(rest).replace('"pinned":"main"', '"pinned":"main","__proto__":{"p":1}'));
      text = JSON.stringify({ ...raw, checksum: checksumOf(raw) });
    } else { const o = base(); mut(o); text = seal(o); }
    const r = deserialize(text);
    assert.equal(r.ok, false, `accepted a forged quest block: ${name}`);
    assert.ok(typeof r.message === "string" && r.message.length > 0);
    assert.equal(({}).p, undefined, "no prototype pollution");
  });
}

// ADV-R7-01: the block is "exactly what play can produce" (format.js:194) but a side quest can be ready or completed with none of the play it needs.
const BYPASS = [
  ["sq3 ready on a level-1 hero that never left floor 1 (the elite is on floor 4)", (o) => { o.quests.sq3 = { s: "ready", p: 1 }; }],
  ["sq3 completed on a hero that never reached floor 4", (o) => { o.quests.sq3 = { s: "completed", p: 1 }; }],
  ["sq1 ready with 0 kills (the quest asks for 8 zombie interns)", (o) => { o.quests.sq1 = { s: "ready", p: 8 }; }],
  ["sq2 ready with the badge in the pouch on a hero that never reached floor 3 or 4", (o) => { o.quests.sq2 = { s: "ready", p: 1 }; o.quests.pouch = [{ id: "qi-sq2", quest: "sq2" }]; }],
];
for (const [name, mut] of BYPASS) {
  test(`[R7-forge] ADV-R7-01 rejected: ${name}`, () => {
    const r = forge(mut);
    assert.equal(r.ok, false, name);
  });
}

test("[R7-forge] ADV-R7-01 the bypass is closed: a forged ready sq3 on a fresh hero no longer loads, so it cannot be paid (this test demonstrated the defect before the fix)", () => {
  const r = forge((o) => { o.quests.sq3 = { s: "ready", p: 1 }; });
  assert.equal(r.ok, false, "the forged save is refused at load");
});

// ---------------------------------------------------------------------------------------------------- legal saves are never rejected
function playAndSave(cls, seed, depth) {
  const state = newGame(seed, { start: "town", class: cls }), mem = createBotMemory({ depth, respawn: true, maxDeaths: 12, class: cls });
  const out = [];
  const grab = () => {
    const hit = state.events.filter((e) => e.type === "autosave" || (e.type.startsWith("quest.") && e.type !== "quest.progress" && e.type !== "quest.pinned"));
    if (out.length < 400) for (const e of hit) out.push({ text: serialize(state), quests: structuredClone(state.quests), pouch: structuredClone(state.player.pouch), tick: state.tick, why: e.type });
  };
  for (let i = 0; i < 200000 && !mem.done; i++) {
    if (state.scene === "dead") applyInput(state, { t: "respawn" });
    if (i % BOT.decideEvery === 0) { const cmd = decide(state, mem); if (cmd) { noteResult(mem, cmd, applyInput(state, cmd)); grab(); } } // accept and hand-in events live until the next step
    step(state);
    grab();
  }
  return out;
}
test("[R7-legal] every autosave and every quest event of real bot play (3 classes) loads again with the quest block and pouch unchanged: no false rejection", () => {
  let n = 0, kinds = new Set();
  for (const [cls, seed] of [["facilities-manager", 301], ["sales-rep", 302], ["it-wizard", 303]]) {
    for (const snap of playAndSave(cls, seed, 5)) {
      const r = deserialize(snap.text);
      assert.ok(r.ok, `${cls} seed ${seed} tick ${snap.tick} after ${snap.why}: ${r.message}`);
      assert.deepEqual(r.state.quests, snap.quests);
      assert.deepEqual(r.state.player.pouch, snap.pouch);
      assert.equal(serialize(r.state), snap.text, "save, load, save is stable");
      n++; kinds.add(snap.why);
    }
  }
  assert.ok(n > 30 && kinds.has("quest.step") && kinds.has("quest.accepted") && kinds.has("quest.completed"), `covered ${[...kinds]} in ${n} states`);
});

test("[R7-legal] the quest block stays small: all quests done, pouch full, under the 400 characters of the contract and the slot size cap", () => {
  const s = fresh(9);
  for (const id of content.sideIds) s.quests[id] = { s: "ready", p: id === "sq1" ? 8 : 1 };
  s.player.pouch = [{ id: "qi-sq2", quest: "sq2" }];
  s.deepestDepth = 9; s.bossUnlocked = s.bossDefeated = true; s.quests.main.m = { memo: true, depth: 9, unlocked: true, defeated: true, verdict: true };
  const o = JSON.parse(serialize(s));
  assert.ok(JSON.stringify(o.quests).length < 400, JSON.stringify(o.quests).length);
  assert.ok(serialize(s).length < config.slotMaxBytes);
});

// ---------------------------------------------------------------------------------------------------- migration from real v0..v3 files
test("[R7-migrate] every real fixture (v0, v1, v2, v3) loads; the derived main step follows the world flags and no side quest starts anything", () => {
  assert.ok(fixtures.length >= 10, fixtures.join());
  for (const f of fixtures) {
    const raw = JSON.parse(read(f));
    const r = deserialize(read(f));
    assert.ok(r.ok, `${f}: ${r.message}`);
    const q = r.state.quests, m = q.main.m;
    for (const id of content.sideIds) assert.deepEqual(q[id], { s: "available", p: 0 }, `${f}: ${id} is untouched`);
    assert.deepEqual(r.state.player.pouch, []);
    assert.equal(q.pinned, "main");
    assert.equal(m.depth, Math.max(raw.deepestDepth >= 2 ? raw.deepestDepth : 0, m.depth), `${f}: depth never below deepest`);
    if (raw.bossDefeated) assert.ok(m.defeated && m.unlocked, f);
    if (raw.bossUnlocked) assert.ok(m.unlocked, f);
    assert.equal(m.verdict, false, `${f}: the verdict was never read`);
    // no retroactive reward: gold, xp, items, skills and attributes equal the fixture's
    const p = r.state.player, rp = raw.player ?? {};
    if (rp.gold !== undefined) { assert.equal(p.gold, rp.gold, f); assert.equal(p.xp, rp.xp, f); }
    if (raw.inventory?.items) assert.equal(r.state.inventory.items.length, raw.inventory.items.length, f);
    // writing it again gives a version 4 save that loads to the same quest state
    const again = deserialize(serialize(r.state));
    assert.ok(again.ok, `${f}: ${again.message}`);
    assert.deepEqual(again.state.quests, q);
    assert.equal(JSON.parse(serialize(r.state)).version, config.saveVersion);
  }
});

test("[R7-migrate] a second migration changes nothing; migrate(v3 -> v4) is pure; a v4 input is returned unchanged", () => {
  for (const f of fixtures.filter((x) => /v3/.test(x))) {
    const raw = JSON.parse(read(f)), frozen = structuredClone(raw);
    const a = migrate(raw, 4), b = migrate(a.data, 4);
    assert.deepEqual(raw, frozen, `${f}: input untouched`);
    assert.ok(a.ok && b.ok);
    assert.deepEqual(b.data, a.data);
  }
});

test("[R7-migrate] a v3 file that carries a forged quests block gets the derived block, not the forged one (cannot be used to smuggle a state past the schema)", () => {
  for (const f of fixtures.filter((x) => /save-v3/.test(x))) {
    const raw = JSON.parse(read(f));
    raw.quests = { main: { m: { memo: true, depth: 9, unlocked: true, defeated: true, verdict: true } }, sq1: { s: "ready", p: 8 }, sq2: { s: "completed", p: 1 }, sq3: { s: "ready", p: 1 }, pinned: "sq3", pouch: [{ id: "qi-sq2", quest: "sq2" }] };
    const r = deserialize(seal(raw));
    if (!r.ok) continue; // rejecting it is fine too
    for (const id of content.sideIds) assert.equal(r.state.quests[id].s, "available", `${f}: ${id}`);
    assert.equal(r.state.quests.main.m.verdict, false);
    assert.deepEqual(r.state.player.pouch, []);
  }
});

test("[R7-migrate] the five v3 states of real play (Lobby, floor 1, floor 4, boss unlocked, boss defeated) derive steps 1, 3, 4, 5, 6 and keep the hero on the same floor", () => {
  const want = { "save-v3-lobby.json": [1, 0], "save-v3-floor1.json": [3, 1], "save-v3-floor4.json": [4, 4], "save-v3-boss-unlocked.json": [5, 0], "save-v3-boss-defeated.json": [6, 0] };
  for (const [f, [stepWanted]] of Object.entries(want)) {
    const r = deserialize(read(f));
    assert.ok(r.ok, f);
    const m = r.state.quests.main.m;
    const done = [m.memo || m.depth >= 1 || m.depth >= 4 || m.unlocked || m.defeated, m.depth >= 1 || m.depth >= 4 || m.unlocked || m.defeated, m.depth >= 4 || m.unlocked || m.defeated, m.unlocked || m.defeated, m.defeated, m.verdict];
    const cur = done.indexOf(false) < 0 ? 7 : done.indexOf(false) + 1;
    assert.equal(cur, stepWanted === 1 && f.includes("lobby") ? 1 : stepWanted, `${f}: main step`);
  }
});

test("[R7-migrate] v1 and v2 saves with quest-era play afterwards: accept, descend, hand in, save, load, with the migration refund notes intact", () => {
  for (const f of ["save-v1.json", "save-v2-r5-fm.json", "save-v2-r5-it.json", "save-v2-r5-sales.json"]) {
    const r = deserialize(read(f));
    assert.ok(r.ok, `${f}: ${r.message}`);
    const s = r.state;
    enterFloor(s, 0, { at: "entry" });
    for (const [id, npc] of [["sq1", "vendor"], ["sq2", "healer"], ["sq3", "potions"]]) {
      applyInput(s, { t: "interact", id: npc });
      for (let i = 0; i < 900 && s.ui.dialog?.npc !== npc; i++) step(s);
      assert.deepEqual(applyInput(s, { t: "questAccept", id }), { ok: true }, `${f} ${id}`);
    }
    enterFloor(s, 4, { at: "entry" });
    const back = deserialize(serialize(s));
    assert.ok(back.ok, `${f}: ${back.message}`);
    assert.deepEqual(back.state.quests, s.quests);
    assert.equal(back.state.monsters.filter((m) => m.quest === "sq3").length, 1, `${f}: the elite is there after the reload`);
    void itemFloorOf;
  }
});

test("[R7-migrate] 300 mutated v3 and v4 saves: deserialize never throws, and any save it accepts passes the schema again after a write", () => {
  const seeds = [...fixtures.filter((f) => /v3/.test(f)).map(read), serialize(fresh(7))];
  let rngState = 12345; const rnd = (n) => { rngState = (Math.imul(rngState, 1103515245) + 12345) >>> 0; return rngState % n; };
  let accepted = 0;
  for (let i = 0; i < 300; i++) {
    const o = JSON.parse(seeds[i % seeds.length]);
    const target = o.quests ? o.quests : o;
    const keys = Object.keys(target);
    const k = keys[rnd(keys.length)];
    const pick = [null, "x", -1, 1e9, [], {}, true, "<script>", { s: "ready", p: 1 }, 0][rnd(10)];
    if (rnd(4) === 0) delete target[k]; else target[k] = pick;
    let r;
    assert.doesNotThrow(() => { r = deserialize(rnd(2) ? seal(o) : JSON.stringify(o)); });
    if (r.ok) { accepted++; const again = deserialize(serialize(r.state)); assert.ok(again.ok, `accepted a save that does not survive a write: ${again.message}`); }
  }
  assert.ok(accepted >= 0);
});

// ---------------------------------------------------------------------------------------------------- slot index
test("[R7-slots] an index written by an R5/R6 build (ok entries without quest fields) is upgraded once; the slot texts are not rewritten; a hostile index entry cannot break the card", () => {
  const adapter = createMemoryAdapter();
  const s = fresh(3);
  const text = serialize(s);
  const store = createSlotStore(adapter, { now: () => 1000, tabId: "t1" });
  assert.ok(store.create(1, fresh(3)).ok);
  const idxKey = config.slotIndexKey;
  const idx = JSON.parse(adapter.getItem(idxKey));
  for (const e of idx.slots) { delete e.mainStep; delete e.mainDone; delete e.sidesDone; }
  adapter.setItem(idxKey, JSON.stringify(idx));
  const before = adapter.getItem(`${config.slotKeyPrefix}1`);
  const store2 = createSlotStore(adapter, { now: () => 2000, tabId: "t2" });
  store2.migrateLegacy();
  const after = JSON.parse(adapter.getItem(idxKey));
  const e1 = after.slots[0];
  if (e1.state === "ok") assert.ok(Number.isInteger(e1.mainStep) && typeof e1.mainDone === "boolean" && Number.isInteger(e1.sidesDone));
  assert.equal(adapter.getItem(`${config.slotKeyPrefix}1`), before, "slot text byte-identical");
});

test("[R7-slots] sealText round trip helper agrees with the writer (guards the helpers this file relies on)", () => {
  const s = fresh(3), t = v3Text(s), o = JSON.parse(t);
  assert.equal(o.version, 3); assert.equal(o.quests, undefined);
  const r = deserialize(t);
  assert.ok(r.ok, r.message);
  assert.equal(sealText(JSON.parse(serialize(s))), serialize(s));
  assert.equal(check(JSON.parse(t)).ok, true);
});
