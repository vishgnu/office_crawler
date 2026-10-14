// Adversarial tests for rounds 4/5 (save slots, migration, import). Written without reading the implementer's tests.
// Tests that demonstrate a real defect carry { todo: 'ADV-R5-NN' } (node:test reports them but the suite stays green);
// every todo maps to a finding in docs/reviews/R5-adversarial.md. When the defect is fixed the todo test starts passing:
// remove the todo flag then.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSlotStore, createSession, createMemoryAdapter, serialize, deserialize, check, checksumOf, toSave } from "../src/save/index.js";
import { newGame } from "../src/core/state.js";
import { config } from "../src/core/config.js";
import { canonical } from "../src/core/hash.js";
import { skills, skillTrees } from "../src/core/content/skills.js";

const V1 = readFileSync(new URL("./fixtures/save-v1.json", import.meta.url), "utf8");
const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
const mkState = (cls = "sales-rep", name = "Bob", seed = 5) => newGame(seed, { class: cls, name, start: "town", wearStartKit: true });
const reseal = (s) => canonical({ ...s, checksum: checksumOf(s) });
const clock = () => { let t = 1_000_000; return () => (t += 1000); };
function rig({ tabId = "A", adapter = createMemoryAdapter(), now = clock() } = {}) {
  const store = createSlotStore(adapter, { now, tabId });
  return { adapter, store, session: createSession(store, { seedSource: () => 7 }), now };
}
const states = (store) => store.list().slots.map((e) => e.state).join(",");
const snapshotKeys = (ad) => Object.fromEntries(ad.keys().sort().map((k) => [k, ad.getItem(k)]));

// ---- findings (todo) -------------------------------------------------------------------------------------------------------

test("ADV-R5-01a index key missing while slot texts exist: boot must not hide the slots", { todo: "ADV-R5-01" }, () => {
  const { adapter, session } = rig();
  session.createCharacter({ slot: 2, class: "sales-rep", name: "Two" });
  session.createCharacter({ slot: 4, class: "it-wizard", name: "Four" });
  adapter.removeItem(config.slotIndexKey); // lost index (failed index write under quota, partial site-data clearing, restore from backup)
  const fresh = createSlotStore(adapter, { now: clock(), tabId: "B" });
  fresh.migrateLegacy(); // main.js runs this before anything reads the index
  assert.equal(states(fresh), "empty,ok,empty,ok,empty");
});

test("ADV-R5-01b index lost + legacy backup still present: migration must not overwrite an existing slot 1", { todo: "ADV-R5-01" }, () => {
  const { adapter, store, session } = rig({ adapter: createMemoryAdapter({ [config.saveKey]: V1 }) });
  store.migrateLegacy();
  session.loadSlot({ slot: 1 });
  const g = store.load(1).state;
  g.player.gold = 123456;
  assert.ok(store.write(1, g).ok);
  adapter.removeItem(config.slotIndexKey);
  const again = createSlotStore(adapter, { now: clock(), tabId: "A" });
  again.migrateLegacy();
  assert.equal(again.load(1).state.player.gold, 123456, "the legacy backup replaced the played character");
});

