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
const bare = (s) => { s.inventory.items.length = 0; return s; }; // exploration tests: nothing in the pack to manage
const chasing = (m, next) => Object.assign(m, { ai: "chase", next, moveT: 1, moveTotal: 10 });

test("S1-6 bot: with nothing in sight it walks to the nearest unexplored room centre", () => {
  const s = bare(gameOn(OPEN, [["zombie-intern", 12, 4]]));
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
  const s = bare(gameOn(OPEN, [["zombie-intern", 12, 4]]));
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
  const s = bare(gameOn(OPEN, [["zombie-intern", 12, 4]]));
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

test("S2 bot: drinks a belt coffee when health is low, picks up loot when the floor is clear, then equips an upgrade", () => {
  const s = gameOn(OPEN, [["zombie-intern", 12, 4]]);
  s.floor.rooms = [];
  s.player.hp = 5;
  const mem = createBotMemory();
  assert.deepEqual(decide(s, mem), { t: "useBelt", index: 0 });
  s.player.hp = s.player.hpMax;
  s.monsters[0].ai = "dead";
  s.groundItems.push({ id: "g1", gold: 4, tile: { x: 6, y: 3 }, label: "4 gold" });
  assert.deepEqual(decide(s, mem), { t: "equip", id: s.inventory.items[0].id, slot: "weapon" }); // the starting weapon beats bare hands
  s.equipment.weapon = s.inventory.items.shift();
  assert.deepEqual(decide(s, mem), { t: "pickup", id: "g1" });
  noteResult(mem, { t: "pickup", id: "g1" }, { ok: false, error: "inventory full" });
  assert.equal(decide(s, mem), null);
  assert.equal(mem.done, true);
});

test("S2 bot runs pick up loot and stay deterministic: seeds 1-5 clear, collect gold and wear gear", () => {
  let gold = 0, worn = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const a = runOne(seed, 30000);
    assert.equal(a.result, "cleared");
    assert.equal(a.stuck, 0);
    gold += a.gold; worn += a.worn;
  }
  assert.ok(gold > 0, `gold ${gold}`);
  assert.ok(worn > 0, `worn ${worn}`);
});

// ---- S2-3/S2-4: skills, points, floors ----
import { newGame, setLevel, learnSkill, applyInput, config } from "../src/core/index.js";

const lit = (s) => { s.floor.rooms = []; s.inventory.items.length = 0; return s; };

test("S2 bot: spends attribute points by weight and learns skills in the configured order", () => {
  const s = lit(gameOn(OPEN, [["zombie-intern", 12, 4]]));
  setLevel(s, 3); // 10 attribute points, 2 skill points
  const mem = createBotMemory();
  const seen = [];
  for (let i = 0; i < 12; i++) { const c = decide(s, mem); if (!c) break; assert.equal(applyInput(s, c).ok, true); seen.push(c); }
  assert.equal(s.player.attrPoints, 0); assert.equal(s.player.skillPoints, 0);
  assert.deepEqual(seen.filter((c) => c.t === "learnSkill").map((c) => c.id), ["stapler-throw", "stapler-throw"].slice(0, 2));
  assert.ok(s.player.attrs.stamina > 10 && s.player.attrs.grit > 10);
});

test("S2 bot: Coffee Break when hurt, Reply-All on a crowd, Stapler Throw at range with a clear line, nothing without mana", () => {
  const mk = (monsters) => { const s = lit(gameOn(OPEN, monsters)); setLevel(s, 10); for (const id of ["stapler-throw", "coffee-break", "reply-all", "mute"]) learnSkill(s, id); s.player.attrPoints = 0; s.player.skillPoints = 0; s.belt.fill(null); return s; };
  const awake = (s) => s.monsters.forEach((m) => { m.ai = "chase"; });
  let s = mk([["zombie-intern", 9, 1]]); awake(s);
  assert.deepEqual(decide(s, createBotMemory()), { t: "cast", skill: "stapler-throw", tile: { x: 9, y: 1 } });
  s.player.mp = 0;
  assert.notEqual(decide(s, createBotMemory())?.t, "cast");
  s = mk([["zombie-intern", 5, 1]]); awake(s); s.player.hp = 3;
  assert.equal(decide(s, createBotMemory()).skill, "coffee-break");
  s = mk([["zombie-intern", 2, 1], ["zombie-intern", 2, 2], ["zombie-intern", 1, 3], ["zombie-intern", 3, 2]]); awake(s);
  assert.equal(decide(s, createBotMemory()).skill, "reply-all");
  s = mk([["zombie-intern", 2, 1], ["zombie-intern", 2, 2]]); s.monsters.forEach((m) => { m.ai = "attack"; }); s.player.hp = Math.floor(s.player.hpMax * 0.55);
  assert.equal(decide(s, createBotMemory()).skill, "mute");
});

test("S2 bot: in the Lobby it buys belt potions, closes the dialog and takes the elevator", () => {
  const s = newGame(3, { start: "town" }), mem = createBotMemory({ depth: 3 });
  s.belt.fill(null); s.player.gold = 200;
  for (let i = 0; i < 1500 && s.scene === "town"; i++) {
    if (i % BOT.decideEvery === 0) { const c = decide(s, mem); if (c) noteResult(mem, c, applyInput(s, c)); }
    step(s);
  }
  assert.equal(s.scene, "floor"); assert.equal(s.depth, 1);
  assert.ok(s.belt.some((b) => b?.restores === "hp"), "potions on the belt");
  assert.ok(s.player.gold < 200);
});

test("S2 bot: a multi-floor run is deterministic, reaches floor 3 and reports depth and level", () => {
  const a = runOne(2, 40000, { depth: 3, respawn: true }), b = runOne(2, 40000, { depth: 3, respawn: true });
  assert.deepEqual(a, b);
  assert.equal(a.result, "cleared");
  assert.equal(a.depth, 3);
  assert.ok(a.level >= 2);
  assert.equal(a.stuck, 0);
});

test("S2 bot: after a death it respawns in the Lobby and carries on (counted in deaths)", () => {
  const s = newGame(1, { start: "town" }), mem = createBotMemory({ depth: 2, respawn: true });
  s.scene = "dead"; s.player.hp = 0; s.depth = 1;
  assert.deepEqual(decide(s, mem), { t: "respawn" });
  assert.equal(decide(s, createBotMemory()), null); // without respawn the run just ends
});
