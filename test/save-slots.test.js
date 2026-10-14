// Five save slots (ADR-0006, R-220..R-227, NFR-D05/D06): index, isolation, atomicity, quota ladder, migration, import / export, session commands.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, step, config, makeItem, mint, autoplace, rollItem, createRng, setLevel, content } from "../src/core/index.js";
import { createSlotStore, createSession, slotsView, createMemoryAdapter, deserialize, serialize, textSum } from "../src/save/index.js";

const hero = (cls = "facilities-manager", name = "Tester", seed = 3) => newGame(seed, { class: cls, name, start: "town" });
const clock = () => { let t = 1000; return () => (t += 1000); };
const mk = (opts = {}) => { const adapter = createMemoryAdapter(); const notices = []; const store = createSlotStore(adapter, { now: clock(), onNotice: (k) => notices.push(k), ...opts }); return { adapter, store, notices }; };
const texts = (adapter) => Object.fromEntries(adapter.keys().map((k) => [k, adapter.getItem(k)]));
const slotKeys = (adapter) => adapter.keys().filter((k) => /^office-crawler\.slot\.\d$/.test(k)).sort();

test("AC-R-220-1 five slots hold five characters; slot 0 and 6 are refused; storage holds five slot keys, the index and options", () => {
  const { store, adapter } = mk();
  for (let n = 1; n <= 5; n++) assert.equal(store.create(n, hero(content.classes[n % 3].id, `Hero ${n}`)).ok, true);
  assert.deepEqual(store.create(0, hero()), { ok: false, error: "bad-slot" });
  assert.equal(store.create(6, hero()).error, "bad-slot");
  store.saveOptions({ volume: 0.5 });
  assert.deepEqual(adapter.keys().sort(), [...slotKeys(adapter), "office-crawler.options", "office-crawler.slots"].sort());
  assert.equal(slotKeys(adapter).length, 5);
});

test("ADR-0006 section 2: the index has the documented shape and listing reads one key without parsing any slot", () => {
  const { store, adapter } = mk();
  store.create(2, hero("sales-rep", "Dana Lee"));
  store.create(4, hero("it-wizard", "Byte"));
  let reads = [];
  const spy = { ...adapter, getItem: (k) => { reads.push(k); return adapter.getItem(k); } };
  const view = createSlotStore(spy, { now: clock() }).list();
  assert.deepEqual(reads, ["office-crawler.slots"]);
  assert.equal(view.v, 2); assert.equal(view.slots.length, 5);
  assert.deepEqual(view.slots.map((e) => e.state), ["empty", "ok", "empty", "ok", "empty"]);
  const e = view.slots[1];
  assert.deepEqual(Object.keys(e).sort(), ["boss", "bytes", "class", "deepest", "depth", "lastPlayed", "level", "n", "name", "playSec", "state", "sum"].sort());
  assert.equal(e.name, "Dana Lee"); assert.equal(e.class, "sales-rep"); assert.equal(e.level, 1); assert.equal(e.depth, 0);
  assert.equal(e.bytes, adapter.getItem("office-crawler.slot.2").length);
  assert.equal(e.sum, textSum(adapter.getItem("office-crawler.slot.2")));
  assert.equal(view.active, 4); assert.equal(view.last, 4);
});

test("AC-R-224-1 100 autosaves in the active slot leave slots 1, 3, 4, 5 and their index entries byte-identical; keys do not grow", () => {
  const { store, adapter } = mk();
  for (const n of [1, 3, 4, 5]) store.create(n, hero("sales-rep", `Other ${n}`, n));
  const g = hero("it-wizard", "Runner"); store.create(2, g);
  assert.equal(store.setActive(2).ok, true);
  const before = texts(adapter), idx0 = store.list().slots.map((e) => JSON.stringify(e));
  const keys0 = adapter.keys().length;
  for (let i = 0; i < 100; i++) { for (let t = 0; t < 40; t++) step(g); store.autosave(g, { type: "autosave", reason: "floor" }); }
  const after = texts(adapter);
  for (const n of [1, 3, 4, 5]) { assert.equal(after[`office-crawler.slot.${n}`], before[`office-crawler.slot.${n}`]); assert.equal(JSON.stringify(store.list().slots[n - 1]), idx0[n - 1]); }
  assert.notEqual(after["office-crawler.slot.2"], before["office-crawler.slot.2"]);
  assert.equal(adapter.keys().length, keys0);
  assert.equal(store.list().slots[1].playSec, Math.floor(g.stats.playTicks / config.tickHz));
});

