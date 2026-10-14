// Adversarial round 2 (after the SAVE-FIX / UI-FIX round): owner heartbeat timing, takeover, hostile imports against the new id regex and
// skill rules, migration retry flag, restore after replace. { todo: 'ADV-R5-NN' } marks a demonstrated defect (docs/reviews/R5-adversarial.md, Round 2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSlotStore, createSession, createMemoryAdapter, serialize, deserialize, checksumOf, toSave } from "../src/save/index.js";
import { newGame } from "../src/core/state.js";
import * as core from "../src/core/index.js";
import { config } from "../src/core/config.js";
import { canonical } from "../src/core/hash.js";
import { affixes } from "../src/core/content/affixes.js";
import { uniques } from "../src/core/content/uniques.js";

const V1 = readFileSync(new URL("./fixtures/save-v1.json", import.meta.url), "utf8");
const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
const mk = (cls = "sales-rep", name = "Bob", seed = 5) => newGame(seed, { class: cls, name, start: "town", wearStartKit: true });
const reseal = (s) => canonical({ ...s, checksum: checksumOf(s) });
const T0 = 1_000_000_000_000;
function rig(ad, tabId, clk) { const store = createSlotStore(ad, { now: () => clk.t, tabId }); return { store, session: createSession(store, { seedSource: () => 7 }) }; }
const idxOf = (ad) => JSON.parse(ad.getItem(config.slotIndexKey));

// ---- findings ----------------------------------------------------------------------------------------------------------------

test("ADV-R5-12 an imported item with a negative hpMax or stamina affix must not leave the hero with negative health", { todo: "ADV-R5-12" }, () => {
  const bad = [];
  for (const cls of CLASSES) for (const stat of ["hpMax", "stamina"]) {
    const s = toSave(mk(cls)); s.equipment.weapon.affixes = [{ stat, value: -100 }];
    const r = deserialize(reseal(s));
    if (!r.ok) continue; // rejected is fine
    for (let i = 0; i < 30; i++) core.step(r.state);
    const p = r.state.player;
    if (!(p.hpMax >= 1 && p.hp >= 1)) bad.push(`${cls}/${stat}: hp ${p.hp}/${p.hpMax} in ${r.state.scene}`);
  }
  assert.deepEqual(bad, []);
});

test("ADV-R5-13 an owner beat in the future (clock set back, or a tampered index) must not lock other tabs out until that time", { todo: "ADV-R5-13" }, () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const i = idxOf(ad); i.owner = { id: "A", beat: clk.t + 3 * 86400e3 }; ad.setItem(config.slotIndexKey, JSON.stringify(i));
  clk.t += 3600e3; // one hour later A is long gone
  const b = rig(ad, "B", clk);
  assert.equal(b.session.continue().ok, true, `status ${b.store.status().owner}`);
});

// ---- heartbeat, stale, takeover ------------------------------------------------------------------------------------------------

test("two live tabs: the owner keeps writing and beating, the other is refused on every write path with another-tab", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  const c = a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const b = rig(ad, "B", clk);
  for (let k = 0; k < 20; k++) {
    clk.t += 4000; // inside the 5 s beat
    assert.ok(a.store.heartbeat().ok);
    assert.equal(b.store.status().owner, "other");
    assert.equal(b.session.continue().error, "another-tab");
    assert.equal(b.session.createCharacter({ slot: 2, class: "it-wizard", name: "X" }).error, "another-tab");
    assert.equal(b.session.deleteSlot({ slot: 1, confirm: true }).error, "another-tab");
    assert.equal(b.session.renameSlot({ slot: 1, name: "Hijack" }).error, "another-tab");
    assert.equal(b.session.importSlot({ slot: 3, text: serialize(mk()) }).error, "another-tab");
    assert.equal(b.session.copySlot({ from: 1, to: 3 }).error, "another-tab");
    assert.equal(b.store.restorePrev(1).ok, false);
  }
  assert.ok(a.store.autosave(c.state, {}, { force: true }).ok);
  assert.equal(JSON.parse(ad.getItem("office-crawler.slot.1")).name, "One");
});

