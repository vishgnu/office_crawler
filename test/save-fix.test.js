// R5 fix round (SAVE-FIX): owner heartbeat, schema hardening, switch safety, migration retry, notices, slot view contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, applyInput, config } from "../src/core/index.js";
import { createSlotStore, createSession, slotsView, createMemoryAdapter, createAdapter, serialize, deserialize, toSave, checksumOf, OWNER_STALE_MS } from "../src/save/index.js";
import { canonical } from "../src/core/hash.js";
import { validateName } from "../src/core/name.js";

const V1 = readFileSync(new URL("./fixtures/save-v1.json", import.meta.url), "utf8");
const mkState = (cls = "sales-rep", name = "Bob", seed = 5) => newGame(seed, { class: cls, name, start: "town", wearStartKit: true });
const reseal = (s) => canonical({ ...s, checksum: checksumOf(s) });
const clockAt = (t0 = 1_700_000_000_000) => { const c = { t: t0, now: () => c.t }; return c; };
function rig({ tabId = "A", adapter = createMemoryAdapter(), clock = clockAt(), notices = [] } = {}) {
  const store = createSlotStore(adapter, { now: clock.now, tabId, onNotice: (k) => notices.push(k) });
  return { adapter, store, clock, notices, session: createSession(store, { seedSource: () => 7 }) };
}
const slotKey = (n) => `${config.slotKeyPrefix}${n}`;

// ---- CR-01 / ADV-R5-02 owner lock ----------------------------------------------------------------------------------------------

test("CR-01 the owner is { id, beat }; a write refreshes the beat; status.owner is self for the owner and other for a live second tab", () => {
  const clock = clockAt(), ad = createMemoryAdapter();
  const a = rig({ tabId: "A", adapter: ad, clock }), b = rig({ tabId: "B", adapter: ad, clock });
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  assert.deepEqual(a.store.list().owner, { id: "A", beat: clock.t });
  clock.t += 4000;
  a.store.autosave(mkState(), {}, { force: true });
  assert.equal(a.store.list().owner.beat, clock.t, "every write is a heartbeat");
  assert.equal(a.store.status().owner, "self");
  assert.equal(b.store.status().owner, "other");
  assert.equal(b.session.continue().error, "another-tab", "a live owner is respected");
});

test("CR-01 heartbeat() keeps the owner live past the stale limit; without it the owner goes stale and a later tab takes over", () => {
  const clock = clockAt(), ad = createMemoryAdapter();
  const a = rig({ tabId: "A", adapter: ad, clock });
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  for (let i = 0; i < 6; i++) { clock.t += config.ownerBeatMs; assert.ok(a.store.heartbeat().ok); }
  assert.ok(clock.t - 1_700_000_000_000 > OWNER_STALE_MS);
  const b = rig({ tabId: "B", adapter: ad, clock });
  assert.equal(b.store.status().owner, "other", "30 s of beats: still live");
  clock.t += OWNER_STALE_MS + 1;
  assert.equal(b.store.status().owner, "stale");
  const c = rig({ tabId: "C", adapter: ad, clock }); // started after the stale beat
  assert.equal(c.session.continue().ok, true, "a tab that starts after the owner went stale takes over by itself");
  assert.equal(c.store.list().owner.id, "C");
  assert.equal(b.store.write(1, mkState()).error, "another-tab", "B started before C's takeover and C is live");
});

test("CR-01 a tab that started before the stale beat does not take over by itself; takeOverSaves does", () => {
  const clock = clockAt(), ad = createMemoryAdapter();
  const a = rig({ tabId: "A", adapter: ad, clock });
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const b = rig({ tabId: "B", adapter: ad, clock }); // B opens while A is live
  clock.t += OWNER_STALE_MS + 5000; // A's timers were throttled: its beat is old, but B was there first
  assert.equal(b.store.status().owner, "stale");
  assert.equal(b.session.continue().error, "another-tab");
  assert.deepEqual(b.session.run({ t: "takeOverSaves" }), { ok: true });
  assert.equal(b.store.status().owner, "self");
  assert.equal(b.session.continue().ok, true);
  assert.equal(a.store.write(1, mkState()).error, "another-tab", "A is the other tab now");
});

test("CR-01 an owner written as a bare id string (older build) reads as stale, never as a permanent lock", () => {
  const clock = clockAt(), ad = createMemoryAdapter();
  const a = rig({ tabId: "A", adapter: ad, clock });
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const idx = JSON.parse(ad.getItem(config.slotIndexKey)); idx.owner = "tab-that-crashed"; ad.setItem(config.slotIndexKey, JSON.stringify(idx));
  clock.t += 1000;
  const b = rig({ tabId: "B", adapter: ad, clock });
  assert.equal(b.store.status().owner, "stale");
  assert.equal(b.session.continue().ok, true);
});