test("autosave coalesces writes closer than autosaveMinTicks, always writes on force and victory, and needs an active slot", () => {
  const { store } = mk();
  const g = hero(); store.create(1, g);
  assert.equal(store.autosave(g, {}).skipped, true);
  for (let i = 0; i < config.autosaveMinTicks; i++) step(g);
  assert.equal(store.autosave(g, {}).skipped, undefined);
  assert.equal(store.autosave(g, {}).skipped, true);
  assert.equal(store.autosave(g, { reason: "victory" }).ok, true);
  store.clearActive();
  assert.deepEqual(store.autosave(g, {}), { ok: false, error: "no-active-slot" });
});

test("R-221 create over an occupied slot needs confirm and names the character; delete needs confirm; the other slots and options stay", () => {
  const { store, adapter } = mk();
  store.create(1, hero("sales-rep", "Keeper")); store.create(2, hero("it-wizard", "Victim"));
  store.saveOptions({ a: 1 });
  const before = texts(adapter);
  assert.deepEqual(store.create(2, hero()), { ok: false, error: "occupied", lost: "Victim" });
  assert.equal(adapter.getItem("office-crawler.slot.2"), before["office-crawler.slot.2"]);
  assert.equal(store.create(2, hero("facilities-manager", "Fresh"), { confirm: true }).ok, true);
  assert.equal(store.list().slots[1].name, "Fresh");
  assert.equal(adapter.getItem("office-crawler.slot.2.prev"), before["office-crawler.slot.2"], "one undo copy of the replaced character");
  assert.equal(store.remove(1).error, "confirm-required");
  assert.equal(adapter.getItem("office-crawler.slot.1"), before["office-crawler.slot.1"]);
  assert.equal(store.remove(1, { confirm: true }).ok, true);
  assert.equal(adapter.getItem("office-crawler.slot.1"), null);
  assert.equal(store.list().slots[0].state, "empty");
  assert.equal(adapter.getItem("office-crawler.options"), before["office-crawler.options"]);
  assert.equal(store.restorePrev(1).ok, true, "delete keeps an undo copy");
  assert.equal(store.list().slots[0].name, "Keeper");
});

test("R-221 rename changes only the name; an invalid name leaves the slot unchanged", () => {
  const { store, adapter } = mk();
  const g = hero("sales-rep", "Old Name"); setLevel(g, 7); g.player.gold = 321; store.create(3, g);
  const before = adapter.getItem("office-crawler.slot.3");
  assert.equal(store.rename(3, "<b>x</b>").error, "bad-name");
  assert.equal(adapter.getItem("office-crawler.slot.3"), before);
  assert.deepEqual(store.rename(3, "  New   Name "), { ok: true, name: "New Name" });
  const r = deserialize(adapter.getItem("office-crawler.slot.3"));
  assert.equal(r.ok, true);
  assert.equal(r.state.player.name, "New Name"); assert.equal(r.state.player.level, 7); assert.equal(r.state.player.gold, 321);
  assert.equal(store.list().slots[2].name, "New Name");
});

test("AC-R-221-4 / R-222 load gives back the saved character and a slot preview: name, class, level, depth, play time from ticks", () => {
  const { store } = mk();
  const g = hero("it-wizard", "Loader"); setLevel(g, 9); for (let i = 0; i < 600; i++) step(g);
  store.create(3, g);
  const r = store.load(3);
  assert.equal(r.ok, true);
  assert.equal(r.state.player.class, "it-wizard"); assert.equal(r.state.player.name, "Loader"); assert.equal(r.state.player.level, 9);
  assert.deepEqual(r.state.player.skills, g.player.skills); assert.deepEqual(r.state.player.skillBar, g.player.skillBar);
  assert.equal(r.state.stats.playTicks, 600);
  const e = store.list().slots[2];
  assert.equal(e.playSec, 10); assert.equal(e.level, 9); assert.equal(e.class, "it-wizard");
  assert.equal(store.load(1).error, "empty-slot"); assert.equal(store.load(9).error, "bad-slot");
});

