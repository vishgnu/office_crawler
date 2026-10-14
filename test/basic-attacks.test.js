// R4-2: class basic attacks (ADR-0005 section 3): Strike melee, Toss and Zap shoot from range with a clear flight line and cost no mana.
import { test } from "node:test";
import assert from "node:assert/strict";
import { content, applyInput, step, config, setLevel } from "../src/core/index.js";
import { rayClear } from "../src/core/los.js";
import { buildGrid } from "../src/core/grid.js";
import { gameOn, run, OPEN, floorFromRows } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const evs = (s, type) => s.eventLog.filter((e) => e.type === type);
const playerMisses = (s) => evs(s, "miss").filter((e) => e.source === "player");

test("the three basics are free and differ in kind: strike melee, toss and zap projectiles with their own range", () => {
  const { strike, toss, zap } = content.skills;
  assert.deepEqual([strike.archetype, toss.archetype, zap.archetype], ["melee", "projectile", "projectile"]);
  for (const b of [strike, toss, zap]) { assert.equal(b.mana(1), 0); assert.equal(b.kind, "basic"); }
  assert.ok(toss.delivery.range > zap.delivery.range, "toss reaches a little farther than zap");
  assert.deepEqual([toss.effects[0].type, zap.effects[0].type], ["physical", "shock"]);
});

test("a ranged class attacks from range: the hero stops at the basic's range, shoots, never walks adjacent, and spends no mana", () => {
  for (const [cls, range] of [["sales-rep", content.skills.toss.delivery.range], ["it-wizard", content.skills.zap.delivery.range]]) {
    const s = gameOn(OPEN, [["zombie-intern", 18, 4]], 1, { class: cls });
    const m = s.monsters[0]; m.ai = "idle"; m.hp = m.hpMax = 3000; m.muteT = 99999; // it stays where it is
    s.player.attackRating = 100000;
    const mp = s.player.mp;
    cmd(s, { t: "attack", id: m.id });
    run(s, 600);
    const dx = m.tile.x - s.player.tile.x;
    assert.ok(dx > 1.5 && dx <= range, `${cls}: stopped ${dx} tiles away (range ${range})`);
    assert.ok(m.hp < m.hpMax, `${cls} damaged the monster`);
    assert.ok(evs(s, "projectile").length >= 2);
    assert.ok(s.player.mp >= mp, "a basic attack never spends mana");
    assert.ok(evs(s, "cast").length === 0, "a basic attack is not a cast");
  }
});

test("the melee class still walks adjacent and swings; no projectile is fired", () => {
  const s = gameOn(OPEN, [["zombie-intern", 14, 4]]);
  const m = s.monsters[0]; m.ai = "idle"; m.hp = m.hpMax = 3000; s.player.attackRating = 100000;
  cmd(s, { t: "attack", id: m.id });
  run(s, 600);
  assert.ok(Math.max(Math.abs(m.tile.x - s.player.tile.x), Math.abs(m.tile.y - s.player.tile.y)) <= 1);
  assert.ok(m.hp < m.hpMax); assert.equal(evs(s, "projectile").length, 0);
});

test("zap lands without a hit roll (shock); toss rolls to hit like a physical shot", () => {
  const z = gameOn(OPEN, [["zombie-intern", 12, 4]], 1, { class: "it-wizard" });
  z.monsters[0].ai = "idle"; z.monsters[0].defense = 100000; z.monsters[0].hp = z.monsters[0].hpMax = 5000; z.player.attackRating = 0;
  cmd(z, { t: "attack", id: z.monsters[0].id }); run(z, 300);
  assert.ok(z.monsters[0].hp < 5000); assert.equal(playerMisses(z).length, 0);
  const t = gameOn(OPEN, [["zombie-intern", 12, 4]], 1, { class: "sales-rep" });
  t.monsters[0].ai = "idle"; t.monsters[0].defense = 100000; t.monsters[0].hp = t.monsters[0].hpMax = 5000; t.player.attackRating = 0;
  cmd(t, { t: "attack", id: t.monsters[0].id }); run(t, 600);
  assert.ok(playerMisses(t).length >= 1);
});

test("a wall between the hero and the target: the hero walks until a shot would arrive instead of firing into the wall", () => {
  const rows = ["####################", "#........#.........#", "#........#.........#", "#........#.........#", "#........@.........#", "#........#.........#", "#........#.........#", "####################"];
  const s = gameOn(rows, [["zombie-intern", 15, 1]], 1, { class: "sales-rep" });
  s.player.tile = { x: 3, y: 1 };
  const m = s.monsters[0]; m.ai = "idle"; m.hp = m.hpMax = 5000; s.player.attackRating = 100000;
  cmd(s, { t: "attack", id: m.id });
  run(s, 900);
  assert.ok(m.hp < m.hpMax, "got through the door and hit it");
  const walls = evs(s, "projectileEnd").filter((e) => e.reason === "wall").length;
  assert.ok(walls <= 1, `${walls} shots wasted on the wall`);
});

test("rayClear matches the projectile: clear lines are clear, a wall tile on the ray blocks it, the target tile itself does not", () => {
  const f = floorFromRows(["#######", "#.@...#", "#..#..#", "#.....#", "#######"]);
  const g = buildGrid(f);
  assert.equal(rayClear(g, { x: 1, y: 1 }, { x: 5, y: 1 }), true);
  assert.equal(rayClear(g, { x: 1, y: 2 }, { x: 5, y: 2 }), false);
  assert.equal(rayClear(g, { x: 1, y: 2 }, { x: 3, y: 2 }), true, "the target tile does not block");
  assert.equal(rayClear(g, { x: 1, y: 1 }, { x: 1, y: 1 }), true);
});

test("right mouse with the class basic selected attacks the monster under the cursor (toss / zap), not a cast", () => {
  const s = gameOn(OPEN, [["zombie-intern", 12, 4]], 1, { class: "it-wizard" });
  cmd(s, { t: "assignSkill", slot: 1, id: "zap" });
  cmd(s, { t: "key", code: "F2" });
  assert.equal(cmd(s, { t: "mouse", phase: "down", tile: { x: 12, y: 4 }, button: 2 }).ok, true);
  assert.equal(s.player.target, s.monsters[0].id);
  assert.equal(cmd(s, { t: "cast", skill: "zap", tile: { x: 12, y: 4 } }).ok, false, "a basic attack is not cast");
});