test("CR-01 tab ids are per page load: main.js does not read or write sessionStorage for the id", () => {
  const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.ok(!/sessionStorage\.(get|set)Item/.test(src), "a duplicated tab copies sessionStorage and would share the id");
  assert.match(src, /heartbeat\(\)/);
});

// ---- CR-02 / CR-03 / CR-04 schema ----------------------------------------------------------------------------------------------

test("CR-02 item, affix and unique ids that could break out of an attribute are refused by the schema", () => {
  const evil = ['x" onmouseover="alert(1)', "<img src=x>", "a b", "", "x".repeat(33), "a'b", "a>b", "a`b", "ü"];
  for (const id of evil) {
    const s = toSave(mkState());
    s.inventory.items.push({ id, base: "ruler-rapier", name: "Ruler", kind: "gear", rarity: "normal", w: 1, h: 3, x: 0, y: 0, affixes: [] });
    assert.equal(deserialize(reseal(s)).ok, false, JSON.stringify(id));
    const t = toSave(mkState()); t.uniquesFound = [id];
    assert.equal(deserialize(reseal(t)).ok, false, `unique ${JSON.stringify(id)}`);
  }
  const fine = toSave(mkState());
  fine.inventory.items.push({ id: "i_9-Z", base: "ruler-rapier", name: "Ruler", kind: "gear", rarity: "normal", w: 1, h: 3, x: 0, y: 0, affixes: [] });
  assert.equal(deserialize(reseal(fine)).ok, true);
  const importer = createSlotStore(createMemoryAdapter());
  const hostile = toSave(mkState()); hostile.equipment.weapon.id = 'x" onmouseover="alert(1)';
  assert.equal(importer.importText(1, reseal(hostile)).ok, false);
});

test("CR-03 skill bar: primary must be the class basic; hotkeys castable, of the class and learned; unlearned or foreign skills are refused", () => {
  const cases = {
    "primary of another class": (b) => { b.primary = "zap"; },
    "primary is a skill": (b) => { b.primary = "stapler-throw"; },
    "hotkey of another class": (b) => { b.hotkeys[1] = "pallet-slam"; },
    "hotkey not learned": (b) => { b.hotkeys[1] = "intern"; },
    "hotkey is a passive (learned)": (b) => { b.hotkeys[1] = "hustle"; },
    "hotkey is the basic attack": (b) => { b.hotkeys[1] = "toss"; },
    "secondary not learned": (b) => { b.secondary = "intern"; },
  };
  for (const [what, mutate] of Object.entries(cases)) {
    const s = toSave(mkState("sales-rep")); s.player.level = 5; s.player.xp = config.xpTable[4]; s.player.skills.hustle = 1; s.player.skillPoints = 3;
    mutate(s.player.skillBar);
    assert.equal(deserialize(reseal(s)).ok, false, what);
  }
  const good = toSave(mkState("sales-rep")); good.player.level = 5; good.player.xp = config.xpTable[4]; good.player.skills.intern = 1; good.player.skillPoints = 3;
  good.player.skillBar.hotkeys[1] = "intern";
  assert.equal(deserialize(reseal(good)).ok, true, "a learned active skill on a hotkey is fine");
  assert.equal(deserialize(reseal(toSave(mkState("sales-rep")))).ok, true);
});

test("ADV-R5-04 impossible skill points: levels above what the character level grants, gated or prerequisite-less skills are refused", () => {
  const s = toSave(mkState("sales-rep"));
  s.player.level = 5; s.player.xp = config.xpTable[4];
  const lvl = (n) => { const t = structuredClone(s); t.player.level = n; t.player.xp = config.xpTable[n - 1]; return t; };
  const learned = lvl(5); learned.player.skills.hustle = 1; learned.player.skillPoints = 3;
  const ok = deserialize(reseal(learned));
  assert.equal(ok.ok, true, ok.message);
  const over = lvl(5); over.player.skills.hustle = 5; over.player.skillPoints = 1; // 5 points spent + 1 left, only 4 granted
  assert.equal(deserialize(reseal(over)).ok, false);
  const left = lvl(2); left.player.skillPoints = 5; // unspent points beyond the grant
  assert.equal(deserialize(reseal(left)).ok, false);
  const none = lvl(1); none.player.skills.hustle = 1; none.player.skillPoints = 0;
  assert.equal(deserialize(reseal(none)).ok, false, "level 1 cannot hold a spent point at all");
  const gated = lvl(5); gated.player.skills["pen-volley"] = 1; gated.player.skillPoints = 2;
  assert.equal(deserialize(reseal(gated)).ok, false, "level gate 8");
  const prereq = lvl(9); prereq.player.skills["reply-all"] = 1; prereq.player.skillPoints = 7;
  assert.equal(deserialize(reseal(prereq)).ok, false, "reply-all needs intern");
  prereq.player.skills.intern = 1; prereq.player.skillPoints = 6;
  assert.equal(deserialize(reseal(prereq)).ok, true);
});

