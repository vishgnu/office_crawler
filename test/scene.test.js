import { test } from "node:test";
import assert from "node:assert/strict";
import { step, applyInput, newGame, snapshot } from "../src/core/index.js";
import { gameOn, run, OPEN } from "./helpers.js";

const ESC = { t: "key", code: "Escape" };

test("AC-NFR-A02-1 / AC-R-020-3 Escape pauses: nothing moves, no combat events, tick frozen", () => {
  const s = gameOn(OPEN, [["zombie-intern", 15, 4], ["printer-imp", 4, 4]]);
  run(s, 40); // monsters are chasing now
  assert.ok(s.monsters.every((m) => m.ai !== "idle"));
  step(s, [ESC]);
  assert.equal(s.paused, true);
  const before = JSON.stringify({ tick: s.tick, tiles: s.monsters.map((m) => m.tile), hp: s.player.hp, mon: s.monsters });
  for (let i = 0; i < 100; i++) { step(s); assert.equal(s.events.length, 0); }
  assert.equal(JSON.stringify({ tick: s.tick, tiles: s.monsters.map((m) => m.tile), hp: s.player.hp, mon: s.monsters }), before);
  step(s, [ESC]);
  assert.equal(s.paused, false);
  assert.equal(s.tick, JSON.parse(before).tick + 1);
});

test("clicks while paused are refused", () => {
  const s = gameOn(OPEN);
  applyInput(s, ESC);
  assert.equal(applyInput(s, { t: "click", tile: { x: 5, y: 5 }, button: 0 }).ok, false);
});

test("AC-R-023-2 dead scene: tick stops, nothing acts; AC-R-023-3 restart gives a fresh playable game", () => {
  const s = gameOn(OPEN, [["zombie-intern", 10, 4]]);
  s.player.hp = 1;
  run(s, 400);
  assert.equal(s.scene, "dead");
  const tick = s.tick;
  run(s, 100);
  assert.equal(s.tick, tick);
  assert.equal(applyInput(s, { t: "click", tile: { x: 5, y: 5 }, button: 0 }).ok, false);

  assert.equal(applyInput(s, { t: "restart" }).ok, true);
  assert.equal(s.scene, "floor");
  assert.equal(s.player.hp, s.player.hpMax);
  assert.equal(s.player.mp, s.player.mpMax);
  assert.deepEqual(s.player.tile, s.floor.entry);
  assert.equal(s.tick, 0);
  // AC-R-005-1 on the new game: walk to a tile a few steps away
  s.monsters = [];
  const target = { x: s.floor.exit.x, y: s.floor.exit.y };
  assert.equal(applyInput(s, { t: "moveTo", tile: target }).ok, true);
  run(s, 3000);
  assert.deepEqual(s.player.tile, target);
});

test("restart is refused while alive", () => {
  assert.equal(applyInput(gameOn(OPEN), { t: "restart" }).ok, false);
});

test("AC-R-001-1 (core part) newGame(1) then 120 ticks: floor scene, alive, no throw", () => {
  const s = newGame(1);
  run(s, 120);
  assert.equal(s.scene, "floor");
  assert.equal(s.tick, 120);
  assert.ok(s.player.hp > 0);
});

test("AC-R-002-1 a hostile in notice range acts without any input", () => {
  const s = gameOn(OPEN, [["zombie-intern", 14, 4]]);
  const m = s.monsters[0], tile = { ...m.tile };
  run(s, 60);
  assert.ok(m.ai !== "idle" || m.tile.x !== tile.x || s.player.hp < s.player.hpMax);
});

test("regeneration never exceeds the maximum", () => {
  const s = gameOn(OPEN);
  s.player.hp = s.player.hpMax - 1;
  run(s, 500);
  assert.equal(s.player.hp, s.player.hpMax);
});

test("snapshot is JSON-serialisable and carries derived positions", () => {
  const s = newGame(2);
  run(s, 30);
  const snap = snapshot(s);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
  assert.ok("pos" in snap.player && snap.config.tickHz === 60);
  assert.ok(!("pos" in s.player), "state itself carries no derived floats");
});
