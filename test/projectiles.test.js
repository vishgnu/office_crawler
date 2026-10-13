import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, applyInput, step, setLevel, learnSkill, newGame, hashState } from "../src/core/index.js";
import { gameOn, run, OPEN } from "./helpers.js";

const cmd = (s, c) => applyInput(s, c);
const evs = (s, type) => s.events.filter((e) => e.type === type);
const WALLED = [
  "####################",
  "#........#.........#",
  "#........#.........#",
  "#........#.........#",
  "#........@.........#",
  "#........#.........#",
  "#........#.........#",
  "####################",
];
const withStapler = (rows, monsters) => {
  const s = gameOn(rows, monsters); setLevel(s, 3); learnSkill(s, "stapler-throw");
  s.player.attackRating = 100000; // a hit chance at the config ceiling
  return s;
};
const cost = content.skills["stapler-throw"].mana(1);

test("AC-R-022-1 a learned projectile skill creates one player projectile pointing at the tile and costs exactly its mana", () => {
  const s = withStapler(OPEN), mp = s.player.mp;
  assert.equal(cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 15, y: 4 } }).ok, true);
  assert.equal(s.projectiles.length, 1);
  const pr = s.projectiles[0];
  assert.equal(pr.owner, "player");
  assert.deepEqual([pr.dir.x, pr.dir.y], [1, 0]);
  assert.equal(s.player.mp, mp - cost);
  const up = withStapler(OPEN); cmd(up, { t: "cast", skill: "stapler-throw", tile: { x: 9, y: 0 } });
  assert.deepEqual([up.projectiles[0].dir.x, up.projectiles[0].dir.y], [0, -1]);
  assert.equal(cmd(withStapler(OPEN), { t: "cast", skill: "stapler-throw", tile: { x: 9, y: 4 } }).ok, false); // no direction
});

test("AC-R-022-2 the projectile moves by its speed per tick and is removed at a wall without damage; it never hits its owner", () => {
  const s = withStapler(OPEN, [["zombie-intern", 1, 1]]);
  s.monsters[0].ai = "idle";
  cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 18, y: 4 } });
  const pr = s.projectiles[0], x0 = pr.pos.x;
  step(s);
  assert.ok(Math.abs(s.projectiles[0].pos.x - (x0 + pr.speed)) < 1e-9);
  assert.equal(s.projectiles[0].pos.y, 4);
  let ended = null;
  for (let i = 0; i < 100 && s.projectiles.length; i++) { step(s); ended = evs(s, "projectileEnd")[0] ?? ended; }
  assert.equal(s.projectiles.length, 0);
  assert.equal(ended.reason, "wall");
  assert.equal(evs(s, "hit").length, 0);
  assert.equal(s.player.hp, s.player.hpMax); // never hits its owner
});

test("AC-R-022-2 a projectile hits the first monster on its line: one hit or miss event, damage like a swing", () => {
  const s = withStapler(OPEN, [["zombie-intern", 14, 4]]);
  const m = s.monsters[0]; m.ai = "idle"; m.hp = m.hpMax = 500;
  cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 14, y: 4 } });
  let hits = 0, misses = 0;
  for (let i = 0; i < 60 && s.projectiles.length; i++) { step(s); hits += evs(s, "hit").length; misses += evs(s, "miss").length; }
  assert.equal(s.projectiles.length, 0);
  assert.equal(hits + misses, 1);
  const def = content.skills["stapler-throw"];
  if (hits) { const lost = 500 - m.hp; assert.ok(lost >= def.dmgMin(1) && lost <= def.dmgMax(1) + Math.floor((s.player.damage.min + s.player.damage.max) / 2 * def.weaponShare)); }
  else assert.equal(m.hp, 500);
});

test("AC-R-022-3 without enough mana no projectile is created, mp is unchanged and noMana is emitted", () => {
  const s = withStapler(OPEN); s.player.mp = cost - 1;
  assert.equal(cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 15, y: 4 } }).ok, false);
  assert.equal(s.projectiles.length, 0); assert.equal(s.player.mp, cost - 1);
  assert.equal(s.events.filter((e) => e.type === "noMana").length, 1);
});