test("R-227 a damaged slot becomes bad, its text is kept for export, the title still loads and the other slots work; a newer slot is never touched", () => {
  const { store, adapter, notices } = mk();
  store.create(1, hero("sales-rep", "Good One")); store.create(3, hero("it-wizard", "Doomed")); store.create(4, hero("facilities-manager", "Future"));
  const text3 = adapter.getItem("office-crawler.slot.3");
  adapter.setItem("office-crawler.slot.3", text3.slice(0, 200)); // truncated
  const future = JSON.parse(adapter.getItem("office-crawler.slot.4")); future.version = 99;
  adapter.setItem("office-crawler.slot.4", JSON.stringify(future));
  const s2 = createSlotStore(adapter, { now: clock(), onNotice: (k) => notices.push(k) });
  s2.list(); adapter.removeItem("office-crawler.slots"); // an index that has to be rebuilt from the slot keys
  const rebuilt = s2.list();
  assert.deepEqual(rebuilt.slots.map((e) => e.state), ["ok", "empty", "bad", "newer", "empty"]);
  assert.equal(rebuilt.slots[2].reason, "parse");
  assert.equal(s2.load(3).error, "corrupt");
  assert.equal(adapter.getItem("office-crawler.slot.3"), null);
  assert.equal(adapter.getItem("office-crawler.slot.3.bad"), text3.slice(0, 200));
  assert.equal(s2.exportText(3, "bad").text, text3.slice(0, 200));
  assert.ok(notices.includes("slotCorrupt"));
  assert.equal(s2.load(1).ok, true);
  const newerText = adapter.getItem("office-crawler.slot.4");
  assert.equal(s2.load(4).error, "newer");
  assert.equal(s2.create(4, hero(), { confirm: true }).error, "newer");
  assert.equal(s2.write(4, hero()).error, "newer");
  assert.equal(adapter.getItem("office-crawler.slot.4"), newerText, "a save from a newer build is never overwritten");
});

test("AC-R-227-2 a failing write for one slot keeps the game running, keeps that slot's last good text and does not hurt another slot", () => {
  const { store, adapter, notices } = mk();
  const a = hero("sales-rep", "A", 1), b = hero("it-wizard", "B", 2);
  store.create(2, a); store.create(4, b);
  const good2 = adapter.getItem("office-crawler.slot.2");
  adapter.failKeys = (k) => k === "office-crawler.slot.2";
  for (let i = 0; i < 40; i++) step(a);
  const r = store.write(2, a);
  assert.equal(r.ok, false);
  assert.ok(notices.includes("saveFailed") || notices.includes("storageFull"));
  assert.equal(adapter.getItem("office-crawler.slot.2"), good2);
  assert.equal(store.write(4, b).ok, true);
});

test("ADR-0006 section 6/7 a slot over 400 000 characters is refused with too-large and the old save stays; worst-case characters fit (NFR-D05-1)", () => {
  const { store, adapter } = mk();
  const g = hero(); store.create(1, g);
  const old = adapter.getItem("office-crawler.slot.1");
  g.player.name = "Big";
  const rng = createRng(4);
  g.uniquesFound = Array.from({ length: 100 }, (_, i) => "x".repeat(60) + i);
  const saved = config.slotMaxBytes; config.slotMaxBytes = 5000;
  try { assert.deepEqual(store.write(1, g), { ok: false, error: "too-large" }); } finally { config.slotMaxBytes = saved; }
  assert.equal(adapter.getItem("office-crawler.slot.1"), old);
  // worst case: level 30, every skill at its maximum, full inventory and stash of rare rings with five affixes
  const worst = (cls, seed) => {
    const w = hero(cls, "Worst Case Name", seed); setLevel(w, 30);
    for (const s of Object.values(content.skills)) if (s.class === cls) w.player.skills[s.id] = s.maxLevel;
    for (const grid of [w.inventory, w.stash]) while (true) { const it = mint(w, rollItem(rng, { base: "paperclip-ring", rarity: "rare", ilvl: 30 })); if (!autoplace(grid, it)) break; }
    return w;
  };
  const rep = createSlotStore(createMemoryAdapter(), { now: clock() });
  content.classes.forEach((c, i) => assert.equal(rep.create(i + 1, worst(c.id, i + 1)).ok, true));
  rep.create(4, worst("sales-rep", 9)); rep.create(5, worst("it-wizard", 10));
  rep.saveOptions({ volume: 1 });
  const total = rep.keys().reduce((n, k) => n + rep.adapter.getItem(k).length, 0);
  for (let n = 1; n <= 5; n++) assert.ok(rep.raw(n).length <= config.slotMaxBytes, `slot ${n}: ${rep.raw(n).length}`);
  assert.ok(total < config.storageMaxBytes, `total ${total}`);
});