test("ADV-R5-02 a tab that died without pagehide must not lock every other tab out for ever", { todo: "ADV-R5-02" }, () => {
  const ad = createMemoryAdapter();
  let t = 1_000_000;
  const a = rig({ tabId: "A", adapter: ad, now: () => t });
  assert.ok(a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" }).ok);
  // tab A is killed (crash, mobile tab discard): no pagehide, no clearActive. A day later a new tab B opens.
  t += 24 * 3600 * 1000;
  const b = rig({ tabId: "B", adapter: ad, now: () => t });
  assert.equal(b.session.continue().ok, true, `Continue refused: ${JSON.stringify(b.session.continue())}`);
});

test("ADV-R5-03 restorePrev must not overwrite a slot written by a newer build", { todo: "ADV-R5-03" }, () => {
  const { adapter, store, session } = rig({ tabId: null });
  session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  session.deleteSlot({ slot: 1, confirm: true }); // .prev now holds One
  const newer = JSON.stringify({ format: "office-crawler-save", version: config.saveVersion + 1, payload: "from the future" });
  adapter.setItem("office-crawler.slot.1", newer);
  adapter.removeItem(config.slotIndexKey); // index is rebuilt: slot 1 is `newer`
  const s = createSlotStore(adapter, { now: clock() });
  assert.equal(s.list().slots[0].state, "newer");
  s.restorePrev(1);
  assert.equal(adapter.getItem("office-crawler.slot.1"), newer, "a newer-build save was overwritten by the undo copy");
});

test("ADV-R5-04a schema: a level 1 character with every skill at max level is not a valid save", { todo: "ADV-R5-04" }, () => {
  const s = toSave(mkState("sales-rep"));
  for (const id of Object.keys(skillTrees["sales-rep"].skills)) s.player.skills[id] = skills[id].maxLevel;
  assert.equal(deserialize(reseal(s)).ok, false);
});

test("ADV-R5-04b schema: skill bar entries of another class / a non-basic primary are not valid", { todo: "ADV-R5-04" }, () => {
  const s = toSave(mkState("sales-rep"));
  s.player.skillBar.hotkeys = ["pallet-slam", "server-overheat", null, null];
  assert.equal(deserialize(reseal(s)).ok, false, "hotkeys with skills of other classes accepted");
  const t = toSave(mkState("sales-rep"));
  t.player.skillBar.primary = "zap";
  assert.equal(deserialize(reseal(t)).ok, false, "primary slot with another class's basic attack accepted");
});

test("ADV-R5-04c schema: secondary must follow hotkeys[selected]", { todo: "ADV-R5-04" }, () => {
  const s = toSave(mkState("sales-rep"));
  s.player.skillBar.selected = 3; s.player.skillBar.secondary = "stapler-throw"; // hotkeys[3] is empty
  const r = deserialize(reseal(s));
  assert.ok(!r.ok || r.state.player.skillBar.secondary === null, `secondary ${r.ok ? r.state.player.skillBar.secondary : "-"} does not follow the selected empty hotkey`);
});

test("ADV-R5-05 a fresh character and the same character after save and load show the same xpNext", { todo: "ADV-R5-05" }, () => {
  for (const cls of CLASSES) {
    const fresh = mkState(cls);
    const loaded = deserialize(serialize(fresh)).state;
    assert.equal(fresh.player.xpNext, loaded.player.xpNext, `${cls}: ${fresh.player.xpNext} fresh vs ${loaded.player.xpNext} loaded`);
    assert.equal(fresh.player.xpNext, config.xpTable[1], "level 2 needs xpTable[1] xp");
  }
});

// ---- things that must hold (pass) --------------------------------------------------------------------------------------------

test("slots 0, 6, -1, 1.5, '2', NaN, null are all refused as bad-slot and nothing is written", () => {
  const { adapter, store, session } = rig();
  const before = snapshotKeys(adapter);
  for (const slot of [0, 6, -1, 1.5, "2", NaN, null, undefined, Infinity]) {
    assert.deepEqual(session.createCharacter({ slot, class: "sales-rep", name: "X" }), { ok: false, error: "bad-slot" }, String(slot));
    assert.equal(session.loadSlot({ slot }).error, "bad-slot");
    assert.equal(session.deleteSlot({ slot, confirm: true }).error, "bad-slot");
    assert.equal(session.renameSlot({ slot, name: "Y" }).error, "bad-slot");
    assert.equal(session.importSlot({ slot, text: "{}" }).error, "bad-slot");
    assert.equal(session.exportSlot({ slot }).error, "bad-slot");
  }
  assert.deepEqual(snapshotKeys(adapter), before);
});

test("hostile import matrix: no throw, no write, existing slots untouched", () => {
  const { adapter, store, session } = rig();
  session.createCharacter({ slot: 1, class: "sales-rep", name: "Keep" });
  const before = snapshotKeys(adapter);
  const good = serialize(mkState("it-wizard", "Good"));
  const j = JSON.parse(good);
  const evil = [
    "", " ", "null", "[]", "5", '"x"', "{}", "{", "\u0000", "[".repeat(100000), "{".repeat(50000), "[" + "1,".repeat(600000) + "1]", "x".repeat(config.saveMaxBytes + 1),
    JSON.stringify({ ...j, checksum: "0" }), JSON.stringify({ ...j, version: config.saveVersion + 1 }), JSON.stringify({ ...j, version: -1 }), JSON.stringify({ ...j, version: 1.5 }),
    JSON.stringify({ ...j, version: "2" }), JSON.stringify({ ...j, extra: 1 }), JSON.stringify({ ...j, class: "__proto__" }), JSON.stringify({ ...j, class: "constructor" }),
    good.slice(0, good.length - 1), good.replace('"name":"Good"', '"name":"<img src=x onerror=alert(1)>"'), good + good, `﻿${good}`.slice(1) + "x",
    '{"__proto__":{"polluted":true},"format":"office-crawler-save","version":2}', '{"constructor":{"prototype":{"polluted":true}}}',
  ];
  for (const text of evil) {
    for (const slot of [1, 2]) {
      let r;
      assert.doesNotThrow(() => { r = session.importSlot({ slot, text, confirm: true }); }, text.slice(0, 40));
      assert.equal(r.ok, false, `accepted: ${text.slice(0, 60)}`);
    }
  }
  assert.equal(({}).polluted, undefined);
  assert.deepEqual(snapshotKeys(adapter), before, "a failed import changed storage");
  // and the good file does import
  assert.equal(session.importSlot({ slot: 2, text: good }).ok, true);
  assert.equal(store.list().slots[1].name, "Good");
});

test("hostile import with a valid checksum but nonsense inventory/equipment is rejected, not loaded", () => {
  const base = toSave(mkState("sales-rep"));
  const variants = {
    "item w/h 0": (s) => { s.inventory.items.push({ id: "i999", name: "x", base: "bogus-base", kind: "gear", rarity: "normal", w: 0, h: 0, x: 0, y: 0 }); },
    "duplicate ids": (s) => { s.inventory.items.push({ ...s.equipment.weapon, x: 0, y: 0 }); },
    "item off grid": (s) => { s.inventory.items.push({ ...s.equipment.weapon, id: "i500", x: 99, y: 99 }); },
    "negative gold": (s) => { s.player.gold = -1; },
    "NaN-ish xp": (s) => { s.player.xp = 1.5; },
    "affix with unknown stat": (s) => { s.equipment.weapon.affixes = [{ stat: "constructor", value: 1 }]; },
    "huge affix list": (s) => { s.equipment.weapon.affixes = Array.from({ length: 50 }, () => ({ stat: "defense", value: 1 })); },
    "explored lies": (s) => { s.explored = { 1: { size: 10, runs: [1, 2, 3] } }; },
    "rng stream missing": (s) => { delete s.rng.loot; },
    "resume depth beyond boss": (s) => { s.resume.depth = config.bossDepth + 1; },
    "name with markup": (s) => { s.name = "<b>x</b>"; },
    "name too long": (s) => { s.name = "x".repeat(17); },
    "name untrimmed": (s) => { s.name = " pad "; },
  };
  for (const [what, fn] of Object.entries(variants)) {
    const s = structuredClone(base); fn(s);
    let r; assert.doesNotThrow(() => { r = deserialize(reseal(s)); }, what);
    assert.equal(r.ok, false, `${what}: accepted`);
  }
});

test("200 single-character mutations of a valid slot text never throw and never load as ok unless identical", () => {
  const text = serialize(mkState("facilities-manager", "Fuzz"));
  let seed = 99; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 200; i++) {
    const pos = Math.floor(rnd() * text.length), ch = "{}[]\",:0123456789abz \\\u0000"[Math.floor(rnd() * 25)];
    const m = text.slice(0, pos) + ch + text.slice(pos + 1);
    let r; assert.doesNotThrow(() => { r = deserialize(m); });
    if (m !== text && r.ok) assert.equal(serialize(r.state), serialize(deserialize(text).state), "a mutated text loaded as a different character");
  }
});

