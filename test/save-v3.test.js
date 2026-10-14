// R6 fix round (FIX-R6-CORE): save version 3 (attribute refund for classes whose power attribute changed, ADV-R6-05), the attribute-sum and
// rollable-affix invariants of the importer (ADV-R6-01 = CR6-02), respec with nothing to refund (ADV-R6-02), castRefused events (CR6-07).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, config, content, setLevel, applyDerived, applyInput, respec, respecCheck, learnSkill, rollItem, createRng, mint, castCost } from "../src/core/index.js";
import { deserialize, serialize, toSave, checksumOf, migrate, MIGRATIONS, createSlotStore, createMemoryAdapter } from "../src/save/index.js";
import { autoplace } from "../src/core/items/inventory.js";
import { canonical } from "../src/core/hash.js";
import { gameOn } from "./helpers.js";

const fx = (n) => readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), "utf8");
const reseal = (s) => canonical({ ...s, checksum: checksumOf(s) });
const cls = (id) => content.classes.find((c) => c.id === id);
const ATTRS = ["grit", "agility", "stamina", "focus"];
const hero = (id) => newGame(5, { class: id, name: "V3", start: "town", wearStartKit: true });

// ---- ADV-R6-05: version 3 migration, with real R5-shaped fixtures (version 2, sealed) ----------------------------------------------

test("R5 fixtures are real version 2 saves of the three classes at level 14 with the R5 allocation (all points in Grit, one mixed)", () => {
  for (const [f, id] of [["save-v2-r5-it", "it-wizard"], ["save-v2-r5-sales", "sales-rep"], ["save-v2-r5-fm", "facilities-manager"]]) {
    const j = JSON.parse(fx(f));
    assert.deepEqual([j.version, j.class, j.player.level, j.player.attrPoints], [2, id, 14, 0]);
    assert.equal(j.checksum, checksumOf(j));
    assert.ok(j.inventory.items.filter((i) => i.rarity === "magic" || i.rarity === "rare").length >= 6, "generated magic and rare gear is in the bag");
    assert.ok(config.saveVersion > j.version);
  }
});

test("v2 to v3: an R5 IT Wizard and Sales Rep get every attribute point beyond the class start back, keep everything else, and are told once", () => {
  for (const [f, id, ps] of [["save-v2-r5-it", "it-wizard", 65], ["save-v2-r5-sales", "sales-rep", 65]]) {
    const old = JSON.parse(fx(f)), r = deserialize(fx(f));
    assert.equal(r.ok, true, r.message);
    const p = r.state.player;
    assert.deepEqual(p.attrs, cls(id).attrs, `${id}: attributes back to the class start`);
    assert.equal(p.attrPoints, ps);
    assert.deepEqual(r.notes, [{ from: 2, attributePointsRefunded: ps, attr: cls(id).derived.powerAttr }]);
    assert.equal(r.save.version, config.saveVersion);
    assert.deepEqual([p.level, p.xp, p.gold, p.skillPoints, p.skills], [old.player.level, old.player.xp, old.player.gold, old.player.skillPoints, old.player.skills]);
    assert.deepEqual(r.state.inventory.items.map((i) => i.id), old.inventory.items.map((i) => i.id), "gear kept");
    const again = deserialize(serialize(r.state));          // saved as version 3: loads again without a note or a second refund
    assert.equal(again.ok, true); assert.deepEqual(again.notes, []); assert.equal(again.state.player.attrPoints, ps);
    assert.equal(JSON.parse(serialize(r.state)).version, config.saveVersion);
  }
});

