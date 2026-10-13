import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, makeItem, content, config } from "../src/core/index.js";
import { describeItem, compareToEquipped, dropCheck, allocPreview, unmetGear, xpRatio, reqLines, unmetReason, affixText } from "../src/ui/itemview.js";

const mint = (state, id, opts = {}) => ({ ...makeItem(id, opts), id: `t${state.nextItemId++}` });
const game = () => newGame(1, { start: "town" });
const wear = (s, item) => { s.equipment[item.slot] = item; };

test("describeItem lists name, rarity word, mark, requirements with have/need and each affix as text", () => {
  const s = game(), it = mint(s, "keyboard-sword", { rarity: "rare", ilvl: 9 });
  it.affixes = [{ stat: "grit", value: 4 }, { stat: "hpMax", value: 12 }, { stat: "resist.fire", value: 9 }, { stat: "damage", value: 2 }];
  const d = describeItem(it, s.player);
  assert.equal(d.name, "Keyboard Sword");
  assert.equal(d.rarityName, "Rare");
  assert.equal(d.mark, "*");
  assert.deepEqual(d.affixes.map((a) => a.text), ["+4 Grit", "+12 Max Health", "+9 Fire Resist", "+2 Damage"]);
  assert.equal(d.main[0].text, "Damage 4–8");
  const lvl = d.reqs.find((r) => r.key === "level"), grit = d.reqs.find((r) => r.key === "grit");
  assert.equal(lvl.ok, false);
  assert.match(lvl.detail, /Level 5 \(you have 1, need 4 more\)/);
  assert.match(grit.detail, /Grit 14 \(you have 10, need 4 more\)/);
  assert.equal(d.unmet, true);
});

test("potions describe what they restore; uniques carry their flavour line", () => {
  const s = game();
  assert.equal(describeItem(mint(s, "strong-coffee"), s.player).main[0].text, "Restores 50 health");
  const u = { ...mint(s, "id-card"), rarity: "unique", flavour: "flavour_employee_of_the_month", affixes: [] };
  assert.equal(describeItem(u, s.player).flavour, content.strings.flavour_employee_of_the_month);
});

test("unmetReason reads 'Needs Level 8 (you have 1)' and is null when everything is met", () => {
  const s = game();
  assert.equal(unmetReason(s.player, mint(s, "ruler-rapier")), null);
  assert.match(unmetReason(s.player, mint(s, "hole-punch-hammer")), /^Needs Level 9 \(you have 1\)$/);
  assert.equal(reqLines(s.player, mint(s, "ruler-rapier"))[0].ok, true);
});

test("compareToEquipped: an upgrade, a downgrade and a mixed change, with real derived deltas (R-061)", () => {
  const s = game(), p = s.player;
  p.level = 10; p.attrs.grit = 18;
  const club = mint(s, "mop-halberd"), dagger = mint(s, "letter-opener"), big = mint(s, "hole-punch-hammer");
  assert.equal(compareToEquipped(s, dagger).equipped, null, "nothing worn: no equipped item in the comparison");
  wear(s, dagger);
  const up = compareToEquipped(s, big);
  assert.equal(up.verdict, "up");
  assert.ok(up.deltas.find((d) => d.key === "damage").delta > 0);
  assert.match(up.verdictText, /^Upgrade/);
  assert.equal(up.equipped.name, "Letter Opener");
  wear(s, big);
  const down = compareToEquipped(s, dagger);
  assert.equal(down.verdict, "down");
  assert.match(down.verdictText, /^Downgrade/);
  // a two-handed weapon displaces the worn shield: damage up, defense down = mixed
  s.equipment.offhand = mint(s, "binder-buckler");
  const mixed = compareToEquipped(s, club);
  assert.equal(mixed.verdict, "mixed");
  assert.match(mixed.verdictText, /^Mixed/);
  assert.ok(mixed.deltas.find((d) => d.key === "defense").delta < 0);
  assert.equal(compareToEquipped(s, big), null, "the worn item itself has no comparison");
});

test("compareToEquipped skips potions and compares a ring with the first ring slot", () => {
  const s = game();
  assert.equal(compareToEquipped(s, mint(s, "lukewarm-coffee")), null);
  const r1 = mint(s, "paperclip-ring"), r2 = mint(s, "rubber-band-ring");
  assert.equal(compareToEquipped(s, r1).slot, "ring1");
  s.equipment.ring1 = r1;
  assert.equal(compareToEquipped(s, r2).slot, "ring2");
  s.equipment.ring2 = mint(s, "paperclip-ring");
  assert.equal(compareToEquipped(s, r2).slot, "ring1");
});