test("a corrupt slot becomes bad on load, its text is kept for export, the others are untouched (R-227)", () => {
  const { adapter, store, session } = rig();
  session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  session.createCharacter({ slot: 3, class: "it-wizard", name: "Three" });
  const one = adapter.getItem("office-crawler.slot.1"), three = adapter.getItem("office-crawler.slot.3");
  const broken = three.replace('"gold":', '"gold":9');
  adapter.setItem("office-crawler.slot.3", broken);
  const r = store.load(3);
  assert.equal(r.ok, false); assert.equal(r.error, "corrupt");
  assert.equal(states(store), "ok,empty,bad,empty,empty");
  assert.equal(store.exportText(3, "bad").text, broken);
  assert.equal(adapter.getItem("office-crawler.slot.1"), one);
  assert.equal(store.load(1).ok, true);
  // a bad slot can be replaced only with confirm, and the damaged text is then gone
  assert.equal(session.createCharacter({ slot: 3, class: "sales-rep", name: "New" }).error, "occupied");
  assert.equal(session.createCharacter({ slot: 3, class: "sales-rep", name: "New", confirm: true }).ok, true);
});

test("a save from a newer build is never overwritten, deleted by autosave, or replaced by import/create", () => {
  const { adapter, store, session } = rig({ tabId: null });
  session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const newer = JSON.stringify({ ...JSON.parse(adapter.getItem("office-crawler.slot.1")), version: config.saveVersion + 1 });
  adapter.setItem("office-crawler.slot.2", newer);
  adapter.removeItem(config.slotIndexKey);
  assert.equal(states(store), "ok,newer,empty,empty,empty");
  const st = mkState();
  assert.equal(store.write(2, st).error, "newer");
  assert.equal(store.create(2, st, { confirm: true }).error, "newer");
  assert.equal(store.importText(2, serialize(st), { confirm: true }).error, "newer");
  assert.equal(store.load(2).error, "newer");
  assert.equal(adapter.getItem("office-crawler.slot.2"), newer);
  assert.equal(states(store), "ok,newer,empty,empty,empty");
});

