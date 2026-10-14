// The quest block of the current save (R7-0.3, ADR-0006 amendment "R7 quests", AC-R-251-1, AC-R-253-2; version 5 since R7-4: sq4, sq5, the pin on the active main quest): schema, round trip, hostile values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, config, content } from "../src/core/index.js";
import { setQuestStep } from "../src/core/cheats.js";
import { serialize, deserialize, toSave, schemaProblem, checksumOf, SAVE_KEYS, check } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";
import { sealText } from "./helpers.js";

const hero = (cls = "facilities-manager", seed = 5) => newGame(seed, { class: cls, name: "Quest Tester", start: "town" });
const parsed = (state) => JSON.parse(serialize(state));
const load = (save) => deserialize(sealText(save));
const SIDES = content.sideIds;
/** Put the main quest at the global step g (1..10) through the cheat of its own quest. */
const at = (s, g) => { const st = content.mainSteps[g - 1]; return setQuestStep(s, st.arcId, st.arcStep); };

test("config.saveVersion is 5 and SAVE_KEYS lists the quest block", () => {
  assert.equal(config.saveVersion, 5);
  assert.ok(SAVE_KEYS.includes("quests"));
  const j = parsed(hero());
  assert.equal(j.version, 5);
  assert.deepEqual(Object.keys(j.quests).sort(), ["main", "pinned", "pouch", "sq1", "sq2", "sq3", "sq4", "sq5"]);
  assert.deepEqual(j.quests.main.m, { memo: false, depth: 0, unlocked: false, defeated: false, verdict: false });
  assert.deepEqual(j.quests.pouch, []); assert.equal(j.quests.pinned, "main");
});

test("AC-R-251-1 round trip: step, side states, pinned quest and pouch come back identical, and a second save is the same text", () => {
  const s = hero();
  assert.equal(at(s, 5).ok, true);
  assert.equal(setQuestStep(s, "sq1", 1).ok, true); s.quests.sq1.p = 3;
  assert.equal(setQuestStep(s, "sq4", 2).ok, true); assert.equal(setQuestStep(s, "sq5", 1).ok, true); s.quests.sq5.p = 2;
  assert.equal(setQuestStep(s, "sq2", 2).ok, true);
  s.quests.pinned = "sq2";
  assert.equal(s.player.pouch.length, 2, "the badge and the ledger");
  const text = serialize(s), r = deserialize(text);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.state.quests, s.quests); assert.deepEqual(r.state.player.pouch, s.player.pouch);
  assert.equal(serialize(r.state), text);
  assert.equal(r.state.events.length, 0, "loading emits no quest cue");
});

test("the quest block is small: under 400 characters in the worst legal case", () => {
  const s = hero(); at(s, 10); for (const id of SIDES) setQuestStep(s, id, 2);
  const len = canonical(toSave(s).quests).length;
  assert.ok(len < 400, `${len} characters`);
});

test("a character saved on a floor resumes with its quest block set (the block is loaded before the resume entry)", () => {
  const s = newGame(9, { class: "sales-rep", name: "Floor Hero", start: "town" });
  setQuestStep(s, "sq3", 1); at(s, 3);
  s.scene = "floor"; // a save taken on floor 1 resumes there
  const j = parsed(s); j.resume.depth = 1;
  const r = load(j);
  assert.equal(r.ok, true, r.message);
  assert.equal(r.state.depth, 1);
  assert.equal(r.state.quests.sq3.s, "active"); assert.equal(r.state.quests.main.m.depth, 1);
  assert.equal(r.state.events.length, 0);
});

test("every legal combination of side states and main steps saves and loads (legal saves are never refused)", () => {
  const states = [0, 1, 2, 3];
  let n = 0;
  for (const a of states) for (const b of states) for (const c of states) for (const ms of [1, 3, 5, 9, 10]) {
    const s = hero(["facilities-manager", "sales-rep", "it-wizard"][(a + b + c + ms) % 3], 20 + n);
    assert.equal(at(s, ms).ok, true);
    for (const [id, st] of [["sq1", a], ["sq2", b], ["sq3", c], ["sq4", n % 4], ["sq5", (n >> 2) % 4]]) {
      const r = setQuestStep(s, id, st); // 3 = completed goes through the hand-in path (R7-0.2)
      assert.equal(r.ok, true, `${id} ${st}: ${r.error}`);
    }
    n++;
    const p = schemaProblem(toSave(s));
    assert.equal(p, null, `${[a, b, c, ms]}: ${p}`);
    const r = deserialize(serialize(s)); assert.equal(r.ok, true, r.message);
  }
});

