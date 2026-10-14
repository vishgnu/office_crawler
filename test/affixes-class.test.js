// R4-4: class-tagged affixes (ADR-0005 section 7, R-231): rolled only for the matching class, deterministic, class-independent requirements,
// and the skill level bonus they give (effLevel).
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, createRng, rollItem, rollAffixes, makeItem, mint, equipItem, autoplace, newGame, effLevel, skillView, castCost, deriveStats, vendorStock, checkReqs, spawnItem, at, config } from "../src/core/index.js";
import { serialize, deserialize } from "../src/save/index.js";

const tags = Object.fromEntries(content.classes.map((c) => [c.id, c.affixTag]));
const tagged = content.affixes.filter((a) => a.class);

test("the tagged affix set: three groups per class on weapon, ring and amulet, stats from the closed list, unique group names", () => {
  assert.equal(new Set(tagged.map((a) => a.group)).size, 9);
  for (const t of Object.values(tags)) assert.equal(new Set(tagged.filter((a) => a.class === t).map((a) => a.group)).size, 3, t);
  for (const a of tagged) {
    assert.ok(/^skillLevel\.all$|^skillLevel\.branch\.[a-z]+$|^skillDamagePct\.[a-z]+$/.test(a.stat), a.stat);
    assert.deepEqual([...a.types].sort(), ["amulet", "ring", "weapon"]);
    if (a.stat.startsWith("skillLevel.branch.")) assert.ok(content.classes.find((c) => c.affixTag === a.class).branches.includes(a.stat.slice(18)), `${a.id}: a branch of its own class`);
  }
  assert.ok(content.affixGroups.includes("fac-all"));
});

test("AC-R-231-2 over 5000 rolls per class, a tagged affix appears only for its own class, shows up at least once for each, and never on a slot it does not fit", () => {
  for (const [cls, tag] of Object.entries(tags)) {
    const rng = createRng(21), seen = new Set();
    for (let i = 0; i < 5000; i++) {
      const it = rollItem(rng, { ilvl: 12, rarity: i % 2 ? "rare" : "magic", affixTag: tag });
      for (const a of it.affixes) if (a.class) { assert.equal(a.class, tag, `${cls} rolled ${a.id}`); seen.add(a.group); assert.ok(["weapon", "ring", "amulet"].includes(it.slot)); }
    }
    assert.equal(seen.size, 3, `${cls}: every tagged group appeared (${[...seen]})`);
  }
  const rng = createRng(5);
  for (let i = 0; i < 3000; i++) assert.ok(rollItem(rng, { ilvl: 12, rarity: "rare" }).affixes.every((a) => !a.class), "no tag, no tagged affix");
  for (let i = 0; i < 3000; i++) assert.ok(rollItem(rng, { ilvl: 12, rarity: "rare", affixTag: "nobody" }).affixes.every((a) => !a.class));
});

test("same seed and class give the same loot (deterministic); a different class gives different class affixes", () => {
  const roll = (tag) => { const rng = createRng(8); return Array.from({ length: 200 }, () => JSON.stringify(rollItem(rng, { ilvl: 12, rarity: "rare", affixTag: tag }))); };
  assert.deepEqual(roll("sales"), roll("sales"));
  assert.notDeepEqual(roll("sales"), roll("it"));
});

test("loot and vendors roll for the character that plays: a Sales Rep never sees an IT affix in kills, spawned items or vendor stock", () => {
  const s = newGame(4, { class: "sales-rep", start: "town" });
  const seen = new Set();
  for (let i = 0; i < 400; i++) { const e = spawnItem(s, { ilvl: 15, rarity: "rare", slot: "ring" }); for (const a of e.item?.affixes ?? []) if (a.class) seen.add(a.class); }
  assert.ok(seen.has("sales")); assert.ok(![...seen].some((c) => c !== "sales"));
  const stock = vendorStock(4, 1, { level: 20, ilvl: 60, affixTag: "it" });
  for (const e of stock) for (const a of e.item.affixes ?? []) if (a.class) assert.equal(a.class, "it");
  const v = vendorStock(4, 1, { level: 20, ilvl: 60 });
  for (const e of v) assert.ok((e.item.affixes ?? []).every((a) => !a.class));
});

test("AC-R-231-1 item requirements are class-independent: the same level and attributes equip the same item for every class", () => {
  const item = makeItem("keyboard-sword");
  const players = content.classes.map((c) => ({ level: 7, attrs: { grit: 15, agility: 9, stamina: 9, focus: 9 }, class: c.id }));
  const results = players.map((p) => JSON.stringify(checkReqs(p, item)));
  assert.equal(new Set(results).size, 1);
  assert.equal(JSON.parse(results[0]).ok, true);
  assert.equal(new Set(players.map((p) => JSON.stringify(checkReqs({ ...p, level: 2 }, item)))).size, 1);
});