test("quota full: a failed create changes nothing, other slots stay loadable, the index stays consistent", () => {
  const size = serialize(mkState()).length;
  const cap = size * 2 + 700, m = new Map();
  const ad = { kind: "memory", getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => { m.delete(k); }, keys: () => [...m.keys()],
    setItem(k, v) { let n = k.length + v.length; for (const [kk, vv] of m) if (kk !== k) n += kk.length + vv.length; if (n > cap) throw new Error("QuotaExceededError"); m.set(k, String(v)); } };
  const notices = [];
  const store = createSlotStore(ad, { now: clock(), tabId: "A", onNotice: (k) => notices.push(k) });
  const session = createSession(store, { seedSource: () => 7 });
  assert.ok(session.createCharacter({ slot: 1, class: "sales-rep", name: "One" }).ok);
  assert.ok(session.createCharacter({ slot: 2, class: "sales-rep", name: "Two" }).ok);
  const before = snapshotKeys(ad);
  const r = session.createCharacter({ slot: 3, class: "sales-rep", name: "Three" });
  assert.equal(r.ok, false); assert.equal(r.error, "quota");
  assert.ok(notices.includes("storageFull"));
  assert.equal(states(store), "ok,ok,empty,empty,empty");
  assert.equal(ad.getItem("office-crawler.slot.3"), null);
  for (const k of ["office-crawler.slot.1", "office-crawler.slot.2"]) assert.equal(ad.getItem(k), before[k]);
  assert.ok(store.load(1).ok && store.load(2).ok);
});

test("import over an occupied slot keeps one undo copy; undo returns the old character; undo twice is a redo, never a loss", () => {
  const { adapter, store, session } = rig();
  session.createCharacter({ slot: 1, class: "sales-rep", name: "Old" });
  const old = adapter.getItem("office-crawler.slot.1");
  const other = serialize(mkState("it-wizard", "Newcomer"));
  assert.equal(session.importSlot({ slot: 1, text: other }).error, "occupied");
  assert.equal(session.importSlot({ slot: 1, text: other, confirm: true }).ok, true);
  assert.equal(adapter.getItem("office-crawler.slot.1.prev"), old);
  assert.equal(session.importSlot({ slot: 1, text: adapter.getItem("office-crawler.slot.1.prev"), confirm: true }).ok, true); // what the Undo button does
  assert.equal(store.list().slots[0].name, "Old");
  assert.equal(JSON.parse(adapter.getItem("office-crawler.slot.1.prev")).name, "Newcomer", "redo copy lost");
});

test("delete + undo + delete again: the undo copy always holds the last deleted character", () => {
  const { adapter, store, session } = rig();
  session.createCharacter({ slot: 1, class: "sales-rep", name: "A" });
  assert.equal(session.deleteSlot({ slot: 1 }).error, "confirm-required");
  assert.equal(session.deleteSlot({ slot: 1, confirm: "yes" }).error, "confirm-required", "only the boolean true confirms");
  assert.ok(session.deleteSlot({ slot: 1, confirm: true }).ok);
  assert.ok(store.restorePrev(1).ok);
  assert.equal(store.list().slots[0].name, "A");
  assert.equal(store.restorePrev(1).error, "occupied", "undo over a live character must refuse");
  assert.ok(session.deleteSlot({ slot: 1, confirm: true }).ok);
  assert.ok(session.createCharacter({ slot: 1, class: "it-wizard", name: "B" }).ok);
  assert.ok(session.deleteSlot({ slot: 1, confirm: true }).ok);
  assert.ok(store.restorePrev(1).ok);
  assert.equal(store.list().slots[0].name, "B");
});