test("ADR-0006 section 6 a crash between the slot write and the index write is repaired when the slot is opened", () => {
  const { store, adapter } = mk();
  const g = hero("sales-rep", "Crash"); store.create(1, g);
  for (let i = 0; i < 60; i++) step(g); setLevel(g, 5);
  adapter.failKeys = (k) => k === "office-crawler.slots"; // the slot write lands, the index write does not
  const r = store.write(1, g);
  assert.equal(r.ok, true); assert.equal(r.indexed, false);
  adapter.failKeys = null;
  assert.equal(store.list().slots[0].level, 1, "the index is stale");
  assert.equal(store.load(1).state.player.level, 5);
  assert.equal(store.list().slots[0].level, 5, "opening the slot repaired the entry");
  assert.equal(store.list().slots[0].sum, textSum(adapter.getItem("office-crawler.slot.1")));
});

test("ADR-0006 section 2 a missing or damaged index is rebuilt from the slot keys; unparsable index text too", () => {
  const { store, adapter } = mk();
  store.create(1, hero("sales-rep", "One")); store.create(5, hero("it-wizard", "Five"));
  const want = store.list().slots.map((e) => ({ ...e, lastPlayed: undefined }));
  adapter.setItem("office-crawler.slots", "{not json");
  const got = store.list();
  assert.deepEqual(got.slots.map((e) => ({ ...e, lastPlayed: undefined })), want);
  adapter.removeItem("office-crawler.slots");
  assert.equal(store.list().slots[4].name, "Five");
  assert.ok(adapter.getItem("office-crawler.slots"), "the rebuilt index is stored");
});

test("ADR-0006 section 7 the quota ladder frees space in the fixed order: legacy backups, stray .bad, other slots' .prev, the legacy save (only when slot 1 is ok)", () => {
  const { store, adapter } = mk();
  store.create(1, hero("sales-rep", "Slot One")); store.create(2, hero("it-wizard", "Slot Two"));
  const pad = (n) => "x".repeat(n);
  adapter.setItem("office-crawler.save.corrupt", pad(1000)); adapter.setItem("office-crawler.save.corrupt.1", pad(1000));
  adapter.setItem("office-crawler.slot.3.bad", pad(1000)); adapter.setItem("office-crawler.slot.1.prev", pad(1000)); adapter.setItem("office-crawler.slot.2.prev", pad(1000));
  adapter.setItem("office-crawler.save", pad(1000));
  store.setActive(2);
  const saved = config.storageSoftCeiling;
  const used = () => store.usage().chars;
  const g = hero("it-wizard", "Slot Two");
  const present = () => ["office-crawler.save.corrupt", "office-crawler.slot.3.bad", "office-crawler.slot.1.prev", "office-crawler.slot.2.prev", "office-crawler.save"].map((k) => adapter.getItem(k) !== null);
  try {
    config.storageSoftCeiling = used() + 10;            // a rewrite of slot 2 needs a little room: only step one runs
    assert.equal(store.write(2, g).ok, true);
    assert.deepEqual(present(), [false, true, true, true, true]);
    config.storageSoftCeiling = used() - 500;           // now the stray .bad has to go, then the non-active .prev
    assert.equal(store.write(2, g).ok, true);
    assert.equal(adapter.getItem("office-crawler.slot.3.bad"), null);
    assert.equal(adapter.getItem("office-crawler.slot.2.prev") !== null, true, "the active slot keeps its undo copy");
    config.storageSoftCeiling = 1;                      // nothing can fit: the ladder runs to its end and then reports quota
    const r = store.write(2, g);
    assert.deepEqual([r.ok, r.error], [false, "quota"]);
    assert.equal(adapter.getItem("office-crawler.save"), null, "the legacy save went last, and only because slot 1 reads ok");
    assert.ok(store.load(1).ok && store.load(2).ok, "no slot in state ok was ever deleted");
  } finally { config.storageSoftCeiling = saved; }
});