test("the pouch invariant: an item quest is ready if and only if its badge is in the pouch", () => {
  const ok = parsed((() => { const s = hero(); setQuestStep(s, "sq2", 2); return s; })());
  assert.equal(schemaProblem(ok), null);
  assert.deepEqual(ok.quests.pouch, [{ id: "qi-sq2", quest: "sq2" }]);
  const missing = structuredClone(ok); missing.quests.pouch = [];
  assert.equal(load(missing).ok, false, "ready without the badge");
  const extra = parsed(hero()); extra.quests.pouch = [{ id: "qi-sq2", quest: "sq2" }];
  assert.equal(load(extra).ok, false, "badge while the quest is available");
  const twice = structuredClone(ok); twice.quests.pouch.push({ id: "qi-sq2", quest: "sq2" });
  assert.equal(load(twice).ok, false, "two badges");
  for (const quest of ["sq1", "sq3", "sq5"]) { const w = structuredClone(ok); w.quests[quest] = { s: "ready", p: quest === "sq1" ? 8 : quest === "sq5" ? 6 : 1 }; w.stats.kills = 99; w.deepestDepth = 6; w.quests.pouch.push({ id: `qi-${quest}`, quest }); assert.equal(load(w).ok, false, `${quest} has no item`); }
  const wrongId = structuredClone(ok); wrongId.quests.pouch[0].id = "qi-sq3"; assert.equal(load(wrongId).ok, false);
  const gone = structuredClone(ok); gone.quests.sq2 = { s: "completed", p: 1 }; assert.equal(load(gone).ok, false, "completed but the badge is still held");
});

test("schema rules, one by one: every forged quest block is refused as schema", () => {
  const base = () => { const s = hero(); at(s, 5); return parsed(s); };
  const bossy = () => { const s = hero(); at(s, 10); return parsed(s); };
  const cases = {
    "extra top-level quest key": (q) => { q.extra = 1; },
    "missing pinned": (q) => { delete q.pinned; },
    "missing sq3": (q) => { delete q.sq3; },
    "extra side quest": (q) => { q.sq6 = { s: "available", p: 0 }; },
    "missing sq4": (q) => { delete q.sq4; },
    "missing sq5": (q) => { delete q.sq5; },
    "a stored main2": (q) => { q.main2 = { m: q.main.m }; },
    "main without m": (q) => { q.main = {}; },
    "m with an extra key": (q) => { q.main.m.step = 3; },
    "m missing a key": (q) => { delete q.main.m.verdict; },
    "memo not boolean": (q) => { q.main.m.memo = 1; },
    "depth fractional": (q) => { q.main.m.depth = 1.5; },
    "depth negative": (q) => { q.main.m.depth = -1; },
    "depth above the boss floor": (q) => { q.main.m.depth = config.bossDepth + 1; },
    "depth above deepestDepth": (q, d) => { q.main.m.depth = d.deepestDepth + 1; },
    "unlocked without the world flag": (q) => { q.main.m.unlocked = true; },
    "defeated without the world flag": (q) => { q.main.m.defeated = true; },
    "verdict without defeated": (q) => { q.main.m.verdict = true; },
    "unknown side state": (q) => { q.sq1.s = "failed"; },
    "side with an extra key": (q) => { q.sq1.x = 1; },
    "available with progress": (q) => { q.sq1.p = 1; },
    "active at the goal": (q) => { q.sq1 = { s: "active", p: 8 }; },
    "active above the goal": (q) => { q.sq1 = { s: "active", p: 99 }; },
    "negative progress": (q) => { q.sq1 = { s: "active", p: -1 }; },
    "fractional progress": (q) => { q.sq1 = { s: "active", p: 0.5 }; },
    "string progress": (q) => { q.sq1 = { s: "active", p: "3" }; },
    "ready below the goal": (q) => { q.sq1 = { s: "ready", p: 7 }; },
    "completed below the goal": (q) => { q.sq3 = { s: "completed", p: 0 }; },
    "kill goal on an elite quest": (q) => { q.sq3 = { s: "active", p: 5 }; },
    "pinned unknown": (q) => { q.pinned = "sq9"; },
    "pinned inherited name": (q) => { q.pinned = "constructor"; },
    "pinned completed quest": (q) => { q.sq1 = { s: "completed", p: 8 }; q.pinned = "sq1"; },
    "pinned not a string": (q) => { q.pinned = ["main"]; },
    "pinned a locked main quest": (q) => { q.pinned = "main3"; },
    "pinned a completed main quest": (q) => { q.pinned = "main"; },
    "pinned the old alias while the first quest is done": (q) => { q.pinned = "main"; },
    "sq4 ready with deepestDepth 1": (q, d) => { d.deepestDepth = 1; q.main.m.depth = 1; q.sq4 = { s: "ready", p: 1 }; q.pouch = [{ id: "qi-sq4", quest: "sq4" }]; q.pinned = "main"; },
    "sq4 ready without the ledger": (q, d) => { d.deepestDepth = 6; q.sq4 = { s: "ready", p: 1 }; },
    "sq5 completed with no kills": (q, d) => { d.deepestDepth = 6; d.stats.kills = 0; q.sq5 = { s: "completed", p: 6 }; },
    "sq5 completed below the kill floors": (q, d) => { d.deepestDepth = 4; d.stats.kills = 50; q.sq5 = { s: "completed", p: 6 }; },
    "sq5 active at 7 of 6": (q) => { q.sq5 = { s: "active", p: 7 }; },
    "pouch entry of a quest that is not ready": (q) => { q.pouch = [{ id: "qi-sq4", quest: "sq4" }]; },
    "pouch not an array": (q) => { q.pouch = {}; },
    "pouch too long": (q) => { q.pouch = [1, 2, 3, 4]; },
    "pouch entry with an extra key": (q) => { q.sq2 = { s: "ready", p: 1 }; q.pouch = [{ id: "qi-sq2", quest: "sq2", x: 1 }]; },
    "pouch id with markup": (q) => { q.sq2 = { s: "ready", p: 1 }; q.pouch = [{ id: "<img onerror=x>", quest: "sq2" }]; },
    "pouch quest not a side": (q) => { q.pouch = [{ id: "qi-main", quest: "main" }]; },
    "pouch item as a string": (q) => { q.pouch = ["qi-sq2"]; },
    "quests is null": (_q, _d, j) => { j.quests = null; },
    "quests is an array": (_q, _d, j) => { j.quests = []; },
  };
  for (const [what, mutate] of Object.entries(cases)) {
    const j = base();
    mutate(j.quests, j, j);
    const text = sealText(j);
    const r = deserialize(text);
    assert.equal(r.ok, false, `${what} was accepted`);
    assert.equal(r.reason, "schema", what);
  }
  // legal neighbours of the cases above stay legal (a rule that is too tight would refuse real play)
  const legal = bossy(); assert.equal(deserialize(sealText(legal)).ok, true);
  const v = structuredClone(legal); v.quests.main.m.verdict = true; assert.equal(deserialize(sealText(v)).ok, true, "verdict after the boss");
});