test("100 autosaves to the active slot leave the other four slot texts byte-identical and add no keys (AC-R-224-1)", () => {
  const { adapter, store, session } = rig();
  for (const [n, cls] of [[1, "sales-rep"], [2, "it-wizard"], [3, "facilities-manager"], [4, "sales-rep"], [5, "it-wizard"]]) session.createCharacter({ slot: n, class: cls, name: `C${n}` });
  const r = session.loadSlot({ slot: 3 });
  const st = r.state;
  const others = Object.fromEntries([1, 2, 4, 5].map((n) => [n, adapter.getItem(`office-crawler.slot.${n}`)]));
  const keys = new Set(adapter.keys());
  let wrote = 0;
  for (let i = 0; i < 100; i++) { st.tick += 7; st.player.gold += 1; const a = store.autosave(st, { reason: "floor" }); if (a.ok && !a.skipped) wrote++; }
  assert.ok(wrote < 100 && wrote >= 1, `coalescing: ${wrote} writes`);
  for (const n of [1, 2, 4, 5]) assert.equal(adapter.getItem(`office-crawler.slot.${n}`), others[n]);
  assert.deepEqual(new Set(adapter.keys()), keys);
  assert.equal(JSON.parse(adapter.getItem("office-crawler.slot.3")).player.gold > 0, true);
});

test("legacy Clerk migration: idempotent, legacy key kept as backup, points refunded, notice once", () => {
  const notices = [];
  const ad = createMemoryAdapter({ [config.saveKey]: V1 });
  const store = createSlotStore(ad, { now: clock(), tabId: "A", onNotice: (k, x) => notices.push([k, x]) });
  const m = store.migrateLegacy();
  assert.deepEqual(m.migrated, { from: 1, refundedPoints: 4 });
  assert.deepEqual(notices.map((n) => n[0]), ["slotMigrated"]);
  assert.equal(ad.getItem(config.saveKey), V1, "legacy backup must stay");
  const e = store.list().slots[0];
  assert.equal(e.state, "ok"); assert.equal(e.class, "facilities-manager"); assert.equal(e.name, "Employee");
  const text = ad.getItem("office-crawler.slot.1");
  const again = createSlotStore(ad, { now: clock(), tabId: "A", onNotice: (k) => notices.push([k]) });
  assert.equal(again.migrateLegacy().skipped, true);
  assert.equal(ad.getItem("office-crawler.slot.1"), text);
  assert.equal(notices.length, 1, "notice repeated");
  const loaded = store.load(1);
  assert.ok(loaded.ok);
  assert.equal(loaded.state.player.class, "facilities-manager");
  assert.equal(loaded.state.player.skillPoints, JSON.parse(V1).player.skillPoints + 4);
  assert.deepEqual(Object.keys(loaded.state.player.skills), ["pallet-slam"]);
  // the migrated character survives rename, save and a second load
  assert.ok(store.rename(1, "Renamed Clerk").ok);
  assert.equal(store.load(1).state.player.name, "Renamed Clerk");
});

test("legacy save that is corrupt, truncated, newer or oversized: title loads, no slot is invented, no throw", () => {
  const j = JSON.parse(V1);
  const cases = { truncated: V1.slice(0, 400), newer: JSON.stringify({ ...j, version: 9 }), garbage: "\u0000\u0001", oversize: "x".repeat(config.saveMaxBytes + 10), badChecksum: JSON.stringify({ ...j, checksum: "nope" }) };
  for (const [what, text] of Object.entries(cases)) {
    const ad = createMemoryAdapter({ [config.saveKey]: text });
    const store = createSlotStore(ad, { now: clock(), tabId: "A" });
    let r; assert.doesNotThrow(() => { r = store.migrateLegacy(); }, what);
    const st = store.list().slots[0].state;
    assert.ok(["bad", "newer"].includes(st), `${what}: slot 1 is ${st}`);
    assert.equal(states(store).split(",").slice(1).join(","), "empty,empty,empty,empty", what);
    assert.equal(ad.getItem(config.saveKey), text, `${what}: the legacy text must stay`);
  }
});

