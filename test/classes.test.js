// R4-1: the class registry (ADR-0005 section 1, R-200, R-201, R-233).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newGame, step, content, config, classById, classCards, deriveStats, setLevel, retiredClasses, hashState } from "../src/core/index.js";

const sum = (a) => Object.values(a).reduce((x, y) => x + y, 0);
const terms = ["docs/product/ip-denylist.txt", "docs/product/ip-denylist-brands.txt"].flatMap((f) => readFileSync(f, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
const hits = (text) => terms.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text.toLowerCase()));

test("AC-R-200-1 three classes with the contract ids; newGame builds each; an unknown id throws and classById answers undefined", () => {
  assert.deepEqual(content.classes.map((c) => c.id), ["facilities-manager", "sales-rep", "it-wizard"]);
  for (const c of content.classes) { assert.equal(classById(c.id), c); assert.equal(newGame(1, { class: c.id }).player.class, c.id); }
  assert.equal(classById("clerk"), undefined);
  assert.deepEqual(retiredClasses, { clerk: { migrateTo: "facilities-manager" } });
  assert.throws(() => newGame(1, { class: "clerk" }));
});

test("AC-R-201-1 the classes differ pairwise in attributes, growth and basic attack; the attribute sums are equal; no class literal outside the data", () => {
  const cs = content.classes;
  for (let i = 0; i < 3; i++) {
    assert.equal(sum(cs[i].attrs), 44, cs[i].id);
    for (let j = i + 1; j < 3; j++) {
      assert.notDeepEqual(cs[i].attrs, cs[j].attrs); assert.notDeepEqual(cs[i].derived, cs[j].derived); assert.notEqual(cs[i].basic, cs[j].basic);
      assert.notEqual(cs[i].startKit.weapon, cs[j].startKit.weapon); assert.notEqual(cs[i].signature, cs[j].signature);
    }
  }
  assert.deepEqual(cs.map((c) => c.basic), ["strike", "toss", "zap"]);
  assert.deepEqual(cs.map((c) => c.role), ["melee", "ranged", "caster"]);
});

test("class rules: derived keys are a subset of config.derived (plus unarmed), kit bases exist, the signature is a tier-1 skill of the class, ids are kebab-case", () => {
  for (const c of content.classes) {
    assert.match(c.id, /^[a-z]+(-[a-z]+)*$/);
    for (const k of Object.keys(c.derived)) assert.ok(k === "unarmed" || k in config.derived, `${c.id}.${k}`);
    for (const id of [c.startKit.weapon, ...c.startKit.extra]) assert.ok(content.items[id], id);
    const sig = content.skills[c.signature];
    assert.equal(sig.class, c.id); assert.equal(sig.tier, 1); assert.equal(sig.kind, "active");
    assert.equal(content.skills[c.basic].kind, "basic");
    assert.equal(c.figureKey, `hero.${c.id}`);
    assert.deepEqual(c.branches, content.skillTrees[c.id].branches.map((b) => b.id));
    for (const k of ["stance", "potionHp", "priority", "buildOrder", "attrWeights"]) assert.ok(c.bot[k] !== undefined, `${c.id}.bot.${k}`);
    for (const id of c.bot.priority) assert.equal(content.skills[id].class, c.id);
    for (const [id, lv] of c.bot.buildOrder) assert.ok(content.skills[id]?.class === c.id && lv >= 1 && lv <= content.skills[id].maxLevel, `${c.id} ${id}`);
  }
  assert.equal(new Set(content.classes.map((c) => c.affixTag)).size, 3);
});

test("AC-R-201-2 hpMax and mpMax at level 10 equal the start value plus 9 times the class growth", () => {
  for (const c of content.classes) {
    const s = newGame(1, { class: c.id }), hp1 = s.player.hpMax, mp1 = s.player.mpMax;
    setLevel(s, 10);
    assert.equal(s.player.hpMax, hp1 + 9 * c.derived.hpPerLevel, c.id);
    assert.equal(s.player.mpMax, mp1 + 9 * c.derived.mpPerLevel, c.id);
  }
});