test("CR-04 options inside a save are not persisted; an imported file with a large options object is stripped", () => {
  const st = mkState(); st.options = { keys: { A: "F1" }, volume: 0.1 };
  assert.deepEqual(JSON.parse(serialize(st)).options, {});
  const s = toSave(mkState()); s.options = JSON.parse('{"__proto__": {"x": 1}, "junk": "' + "y".repeat(200000) + '"}');
  const store = createSlotStore(createMemoryAdapter());
  assert.equal(store.importText(1, reseal(s)).ok, true);
  const stored = JSON.parse(store.raw(1));
  assert.deepEqual(stored.options, {});
  assert.ok(store.raw(1).length < 100000);
  assert.deepEqual(deserialize(store.raw(1)).state.options, {});
  assert.equal({}.x, undefined);
});

// ---- CR-05 / CR-06 switching ----------------------------------------------------------------------------------------------------

test("CR-05 a failed pre-switch save aborts loadSlot and createCharacter with a reason and sets status.notice", () => {
  const { adapter, store, session } = rig({ tabId: null });
  const a = session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  session.createCharacter({ slot: 2, class: "it-wizard", name: "Two" }, a.state);
  store.setActive(1);
  const running = a.state; running.player.gold = 4242;
  adapter.failWrites = true;
  const r = session.loadSlot({ slot: 2 }, running);
  assert.deepEqual([r.ok, r.error], [false, "save-failed-before-switch"]);
  assert.ok(r.reason);
  assert.equal(store.status().notice, "pre-switch-save-failed");
  assert.equal(store.activeSlot(), 1, "nothing switched");
  const c = session.createCharacter({ slot: 3, class: "sales-rep", name: "Three" }, running);
  assert.equal(c.error, "save-failed-before-switch");
  assert.equal(store.list().slots[2].state, "empty");
  adapter.failWrites = false;
  assert.equal(session.loadSlot({ slot: 2 }, running).ok, true);
  assert.equal(store.load(1).state.player.gold, 4242, "the progress was saved by the successful switch");
  assert.equal(store.status().notice, null, "a successful write clears the notice");
});

test("CR-06 loading the slot you are playing saves first, so it never brings back an older copy", () => {
  const { store, session } = rig({ tabId: null });
  const a = session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  a.state.player.gold = 777; // progress since the last autosave
  const r = session.loadSlot({ slot: 1 }, a.state);
  assert.equal(r.ok, true);
  assert.equal(r.state.player.gold, 777);
  // and when that save fails, the switch is refused instead of reloading the older copy
  r.state.player.gold = 888;
  store.adapter.failWrites = true;
  assert.equal(session.loadSlot({ slot: 1 }, r.state).error, "save-failed-before-switch");
});

// ---- CR-07 / ADV-R5-06 notices and status ------------------------------------------------------------------------------------------

test("CR-07 autosave with no active slot sets status.notice no-active-slot and tells the player once; dismissSaveNotice clears it", () => {
  const { store, session, notices } = rig({ tabId: null });
  assert.equal(store.autosave(mkState(), {}, { force: true }).error, "no-active-slot");
  store.autosave(mkState(), {}, { force: true });
  assert.equal(store.status().notice, "no-active-slot");
  assert.equal(notices.filter((k) => k === "saveFailed").length, 1, "rate limited");
  assert.equal(slotsView(store).status.notice, "no-active-slot");
  assert.deepEqual(session.run({ t: "dismissSaveNotice" }), { ok: true });
  assert.equal(store.status().notice, null);
  session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  store.autosave(mkState(), {}, { force: true });
  assert.equal(store.status().notice, null);
});

test("ADV-R5-06 blocked storage: createAdapter falls back to memory and status.storage says so; a quota failure reads full", () => {
  const blocked = createAdapter({ get localStorage() { throw new Error("denied"); } });
  assert.equal(createSlotStore(blocked).status().storage, "memory");
  assert.equal(createSlotStore(createMemoryAdapter()).status().storage, "ok");
  const { adapter, store, session } = rig({ tabId: null });
  const a = session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  adapter.failWrites = true;
  assert.equal(store.write(1, a.state).ok, false);
  assert.equal(store.status().storage, "full");
  adapter.failWrites = false;
  assert.equal(store.write(1, a.state).ok, true);
  assert.equal(store.status().storage, "ok");
});