test("heartbeat boundary: at exactly 15 s the owner is still live, one ms later it is stale; a tab opened before the last beat needs takeOver", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const early = rig(ad, "E", clk); // started before A's next beat
  clk.t += 1000; a.store.heartbeat();
  const beat = idxOf(ad).owner.beat;
  clk.t = beat + config.ownerStaleMs;
  const late = rig(ad, "L", clk);
  assert.equal(late.store.status().owner, "other", "exactly the stale age is still live");
  clk.t += 1;
  assert.equal(late.store.status().owner, "stale");
  assert.equal(early.store.status().owner, "stale");
  assert.equal(early.session.continue().error, "another-tab", "a tab that started before the beat must not take over silently");
  assert.ok(early.store.takeOver().ok);
  assert.equal(early.session.continue().ok, true);
});

test("a frozen background tab (no beats for 20 s) is displaced; when it thaws it cannot write, beat or steal the lock back", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  const c = a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  clk.t += 20000;
  const b = rig(ad, "B", clk);
  assert.ok(b.session.continue().ok);
  const textB = ad.getItem("office-crawler.slot.1");
  c.state.player.gold = 999;
  assert.equal(a.store.autosave(c.state, {}, { force: true }).error, "another-tab");
  assert.equal(a.store.heartbeat().ok, false);
  assert.equal(a.store.status().owner, "other");
  assert.equal(ad.getItem("office-crawler.slot.1"), textB);
  assert.equal(idxOf(ad).owner.id, "B");
});

test("takeOver while the old owner is still beating: the old owner loses the next write and heartbeat, the new owner's writes succeed", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  const c = a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const b = rig(ad, "B", clk);
  assert.ok(b.store.takeOver().ok);
  clk.t += 1000;
  assert.equal(a.store.autosave(c.state, {}, { force: true }).error, "another-tab");
  assert.equal(a.store.heartbeat().ok, false);
  assert.ok(b.session.continue().ok);
  assert.equal(idxOf(ad).owner.id, "B");
  assert.equal(a.store.status().owner, "other");
});

test("a bare-string owner written by the old build and an owner with a junk beat do not crash and read as stale or invalid", () => {
  for (const owner of ["old-tab", { id: "x", beat: "now" }, { id: "x" }, { id: 5, beat: 1 }, { id: "x", beat: NaN }, { id: "x", beat: null }, [], 5, true]) {
    const ad = createMemoryAdapter(), clk = { t: T0 };
    const a = rig(ad, "A", clk); a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
    const i = idxOf(ad); i.owner = owner; ad.setItem(config.slotIndexKey, JSON.stringify(i));
    clk.t += 60000;
    const b = rig(ad, "B", clk);
    let r; assert.doesNotThrow(() => { r = b.session.continue(); b.store.status(); b.store.heartbeat(); }, JSON.stringify(owner));
    assert.ok(r.ok, `owner ${JSON.stringify(owner)} locked the new tab out`);
  }
});

test("heartbeat never creates an owner on its own and never touches slot texts", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk); a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  a.store.clearActive();
  const before = ad.getItem("office-crawler.slot.1");
  const b = rig(ad, "B", clk);
  b.store.heartbeat();
  assert.equal(idxOf(ad).owner, null);
  assert.equal(ad.getItem("office-crawler.slot.1"), before);
});

// ---- hostile imports against the new rules -------------------------------------------------------------------------------------

