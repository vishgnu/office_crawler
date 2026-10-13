import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config, content, monsterStats, generateFloor, teleportFloor, spawnMonster, dropLoot } from "../src/core/index.js";
import { validateFloor } from "../src/core/gen/validate.js";
import { buildGrid, flood } from "../src/core/grid.js";
import { gameOn, OPEN } from "./helpers.js";

const deny = ["ip-denylist.txt", "ip-denylist-brands.txt"].flatMap((f) => readFileSync(`docs/product/${f}`, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
const clean = (name) => !deny.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(name.toLowerCase()));

test("AC-R-030-2 the registry holds 6-8 types; the behaviours are exactly swarmer, ranged and elite, two or more types each (QF-03-6)", () => {
  const list = Object.values(content.monsters);
  assert.ok(list.length >= 6 && list.length <= 8, `${list.length} types`);
  assert.deepEqual(new Set(list.map((m) => m.behaviour)), new Set(["swarmer", "ranged", "elite"]));
  for (const b of ["swarmer", "ranged", "elite"]) assert.ok(list.filter((m) => m.behaviour === b).length >= 2, b);
  for (const m of list.filter((x) => x.behaviour === "ranged")) assert.ok(m.range > 1 && m.projectile.speed > 0 && m.projectile.kind);
  for (const m of list) for (const k of ["hpBase", "damage", "defense", "attackRating", "xp", "speed", "sightRange", "cost"]) assert.ok(m[k] > 0, `${m.id}.${k}`);
});

test("AC-R-030-4 / AC-R-030-3 the registry covers the listed roles; every monster, skill and NPC name passes the denylists", () => {
  const names = Object.values(content.monsters).map((m) => m.name.toLowerCase()).join("|");
  for (const role of ["temp worker", "middle manager", "auditor", "printer", "consultant", "vending machine"]) assert.ok(names.includes(role), role);
  for (const m of Object.values(content.monsters)) assert.ok(clean(m.name), m.name);
  for (const k of Object.values(content.skills)) assert.ok(clean(k.name), k.name);
  for (const n of Object.values(content.npcs)) assert.ok(clean(content.strings[n.nameKey]), n.id);
  for (const m of Object.values(content.championMods)) assert.ok(clean(m.name), m.name);
});

test("AC-R-031-1 monsterStats: hp, damage, defense and xp are non-decreasing with depth 1..8 and higher at 8 than at 1", () => {
  for (const type of Object.keys(content.monsters)) {
    for (let d = 1; d < 8; d++) {
      const a = monsterStats(type, d), b = monsterStats(type, d + 1);
      for (const k of ["hp", "damage", "defense", "xp", "attackRating"]) assert.ok(b[k] >= a[k], `${type} ${k} ${d}`);
    }
    const lo = monsterStats(type, 1), hi = monsterStats(type, 8);
    for (const k of ["hp", "damage", "defense", "xp"]) assert.ok(hi[k] > lo[k], `${type} ${k}`);
    assert.equal(lo.hp, content.monsters[type].hpBase); // depth 1 equals the registry
  }
});

test("AC-R-031-2 the item level of drops does not fall with depth and is higher at depth 8 than at depth 1", () => {
  const ilvlAt = (d) => {
    const s = gameOn(OPEN); s.depth = d;
    const out = [];
    for (let i = 0; i < 40; i++) { const m = spawnMonster(s, "zombie-intern", { x: 2 + (i % 16), y: 1 + (i % 7) }); if (m) out.push(...dropLoot(s, m).filter((e) => e.item).map((e) => e.item.ilvl)); }
    return Math.min(...out);
  };
  const v = [1, 2, 3, 4, 5, 6, 7, 8].map(ilvlAt);
  for (let i = 1; i < v.length; i++) assert.ok(v[i] >= v[i - 1]);
  assert.ok(v[7] > v[0]);
  assert.ok(v[0] >= config.ilvlPerDepth);
});

test("AC-R-031-4 a monster of the same type has more hpMax on floor 8 than on floor 1 (teleportFloor)", () => {
  const s = gameOn(OPEN);
  const at = (d) => {
    assert.equal(teleportFloor(s, d).ok, true);
    const g = buildGrid(s.floor), { dist } = flood(g, s.floor.entry.x, s.floor.entry.y);
    for (let y = 1; y < s.floor.h; y++) for (let x = 1; x < s.floor.w; x++) {
      if (g.walkable(x, y) && dist[y * s.floor.w + x] > 3) { const m = spawnMonster(s, "zombie-intern", { x, y }); if (m) return m.hpMax; }
    }
  };
  assert.ok(at(8) > at(1));
});

test("AC-R-034-3 floor budget: the spawn cost stays within it, it never falls with depth and is larger on floor 8", () => {
  let prev = 0;
  for (let d = 1; d <= 8; d++) {
    let budget = null;
    for (let seed = 1; seed <= 30; seed++) {
      const f = generateFloor(seed, d);
      budget ??= f.budget;
      assert.equal(f.budget, budget);
      const cost = f.spawns.reduce((a, sp) => a + content.monsters[sp.type].cost * config.tierFactor[sp.tier ?? "normal"], 0);
      assert.ok(cost <= f.budget + 1e-9, `d${d} seed${seed}: ${cost} > ${f.budget}`);
    }
    assert.ok(budget >= prev); prev = budget;
  }
  assert.ok(prev > generateFloor(1, 1).budget);
});

test("AC-R-043-1 / AC-R-101-2 depth 1-4 are open-plan, 5-8 basement; the server room kind exists only in the basement", () => {
  const kinds = { "open-plan": new Set(), basement: new Set() };
  for (let d = 1; d <= 8; d++) for (let seed = 1; seed <= 50; seed++) {
    const f = generateFloor(seed, d);
    assert.equal(f.theme, d <= 4 ? "open-plan" : "basement");
    for (const r of f.rooms) kinds[f.theme].add(r.kind);
  }
  assert.ok(kinds.basement.has("server"));
  assert.ok(!kinds["open-plan"].has("server"));
  for (const k of kinds["open-plan"]) assert.ok(content.themes["open-plan"].roomKinds.includes(k));
  for (const k of kinds.basement) assert.ok(content.themes.basement.roomKinds.includes(k));
});

test("AC-R-042-1/-2 floors 1-8 validate, population stands on reachable tiles and monsters are valid types", () => {
  for (let d = 1; d <= 8; d++) for (let seed = 1; seed <= 25; seed++) {
    const f = generateFloor(seed, d);
    assert.equal(validateFloor(f).ok, true, `d${d} seed${seed}`);
    const g = buildGrid(f), { dist } = flood(g, f.entry.x, f.entry.y);
    for (const sp of f.spawns) { assert.ok(g.walkable(sp.tile.x, sp.tile.y) && dist[sp.tile.y * f.w + sp.tile.x] >= 0); assert.ok(content.monsters[sp.type].minDepth <= d); }
    for (const p of f.props) assert.ok(content.props[p.type], p.type);
    assert.equal(f.depth, d);
  }
});

test("tougher monsters appear deeper: elites and ranged types need their minDepth", () => {
  const seen = (d) => new Set(Array.from({ length: 40 }, (_, i) => generateFloor(i + 1, d).spawns.map((s) => s.type)).flat());
  assert.ok(!seen(1).has("printer-demon") && !seen(1).has("middle-manager") && !seen(2).has("middle-manager"));
  assert.ok(seen(3).has("middle-manager") && seen(2).has("printer-demon"));
  assert.ok(seen(5).has("consultant") && seen(5).has("auditor") && !seen(4).has("auditor"));
});