test("AC-R-022-5 two monsters in line: only the nearer is hit, the projectile is consumed", () => {
  const s = withStapler(OPEN, [["zombie-intern", 12, 4], ["zombie-intern", 14, 4]]);
  for (const m of s.monsters) { m.ai = "idle"; m.hp = m.hpMax = 500; }
  cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 18, y: 4 } });
  for (let i = 0; i < 80; i++) step(s);
  assert.equal(s.projectiles.length, 0);
  assert.equal(s.monsters[1].hp, 500);
  assert.ok(s.monsters[0].hp < 500 || s.eventLog.some((e) => e.type === "miss"));
});

test("a projectile cannot pass a wall: the monster behind it is untouched", () => {
  const s = withStapler(WALLED, [["zombie-intern", 12, 4]]);
  const m = s.monsters[0]; m.ai = "idle";
  s.player.tile = { x: 5, y: 4 };
  cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 5, y: 1 } }); // up into the wall
  for (let i = 0; i < 60; i++) step(s);
  assert.equal(s.projectiles.length, 0);
  assert.equal(m.hp, m.hpMax);
});

test("AC-R-022-4 / AC-R-032-8 a ranged monster with a clear line in range stops and shoots through the shared projectile code", () => {
  const s = gameOn(OPEN, [["printer-demon", 15, 4]]);
  const m = s.monsters[0], range = content.monsters["printer-demon"].range;
  m.ai = "notice"; m.aiT = 1;
  let shot = null, moved = false;
  const start = { ...m.tile };
  for (let i = 0; i < 300 && !shot; i++) { step(s); shot = s.projectiles.find((p) => p.owner === m.id) ?? null; if (m.next) moved = true; }
  assert.ok(shot, "the demon fired");
  assert.equal(shot.hostile, true);
  const d = Math.max(Math.abs(m.tile.x - s.player.tile.x), Math.abs(m.tile.y - s.player.tile.y));
  assert.ok(d > 1 && d <= range, `distance ${d}`); // it did not close to melee
  assert.ok(m.tile.x <= start.x);
  const hp = s.player.hp;
  for (let i = 0; i < 80; i++) step(s);
  assert.ok(s.player.hp < hp || s.eventLog.some((e) => e.type === "miss" && e.source === m.id), "hit or miss reached the hero");
  assert.equal(s.monsters.length, 1);
});

test("a ranged monster behind a wall does not shoot (line of sight is required)", () => {
  const s = gameOn(WALLED, [["printer-demon", 12, 2]]);
  s.player.tile = { x: 5, y: 2 };
  const m = s.monsters[0]; m.ai = "chase"; m.path = []; m.goal = { x: 5, y: 2 };
  for (let i = 0; i < 40; i++) { step(s); assert.equal(s.projectiles.length, 0); }
});

test("monster projectiles pass over other monsters and only the hero is hit", () => {
  const s = gameOn(OPEN, [["printer-demon", 16, 4], ["zombie-intern", 13, 4]]);
  const z = s.monsters[1]; z.ai = "idle"; const hp = z.hp;
  s.monsters[0].ai = "attack"; s.monsters[0].attackT = config.monsterAttackHitTick - 1;
  for (let i = 0; i < 100; i++) step(s);
  assert.equal(z.hp, hp);
});

test("projectile runs are deterministic and survive a JSON round trip", () => {
  const make = () => { const s = withStapler(OPEN, [["zombie-intern", 14, 4]]); cmd(s, { t: "cast", skill: "stapler-throw", tile: { x: 14, y: 4 } }); return s; };
  const a = make(), b = JSON.parse(JSON.stringify(make()));
  for (let i = 0; i < 30; i++) { step(a); step(b); }
  assert.equal(hashState(a), hashState(b));
});