test("forged states cannot get in through the world flags either: no defeated boss, no verdict, step 6 only with the flags", () => {
  const j = parsed(hero()); j.quests.main.m.defeated = true; j.quests.main.m.unlocked = true; j.quests.main.m.depth = 0;
  assert.equal(load(j).ok, false);
  j.bossDefeated = true; j.bossUnlocked = true; j.deepestDepth = config.bossDepth; j.quests.pinned = "main3";
  assert.equal(load(j).ok, true, "with the world flags it is legal");
});

test("20 mutated copies of a real save never throw and never load as a different quest state without passing the schema", () => {
  const s = hero(); at(s, 9); setQuestStep(s, "sq2", 2); setQuestStep(s, "sq1", 1); setQuestStep(s, "sq4", 2);
  const base = parsed(s);
  const bad = [undefined, null, "x", -1, 1e9, {}, [], true, "__proto__"];
  for (let i = 0; i < 20; i++) {
    const j = structuredClone(base), q = j.quests;
    const keys = ["main", "sq1", "sq2", "sq3", "sq4", "sq5", "pinned", "pouch"], k = keys[i % keys.length], v = bad[i % bad.length];
    if (i % 2) { if (q[k] && typeof q[k] === "object" && !Array.isArray(q[k])) q[k][Object.keys(q[k])[0] ?? "s"] = v; else q[k] = v; } else q[k] = v;
    let r; assert.doesNotThrow(() => { r = deserialize(JSON.stringify({ ...j, checksum: checksumOf(j) })); });
    if (r.ok) assert.equal(schemaProblem(r.save), null);
  }
  for (const text of ['{"quests":', JSON.stringify({ ...base, quests: undefined }), JSON.stringify({ ...base, checksum: "0" })]) assert.doesNotThrow(() => deserialize(text));
});

test("a version above 5 reports newer; a version 5 save passes check() without a note", () => {
  const j = parsed(hero());
  assert.equal(deserialize(sealText({ ...j, version: 6 })).reason, "newer");
  const c = check(j); assert.equal(c.ok, true); assert.deepEqual(c.notes, []);
});

test("AC-R-253-2 quest state is per character: a new game starts at step 1 with every side quest available", () => {
  const a = hero(); at(a, 9); setQuestStep(a, "sq1", 1);
  const b = hero("it-wizard", 11);
  assert.deepEqual(b.quests, hero().quests);
  assert.notDeepEqual(a.quests, b.quests);
  assert.deepEqual(deserialize(serialize(b)).state.quests, b.quests);
});

test("a long game plays on after loading: quest state survives a save and keeps counting (replay of ticks after load)", () => {
  const s = hero(); setQuestStep(s, "sq1", 1);
  const r = deserialize(serialize(s)); for (let i = 0; i < 30; i++) step(r.state, []);
  assert.equal(r.state.quests.sq1.s, "active");
});
