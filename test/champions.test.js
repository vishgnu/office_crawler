import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config, content, generateFloor, monsterStats, newGame, dropLoot, spawnMonster, hashState, step } from "../src/core/index.js";
import { gameOn, OPEN } from "./helpers.js";

const deny = ["ip-denylist.txt", "ip-denylist-brands.txt"].flatMap((f) => readFileSync(`docs/product/${f}`, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
const rank = (r) => content.rarityOrder.indexOf(r);

// 200 seeded floors across depths 2..8 (champion packs start at depth 2)
const floors = Array.from({ length: 200 }, (_, i) => newGame(i + 1, { floor: generateFloor(i + 1, 2 + (i % 7)) }));
const champions = floors.flatMap((s) => s.monsters.filter((m) => m.tier === "champion"));

test("AC-R-033-1 champions exist on seeded floors with 1..championMaxMods registry modifiers and a generated name", () => {
  assert.ok(champions.length >= 20, `only ${champions.length} champions in 200 floors`);
  for (const m of champions) {
    assert.ok(m.mods.length >= 1 && m.mods.length <= config.championMaxMods);
    assert.equal(new Set(m.mods).size, m.mods.length);
    for (const k of m.mods) assert.ok(content.championMods[k], k);
    assert.ok(m.name.length > content.monsters[m.type].name.length);
    assert.ok(m.name.endsWith(content.monsters[m.type].name));
    assert.ok(!deny.some((t) => new RegExp(`\\b${t}\\b`).test(m.name.toLowerCase())), m.name);
    assert.ok(m.hpMax > monsterStats(m.type, m.level).hp); // sturdier than the normal type at the same depth
  }
  assert.ok(champions.some((m) => m.mods.includes("burly")));
});

test("a champion with the extra-health modifier has more hpMax than one without it; mods change speed, damage and defense", () => {
  const s = gameOn(OPEN);
  const mk = (mods, x) => spawnMonster(s, "zombie-intern", { x, y: 2 }, null, { tier: "champion", mods });
  const plain = mk(["regenerating"], 2), burly = mk(["burly"], 4), fast = mk(["caffeinated"], 6), mean = mk(["vicious"], 8), tough = mk(["armored"], 10);
  assert.ok(burly.hpMax > plain.hpMax);
  assert.ok(fast.speed > plain.speed);
  assert.ok(mean.damage > plain.damage);
  assert.ok(tough.defense > plain.defense);
  assert.equal(plain.name, "Regenerating Zombie Intern");
});

test("a regenerating champion heals over time", () => {
  const s = gameOn(OPEN);
  const m = spawnMonster(s, "zombie-intern", { x: 3, y: 2 }, null, { tier: "champion", mods: ["regenerating"] });
  m.hp = 1;
  for (let i = 0; i < 90; i++) step(s);
  assert.ok(m.hp > 1);
});

test("champion packs: one champion leader per pack, the rest normal; no champions on floor 1", () => {
  for (let seed = 1; seed <= 100; seed++) assert.ok(generateFloor(seed, 1).spawns.every((sp) => !sp.tier || sp.tier === "normal"));
  for (const s of floors) {
    const byPack = new Map();
    for (const m of s.monsters.filter((x) => x.packId && x.tier === "champion")) byPack.set(m.packId, (byPack.get(m.packId) ?? 0) + 1);
    for (const n of byPack.values()) assert.equal(n, 1);
  }
});

test("AC-R-033-2 / QF-03-4 champions drop at least magic items; their mean drop rarity beats normal monsters'", () => {
  const meanRank = (tier) => {
    const s = gameOn(OPEN); s.depth = 4;
    let sum = 0, n = 0;
    for (let i = 0; i < 1500; i++) {
      const m = spawnMonster(s, "zombie-intern", { x: 2 + (i % 16), y: 1 + (i % 7) }, null, tier === "champion" ? { tier, mods: ["burly"] } : {});
      if (!m) continue;
      for (const e of dropLoot(s, m)) if (e.item && e.item.kind === "gear") { sum += rank(e.item.rarity); n++; if (tier === "champion") assert.ok(rank(e.item.rarity) >= 1); }
      s.groundItems.length = 0; s.monsters.length = 0;
    }
    return sum / n;
  };
  assert.ok(meanRank("champion") > meanRank("normal"));
});

test("champion floors are deterministic per seed", () => {
  for (let seed = 1; seed <= 20; seed++) assert.deepEqual(generateFloor(seed, 5).spawns, generateFloor(seed, 5).spawns);
  assert.equal(hashState(newGame(7, { floor: generateFloor(7, 6) })), hashState(newGame(7, { floor: generateFloor(7, 6) })));
});