test("skill level bonus: +n to all skills and +n to a branch raise the effective level of learned skills of that scope only", () => {
  const s = newGame(1, { class: "sales-rep", start: "town" });
  const p = s.player;
  p.skills = { "stapler-throw": 2, intern: 1, upsell: 1 };
  const sk = content.skills;
  assert.deepEqual([effLevel(s, sk["stapler-throw"]), effLevel(s, sk.intern), effLevel(s, sk["hard-close"]), effLevel(s, sk.strike)], [2, 1, 0, 1]);
  const ring = { ...makeItem("paperclip-ring", { rarity: "rare" }), id: "r1", affixes: [{ id: "x", group: "sales-all", kind: "suffix", stat: "skillLevel.all", name: "x", value: 2, range: [1, 3], class: "sales" }] };
  const ring2 = { ...makeItem("paperclip-ring", { rarity: "rare" }), id: "r2", affixes: [{ id: "y", group: "sales-branch", kind: "suffix", stat: "skillLevel.branch.pitch", name: "y", value: 1, range: [1, 4], class: "sales" }] };
  s.equipment.ring1 = ring; s.equipment.ring2 = ring2;
  const d = deriveStats(p, s.equipment);
  assert.equal(d.mods.skillLevelAll, 2); assert.deepEqual(d.mods.skillLevelBranch, { pitch: 1 });
  s.player.mods = d.mods;
  assert.equal(effLevel(s, sk["stapler-throw"]), 2 + 2 + 1, "all + pitch branch");
  assert.equal(effLevel(s, sk.intern), 1 + 2, "all only: networking");
  assert.equal(effLevel(s, sk["hard-close"]), 0, "a skill that is not learned stays at 0");
  const v = skillView(s, "stapler-throw");
  assert.deepEqual([v.level, v.bonus], [2, 3]);
  assert.equal(v.cost.mana, content.skills["stapler-throw"].mana(5), "the panel shows the cost at the effective level");
  assert.equal(v.now[0].value, `${at([4, 2], 5)}-${at([8, 3], 5)}`);
});

test("a bonus level is not capped by maxLevel (the panel shows 5 (+2)); a passive scales with the bonus too", () => {
  const s = newGame(1, { class: "sales-rep", start: "town" });
  s.player.skills = { "stapler-throw": 5, hustle: 2 };
  s.equipment.ring1 = { ...makeItem("paperclip-ring", { rarity: "rare" }), id: "r1", affixes: [{ id: "x", group: "sales-all", kind: "suffix", stat: "skillLevel.all", name: "x", value: 2, range: [1, 3], class: "sales" }] };
  const base = deriveStats({ ...s.player, skills: { hustle: 2 } }, {}).attackRating;
  const withRing = deriveStats(s.player, s.equipment).attackRating;
  assert.equal(withRing - base, at([6, 6], 4) - at([6, 6], 2), "Hustle at level 2 + 2");
  s.player.mods = deriveStats(s.player, s.equipment).mods;
  assert.equal(effLevel(s, content.skills["stapler-throw"]), 7);
  assert.equal(skillView(s, "stapler-throw").maxLevel, 5);
});

test("tagged skill damage (skillDamagePct.<tag>) is part of the derived mods and a tagged item survives save and load", () => {
  const s = newGame(1, { class: "it-wizard", start: "town" });
  const it = { ...makeItem("usb-staff", { rarity: "rare" }), id: "w1", x: 0, y: 5, affixes: [{ id: "it-fire-t1", group: "it-fire", kind: "prefix", stat: "skillDamagePct.fire", name: "Overclocked", tier: 1, value: 6, range: [4, 8], class: "it" }] };
  s.inventory.items.push(it);
  assert.equal(equipItem(s, "w1").ok, true);
  assert.equal(s.player.mods.skillDamagePct.fire, 6);
  const back = deserialize(serialize(s));
  assert.equal(back.ok, true, back.message);
  assert.equal(back.state.player.mods.skillDamagePct.fire, 6);
  assert.equal(back.state.equipment.weapon.affixes[0].class, "it");
});

test("castCost uses the effective level, so bonus levels cost a little more mana (monotonic)", () => {
  const s = newGame(1, { class: "sales-rep" });
  const d = content.skills["stapler-throw"];
  assert.ok(castCost(s, d, 5) >= castCost(s, d, 1));
});