test("v2 to v3: the Facilities Manager (power attribute Grit) keeps its attributes and gets no note", () => {
  const old = JSON.parse(fx("save-v2-r5-fm")), r = deserialize(fx("save-v2-r5-fm"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.player.attrs, old.player.attrs); assert.equal(r.state.player.attrPoints, 0); assert.deepEqual(r.notes, []);
});

test("v2 to v3: a Clerk save (version 1) still migrates through 1 to 2 to 3 and gets no attribute note (it becomes a Facilities Manager)", () => {
  const r = deserialize(readFileSync(new URL("./fixtures/save-v1.json", import.meta.url), "utf8"));
  assert.equal(r.ok, true, r.message); assert.equal(r.save.version, config.saveVersion);
  assert.deepEqual(r.notes.map((n) => n.from), [1]);
});

test("v2 to v3 is idempotent and pure: a version 3 save passes through MIGRATIONS[2] unchanged, the input is not mutated, malformed attributes are left to the schema", () => {
  const v3 = JSON.parse(serialize(hero("it-wizard")));
  assert.deepEqual(MIGRATIONS[2](structuredClone(v3)), v3);
  const old = JSON.parse(fx("save-v2-r5-it")), copy = structuredClone(old);
  migrate(old, 3); assert.deepEqual(old, copy);
  const bad = structuredClone(old); bad.player.attrs.grit = "71"; bad.checksum = checksumOf(bad);
  assert.equal(deserialize(JSON.stringify(bad)).ok, false);
});

test("v2 to v3: a refund that would break the attribute invariant cannot happen (refund + attributes equals what was there)", () => {
  for (const f of ["save-v2-r5-it", "save-v2-r5-sales"]) {
    const old = JSON.parse(fx(f)), m = migrate(old, 3).data, sum = (p) => ATTRS.reduce((n, a) => n + p.attrs[a], 0) + p.attrPoints;
    assert.equal(sum(m.player), sum(old.player));
  }
});

test("the slot store sets status.notice attributes-refunded when it loads or imports a migrated R5 save, and the notice can be dismissed", () => {
  const store = createSlotStore(createMemoryAdapter());
  assert.equal(store.status().notice, null);
  const r = store.importText(1, fx("save-v2-r5-it"));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(store.status().notice, "attributes-refunded"); assert.equal(store.status().noticeAttr, "focus");
  store.dismissNotice(); assert.equal(store.status().notice, null); assert.equal(store.status().noticeAttr, null);
  const sr = createSlotStore(createMemoryAdapter()); sr.importText(1, fx("save-v2-r5-sales")); assert.equal(sr.status().noticeAttr, "agility");
  const l = store.load(1);
  assert.equal(l.ok, true); assert.equal(l.state.player.attrPoints, 65); // the stored text is version 3 already: no second refund
  assert.equal(store.status().notice, null, "a migrated and stored save is not announced twice");
  const fm = createSlotStore(createMemoryAdapter()); fm.importText(1, fx("save-v2-r5-fm")); assert.equal(fm.status().notice, null);
});

// ---- ADV-R6-01: attribute-sum invariant --------------------------------------------------------------------------------------------

test("attribute invariant: start values + 5 per level is the most a save may hold (attributes plus unspent points), one more is refused, for every class and level", () => {
  for (const c of content.classes) for (const level of [1, 2, 14, config.levelCap]) {
    const s = hero(c.id); setLevel(s, level);
    const sv = toSave(s), cap = ATTRS.reduce((n, a) => n + c.attrs[a], 0) + (level - 1) * config.attrPointsPerLevel;
    const total = () => ATTRS.reduce((n, a) => n + sv.player.attrs[a], 0) + sv.player.attrPoints;
    assert.equal(total(), cap, "a game played by the rules sits exactly on the cap");
    assert.equal(deserialize(reseal(sv)).ok, true, `${c.id} L${level} at the cap`);
    sv.player.attrs.focus += 1;
    assert.equal(deserialize(reseal(sv)).ok, false, `${c.id} L${level} one over`);
    sv.player.attrs.focus -= 1; sv.player.attrPoints += 1;
    assert.equal(deserialize(reseal(sv)).ok, false, `${c.id} L${level} one unspent over`);
  }
});

test("attribute invariant: spending points through the game's own allocate keeps every save valid (random split at level 30, all classes)", () => {
  for (const c of content.classes) {
    const s = hero(c.id); setLevel(s, config.levelCap);
    for (let i = 0; s.player.attrPoints > 0; i++) applyInput(s, { t: "allocate", attr: ATTRS[(i * 7 + 3) % 4] });
    assert.equal(deserialize(serialize(s)).ok, true, c.id);
  }
});

// ---- ADV-R6-01b: rollable affixes ----------------------------------------------------------------------------------------------------

const weaponSave = (id = "it-wizard") => { const sv = toSave(hero(id)); return sv; };
const withRolled = (rarity, mut, { slot = "weapon", depth = 6, tag = "it" } = {}) => {
  const s = hero("it-wizard"), rng = createRng(31);
  const it = mint(s, rollItem(rng, { rarity, depth, slot, affixTag: tag }));
  autoplace(s.inventory, it);
  const sv = toSave(s), item = sv.inventory.items.find((i) => i.id === it.id);
  mut?.(item, sv);
  return { sv, item };
};

test("affixes: items rolled by the generator (every slot, depth 1 to 9, magic, rare, unique, every class tag, vendor stock) are accepted by the importer", () => {
  const rng = createRng(2024); let checked = 0;
  for (let round = 0; round < 60; round++) {
    const s = hero(["it-wizard", "sales-rep", "facilities-manager"][round % 3]), tag = cls(s.player.class).affixTag;
    const sl = content.slots.filter((k) => k !== "ring2");
    for (let i = 0; i < 12; i++) {
      const slot = sl[(round + i) % sl.length], rarity = ["magic", "rare", "unique", "normal"][(round + i) % 4];
      const it = mint(s, rollItem(rng, { depth: 1 + ((round * 3 + i) % 9), rarity, slot: slot === "ring1" ? "ring" : slot, affixTag: tag }));
      if (autoplace(s.inventory, it)) checked++;
    }
    const r = deserialize(serialize(s));
    assert.equal(r.ok, true, `${r.reason}: ${r.message} (round ${round})`);
  }
  assert.ok(checked > 400);
});

test("affixes: a forged value, a forged range, an id that is not in the tables, a tier not yet unlocked, a group the slot cannot roll and a repeated group are refused", () => {
  const ok = withRolled("rare");
  assert.equal(deserialize(reseal(ok.sv)).ok, true);
  const bump = (i) => (it) => { it.affixes[i].value = it.affixes[i].range[1] + 1; it.affixes[i].range[1] += 1; };
  assert.equal(deserialize(reseal(withRolled("rare", bump(0)).sv)).ok, false, "value above the table range (self-consistent forgery)");
  assert.equal(deserialize(reseal(withRolled("magic", (it) => { it.affixes[0].id = "nope-t9"; }).sv)).ok, false, "unknown affix id");
  assert.equal(deserialize(reseal(withRolled("magic", (it) => { it.affixes = [{ stat: "focus", value: 900, range: [900, 900] }]; }).sv)).ok, false, "the ADV-R6-01b shape");
  assert.equal(deserialize(reseal(withRolled("magic", (it) => { it.ilvl = 1; it.affixes = [{ id: "grit-t4", group: "grit", kind: "suffix", stat: "grit", name: "x", tier: 4, value: 9, range: [7, 9] }]; }).sv)).ok, false, "tier 4 needs item level 20");
  assert.equal(deserialize(reseal(withRolled("magic", (it) => { it.ilvl = 30; it.affixes = [{ id: "grit-t4", group: "grit", kind: "suffix", stat: "grit", name: "x", tier: 4, value: 9, range: [7, 9] }]; }).sv)).ok, true, "the same affix at item level 30 is a legal roll");
  assert.equal(deserialize(reseal(withRolled("rare", (it) => { it.affixes = [it.affixes[0], it.affixes[0]]; }).sv)).ok, false, "the same group twice");
  assert.equal(deserialize(reseal(withRolled("magic", (it) => { it.affixes = [{ id: "defense-t1", group: "defense", kind: "prefix", stat: "defense", name: "x", tier: 1, value: 3, range: [2, 4] }]; }).sv)).ok, false, "defense cannot roll on a weapon");
  assert.equal(deserialize(reseal(withRolled("normal", (it) => { it.affixes = [{ id: "grit-t1", group: "grit", kind: "suffix", stat: "grit", name: "x", tier: 1, value: 1, range: [1, 2] }]; }).sv)).ok, false, "a normal item has no affixes");
  assert.equal(deserialize(reseal(withRolled("magic", (it) => { it.affixes.push(...it.affixes.map((a) => ({ ...a, group: a.group + "x" }))); }).sv)).ok, false, "more affixes than the rarity allows or group mismatch");
});

test("affixes: a unique carries exactly its fixed affixes; forged base damage or defence is refused", () => {
  const u = withRolled("unique", null, { depth: 9, slot: "weapon" });
  assert.equal(u.item.rarity, "unique"); assert.equal(deserialize(reseal(u.sv)).ok, true);
  const raised = withRolled("unique", (it) => { it.affixes[0].value += 50; it.affixes[0].range = [it.affixes[0].value, it.affixes[0].value]; }, { depth: 9 });
  assert.equal(deserialize(reseal(raised.sv)).ok, false);
  const swapped = withRolled("unique", (it) => { it.unique = "pink-slip"; }, { depth: 9 });
  assert.equal(deserialize(reseal(swapped.sv)).ok, false);
  const dmg = withRolled("magic", (it) => { it.damage = { min: 900, max: 900 }; });
  assert.equal(deserialize(reseal(dmg.sv)).ok, false);
  const def = withRolled("magic", (it) => { it.defense = 9999; }, { slot: "body" });
  assert.equal(deserialize(reseal(def.sv)).ok, false);
});

// ---- ADV-R6-02: respec with nothing to refund ----------------------------------------------------------------------------------------

function inMode(mode, extra, fn) {
  const old = { ...config.respec };
  Object.assign(config.respec, { mode, ...extra });
  try { fn(); } finally { Object.assign(config.respec, old); }
}
const bare = () => { const s = hero("it-wizard"); setLevel(s, 16); s.player.gold = 1000; return s; };

test("respec with nothing to refund: modes gold and once answer nothing-to-respec (error and reason), charge nothing and keep the one respec; mode free stays harmless", () => {
  inMode("gold", { goldBase: 50, goldPerLevel: 10 }, () => {
    const s = bare(), before = JSON.stringify(s.player);
    assert.equal(respecCheck(s), "nothing-to-respec");
    assert.deepEqual(respec(s), { ok: false, error: "nothing-to-respec", reason: "nothing-to-respec" });
    assert.equal(JSON.stringify(s.player), before, "nothing changed, no gold taken");
    assert.equal(applyInput(s, { t: "respec" }).ok, false);
    learnSkill(s, "server-overheat"); assert.equal(respecCheck(s), null); assert.ok(respec(s).ok); assert.equal(s.player.gold, 1000 - 210);
  });
  inMode("once", {}, () => {
    const s = bare();
    assert.equal(respec(s).reason, "nothing-to-respec"); assert.equal(s.player.respecsUsed, 0);
    learnSkill(s, "server-overheat"); assert.ok(respec(s).ok); assert.equal(s.player.respecsUsed, 1);
    learnSkill(s, "server-overheat"); assert.equal(respec(s).error, "respec-used", "used-up beats nothing-to-respec only when something is learned; here it is used");
  });
  inMode("free", {}, () => { const s = bare(); assert.equal(respec(s).ok, true); });
});

// ---- CR6-07: castRefused ---------------------------------------------------------------------------------------------------------------

const ROOM = ["####################", "#@.................#", "#..................#", "#..................#", "####################"];
const refusedOf = (st) => st.events.filter((e) => e.type === "castRefused");
function ready(id, klass) {
  const st = gameOn(ROOM, [["zombie-intern", 7, 2]], 3, { class: klass });
  setLevel(st, 20); st.player.skills[id] = 3; applyDerived(st, { fill: true }); st.player.mp = st.player.mpMax;
  return st;
}

test("castRefused: no-direction (projectile at the own tile), no-target (no tile) and no-mana are emitted with skill and reason; a good cast emits none", () => {
  const st = ready("power-surge", "it-wizard");
  assert.equal(applyInput(st, { t: "cast", skill: "power-surge", tile: { ...st.player.tile } }).ok, false);
  assert.deepEqual(refusedOf(st).map((e) => [e.type, e.t, e.skill, e.reason]), [["castRefused", "castRefused", "power-surge", "no-direction"]]);
  st.events.length = 0;
  assert.equal(applyInput(st, { t: "cast", skill: "power-surge" }).ok, false);
  assert.deepEqual(refusedOf(st).map((e) => e.reason), ["no-target"]);
  st.events.length = 0; st.player.mp = 0;
  applyInput(st, { t: "cast", skill: "power-surge", tile: { x: 7, y: 2 } });
  assert.deepEqual(refusedOf(st).map((e) => e.reason), ["no-mana"]);
  assert.ok(st.events.some((e) => e.type === "noMana"), "the noMana event is still emitted");
  st.events.length = 0; st.player.mp = st.player.mpMax;
  assert.equal(applyInput(st, { t: "cast", skill: "power-surge", tile: { x: 7, y: 2 } }).ok, true);
  assert.deepEqual(refusedOf(st), []);
  const dash = ready("pallet-slam", "facilities-manager"); dash.events.length = 0;
  assert.ok(castCost(dash, content.skills["pallet-slam"], 3) > 0);
});

test("castRefused: only the reasons the UI has texts for are ever emitted (no-direction, no-target, no-mana); other refusals (busy, out of range) stay silent", () => {
  const st = ready("power-surge", "it-wizard");
  for (const tile of [undefined, { ...st.player.tile }, { x: 7, y: 2 }, { x: 99, y: 99 }]) { applyInput(st, { t: "cast", skill: "power-surge", tile }); applyInput(st, { t: "cast", skill: "unknown-skill", tile }); }
  for (const e of refusedOf(st)) assert.ok(["no-direction", "no-target", "no-mana"].includes(e.reason), e.reason);
});

test("every unique item survives a save round trip (affix ids such as unique-resist.fire contain a dot; before R6 fix four uniques made the save unloadable)", () => {
  for (const u of content.uniques) {
    const s = hero("facilities-manager"), it = mint(s, rollItem(createRng(1), { rarity: "unique", depth: 9, base: u.base, ilvl: 40 }));
    assert.equal(it.unique, u.id); autoplace(s.inventory, it);
    const r = deserialize(serialize(s));
    assert.equal(r.ok, true, `${u.id}: ${r.message}`);
  }
});
