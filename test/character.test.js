import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, content, config, deriveStats, applyDerived, setSeedSource, hashState, makeItem, mint, equipItem, autoplace } from "../src/core/index.js";
import { gameOn, OPEN } from "./helpers.js";

const ATTRS = ["grit", "agility", "stamina", "focus"];

test("AC-R-010-1 content.classes holds exactly one melee class with a non-empty name", () => {
  assert.equal(content.classes.length, 1);
  assert.equal(content.classes[0].kind, "melee");
  assert.ok(content.classes[0].name.length > 0);
});

test("AC-R-010-2 a new player of the class starts at level 1 with class attributes, config gold and a positive damage range", () => {
  const p = newGame(1, { class: content.classes[0].id }).player;
  assert.equal(p.level, 1); assert.equal(p.xp, 0);
  assert.ok(p.hp === p.hpMax && p.hpMax > 0 && p.mp === p.mpMax && p.mpMax > 0);
  assert.equal(p.gold, config.startGold);
  assert.deepEqual(p.attrs, content.classes[0].attrs);
  assert.ok(p.damage.min > 0 && p.damage.min <= p.damage.max);
});

test("AC-R-010-3 no class argument uses the only class; an unknown class throws", () => {
  assert.equal(newGame(1).player.class, content.classes[0].id);
  assert.throws(() => newGame(1, { class: "nope" }));
});

test("AC-R-011-1 attrs have exactly grit, agility, stamina, focus as integers >= 1", () => {
  const p = newGame(1).player;
  assert.deepEqual(Object.keys(p.attrs).sort(), [...ATTRS].sort());
  for (const k of ATTRS) assert.ok(Number.isInteger(p.attrs[k]) && p.attrs[k] >= 1);
});

test("AC-R-011-2 each attribute point raises exactly the stats its formula names", () => {
  const base = newGame(1).player, d0 = deriveStats(base, {});
  const up = (k) => deriveStats({ ...base, attrs: { ...base.attrs, [k]: base.attrs[k] + 1 } }, {});
  const g = up("grit");
  assert.ok(g.damage.min > d0.damage.min && g.damage.max > d0.damage.max);
  assert.deepEqual([g.hpMax, g.mpMax, g.defense, g.attackRating], [d0.hpMax, d0.mpMax, d0.defense, d0.attackRating]);
  const a = up("agility");
  assert.ok(a.defense > d0.defense && a.attackRating > d0.attackRating); // attack rating feeds hitChance
  assert.deepEqual([a.hpMax, a.mpMax, a.damage], [d0.hpMax, d0.mpMax, d0.damage]);
  const s = up("stamina");
  assert.ok(s.hpMax > d0.hpMax);
  assert.deepEqual([s.mpMax, s.defense, s.damage], [d0.mpMax, d0.defense, d0.damage]);
  const f = up("focus");
  assert.ok(f.mpMax > d0.mpMax);
  assert.deepEqual([f.hpMax, f.defense, f.damage], [d0.hpMax, d0.defense, d0.damage]);
});

test("AC-R-012-1 deriveStats follows the config formulas, is pure and rounds as configured", () => {
  const d = config.derived, p = { level: 4, attrs: { grit: 15, agility: 12, stamina: 20, focus: 9 } };
  const before = JSON.stringify(p), s = deriveStats(p, {});
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(deriveStats(p, {}), s);
  assert.equal(s.hpMax, d.hpBase + 4 * d.hpPerLevel + 20 * d.hpPerStamina);
  assert.equal(s.mpMax, d.mpBase + 4 * d.mpPerLevel + 9 * d.mpPerFocus);
  assert.equal(s.damage.min, config.unarmed.min + (15 - d.gritFree) * d.damagePerGrit.min);
  assert.equal(s.damage.max, config.unarmed.max + (15 - d.gritFree) * d.damagePerGrit.max);
  assert.equal(s.defense, d.defenseBase + 12 * d.defensePerAgility);
  assert.equal(s.attackRating, d.attackRatingBase + 12 * d.attackRatingPerAgility);
  assert.ok(Object.values(s).every((v) => typeof v === "object" || Number.isInteger(v)));
});

test("a new player's stats are the S1 numbers (50 hp, 20 mp, damage 3-6, defense 10, attack rating 40)", () => {
  const p = newGame(1).player;
  assert.deepEqual([p.hpMax, p.mpMax, p.damage, p.defense, p.attackRating], [50, 20, { min: 3, max: 6 }, 10, 40]);
});

test("AC-R-012-2 with empty equipment damage is the unarmed range plus the attribute bonus", () => {
  const s = deriveStats({ level: 1, attrs: { grit: config.derived.gritFree, agility: 1, stamina: 1, focus: 1 } }, {});
  assert.deepEqual(s.damage, { ...config.unarmed });
});

test("AC-R-012-3 hpMax rising does not heal; hp never exceeds hpMax", () => {
  const s = gameOn(OPEN);
  s.player.hp = 20;
  s.player.attrs.stamina += 5;
  applyDerived(s);
  assert.equal(s.player.hp, 20);
  assert.ok(s.player.hpMax > 50);
  s.player.attrs.stamina -= 5;
  s.player.hp = s.player.hpMax; // full at the larger value ...
  applyDerived(s); // ... clamped when the maximum falls
  assert.equal(s.player.hp, s.player.hpMax);
  applyDerived(s, { fill: true });
  assert.equal(s.player.hp, s.player.hpMax);
});

test("AC-R-012-4 resist has every config damage type at 0 without gear", () => {
  const p = newGame(1).player;
  assert.deepEqual(Object.keys(p.resist).sort(), [...config.damageTypes].sort());
  assert.ok(Object.values(p.resist).every((v) => v === 0));
});

test("attribute affixes on gear raise the totals used by the formulas (own attrs stay unchanged)", () => {
  const s = gameOn(OPEN);
  const ring = mint(s, makeItem("paperclip-ring", { rarity: "magic" }));
  ring.affixes = [{ id: "x", group: "stamina", kind: "suffix", stat: "stamina", name: "x", value: 4, range: [1, 9] }];
  autoplace(s.inventory, ring);
  assert.equal(equipItem(s, ring.id).ok, true);
  assert.equal(s.player.attrs.stamina, 10);
  assert.equal(s.player.attrsTotal.stamina, 14);
  assert.equal(s.player.hpMax, 50 + 4 * config.derived.hpPerStamina);
});

test("AC-R-042-5 unseeded newGame calls give different seeds and floors; an injected source makes them reproducible", () => {
  const a = newGame(), b = newGame();
  assert.notEqual(a.seed, b.seed);
  assert.notEqual(hashState(a.floor), hashState(b.floor));
  setSeedSource(() => 77);
  try {
    assert.equal(newGame().seed, 77);
    assert.equal(hashState(newGame()), hashState(newGame(77)));
    assert.equal(newGame({ seedSource: () => 5 }).seed, 5);
  } finally { setSeedSource(null); }
  assert.notEqual(newGame().seed, newGame().seed);
});

test("an explicit seed still gives the same game (determinism)", () => {
  assert.equal(hashState(newGame(9)), hashState(newGame(9)));
  assert.notEqual(hashState(newGame(9)), hashState(newGame(10)));
});
