import { test } from "node:test";
import assert from "node:assert/strict";
import { step } from "../src/core/index.js";
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";
import { runOne } from "../bot/run-headless.mjs";
import { gameOn } from "./helpers.js";

const OPEN = [
  "##############",
  "#@...........#",
  "#............#",
  "#............#",
  "#............#",
  "##############",
];
const room = (x, y) => ({ x, y, w: 3, h: 3, kind: "cubicle" });
const chasing = (m, next) => Object.assign(m, { ai: "chase", next, moveT: 1, moveTotal: 10 });

test("S1-6 bot: with nothing in sight it walks to the nearest unexplored room centre", () => {
  const s = gameOn(OPEN, [["zombie-intern", 12, 4]]);
  s.floor.rooms = [room(0, 0), room(8, 1)];
  const mem = createBotMemory(), cmd = decide(s, mem);
  assert.equal(cmd?.t, "moveTo");
  assert.deepEqual(cmd.tile, { x: 9, y: 2 }); // the first room is within arriveRadius of the hero, so it counts as explored
  assert.equal(mem.rooms[0].done, true);
});

test("S1-6 bot: attacks the awake monster that is hitting the hero, and keeps its target (hysteresis)", () => {
  const s = gameOn(OPEN, [["zombie-intern", 2, 1], ["zombie-intern", 4, 1]]);
  s.floor.rooms = [];
  const [a, b] = s.monsters;
  a.ai = "attack"; chasing(b, { x: 3, y: 1 });
  const mem = createBotMemory();
  assert.deepEqual(decide(s, mem), { t: "attack", id: a.id });
  s.player.target = a.id;
  b.tile = { x: 1, y: 2 }; b.next = null; b.ai = "attack"; // equally close and also attacking: the current target stays
  assert.equal(decide(s, mem), null);
});

test("S1-6 bot: waits for a chaser instead of walking into it; gives up after waitTicks; a reckless bot never waits", () => {
  const make = () => {
    const s = gameOn(OPEN, [["zombie-intern", 7, 1]]);
    s.floor.rooms = [];
    chasing(s.monsters[0], { x: 6, y: 1 });
    s.player.path = [{ x: 2, y: 1 }]; // busy: walking
    return s;
  };
  const s = make(), mem = createBotMemory();
  assert.deepEqual(decide(s, mem), { t: "moveTo", tile: { x: 1, y: 1 } }); // a moveTo on the own tile cancels the walk
  s.tick += BOT.waitTicks + 1;
  decide(s, mem);
  assert.equal(mem.waitGaveUp, 1);
  assert.deepEqual(decide(make(), createBotMemory({ reckless: true })), { t: "attack", id: "m1" });
});

test("S1-6 bot: a refused move is counted; no living monster means the floor is clear", () => {
  const s = gameOn(OPEN, [["zombie-intern", 12, 4]]);
  s.floor.rooms = [room(8, 1)];
  const mem = createBotMemory(), cmd = decide(s, mem);
  noteResult(mem, cmd, { ok: false, error: "no path" });
  assert.equal(mem.failedMoves, 1);
  assert.equal(mem.goal, null);
  s.monsters[0].ai = "dead";
  assert.equal(decide(s, mem), null);
  assert.equal(mem.done, true);
});

test("S1-6 bot: no progress with an order active is counted as a stuck event", () => {
  const s = gameOn(OPEN, [["zombie-intern", 12, 4]]);
  s.floor.rooms = [room(8, 1)];
  const mem = createBotMemory();
  decide(s, mem);
  s.player.path = [{ x: 2, y: 1 }]; s.tick = BOT.stuckTicks + 10; // an order, but the hero has not moved or swung
  decide(s, mem);
  assert.equal(mem.stuck, 1);
});

test("S1-6 bot runs on the pure core are bounded and deterministic: seeds 1-5 clear their floor without stuck events", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const a = runOne(seed, 20000), b = runOne(seed, 20000);
    assert.deepEqual(a, b, `seed ${seed} is deterministic`);
    assert.equal(a.result, "cleared", `seed ${seed}: ${a.result}`);
    assert.equal(a.kills, a.total);
    assert.equal(a.stuck, 0);
    assert.ok(a.ttk.every((t) => t >= 0));
  }
});

test("S1 hardening: a hero whose target is already chasing it from two tiles away waits instead of stepping towards it", () => {
  const s = gameOn(OPEN, [["printer-imp", 5, 1]]);
  const m = s.monsters[0], p = s.player;
  p.tile = { x: 3, y: 1 };
  chasing(m, { x: 4, y: 1 });
  p.target = m.id; p.path = [{ x: 4, y: 1 }];
  step(s);
  assert.equal(p.path.length, 0);
  assert.equal(p.next, null);
  assert.deepEqual(p.tile, { x: 3, y: 1 });
});

test("S1 hardening: a target that is not coming (idle) is still walked to", () => {
  const s = gameOn(OPEN, [["zombie-intern", 6, 1]]);
  const m = s.monsters[0], p = s.player;
  p.tile = { x: 3, y: 1 };
  p.target = m.id; p.path = [];
  for (let i = 0; i < 20; i++) step(s);
  assert.ok(p.tile.x > 3 || p.next, "the hero moved towards the idle monster");
});
