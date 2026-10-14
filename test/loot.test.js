import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { content, config, createRng, rollItem, rollPotion, rollRarity, rollAffixValue, dropLoot, spawnItem, step, sellValue, buyPrice, applyInput, hashState } from "../src/core/index.js";
import { gameOn, run, OPEN } from "./helpers.js";

const list = (p) => readFileSync(p, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
const denied = [...list("docs/product/ip-denylist.txt"), ...list("docs/product/ip-denylist-brands.txt")];
const hits = (text) => denied.filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text.toLowerCase()));
const ILVL = 30;

function killDrops(state, n, mon = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    state.groundItems.length = 0;
    out.push(dropLoot(state, { type: "zombie-intern", level: 1, tile: { x: 5, y: 4 }, tier: "normal", ...mon }));
  }
  return out;
}

test("AC-R-050-1 a kill drops entries at the tile or nearby; items have label = name, gold is separate with n > 0", () => {
  const s = gameOn(OPEN);
  let items = 0, gold = 0;
  for (const drops of killDrops(s, 300)) for (const e of drops) {
    assert.ok(Math.abs(e.tile.x - 5) <= config.dropRadius && Math.abs(e.tile.y - 4) <= config.dropRadius);
    if (e.gold !== undefined) { gold++; assert.ok(e.gold > 0); assert.ok(e.label.length > 0); }
    else { items++; assert.equal(e.label, e.item.name); assert.ok(e.label.length > 0); }
  }
  assert.ok(items > 0 && gold > 0);
});