test("R-226 an exported slot imports into another slot as the same character; a garbage file leaves all slots unchanged", () => {
  const { store, adapter } = mk();
  const g = hero("sales-rep", "Exporter"); setLevel(g, 12); store.create(2, g);
  store.create(4, hero("it-wizard", "Overwritten")); store.create(1, hero("facilities-manager", "Bystander"));
  const ex = store.exportText(2);
  assert.match(ex.filename, /^office-crawler-slot-2-exporter\.json$/);
  const before = texts(adapter);
  assert.equal(store.importText(4, ex.text).error, "occupied");
  assert.deepEqual(texts(adapter), before);
  assert.equal(store.importText(4, "not a save", { confirm: true }).error, "corrupt");
  assert.equal(store.importText(4, JSON.stringify({ format: "x" }), { confirm: true }).error, "corrupt");
  assert.deepEqual(texts(adapter), before);
  assert.equal(store.importText(4, ex.text, { confirm: true }).ok, true);
  const [a, b] = [store.list().slots[1], store.list().slots[3]];
  assert.deepEqual({ ...a, n: 0, lastPlayed: 0 }, { ...b, n: 0, lastPlayed: 0 });
  for (const n of [1, 2]) assert.equal(adapter.getItem(`office-crawler.slot.${n}`), before[`office-crawler.slot.${n}`]);
  assert.equal(adapter.getItem("office-crawler.slot.4.prev"), before["office-crawler.slot.4"]);
  assert.equal(store.copy(2, 5).ok, true);
  assert.equal(store.list().slots[4].name, "Exporter");
});

test("R-225 migrateLegacy: the v1 Clerk save lands in slot 1 as a Facilities Manager; legacy keys stay; running it again changes nothing", () => {
  const v1 = readFileSync("test/fixtures/save-v1.json", "utf8");
  const adapter = createMemoryAdapter({ "office-crawler.save": v1, "office-crawler.save.corrupt": "old backup" });
  const notices = [];
  const store = createSlotStore(adapter, { now: clock(), onNotice: (k, x) => notices.push([k, x]) });
  const r = store.migrateLegacy();
  assert.equal(r.ok, true);
  assert.deepEqual(r.migrated, { from: 1, refundedPoints: 4 });
  assert.deepEqual(notices[0], ["slotMigrated", { from: 1, refundedPoints: 4 }]);
  const e = store.list().slots[0];
  assert.deepEqual([e.state, e.class, e.level, e.name, e.deepest], ["ok", "facilities-manager", 12, "Employee", 4]);
  assert.equal(store.list().last, 1);
  assert.equal(adapter.getItem("office-crawler.save"), v1);
  assert.equal(adapter.getItem("office-crawler.save.corrupt"), "old backup");
  const loaded = store.load(1);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.player.skillPoints, 7 + 4);
  assert.equal(loaded.state.stash.items.length, 1);
  assert.equal(loaded.state.player.gold, 777);
  const snap = texts(adapter);
  assert.deepEqual(store.migrateLegacy(), { ok: true, skipped: true });
  assert.deepEqual(texts(adapter), snap);
});

test("R-225 migrateLegacy: a crash before the index is written repeats the same result; no legacy key gives an empty index", () => {
  const v1 = readFileSync("test/fixtures/save-v1.json", "utf8");
  const adapter = createMemoryAdapter({ "office-crawler.save": v1 });
  const store = createSlotStore(adapter, { now: clock() });
  adapter.failKeys = (k) => k === "office-crawler.slots";
  store.migrateLegacy();
  adapter.failKeys = null;
  assert.equal(adapter.getItem("office-crawler.slots"), null, "no index: the migration did not complete");
  const slot1 = adapter.getItem("office-crawler.slot.1");
  assert.equal(store.migrateLegacy().ok, true);
  assert.equal(adapter.getItem("office-crawler.slot.1"), slot1, "the same text again");
  const empty = createSlotStore(createMemoryAdapter(), { now: clock() });
  assert.deepEqual(empty.migrateLegacy().index.slots.map((e) => e.state), Array(5).fill("empty"));
});

test("AC-R-225-4 a corrupt or newer legacy save never throws: slot 1 is bad (text kept for export) or newer (left alone)", () => {
  for (const [text, state] of [["{\"format\":\"office-crawler-save\",\"version\":1,", "bad"], [JSON.stringify({ format: "office-crawler-save", version: 99 }), "newer"], ["garbage", "bad"]]) {
    const adapter = createMemoryAdapter({ "office-crawler.save": text });
    const store = createSlotStore(adapter, { now: clock() });
    assert.equal(store.migrateLegacy().ok, true);
    assert.equal(store.list().slots[0].state, state);
    assert.equal(adapter.getItem("office-crawler.slot.1"), null);
    assert.equal(adapter.getItem("office-crawler.save"), text);
    if (state === "bad") assert.equal(store.exportText(1, "bad").text, text);
    assert.deepEqual(store.list().slots.slice(1).map((e) => e.state), Array(4).fill("empty"));
  }
});

