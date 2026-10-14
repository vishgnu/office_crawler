// R7-0.2 generator hooks (AC-R-246-2, 246-4, 246-5, 250-1, 240-2 placement part): questRng, questSpot, placeQuestObjects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyInput, config, content, hashStateWithout, monsterStats, enterFloor, generateFloor, questRng, questSpot, cloneState, stairsTile, placeQuestObjects, spawnMonster } from "../src/core/index.js";
import { fallbackFloor } from "../src/core/gen/floor.js";
import { itemFloorOf } from "../src/core/systems/quests.js";
import { killMonster } from "../src/core/systems/damage.js";
import { buildGrid, flood } from "../src/core/grid.js";

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

function accept(s, id) {
  const giver = content.quests[id].giver, n = s.floor.npcs.find((o) => o.id === giver);
  s.player.tile = { x: n.tile.x, y: n.tile.y + 1 };
  assert.ok(applyInput(s, { t: "interact", id: giver }).ok);
  assert.ok(applyInput(s, { t: "questAccept", id }).ok);
  s.ui.dialog = null;
}
const lobby = (seed, ...ids) => { const s = newGame(seed, { start: "town" }); for (const id of ids) accept(s, id); return s; };
const quest = (s, id) => s.groundItems.filter((g) => g.quest === id);
const elites = (s) => s.monsters.filter((m) => m.quest === "sq3" && m.ai !== "dead");
const roomOf = (f, t) => f.rooms.findIndex((r) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h);

function checkTile(s, t) {
  const f = s.floor, grid = buildGrid(f), { dist } = flood(grid, f.entry.x, f.entry.y);
  assert.ok(grid.walkable(t.x, t.y), "walkable");
  assert.ok(dist[t.y * f.w + t.x] >= 0, "reachable from the stairs");
  assert.ok(Math.max(Math.abs(t.x - f.entry.x), Math.abs(t.y - f.entry.y)) > config.safeRadius, "outside the safe radius");
  assert.ok(!(t.x === f.exit.x && t.y === f.exit.y) && !(t.x === f.entry.x && t.y === f.entry.y));
  assert.ok(!f.spawns.some((sp) => sp.tile.x === t.x && sp.tile.y === t.y), "not a monster start");
  const r = roomOf(f, t);
  assert.ok(r >= 0 && r !== roomOf(f, f.entry) && r !== roomOf(f, f.exit), "in a room that is neither the entry nor the exit room");
}

test("AC-R-246-2 sq2 active: exactly one quest item over floors 3 and 4, on the quest-stream floor, valid tile, 100 seeds", () => {
  for (const seed of SEEDS) {
    const s = lobby(seed, "sq2");
    let found = 0;
    for (const d of [3, 4]) {
      enterFloor(s, d);
      const q = quest(s, "sq2");
      found += q.length;
      if (q.length) {
        assert.equal(d, itemFloorOf(seed));
        const e = q[0];
        assert.deepEqual(Object.keys(e).sort(), ["border", "color", "id", "keep", "label", "mark", "quest", "rarity", "tile"], "no item, no gold");
        assert.equal(e.id, "qi-sq2"); assert.equal(e.label, content.quests.sq2.item.name);
        checkTile(s, e.tile);
      }
    }
    assert.equal(found, 1, `seed ${seed}`);
    assert.ok(config.quests.item.floors.includes(itemFloorOf(seed)));
  }
});

test("AC-R-246-2 the item is absent when sq2 is not active (available, ready, completed) and on other floors", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const s = newGame(seed, { start: "town" });
    for (let d = 1; d <= 4; d++) { enterFloor(s, d); assert.equal(quest(s, "sq2").length, 0); }
    for (const st of ["ready", "completed"]) {
      s.quests.sq2 = { s: st, p: 1 };
      for (const d of [3, 4]) { enterFloor(s, d); assert.equal(quest(s, "sq2").length, 0); }
    }
    const a = lobby(seed, "sq2");
    for (const d of [1, 2, 5, 6]) { enterFloor(a, d); assert.equal(quest(a, "sq2").length, 0); }
  }
});