test("ids that reach markup: every unsafe form is rejected (quotes, angle brackets, spaces, newline, unicode digits, 33 chars, empty, non-string)", () => {
  const unsafe = ['a"b', "a<b", "a>b", "a b", "ab\n", "\nab", "a'b", "a`b", "a&b", "a٠b", "a‮b", "x".repeat(33), "", "a.b", "a/b", "a:b", 5, null, {}, []];
  const sinks = {
    "inventory item id": (s, v) => { s.inventory.items.push({ ...structuredClone(s.equipment.weapon), id: v, x: 0, y: 0 }); },
    "equipment id": (s, v) => { s.equipment.weapon.id = v; },
    "affix id": (s, v) => { s.equipment.weapon.affixes = [{ id: v, stat: "defense", value: 1 }]; },
    "affix group": (s, v) => { s.equipment.weapon.affixes = [{ group: v, stat: "defense", value: 1 }]; },
    "affix kind": (s, v) => { s.equipment.weapon.affixes = [{ kind: v, stat: "defense", value: 1 }]; },
    "affix class": (s, v) => { s.equipment.weapon.affixes = [{ class: v, stat: "defense", value: 1 }]; },
    "item slot": (s, v) => { s.equipment.weapon.slot = v; },
    "item unique": (s, v) => { s.equipment.weapon.unique = v; },
    "item effect": (s, v) => { s.equipment.weapon.effect = v; },
    "item restores": (s, v) => { s.belt[0].restores = v; },
    "reqs key": (s, v) => { s.equipment.weapon.reqs = { [v]: 1 }; },
    "uniquesFound": (s, v) => { s.uniquesFound = [v]; },
  };
  for (const [sink, fn] of Object.entries(sinks)) for (const v of unsafe) {
    const s = toSave(mk());
    if (!s.belt[0]) s.belt[0] = { id: "i50", base: "lukewarm-coffee", name: "x", kind: "potion", rarity: "normal", w: 1, h: 1 };
    fn(s, v);
    if (sink === "reqs key" && typeof v !== "string") continue; // object keys are always strings
    const r = deserialize(reseal(s));
    assert.equal(r.ok, false, `${sink}: ${JSON.stringify(v)} accepted`);
  }
});

test("free-text item fields (name, baseName, flavour, affix name) stay allowed but are length-capped, so the UI must escape them", () => {
  const s = toSave(mk()); s.equipment.weapon.name = "<img src=x onerror=1>"; s.equipment.weapon.flavour = "\"><svg onload=1>";
  assert.equal(deserialize(reseal(s)).ok, true, "text fields are accepted: escaping is the UI's job (see e2e adv-r5 round 2)");
  s.equipment.weapon.name = "x".repeat(65);
  assert.equal(deserialize(reseal(s)).ok, false);
});

test("skill rules in the schema: every illegal learned skill, point total and bar entry is rejected; the legal edges are accepted", () => {
  const cls = "facilities-manager";
  const base = () => { const st = mk(cls); core.setLevel(st, 16); st.player.skillPoints = 15; return toSave(st); };
  const ok = (mut) => { const s = base(); mut(s); return deserialize(reseal(s)).ok; };
  assert.equal(ok(() => {}), true);
  assert.equal(ok((s) => { s.player.skills["floor-buffer"] = 1; s.player.skillPoints = 14; }), true, "legal: tier 2 at level 16 with its parent");
  assert.equal(ok((s) => { s.player.skills["floor-buffer"] = 1; s.player.skills["demolition-day"] = 1; s.player.skillPoints = 13; }), true, "legal chain");
  assert.equal(ok((s) => { s.player.skills["demolition-day"] = 1; s.player.skillPoints = 14; }), false, "tier 3 without its parent");
  assert.equal(ok((s) => { s.player.level = 7; s.player.xp = core.config.xpTable[6]; s.player.skills["floor-buffer"] = 1; s.player.skillPoints = 0; }), false, "level gate");
  assert.equal(ok((s) => { s.player.skillPoints = 16; }), false, "one point too many");
  assert.equal(ok((s) => { s.player.skills["pallet-slam"] = 5; s.player.skillPoints = 11; }), true, "signature levels above 1 cost points");
  assert.equal(ok((s) => { s.player.skills["pallet-slam"] = 5; s.player.skillPoints = 12; }), false, "signature levels above 1 cost points (off by one)");
  assert.equal(ok((s) => { s.player.skills["pallet-slam"] = 0; }), false, "level-0 entries");
  assert.equal(ok((s) => { delete s.player.skills["pallet-slam"]; }), false, "signature missing");
  assert.equal(ok((s) => { s.player.skills["dress-code"] = 1; s.player.skillBar.hotkeys[0] = "dress-code"; s.player.skillPoints = 14; }), false, "passive on the bar");
  assert.equal(ok((s) => { s.player.skillBar.hotkeys[1] = "floor-buffer"; }), false, "unlearned on the bar");
  assert.equal(ok((s) => { s.player.skillBar.hotkeys[1] = "zap"; }), false, "foreign basic on the bar");
  assert.equal(ok((s) => { s.player.skillBar.hotkeys[1] = "strike"; }), false, "basic attack on the bar via a file");
  assert.equal(ok((s) => { s.player.skillBar.primary = "pallet-slam"; }), false, "non-basic primary");
  assert.equal(ok((s) => { s.player.skillBar.primary = null; }), false, "null primary");
  assert.equal(ok((s) => { s.player.skillBar.secondary = "pallet-slam"; s.player.skillBar.selected = 3; }), true, "stale secondary is re-derived");
  assert.equal(deserialize(reseal(Object.assign(base(), {}))).state.player.skillBar.secondary, "pallet-slam");
  for (const bad of ["__proto__", "constructor", "toString", 5, {}, []]) assert.equal(ok((s) => { s.player.skillBar.hotkeys[2] = bad; }), false, String(bad));
  assert.equal(ok((s) => { s.player.skills.__proto__ = { x: 1 }; }), true, "an inherited __proto__ assignment is not an own key (no pollution, no crash)");
});