test("a new character: signature skill free at level 1 on F1, the class basic attack as primary, class weapon in the bag, potions on the belt", () => {
  for (const c of content.classes) {
    const p = newGame(1, { class: c.id }).player, g = newGame(1, { class: c.id });
    assert.deepEqual(p.skills, { [c.signature]: 1 });
    assert.deepEqual(p.skillBar, { primary: c.basic, secondary: c.signature, hotkeys: [c.signature, null, null, null], selected: 0 });
    assert.equal(p.skillPoints, 0);
    assert.equal(g.inventory.items[0].base, c.startKit.weapon);
    assert.equal(g.belt.filter((b) => b?.restores === "hp").length, c.startKit.healthPotions);
    assert.equal(g.belt.filter((b) => b?.restores === "mp").length, c.startKit.manaPotions);
    assert.equal(p.name, "Employee");
  }
});

test("AC-R-200-2 (core part) every class starts and plays 60 ticks on floor 1; the three classes are different games", () => {
  const hashes = new Set();
  for (const c of content.classes) {
    const s = newGame(5, { class: c.id });
    for (let i = 0; i < 60; i++) step(s);
    assert.equal(s.scene, "floor"); assert.equal(s.depth, 1); assert.equal(s.player.class, c.id);
    hashes.add(hashState(s));
  }
  assert.equal(hashes.size, 3);
});

test("classCards: everything the selection screen needs, from data (name, role, blurb, figure, attributes, preview, branches with skills, signature, basic)", () => {
  const cards = classCards();
  assert.equal(cards.length, 3);
  for (const card of cards) {
    const c = classById(card.id);
    assert.deepEqual([card.name, card.role, card.blurbKey, card.figureKey, card.signature, card.basic], [c.name, c.role, c.blurbKey, c.figureKey, c.signature, c.basic]);
    assert.deepEqual(card.attrs, c.attrs);
    assert.ok(content.strings[card.blurbKey] && card.derivedPreview.hp > 0 && card.derivedPreview.mp > 0 && card.derivedPreview.damage.max >= card.derivedPreview.damage.min);
    assert.equal(card.branches.length, 3);
    assert.equal(card.branches.flatMap((b) => b.skills).length, 10);
    for (const b of card.branches) { assert.ok(content.strings[b.nameKey] && b.name === content.strings[b.nameKey]); for (const s of b.skills) assert.ok(s.iconKey && s.name); }
    // the preview is what the character really starts with when it wears the kit
    const g = newGame(1, { class: c.id, wearStartKit: true });
    assert.equal(card.derivedPreview.hp, g.player.hpMax); assert.deepEqual(card.derivedPreview.damage, g.player.damage);
  }
});

test("AC-R-233-1 class names, blurbs and branch names pass both denylists (safe-default renames in force)", () => {
  const text = [];
  for (const c of content.classes) text.push(c.name, content.strings[c.blurbKey], ...content.skillTrees[c.id].branches.map((b) => content.strings[b.nameKey]));
  assert.ok(terms.includes("fire wall"), "the denylist carries the added term");
  assert.deepEqual(text.flatMap(hits), []);
});

test("deriveStats of a plain player object (no class) is still the pure config formula; a class changes it only through its derived overrides", () => {
  const plain = { level: 3, attrs: { grit: 12, agility: 12, stamina: 12, focus: 12 } };
  const d = config.derived;
  assert.equal(deriveStats(plain, {}).hpMax, d.hpBase + 3 * d.hpPerLevel + 12 * d.hpPerStamina);
  const it = deriveStats({ ...plain, class: "it-wizard" }, {});
  assert.equal(it.mpMax, d.mpBase + 3 * classById("it-wizard").derived.mpPerLevel + 12 * classById("it-wizard").derived.mpPerFocus);
});