test("the item is not in the normal loot tables: no drop table, rollable pool or ground rule can produce a quest entry", () => {
  assert.ok(!JSON.stringify(content.drops).includes("qi-") && !JSON.stringify(content.items).includes(content.quests.sq2.item.name));
});

test("revisiting the item floor keeps one entry (parked ground list); after pickup none comes back; a pouch item blocks a new one", () => {
  const seed = 5, s = lobby(seed, "sq2"), d = itemFloorOf(seed);
  enterFloor(s, d); enterFloor(s, d === 3 ? 4 : 3); enterFloor(s, d);
  assert.equal(quest(s, "sq2").length, 1);
  s.player.tile = { ...quest(s, "sq2")[0].tile };
  assert.ok(applyInput(s, { t: "pickup", id: "qi-sq2" }).ok);
  assert.equal(quest(s, "sq2").length, 0);
  enterFloor(s, 0); enterFloor(s, d);
  assert.equal(quest(s, "sq2").length, 0);
});

test("AC-R-246-4 sq3 active: exactly one named elite on floor 4, hp relation, valid tile, 100 seeds", () => {
  for (const seed of SEEDS) {
    const s = lobby(seed, "sq3");
    for (const d of [1, 2, 3]) { enterFloor(s, d); assert.equal(elites(s).length, 0); }
    enterFloor(s, config.quests.elite.depth);
    const e = elites(s);
    assert.equal(e.length, 1, `seed ${seed}`);
    const m = e[0];
    assert.equal(m.name, content.quests.sq3.elite.name);
    assert.equal(m.tier, "champion"); assert.deepEqual(m.mods, []);
    assert.equal(m.type, config.quests.elite.type);
    assert.ok(m.hpMax >= config.quests.elite.hpMult * monsterStats(config.quests.elite.type, 4).hp);
    assert.equal(m.hp, m.hpMax);
    checkTile(s, m.tile);
    assert.equal(s.floor.spawns.length, generateFloor(seed, 4).spawns.length, "the population is unchanged");
  }
});

test("AC-R-246-4 no elite when sq3 is not active, or already ready or completed", () => {
  const s = newGame(9, { start: "town" });
  for (const st of ["available", "ready", "completed"]) {
    s.quests.sq3 = { s: st, p: st === "available" ? 0 : 1 };
    enterFloor(s, 4); assert.equal(elites(s).length, 0, st); enterFloor(s, 0);
  }
});

test("AC-R-246-5 kill makes sq3 ready and the elite never comes back; leaving or dying first brings exactly one back", () => {
  const s = lobby(11, "sq3");
  enterFloor(s, 4);
  assert.equal(elites(s).length, 1);
  enterFloor(s, 3); enterFloor(s, 4);
  assert.equal(elites(s).length, 1, "left before the kill: one again, never two");
  s.player.hp = 0; s.scene = "dead";
  s.player.hp = s.player.hpMax; s.scene = "floor";
  enterFloor(s, 0); enterFloor(s, 4);
  assert.equal(elites(s).length, 1, "after a death trip to the Lobby: one");
  killMonster(s, elites(s)[0]);
  assert.equal(s.quests.sq3.s, "ready");
  assert.ok(s.eventLog.some((e) => e.type === "quest.step" && e.id === "sq3"));
  enterFloor(s, 3); enterFloor(s, 4);
  assert.equal(elites(s).length, 0, "never again once ready");
  const q = s.monsters.filter((m) => m.quest === "sq3");
  assert.equal(q.length, 0);
});

test("the hook is idempotent per entry and avoids a tile a monster stands on (one elite, never zero or two)", () => {
  const s = lobby(13, "sq3");
  enterFloor(s, 4);
  const first = { ...elites(s)[0].tile };
  placeQuestObjects(s);
  assert.equal(elites(s).length, 1, "a second call adds nothing");
  s.monsters = [];
  assert.ok(spawnMonster(s, "zombie-intern", first));
  placeQuestObjects(s);
  assert.equal(elites(s).length, 1);
  assert.notDeepEqual(elites(s)[0].tile, first, "the occupied tile is skipped");
});