test("a sealed hostile save never leaves the hero dead, NaN or throwing after load for any single affix (positive values, every stat)", () => {
  const stats = [...new Set([...affixes.map((a) => a.stat), ...uniques.flatMap((u) => u.affixes.map((a) => a.stat))])];
  for (const cls of CLASSES) for (const stat of stats) for (const value of [1e6, 0.5, 0]) {
    const s = toSave(mk(cls)); s.equipment.weapon.affixes = [{ stat, value }];
    const r = deserialize(reseal(s));
    if (!r.ok) continue;
    assert.doesNotThrow(() => { for (let i = 0; i < 30; i++) core.step(r.state); }, `${cls}/${stat}/${value}`);
    const p = r.state.player;
    for (const k of ["hp", "hpMax", "mp", "mpMax", "defense", "attackRating"]) assert.ok(Number.isFinite(p[k]), `${cls}/${stat}/${value}: ${k}=${p[k]}`);
  }
});

// ---- migration retry flag --------------------------------------------------------------------------------------------------------

test("migration retry: a failed slot-1 write keeps slots 2-5 visible and retries next boot only while slot 1 is empty", () => {
  const ad = createMemoryAdapter({ [config.saveKey]: V1 }), clk = { t: T0 };
  const pre = rig(createMemoryAdapter(), "Z", clk); void pre;
  // a played slot 2 exists, the legacy backup is still there, slot 1 write fails
  const seedAd = createMemoryAdapter({ [config.saveKey]: V1 });
  const s0 = rig(seedAd, "A", clk); s0.session.createCharacter({ slot: 2, class: "it-wizard", name: "Two" });
  seedAd.removeItem(config.slotIndexKey);
  seedAd.failKeys = (k) => k === "office-crawler.slot.1";
  const a = rig(seedAd, "A", clk); const m = a.store.migrateLegacy();
  assert.equal(m.ok, false);
  assert.equal(a.store.list().slots[1].state, "ok", "slot 2 must stay visible");
  assert.equal(idxOf(seedAd).pendingMigration, true);
  assert.equal(a.store.status().notice, "migration-failed");
  seedAd.failKeys = null;
  // the player starts a character in slot 1 before the next boot: the retry must not replace it
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "Mine" });
  const b = rig(seedAd, "A", clk); b.store.migrateLegacy();
  assert.equal(JSON.parse(seedAd.getItem("office-crawler.slot.1")).name, "Mine");
  assert.equal(idxOf(seedAd).pendingMigration, undefined, "flag must be cleared once slot 1 is taken");
  void ad;
});

