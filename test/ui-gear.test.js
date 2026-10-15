// R8-0.3 (ADR-0008 sections 5, AC-R-260-4/-6 unit side): the slot index `look`, the UI bust sanitiser, the owed-reward lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, makeItem as mk0, mint, content, classCards } from "../src/core/index.js";
import { createSlotStore, createMemoryAdapter } from "../src/save/index.js";
import { gearSignature, EMPTY_SIG } from "../src/render/gearlooks.js";
import { validLook } from "../src/save/slots.js";
import { cleanLook } from "../src/ui/slots.js";
import { owedLine } from "../src/ui/messages.js";
import { readFileSync } from "node:fs";

const makeItem = (base, o) => { const it = mk0(base, o); it.slot = it.slot ?? content.items[base]?.slot; return it; };
const hero = (cls = "facilities-manager") => newGame(3, { class: cls, name: "Tester", start: "town" });
const mk = () => { let t = 1000; const adapter = createMemoryAdapter(); return { adapter, store: createSlotStore(adapter, { now: () => (t += 1000) }) }; };

test("AC-R-260-6 the slot index stores the gear signature of the saved equipment; a bare hero has no look field", () => {
  const { store } = mk();
  const s = hero();
  store.create(1, s);
  assert.equal("look" in store.list().slots[0], false, "bare = no field");
  s.equipment.weapon = makeItem("pipe-wrench"); s.equipment.head = makeItem("hard-hat", { rarity: "rare" });
  assert.equal(store.autosave(s, {}, { force: true }).ok, true);
  const e = store.list().slots[0];
  assert.equal(e.look, gearSignature(s.equipment));
  assert.notEqual(e.look, EMPTY_SIG); assert.ok(validLook(e.look));
  // unequipping everything: the next save rewrites the entry without the field
  s.equipment.weapon = null; s.equipment.head = null;
  store.autosave(s, {}, { force: true });
  assert.equal("look" in store.list().slots[0], false);
});

test("the index rebuild from a stored text also carries the look, and does not change the quest fields", () => {
  const { store, adapter } = mk();
  const s = hero("sales-rep"); s.equipment.body = makeItem("blazer"); mint(s, s.equipment.body);
  store.create(2, s);
  const before = store.list().slots[1];
  adapter.removeItem("office-crawler.slots");
  const rebuilt = createSlotStore(adapter, { now: () => 5 });
  rebuilt.migrateLegacy();
  const e = rebuilt.list().slots[1];
  assert.equal(e.look, before.look); assert.equal(e.mainStep, before.mainStep);
});

test("a malformed look is rejected by both validators (bare bust, no error); empty look counts as bare", () => {
  for (const bad of [undefined, null, 5, {}, "", "x", "-|-|-|-|-", "<img>|-|-|-|-|-", "aaaaaaa|-|-|-|-|-", "-|-|-|-|-|-|-", "b1|-|-|-|-|-".repeat(5), "B1|-|-|-|-|-"]) {
    assert.equal(validLook(bad), false, String(bad)); assert.equal(cleanLook(bad), "", String(bad));
  }
  assert.equal(cleanLook(EMPTY_SIG), "");
  assert.equal(cleanLook("b1|-|k0|-|s2|-"), "b1|-|k0|-|s2|-");
});

test("AC-R-260-6 class cards: every class starts with a worn weapon that the signature draws", () => {
  for (const c of classCards()) {
    const base = content.classes.find((k) => k.id === c.id).startKit.weapon;
    assert.ok(base, c.id);
    assert.notEqual(gearSignature({ weapon: makeItem(base) }), EMPTY_SIG, `${c.id}: start weapon ${base} has a look`);
  }
});

test("R8-Q1 owed lines: singular, plural, none", () => {
  assert.equal(owedLine(0), ""); assert.equal(owedLine(1), "1 item waits until your bag has room."); assert.equal(owedLine(3), "3 items wait until your bag has room.");
});

test("CR7L-03 the title backdrop clears the plate drawer (source guard; the e2e checks the pixels)", () => {
  const src = readFileSync("src/game.js", "utf8");
  assert.match(src, /else fx\.plateDraw = null/);
  assert.match(src, /game\.toTitle = \(\) => \{ game\.core = null; fx\.plateDraw = null;/);
});