test("a different tab is refused writes while another tab owns the active slot; the same tab id (reload) is not", () => {
  const ad = createMemoryAdapter();
  const a = rig({ tabId: "A", adapter: ad });
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const b = rig({ tabId: "B", adapter: ad });
  assert.equal(b.session.createCharacter({ slot: 2, class: "sales-rep", name: "Two" }).error, "another-tab");
  assert.equal(b.session.deleteSlot({ slot: 1, confirm: true }).error, "another-tab");
  assert.equal(b.session.importSlot({ slot: 2, text: serialize(mkState()) }).error, "another-tab");
  assert.equal(b.store.autosave(mkState(), {}, { force: true }).ok, false);
  const a2 = rig({ tabId: "A", adapter: ad });
  assert.equal(a2.session.continue().ok, true);
  a.store.clearActive();
  assert.equal(b.session.continue().ok, true);
});

test("rename: only the name changes; invalid names change nothing; a corrupt slot is refused", () => {
  const { adapter, store, session } = rig();
  session.createCharacter({ slot: 1, class: "it-wizard", name: "Before" });
  const text = adapter.getItem("office-crawler.slot.1"), j = JSON.parse(text);
  for (const bad of ["", " ", "x".repeat(17), "<b>", "a\nb", null, undefined, 5, {}, "emoji \u{1F600}"]) { assert.equal(store.rename(1, bad).error, "bad-name", String(bad)); }
  assert.equal(adapter.getItem("office-crawler.slot.1"), text);
  assert.ok(store.rename(1, "  After   Name ").ok);
  const k = JSON.parse(adapter.getItem("office-crawler.slot.1"));
  assert.equal(k.name, "After Name");
  const { name: _n, checksum: _c, ...a } = j, { name: _n2, checksum: _c2, ...b } = k;
  assert.deepEqual(a, b);
  adapter.setItem("office-crawler.slot.1", adapter.getItem("office-crawler.slot.1").replace('"gold":', '"gold":9'));
  assert.equal(store.rename(1, "Nope").error, "corrupt");
});

test("options are never touched by slot operations (QF-09-4)", () => {
  const { adapter, store, session } = rig();
  store.saveOptions({ volume: { master: 0.3 }, muted: true });
  const opts = adapter.getItem(config.optionsKey);
  session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  session.deleteSlot({ slot: 1, confirm: true });
  session.importSlot({ slot: 2, text: "garbage" });
  store.remove(3, { confirm: true });
  assert.equal(adapter.getItem(config.optionsKey), opts);
});

test("every class: create, play 600 ticks, autosave, reload: state equals what was saved", async () => {
  const { step } = await import("../src/core/index.js");
  for (const cls of CLASSES) {
    const { store, session } = rig();
    const c = session.createCharacter({ slot: 5, class: cls, name: "Rt" });
    assert.ok(c.ok);
    for (let i = 0; i < 600; i++) step(c.state);
    assert.ok(store.autosave(c.state, {}, { force: true }).ok);
    const l = store.load(5);
    assert.ok(l.ok, cls);
    assert.equal(serialize(l.state), serialize(c.state), `${cls}: load(save(x)) != x`);
  }
});

test("existing 5-slot worst case: five maxed level-30 characters fit under the soft ceiling and each text under slotMaxBytes", async () => {
  const { setLevel } = await import("../src/core/index.js");
  const { store, adapter, session } = rig();
  for (let n = 1; n <= 5; n++) {
    const cls = CLASSES[n % 3];
    const c = session.createCharacter({ slot: n, class: cls, name: `Max${n}` });
    setLevel(c.state, 30);
    c.state.player.skillPoints = 100;
    for (let k = 0; k < 6; k++) for (const id of Object.keys(skillTrees[cls].skills)) { c.state.player.skills[id] = Math.min(5, (c.state.player.skills[id] ?? 0) + 1); }
    assert.ok(store.write(n, c.state, { setActive: true }).ok, `slot ${n}`);
  }
  const total = adapter.keys().reduce((a, k) => a + k.length + adapter.getItem(k).length, 0);
  assert.ok(total < config.storageMaxBytes, `total ${total}`);
  for (let n = 1; n <= 5; n++) assert.ok(adapter.getItem(`office-crawler.slot.${n}`).length < config.slotMaxBytes);
});