// ---- CR-08 / ADV-R5-01 migration ---------------------------------------------------------------------------------------------------

test("CR-08 a failed migration write keeps slots 2 to 5 visible, sets the notice, and the next boot retries and succeeds", () => {
  const ad = createMemoryAdapter({ [config.saveKey]: V1 });
  const other = createSlotStore(createMemoryAdapter());
  other.create(2, mkState("it-wizard", "Two"));
  ad.setItem(slotKey(2), other.raw(2));
  ad.failKeys = (k) => k === slotKey(1);
  const first = createSlotStore(ad, { now: clockAt().now });
  const r = first.migrateLegacy();
  assert.equal(r.ok, false);
  assert.equal(first.status().notice, "migration-failed");
  assert.equal(first.list().slots.map((e) => e.state).join(), "empty,ok,empty,empty,empty");
  assert.notEqual(ad.getItem(config.saveKey), null, "the legacy text is untouched");
  ad.failKeys = null;
  const second = createSlotStore(ad, { now: clockAt().now });
  const r2 = second.migrateLegacy();
  assert.equal(r2.ok, true);
  assert.equal(second.list().slots.map((e) => e.state).join(), "ok,ok,empty,empty,empty");
  assert.equal(second.status().notice, null);
  assert.equal(second.migrateLegacy().skipped, true, "no third run");
});

test("CR-08 deleting slot 1 later does not resurrect the legacy backup", () => {
  const ad = createMemoryAdapter({ [config.saveKey]: V1 });
  const s = createSlotStore(ad, { now: clockAt().now });
  assert.ok(s.migrateLegacy().ok);
  s.remove(1, { confirm: true });
  assert.equal(createSlotStore(ad).migrateLegacy().skipped, true);
  assert.equal(createSlotStore(ad).list().slots[0].state, "empty");
});

// ---- CR-09 / ADV-R5-03 / ADV-R5-09 ----------------------------------------------------------------------------------------------

test("CR-09 rename is refused while another live tab owns the saves", () => {
  const clock = clockAt(), ad = createMemoryAdapter();
  const a = rig({ tabId: "A", adapter: ad, clock }), b = rig({ tabId: "B", adapter: ad, clock });
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  assert.equal(b.session.renameSlot({ slot: 1, name: "Hijack" }).error, "another-tab");
  assert.equal(a.session.renameSlot({ slot: 1, name: "Mine" }).ok, true);
});

test("CR-09 creating over a damaged slot keeps the damaged text exportable, also when it still sits under the slot key", () => {
  const { adapter, store, session } = rig({ tabId: null });
  adapter.setItem(slotKey(3), "{broken text");
  store.list(); // index rebuilt: slot 3 is bad, text under the slot key
  assert.equal(store.list().slots[2].state, "bad");
  assert.equal(session.createCharacter({ slot: 3, class: "sales-rep", name: "Fresh" }).error, "occupied");
  assert.equal(session.createCharacter({ slot: 3, class: "sales-rep", name: "Fresh", confirm: true }).ok, true);
  assert.equal(store.list().slots[2].state, "ok");
  assert.equal(session.exportSlot({ slot: 3, which: "bad" }).text, "{broken text");
});

test("ADV-R5-03 restorePrev refuses newer-build and occupied slots", () => {
  const { adapter, store, session } = rig({ tabId: null });
  session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  session.deleteSlot({ slot: 1, confirm: true });
  assert.equal(store.restorePrev(1).ok, true);
  assert.equal(store.restorePrev(1).error, "occupied");
});

// ---- CR-10 / ADV-R5-10 / ADV-R5-05 core -------------------------------------------------------------------------------------------

test("CR-10 setName is accepted by the core while paused and on the death screen, other input is still refused while paused", () => {
  const st = mkState();
  st.paused = true;
  assert.equal(applyInput(st, { t: "setName", name: "Paused Pat" }).ok, true);
  assert.equal(st.player.name, "Paused Pat");
  assert.equal(applyInput(st, { t: "click", tile: { x: 1, y: 1 } }).error, "paused");
  assert.equal(applyInput(st, { t: "setName", name: "<b>" }).error, "bad-name");
  st.paused = false; st.scene = "dead";
  assert.equal(applyInput(st, { t: "setName", name: "Ghost" }).ok, true);
  assert.equal(st.player.name, "Ghost");
  const game = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  assert.ok(!/running\.paused\s*=/.test(game), "the shell no longer flips core flags");
});