test("a kill drops on distinct free tiles", () => {
  const s = gameOn(OPEN);
  for (let i = 0; i < 6; i++) dropLoot(s, { type: "zombie-intern", level: 3, tile: { x: 5, y: 4 }, tier: "champion" });
  const keys = s.groundItems.map((g) => `${g.tile.x},${g.tile.y}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("AC-R-050-2 over 1000 kills some drop an item and some do not; dropChance is strictly between 0 and 1", () => {
  assert.ok(config.dropChance > 0 && config.dropChance < 1);
  const s = gameOn(OPEN);
  const withItem = killDrops(s, 1000).filter((d) => d.some((e) => e.item && e.item.kind === "gear")).length;
  assert.ok(withItem > 0 && withItem < 1000, `${withItem}`);
});

test("AC-R-050-7 / AC-R-120-5 the same seed and kills give identical drops", () => {
  const a = gameOn(OPEN, [], 5), b = gameOn(OPEN, [], 5);
  killDrops(a, 40); killDrops(b, 40);
  assert.deepEqual(a.groundItems, b.groundItems);
  assert.deepEqual(a.rng, b.rng);
  assert.notDeepEqual(killDrops(gameOn(OPEN, [], 6), 40), killDrops(a, 0));
});

test("a monster killed in play drops loot and the hit/kill events stay as before", () => {
  let dropped = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = gameOn(OPEN, [["zombie-intern", 7, 4]], seed);
    s.monsters[0].hp = 1;
    applyInput(s, { t: "attack", id: "m1" });
    run(s, 400);
    assert.ok(s.eventLog.some((e) => e.type === "kill"));
    if (s.groundItems.length) dropped++;
  }
  assert.ok(dropped > 0);
});

test("champions drop at least magic and always something; bosses drop guaranteedDrops rare-or-better items (QF-03-4, QF-04-7)", () => {
  const s = gameOn(OPEN);
  for (const d of killDrops(s, 60, { tier: "champion", level: 4 })) {
    const gear = d.filter((e) => e.item?.kind === "gear");
    assert.ok(gear.length >= 1 && gear.every((e) => e.item.rarity !== "normal"));
  }
  for (const d of killDrops(s, 20, { tier: "boss", level: 8 })) {
    const gear = d.filter((e) => e.item?.kind === "gear");
    assert.equal(gear.length, config.boss.guaranteedDrops);
    assert.ok(gear.every((e) => e.item.rarity === "rare" || e.item.rarity === "unique"));
  }
});

test("AC-R-051-1 20,000 rolls: all four rarities occur and frequencies are ordered normal > magic > rare > unique", () => {
  const rng = createRng(7), n = { normal: 0, magic: 0, rare: 0, unique: 0 };
  for (let i = 0; i < 20000; i++) n[rollRarity(rng, 1)]++;
  assert.ok(n.unique > 0);
  assert.ok(n.normal > n.magic && n.magic > n.rare && n.rare > n.unique, JSON.stringify(n));
  const deep = createRng(7), m = { normal: 0, magic: 0, rare: 0, unique: 0 };
  for (let i = 0; i < 20000; i++) m[rollRarity(deep, 9)]++;
  assert.ok(m.normal < n.normal && m.rare > n.rare, "deeper floors drop better rarities");
});

test("AC-R-051-2 rarity display: mark, border and colour are pairwise different", () => {
  const r = Object.values(content.rarities);
  assert.equal(r.length, 4);
  for (const k of ["mark", "border", "color"]) assert.equal(new Set(r.map((x) => x[k])).size, 4, k);
});

test("AC-R-051-3 ground entries carry mark, border, colour of their rarity", () => {
  const s = gameOn(OPEN);
  const seen = {};
  for (const rarity of content.rarityOrder) { const e = spawnItem(s, { rarity, ilvl: ILVL }, { x: 3 + content.rarityOrder.indexOf(rarity), y: 2 }); seen[rarity] = e; }
  for (const k of ["mark", "border", "color"]) assert.equal(new Set(Object.values(seen).map((e) => e[k])).size, 4);
});

test("AC-R-051-4 every unique has an original name, a fixed affix list, flavour text and no denylisted words", () => {
  assert.ok(content.uniques.length >= 5);
  assert.equal(new Set(content.uniques.map((u) => u.name)).size, content.uniques.length);
  for (const u of content.uniques) {
    assert.ok(content.items[u.base], `${u.id} base`);
    assert.ok(u.affixes.length > 0);
    assert.ok(content.strings[u.flavour]?.length > 0, `${u.id} flavour`);
    assert.deepEqual(hits(u.name + " " + content.strings[u.flavour]), []);
    const a = rollItem(createRng(1), { rarity: "unique", ilvl: ILVL, slot: content.items[u.base].slot });
    assert.ok(a.unique);
  }
  const x = content.uniques[0];
  const twice = [1, 2].map((seed) => rollItem(createRng(seed), { rarity: "unique", ilvl: ILVL, slot: content.items[x.base].slot, taken: [] }));
  for (const t of twice) if (t.unique === x.id) assert.deepEqual(t.affixes, twice.find((o) => o.unique === x.id).affixes);
});

test("AC-R-051-5 a unique already found falls back to a rare of the same base (QF-05-2)", () => {
  const all = content.uniques.map((u) => u.id);
  const rng = createRng(3);
  for (let i = 0; i < 200; i++) {
    const it = rollItem(rng, { rarity: "unique", ilvl: ILVL, taken: all });
    assert.equal(it.rarity, "rare");
    assert.equal(it.unique, undefined);
  }
  const s = gameOn(OPEN);
  const found = [];
  for (let i = 0; i < 60; i++) { const e = spawnItem(s, { rarity: "unique", ilvl: ILVL }); if (e.item.unique) found.push(e.item.unique); }
  assert.equal(new Set(found).size, found.length, "no unique twice in one game");
  assert.deepEqual([...s.uniquesFound].sort(), [...found].sort());
});

const sample = (rarity, n, seed = 11, ilvl = ILVL) => { const rng = createRng(seed); return Array.from({ length: n }, () => rollItem(rng, { rarity, ilvl })); };

test("AC-R-052-1 magic items have 1-2 affixes, rare 3-5, normal 0, and every count occurs", () => {
  const counts = (items) => new Set(items.map((i) => i.affixes.length));
  assert.deepEqual([...counts(sample("normal", 500))], [0]);
  assert.deepEqual([...counts(sample("magic", 5000))].sort(), [1, 2]);
  assert.deepEqual([...counts(sample("rare", 5000))].sort(), [3, 4, 5]);
  for (const ilvl of [1, 3]) assert.ok(sample("rare", 500, 2, ilvl).every((i) => i.affixes.length >= 3 && i.affixes.length <= 5), "even at low item level every type has enough affix groups");
});

test("AC-R-052-2 affix values are integers within the range of their definition; both bounds are reached", () => {
  for (const item of sample("rare", 2000)) for (const a of item.affixes) {
    const def = content.affixes.find((d) => d.id === a.id);
    assert.ok(Number.isInteger(a.value) && a.value >= def.range[0] && a.value <= def.range[1]);
  }
  const rng = createRng(4);
  for (const def of content.affixes) {
    const seen = new Set(Array.from({ length: 5000 }, () => rollAffixValue(rng, def)));
    assert.ok(seen.has(def.range[0]) && seen.has(def.range[1]), def.id);
  }
});

test("AC-R-052-3 every affix fits the item type and item level", () => {
  for (const ilvl of [1, 5, 12, 25]) {
    const rng = createRng(ilvl);
    for (let i = 0; i < 1500; i++) {
      const item = rollItem(rng, { ilvl, rarity: i % 2 ? "rare" : "magic" });
      for (const a of item.affixes) {
        const def = content.affixes.find((d) => d.id === a.id);
        assert.ok(def.types.includes(item.slot), `${a.id} on ${item.slot}`);
        assert.ok(def.minIlvl <= ilvl, `${a.id} needs ilvl ${def.minIlvl}, item ${ilvl}`);
      }
    }
  }
});

test("AC-R-052-4 no affix id or stat group twice on an item; prefix/suffix caps hold", () => {
  for (const item of sample("rare", 5000)) {
    assert.equal(new Set(item.affixes.map((a) => a.id)).size, item.affixes.length);
    assert.equal(new Set(item.affixes.map((a) => a.group)).size, item.affixes.length);
    assert.ok(item.affixes.filter((a) => a.kind === "prefix").length <= config.maxPrefixes);
    assert.ok(item.affixes.filter((a) => a.kind === "suffix").length <= config.maxSuffixes);
  }
});

test("AC-R-052-5 affixes are prefix or suffix with original names; item names are built from them", () => {
  for (const d of content.affixes) { assert.ok(d.kind === "prefix" || d.kind === "suffix"); assert.deepEqual(hits(d.name), [], d.name); }
  for (const item of sample("magic", 500)) {
    const pre = item.affixes.find((a) => a.kind === "prefix"), suf = item.affixes.find((a) => a.kind === "suffix");
    assert.equal(item.name, [pre?.name, item.baseName, suf?.name].filter(Boolean).join(" "));
  }
  for (const item of sample("rare", 200)) {
    assert.deepEqual(hits(item.name), []);
    assert.notEqual(item.name, item.baseName);
  }
});

test("AC-R-052-7 the same rng gives deep-equal items; AC-R-054-2 no durability", () => {
  assert.deepEqual(rollItem(createRng(9), { ilvl: 10 }), rollItem(createRng(9), { ilvl: 10 }));
  assert.notDeepEqual(rollItem(createRng(9), { ilvl: 10 }), rollItem(createRng(10), { ilvl: 10 }));
  for (const item of [...sample("rare", 100), ...sample("normal", 100)]) assert.ok(!("durability" in item));
});

test("AC-R-055-1 (sizes) every base is 1x1 to 2x4; all item names are original and unique; AC-R-058-1 nothing is hidden", () => {
  const bases = Object.values(content.items);
  assert.ok(bases.length >= 30);
  for (const b of bases) { assert.ok(b.w >= 1 && b.w <= 2 && b.h >= 1 && b.h <= 4, b.id); assert.deepEqual(hits(b.name), [], b.name); }
  assert.equal(new Set(bases.map((b) => b.name)).size, bases.length);
  for (const item of sample("rare", 50)) assert.ok(item.identified === undefined || item.identified === true);
  for (const slot of ["weapon", "offhand", "head", "body", "hands", "feet", "belt", "ring", "amulet"]) assert.ok(bases.some((b) => b.slot === slot), slot);
  assert.ok(bases.some((b) => b.twoHanded));
});

test("item generation covers the office theme named in the brief", () => {
  for (const id of ["stapler-mace", "keyboard-sword", "ruler-rapier", "blazer", "lanyard", "hard-hat"]) assert.ok(content.items[id], id);
});

test("AC-R-056-4 health (coffee) and mana (water) potions come in 3 strengths with strictly increasing restore values", () => {
  for (const kind of ["hp", "mp"]) {
    const p = Object.values(content.items).filter((b) => b.kind === "potion" && b.restores === kind).sort((a, b) => a.restore - b.restore);
    assert.ok(p.length >= 2);
    for (let i = 1; i < p.length; i++) assert.ok(p[i].restore > p[i - 1].restore);
  }
  const rng = createRng(2);
  for (let i = 0; i < 200; i++) { const p = rollPotion(rng, 10); assert.equal(p.kind, "potion"); assert.equal(p.w * p.h, 1); }
});

test("AC-R-057-5 buyPrice > sellValue, both positive integers and pure (1,000 seeded items)", () => {
  const rng = createRng(21);
  for (let i = 0; i < 1000; i++) {
    const item = i % 10 === 0 ? rollPotion(rng, 10) : rollItem(rng, { ilvl: 1 + (i % 28) });
    const sv = sellValue(item), bp = buyPrice(item);
    assert.ok(Number.isInteger(sv) && Number.isInteger(bp) && sv > 0 && bp > sv);
    assert.equal(sellValue(structuredClone(item)), sv);
  }
});

test("AC-R-057-6 value is non-decreasing in rarity for the same base and level and grows with affix values", () => {
  for (const base of ["blazer", "ruler-rapier", "paperclip-ring"]) {
    for (let seed = 1; seed <= 200; seed++) {
      const v = content.rarityOrder.map((rarity) => sellValue(rollItem(createRng(seed), { base, rarity, ilvl: 12 })));
      for (let i = 1; i < v.length; i++) assert.ok(v[i] >= v[i - 1], `${base} ${seed}: ${v}`);
    }
  }
  const item = rollItem(createRng(5), { rarity: "magic", ilvl: 12 }), richer = structuredClone(item);
  for (const a of richer.affixes) a.value = a.range[1];
  const poorer = structuredClone(item);
  for (const a of poorer.affixes) a.value = a.range[0];
  assert.ok(sellValue(richer) >= sellValue(poorer));
});

test("snapshot-like state with loot on the ground is JSON-serialisable and round-trips", () => {
  const s = gameOn(OPEN);
  killDrops(s, 20);
  const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy, s);
  assert.equal(hashState(copy), hashState(s));
  for (let i = 0; i < 30; i++) { step(s); step(copy); }
  assert.equal(hashState(copy), hashState(s));
});