test("R-224 / R-225 Continue opens the last used slot, else the most recent ok slot, else nothing", () => {
  const { store } = mk();
  assert.equal(store.lastUsed(), null);
  store.create(1, hero()); store.create(3, hero("sales-rep", "Later")); store.create(2, hero("it-wizard", "Latest"));
  assert.equal(store.lastUsed(), 2);
  store.remove(2, { confirm: true });
  assert.equal(store.lastUsed(), 3, "the most recently played ok slot");
});

test("ADR-0006 section 6 another tab owning the index blocks writes with a notice; options are global and untouched by slot operations", () => {
  const adapter = createMemoryAdapter(), notices = [];
  const a = createSlotStore(adapter, { now: clock(), tabId: "tab-a", onNotice: (k) => notices.push(k) });
  const b = createSlotStore(adapter, { now: clock(), tabId: "tab-b", onNotice: (k) => notices.push(k) });
  const g = hero(); a.create(1, g);
  assert.equal(a.list().owner, "tab-a");
  assert.equal(b.write(1, g).error, "another-tab");
  assert.ok(notices.includes("anotherTab"));
  a.saveOptions({ volume: 0.2 });
  a.remove(1, { confirm: true });
  assert.deepEqual(a.loadOptions(), { volume: 0.2 });
});

test("session commands: createCharacter validates and starts a town game with the class kit; loadSlot saves the running game first; deleteSlot needs confirm", () => {
  const { store, adapter } = mk();
  const session = createSession(store, { seedSource: () => 77 });
  assert.equal(session.createCharacter({ slot: 7, class: "sales-rep", name: "X" }).error, "bad-slot");
  assert.equal(session.createCharacter({ slot: 1, class: "wizard", name: "X" }).error, "bad-class");
  assert.equal(session.createCharacter({ slot: 1, class: "sales-rep", name: "" }).error, "bad-name");
  const made = session.createCharacter({ slot: 1, class: "sales-rep", name: "  Dana  " });
  assert.equal(made.ok, true);
  assert.equal(made.state.player.name, "Dana"); assert.equal(made.state.player.class, "sales-rep"); assert.equal(made.state.scene, "town"); assert.equal(made.state.seed, 77);
  assert.equal(made.state.equipment.weapon.base, "letter-opener");
  assert.equal(store.list().active, 1);
  const second = session.createCharacter({ slot: 2, class: "it-wizard", name: "Bit" }, made.state);
  assert.equal(second.ok, true);
  setLevel(second.state, 6); second.state.player.gold = 999;
  const back = session.loadSlot({ slot: 1 }, second.state);
  assert.equal(back.ok, true); assert.equal(back.state.player.name, "Dana");
  assert.equal(deserialize(adapter.getItem("office-crawler.slot.2")).state.player.level, 6, "the running game was saved first");
  assert.equal(store.list().active, 1);
  assert.deepEqual(session.createCharacter({ slot: 2, class: "sales-rep", name: "Over" }), { ok: false, error: "occupied", lost: "Bit" });
  assert.equal(session.deleteSlot({ slot: 2 }).error, "confirm-required");
  assert.equal(session.deleteSlot({ slot: 2, confirm: true }).ok, true);
  assert.equal(session.continue().state.player.name, "Dana");
  assert.equal(session.run({ t: "selectSlot", slot: 4 }).ok, true);
  assert.equal(session.highlighted, 4);
  assert.equal(session.run({ t: "bogus" }), null);
  const view = slotsView(store, session.highlighted);
  assert.deepEqual([view.active, view.last, view.highlighted], [1, 1, 4]);
  assert.equal(view.index.slots.length, 5);
});

test("AC-R-234-2 / NFR-D06 every class survives serialize, store, load: the loaded game continues identically to the original", () => {
  for (const c of content.classes) {
    const { store } = mk();
    const a = hero(c.id, "Same");
    for (let i = 0; i < 120; i++) step(a);
    store.create(1, a);
    const b = store.load(1).state;
    assert.equal(serialize(b), serialize(a));
  }
});