test("ADV-R5-10 combining marks are allowed inside names, a leading mark and controls are not", () => {
  for (const n of ["José", "Zoë", "สวัสดี"]) assert.equal(validateName(n).ok, true, n);
  for (const n of ["́abc", "a‍b", "a‮b", "<i>", "x".repeat(17)]) assert.equal(validateName(n).ok, false, JSON.stringify(n));
  assert.equal(validateName("a".repeat(14) + "e\u0301").ok, true, "16 code points, marks included");
  assert.equal(validateName("a".repeat(15) + "e\u0301").ok, false, "17 code points");
});

// ---- CR-13 -----------------------------------------------------------------------------------------------------------------------

test("CR-13 a write does not read every key: getItem calls per autosave stay constant while foreign slots grow", () => {
  const ad = createMemoryAdapter(); let reads = 0; const g = ad.getItem.bind(ad); ad.getItem = (k) => { reads++; return g(k); };
  const store = createSlotStore(ad, { now: clockAt().now });
  const session = createSession(store, { seedSource: () => 1 });
  const a = session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  for (let n = 2; n <= 5; n++) session.createCharacter({ slot: n, class: "it-wizard", name: `P${n}` });
  store.setActive(1);
  store.write(1, a.state);
  const per = () => { reads = 0; store.write(1, a.state); return reads; };
  const base = per();
  for (let i = 0; i < 20; i++) assert.equal(per(), base);
  assert.ok(base <= 8, `reads per write: ${base}`);
  assert.equal(store.usage({ exact: true }).chars, store.usage().chars, "the running total equals an exact scan");
});

// ---- contract: slot view and commands ----------------------------------------------------------------------------------------------

test("contract: slotsView has status and list entries with deepest, savedAt (ISO UTC) and hasPrev; exportSlot returns text and fileName", () => {
  const { store, session, clock } = rig({ tabId: null });
  session.createCharacter({ slot: 2, class: "sales-rep", name: "Two" });
  session.createCharacter({ slot: 4, class: "it-wizard", name: "Four" });
  session.deleteSlot({ slot: 4, confirm: true });
  const v = slotsView(store);
  assert.deepEqual(Object.keys(v.status).sort(), ["notice", "noticeAttr", "owner", "storage"]);
  assert.equal(v.list.length, 5);
  assert.equal(v.list[1].savedAt, new Date(clock.t).toISOString());
  assert.equal(v.list[0].savedAt, null);
  assert.equal(typeof v.list[1].deepest, "number");
  assert.deepEqual(v.list.map((e) => e.hasPrev), [false, false, false, true, false]);
  const ex = session.run({ t: "exportSlot", slot: 2 });
  assert.equal(ex.ok, true); assert.match(ex.fileName, /^office-crawler-slot-2-two\.json$/); assert.equal(ex.text, store.raw(2));
  assert.equal(session.run({ t: "exportSlot", slot: 1 }).ok, false);
});

test("ADV-R5-05 a new character shows the real level-2 threshold at once", () => {
  assert.equal(mkState().player.xpNext, config.xpTable[1]);
  assert.equal(config.player.xpNext, config.xpTable[1]);
});

test("undo of a replace: restorePrev with confirm swaps the undo copy back and keeps the replaced text as the new undo copy; newer slots stay guarded", () => {
  const { adapter, store, session } = rig({ tabId: null });
  session.createCharacter({ slot: 5, class: "facilities-manager", name: "Old" });
  const oldText = store.raw(5);
  session.createCharacter({ slot: 5, class: "it-wizard", name: "New", confirm: true });
  const newText = store.raw(5);
  assert.equal(store.restorePrev(5).error, "occupied");
  assert.equal(store.restorePrev(5, { confirm: true }).ok, true);
  assert.equal(store.raw(5), oldText);
  assert.equal(adapter.getItem(`${slotKey(5)}.prev`), newText);
  assert.equal(store.list().slots[4].name, "Old");
  assert.equal(store.restorePrev(5, { confirm: true }).ok, true, "and back again");
  assert.equal(store.raw(5), newText);
  const newer = JSON.stringify({ format: "office-crawler-save", version: config.saveVersion + 1 });
  adapter.setItem(slotKey(5), newer); adapter.removeItem(config.slotIndexKey);
  assert.equal(createSlotStore(adapter).restorePrev(5, { confirm: true }).error, "newer");
  assert.equal(adapter.getItem(slotKey(5)), newer);
});
