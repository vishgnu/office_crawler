// CR7L-05: a permanent proof that withLegacyBalance puts back every number the R7-3 balance pass moved (docs/reviews/R7-balance.md), for floors 1-8 and the boss:
// the generated spawns of seeds 1-60 x floors 1-8 and monsterStats of every monster type (boss included) on depths 1-9 hash to values recorded from the pre-R7-3 numbers.
// Later balance work (R8) must either keep these hashes under the helper (the helper neutralises its own knobs) or it changed something it should not have.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { generateFloor, monsterStats, config } from "../src/core/index.js";
import { allMonsters } from "../src/core/content/monsters.js";
import { withLegacyBalance } from "./balance-legacy.js";

const sha1 = (h) => h.digest("hex");
const SPAWNS_LEGACY = "9ac4acd325b30cdc826ad2eed593f8092d6952ac"; // sha1 over JSON.stringify(spawns) of generateFloor(seed, depth), seeds 1..60 outer, depths 1..8 inner
const STATS_LEGACY = "86fdc7aa3e196640de848ff4f6cf39522e31855e";                                       // sha1 over JSON.stringify([type, depth, monsterStats(type, depth)]), registry order, depths 1..9

test("[CR7L-05] under withLegacyBalance the spawns of seeds 1-60 x floors 1-8 are the pre-R7-3 ones", () => {
  const h = createHash("sha1");
  withLegacyBalance(() => { for (let s = 1; s <= 60; s++) for (let d = 1; d <= 8; d++) h.update(JSON.stringify(generateFloor(s, d).spawns)); });
  assert.equal(sha1(h), SPAWNS_LEGACY);
});

test("[CR7L-05] under withLegacyBalance monsterStats of every type (boss included) on depths 1-9 are the pre-R7-3 ones", () => {
  const h = createHash("sha1");
  withLegacyBalance(() => { for (const id of Object.keys(allMonsters)) for (let d = 1; d <= 9; d++) h.update(JSON.stringify([id, d, monsterStats(id, d)])); });
  assert.equal(sha1(h), STATS_LEGACY);
});

test("[CR7L-05] the helper restores every number it changed, boss included, and refuses an asynchronous callback", () => {
  const before = JSON.stringify([config.depthMult, config.scaling.xpPct, config.championChance, config.boss.hpMult, config.boss.damageMult]);
  assert.throws(() => withLegacyBalance(() => Promise.resolve()), /synchronous/);
  assert.equal(JSON.stringify([config.depthMult, config.scaling.xpPct, config.championChance, config.boss.hpMult, config.boss.damageMult]), before);
  withLegacyBalance(() => assert.deepEqual([config.boss.hpMult, config.boss.damageMult], [3, 0.7]));
});