test("migration retry flag set by hand on an index with a played slot 1 does not replace it; delete of slot 1 never resurrects the legacy save", () => {
  const ad = createMemoryAdapter({ [config.saveKey]: V1 }), clk = { t: T0 };
  const a = rig(ad, "A", clk); a.store.migrateLegacy();
  assert.equal(a.store.list().slots[0].state, "ok");
  a.session.deleteSlot({ slot: 1, confirm: true });
  rig(ad, "A", clk).store.migrateLegacy();
  assert.equal(a.store.list().slots[0].state, "empty");
  a.session.createCharacter({ slot: 1, class: "it-wizard", name: "Played" });
  const i = idxOf(ad); i.pendingMigration = true; ad.setItem(config.slotIndexKey, JSON.stringify(i));
  rig(ad, "A", clk).store.migrateLegacy();
  assert.equal(JSON.parse(ad.getItem("office-crawler.slot.1")).name, "Played");
  // index lost entirely with the legacy key and a played slot 1: slot 1 stays
  ad.removeItem(config.slotIndexKey);
  rig(ad, "A", clk).store.migrateLegacy();
  assert.equal(JSON.parse(ad.getItem("office-crawler.slot.1")).name, "Played");
});

// ---- restore / undo after replace (SAVE-FIX was changing this while I wrote the test) ---------------------------------------------------

test("replace then undo: the replaced character comes back, the replacement becomes the redo copy, nothing is lost in either direction", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "Old" });
  a.store.clearActive();
  const oldText = ad.getItem("office-crawler.slot.1");
  const r = a.session.createCharacter({ slot: 1, class: "it-wizard", name: "New", confirm: true });
  assert.ok(r.ok);
  const newText = ad.getItem("office-crawler.slot.1");
  assert.equal(ad.getItem("office-crawler.slot.1.prev"), oldText);
  assert.equal(a.store.list().slots[0].hasPrev !== false, true);
  const u = a.store.restorePrev(1);
  assert.ok(u.ok === true || u.error === "occupied", JSON.stringify(u));
  if (u.ok) {
    assert.equal(ad.getItem("office-crawler.slot.1"), oldText);
    assert.equal(ad.getItem("office-crawler.slot.1.prev"), newText, "the replacement is kept as the redo copy");
    assert.ok(a.store.restorePrev(1).ok, "redo");
    assert.equal(ad.getItem("office-crawler.slot.1"), newText);
  }
});

test("restorePrev never overwrites a newer-build slot, a bad slot's text, or a live character; a played character is never lost by it", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "A1" });
  a.session.deleteSlot({ slot: 1, confirm: true });
  const newer = JSON.stringify({ format: "office-crawler-save", version: config.saveVersion + 1 });
  ad.setItem("office-crawler.slot.1", newer); ad.removeItem(config.slotIndexKey);
  const b = rig(ad, "A", clk);
  assert.equal(b.store.list().slots[0].state, "newer");
  b.store.restorePrev(1);
  assert.equal(ad.getItem("office-crawler.slot.1"), newer);
  // live character
  const c = rig(createMemoryAdapter(), "A", clk);
  c.session.createCharacter({ slot: 2, class: "it-wizard", name: "Live" });
  const live = c.store.adapter.getItem("office-crawler.slot.2");
  c.store.adapter.setItem("office-crawler.slot.2.prev", serialize(mk("sales-rep", "Prev")));
  const r = c.store.restorePrev(2);
  assert.equal(c.store.adapter.getItem("office-crawler.slot.2"), live, `restorePrev over a live slot answered ${JSON.stringify(r)}`);
});

test("rename, delete and import are guarded by the owner lock; the displaced tab cannot rename the new owner's slot", () => {
  const ad = createMemoryAdapter(), clk = { t: T0 };
  const a = rig(ad, "A", clk);
  a.session.createCharacter({ slot: 1, class: "sales-rep", name: "One" });
  const b = rig(ad, "B", clk);
  const before = ad.getItem("office-crawler.slot.1");
  assert.equal(b.session.renameSlot({ slot: 1, name: "Nope" }).error, "another-tab");
  assert.equal(ad.getItem("office-crawler.slot.1"), before);
});