test("dropCheck: slot rules, requirements text, belt, grid bounds and overlap (decision must-fix 5)", () => {
  const s = game(), p = s.player, sword = mint(s, "keyboard-sword"), cap = mint(s, "visor-cap"), coffee = mint(s, "lukewarm-coffee");
  assert.equal(dropCheck(s, cap, { t: "slot", k: "head" }).ok, true);
  assert.equal(dropCheck(s, cap, { t: "slot", k: "feet" }).reason, "Wrong slot for this item");
  assert.match(dropCheck(s, sword, { t: "slot", k: "weapon" }).reason, /^Needs Level 5/);
  assert.equal(dropCheck(s, coffee, { t: "belt", i: 3 }).ok, true);
  assert.equal(dropCheck(s, cap, { t: "belt", i: 0 }).reason, "The belt only takes potions");
  assert.equal(dropCheck(s, cap, { t: "grid", x: 9, y: 0 }).reason, "Does not fit there");
  assert.equal(dropCheck(s, cap, { t: "grid", x: 8, y: 2 }).ok, true);
  s.inventory.items.length = 0;
  const a = mint(s, "visor-cap"), b = mint(s, "visor-cap");
  a.x = 0; a.y = 0; b.x = 2; b.y = 0; s.inventory.items.push(a, b);
  assert.equal(dropCheck(s, cap, { t: "grid", x: 1, y: 0 }).reason, "Two items are in the way", "overlap with two items is rejected");
  assert.equal(dropCheck(s, cap, { t: "grid", x: 0, y: 0 }).ok, true, "overlap with exactly one item is a swap");
  p.level = 20; wear(s, mint(s, "mop-halberd"));
  assert.match(dropCheck(s, mint(s, "clipboard-shield"), { t: "slot", k: "offhand" }).reason, /two-handed/i);
});

test("allocPreview shows the derived change of one more point and the gear it unlocks (QF-06-6)", () => {
  const s = game(), p = s.player;
  p.attrPoints = 5;
  const gloves = mint(s, "rubber-gloves"); gloves.x = 0; gloves.y = 0; s.inventory.items.push(gloves);
  p.level = 5; p.attrs.agility = 12;
  const pv = allocPreview(s, "agility");
  assert.ok(pv.deltas.some((d) => d.key === "defense" && d.delta === 1));
  assert.ok(pv.deltas.some((d) => d.key === "attackRating" && d.delta === 3));
  assert.deepEqual(pv.unlocks, ["Rubber Gloves"], "Agility 13 unlocks the gloves");
  p.attrs.grit = 7;
  assert.deepEqual(allocPreview(s, "grit").deltas.map((d) => d.key), [], "grit below the free threshold changes no derived stat");
  p.attrs.grit = 9;
  assert.ok(allocPreview(s, "grit").deltas.some((d) => d.key === "damage"));
});

test("unmetGear lists inventory gear the hero cannot use with the missing amounts", () => {
  const s = game(), g = mint(s, "stapler-mace");
  g.x = 0; g.y = 0; s.inventory.items.push(g);
  const [u] = unmetGear(s);
  assert.equal(u.item.id, g.id);
  assert.deepEqual(u.missing.map((m) => m.key).sort(), ["grit", "level"]);
  s.player.level = 3; s.player.attrs.grit = 12;
  assert.deepEqual(unmetGear(s), []);
});

test("xpRatio is progress inside the level: 0 at the start of a level, 1 at the cap (AC-R-077-2)", () => {
  const p = { level: 3, xp: config.xpTable[2], xpNext: config.xpTable[3] };
  assert.equal(xpRatio(p), 0);
  p.xp = (config.xpTable[2] + config.xpTable[3]) / 2;
  assert.ok(Math.abs(xpRatio(p) - 0.5) < 0.01);
  assert.equal(xpRatio({ level: config.levelCap, xp: 5000, xpNext: config.xpTable[config.levelCap - 1] }), 1);
});

test("affixText formats resist and attribute stats with their labels", () => {
  assert.equal(affixText({ stat: "resist.cold", value: 12 }), "+12 Cold Resist");
  assert.equal(affixText({ stat: "attackRating", value: 30 }), "+30 Attack Rating");
});
