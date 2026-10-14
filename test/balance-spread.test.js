// R7-3 (customer decision 6: spread the difficulty): the depth curve of the monsters and the Lobby trip of the quest bot. Bounded by ticks, no wall clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, config, content, monsterStats, makeItem } from "../src/core/index.js";
import { buyPrice } from "../src/core/items/price.js";
import { BOT, createBotMemory, decide, noteResult } from "../bot/policy.js";

test("R7-3 depthMult: eight entries each, positive, hp and damage of every normal monster never fall with depth and the first floor equals its registry hp; bosses ignore the table", () => {
  for (const k of ["hp", "damage"]) { assert.equal(config.depthMult[k].length, config.maxDepth, k); assert.ok(config.depthMult[k].every((v) => v > 0), k); }
  assert.equal(config.depthMult.hp[0], 1);
  for (const id of Object.keys(content.monsters)) for (let d = 1; d < config.maxDepth; d++) {
    const a = monsterStats(id, d), b = monsterStats(id, d + 1);
    assert.ok(b.hp >= a.hp && b.damage >= a.damage, `${id} ${d}`);
  }
  const boss = content.bosses?.["regional-director"];
  if (boss) { const saved = config.depthMult; try { const at = monsterStats("regional-director", 9); config.depthMult = { hp: saved.hp.map(() => 3), damage: saved.damage.map(() => 3) }; assert.deepEqual(monsterStats("regional-director", 9), at); } finally { config.depthMult = saved; } }
});

test("R7-3 the early floors have teeth: floor 1 and 2 monsters hit harder than the plain linear scaling would make them (every type)", () => {
  for (const id of Object.keys(content.monsters)) for (const d of [1, 2]) {
    const plain = Math.round(content.monsters[id].damage * (100 + config.scaling.damagePct * (d - 1)) / 100);
    assert.ok(monsterStats(id, d).damage > plain, `${id} floor ${d}`);
  }
});

test("R7-3 the Emergency Exit costs no more than the starting gold (the bot buys it before the first descent)", () => {
  assert.ok(buyPrice(makeItem("emergency-exit")) <= config.startGold);
});

test("R7-3 the quest bot's trip to the Lobby takes the Emergency Exit: the first hand-in trip (floor 4) costs well under the 2.1 minutes of the climb", () => {
  const s = newGame(1, { start: "town", class: "sales-rep" }), mem = createBotMemory({ depth: 9, class: "sales-rep", respawn: true });
  for (let i = 0; i < 60000 && !(mem.q.trips >= 1); i++) {
    if (s.scene === "dead") noteResult(mem, { t: "respawn" }, applyInput(s, { t: "respawn" }));
    if (i % BOT.decideEvery === 0) { const c = decide(s, mem); if (c) noteResult(mem, c, applyInput(s, c)); }
    step(s);
  }
  assert.ok(mem.q.trips >= 1, "a trip happened");
  assert.ok(mem.q.stageTicks[0] > 0 && mem.q.stageTicks[0] <= 60 * 60, `trip ${mem.q.stageTicks[0]} ticks`); // under a minute (the climb through floors 3, 2 and 1 took about 7500 ticks)
});