test("AC-R-240-2 placement is deterministic across reloads and does not depend on the order of accepts", () => {
  for (const seed of [2, 7, 21, 40]) {
    const a = lobby(seed, "sq2", "sq3"), b = lobby(seed, "sq3", "sq2");
    const c = cloneState(a); // a reload: the stored state comes back, floors regenerate
    c.floors = {};
    const tiles = (s) => { const out = []; for (const d of [3, 4]) { enterFloor(s, d); out.push(d, quest(s, "sq2")[0]?.tile ?? null, elites(s)[0]?.tile ?? null); } return JSON.stringify(out); };
    const ta = tiles(a);
    assert.equal(tiles(b), ta);
    assert.equal(tiles(c), ta);
    assert.equal(tiles(lobby(seed, "sq2", "sq3")), ta);
  }
});

test("AC-R-240-2 questRng is derived from fixed inputs only and the state streams are never touched by a quest hook", () => {
  const a = questRng(5, 2, 1, 0), b = questRng(5, 2, 1, 0), c = questRng(5, 3, 1, 0), d = questRng(5, 2, 2, 0);
  const take = (r) => [r.next(), r.next(), r.next()].join();
  assert.equal(take(a), take(b));
  assert.notEqual(take(questRng(5, 2, 1, 0)), take(c));
  assert.notEqual(take(questRng(5, 2, 1, 0)), take(d));
  const s = lobby(8, "sq2", "sq3"), before = JSON.stringify(s.rng);
  for (const d of [1, 2, 3, 4]) enterFloor(s, d);
  assert.equal(JSON.stringify(s.rng), before, "no state stream drew");
  assert.deepEqual(Object.keys(s.rng).sort(), ["ai", "combat", "loot", "world"]);
});

test("AC-R-240-2 a run that never accepts a quest spawns nothing: the state with and without the quest state hashes the same", () => {
  for (const seed of [1, 4, 9]) {
    const s = newGame(seed, { start: "town" }), t = newGame(seed, { start: "town" });
    delete t.quests;
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 3, 0, 4]) { enterFloor(s, d); enterFloor(t, d); }
    assert.equal(s.groundItems.filter((g) => g.quest).length, 0);
    assert.equal(s.monsters.filter((m) => m.quest).length, 0);
    const strip = { paths: ["quests"], eventPrefixes: ["quest."] };
    assert.equal(hashStateWithout(s, strip), hashStateWithout(t, strip));
  }
});

test("AC-R-250-1 all three quests accepted: floors 1..8 stay valid and generateFloor is unchanged by quests; placement work is bounded", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const s = lobby(seed, "sq1", "sq2", "sq3");
    for (let d = 1; d <= 8; d++) {
      const before = JSON.stringify(generateFloor(seed, d));
      enterFloor(s, d);
      assert.equal(JSON.stringify(generateFloor(seed, d)), before, "generateFloor is pure");
      assert.equal(s.floor.spawns.length, JSON.parse(before).spawns.length);
      if (d < config.bossDepth) assert.ok(stairsTile(s, "down"));
    }
  }
  assert.ok(!("levels" in content), "no quest-only level or map exists");
  // bounded work: questSpot draws at most 2 numbers per try for 30 tries before any scan
  const f = generateFloor(3, 4);
  let draws = 0; const rng = { int: (lo, hi) => { draws++; return lo; }, next: () => 0 };
  questSpot(f, rng, []);
  assert.ok(draws <= 60);
});

test("questSpot on fallbackFloor and generated floors: always a valid tile, 100 seeds", () => {
  for (const seed of SEEDS) for (const d of [3, 4]) {
    for (const f of [generateFloor(seed, d), fallbackFloor(seed, d)]) {
      const t = questSpot(f, questRng(seed, 2, 2, d), f.spawns.map((x) => x.tile));
      assert.ok(t, "a tile exists");
      const g = buildGrid(f), { dist } = flood(g, f.entry.x, f.entry.y);
      assert.ok(g.walkable(t.x, t.y) && dist[t.y * f.w + t.x] >= 0);
      assert.ok(!f.spawns.some((x) => x.tile.x === t.x && x.tile.y === t.y));
    }
  }
});

test("a prepared test floor and the boss arena get no quest objects", () => {
  const s = lobby(3, "sq2", "sq3");
  enterFloor(s, config.bossDepth);
  assert.equal(quest(s, "sq2").length + elites(s).length, 0);
});
