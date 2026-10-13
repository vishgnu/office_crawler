// S3-1: the end boss, the Executive Suite, the unlocked stairs and the finale (R-045, AC-R-043-2 as amended, QF-04-5/-7/-8/-9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, step, applyInput, teleportFloor, generateFloor, config, content, keepPlaying, hashState } from "../src/core/index.js";
import { damageMonster } from "../src/core/systems/damage.js";
import { respawn } from "../src/core/systems/world.js";
import { buildGrid, flood } from "../src/core/grid.js";

const bossOf = (s) => s.monsters.find((m) => m.tier === "boss");
const types = (s) => s.events.map((e) => e.type);
/** A hero who cannot die and can be placed anywhere: the boss tests are about the boss. */
function arena(seed = 3) {
  const s = newGame(seed, { start: "town" });
  assert.equal(teleportFloor(s, config.bossDepth).ok, true);
  s.player.hpMax = s.player.hp = 1e7;
  return s;
}
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Park the hero a few tiles from the boss in its line of sight and wake the boss. */
function engage(s, at = null) {
  const b = bossOf(s);
  s.player.tile = at ?? { x: b.tile.x, y: b.tile.y + 5 };
  for (let i = 0; i < 80 && !b.boss.engaged; i++) step(s);
  assert.ok(b.boss.engaged, "the boss notices the hero");
  return b;
}
const hitFor = (s, m, n) => damageMonster(s, m, n, { source: "player" });

test("AC-R-045-1 the arena is depth 9, theme executive, and holds exactly one boss on a tile reachable from the entry", () => {
  for (const seed of [1, 2, 3, 50, 999]) {
    const s = newGame(seed, { start: "town" });
    assert.equal(teleportFloor(s, config.bossDepth).ok, true);
    assert.equal(s.depth, 9); assert.equal(s.scene, "floor"); assert.equal(s.floor.theme, "executive");
    const bosses = s.monsters.filter((m) => m.tier === "boss");
    assert.equal(bosses.length, 1); assert.equal(s.monsters.length, 1);
    assert.equal(bosses[0].type, "regional-director");
    const grid = buildGrid(s.floor), { dist } = flood(grid, s.floor.entry.x, s.floor.entry.y);
    assert.ok(grid.walkable(bosses[0].tile.x, bosses[0].tile.y));
    assert.ok(dist[bosses[0].tile.y * s.floor.w + bosses[0].tile.x] > 0, "reachable from the entry");
    for (let i = 0; i < s.floor.w * s.floor.h; i++) assert.ok(!grid.walk[i] || dist[i] >= 0, "every walkable tile is reachable");
    assert.equal(s.floor.exit, null, "the arena has no way further down");
    assert.equal(s.floor.bossStairs, false);
  }
  assert.deepEqual(generateFloor(4, 9), generateFloor(4, 9));
  assert.equal(teleportFloor(newGame(1), config.bossDepth + 1).ok, false);
});

test("the boss is not in the normal registry (population, cheats, style tables) but has stats of its own", () => {
  assert.equal(content.monsters["regional-director"], undefined);
  assert.ok(content.bosses["regional-director"].name);
  for (let d = 1; d <= 8; d++) assert.ok(generateFloor(7, d).spawns.every((sp) => sp.type !== "regional-director"));
  const b = bossOf(arena());
  assert.ok(b.hpMax > 1000 && b.boss.phase === 1 && b.boss.pattern === "p1" && b.level === 9);
});

test("AC-R-045-2 phase 2 begins once at config.boss.phase2At, with a different pattern id, and never reverts", () => {
  const s = arena(), b = engage(s);
  const limit = Math.floor(b.hpMax * config.boss.phase2At);
  hitFor(s, b, b.hp - limit - 5); step(s);
  assert.equal(b.boss.phase, 1);
  hitFor(s, b, 10); step(s);
  assert.equal(b.boss.phase, 2); assert.notEqual(b.boss.pattern, "p1");
  assert.equal(s.eventLog.filter((e) => e.type === "bossPhase").length, 1);
  b.hp = b.hpMax; for (let i = 0; i < 30; i++) step(s); // healed back above the threshold
  assert.equal(b.boss.phase, 2);
  assert.equal(s.eventLog.filter((e) => e.type === "bossPhase").length, 1);
});

test("AC-R-045-7 both patterns attack within 300 ticks against a stationary hero, with different event sequences", () => {
  const seq = (phase) => {
    const s = arena(), b = engage(s);
    if (phase === 2) { hitFor(s, b, b.hp - Math.floor(b.hpMax * 0.4)); }
    s.eventLog.length = 0;
    const out = [];
    for (let i = 0; i < 600; i++) { step(s); for (const e of s.events) if (e.type.startsWith("boss") && e.type !== "bossEngage") out.push(e.type); }
    return out;
  };
  const p1 = seq(1), p2 = seq(2);
  assert.ok(p1.includes("bossSlam"), "phase 1 slams");
  assert.ok(!p1.includes("bossVolley") && !p1.includes("bossSummon"), "phase 1 has no volley or summons");
  assert.ok(p2.includes("bossSlam") && p2.includes("bossVolley") && p2.includes("bossSummon"), "phase 2 has slam, volley and summons");
  assert.notDeepEqual(p1, p2);
  assert.deepEqual(seq(1), p1); assert.deepEqual(seq(2), p2); // deterministic
});

test("the slam is telegraphed with state and events and can be dodged: stepping out of the circle avoids all damage", () => {
  const dodge = (move) => {
    const s = arena(), b = engage(s);
    s.player.hp = s.player.hpMax = 5000;
    let tele = null;
    for (let i = 0; i < 600 && !tele; i++) { step(s); tele = s.events.find((e) => e.type === "bossTelegraph" && e.kind === "slam") ?? null; }
    assert.ok(tele && tele.radius > 0 && tele.ticks === config.boss.slam.windup && tele.tile);
    assert.equal(b.ai, "windup"); assert.equal(b.boss.windup.kind, "slam");
    if (move) s.player.tile = { x: tele.tile.x, y: tele.tile.y + Math.ceil(tele.radius) + 3 };
    s.player.hp = 5000; // count only what the slam itself does (the wind-up freezes the boss's melee)
    let slam = null;
    for (let i = 0; i < config.boss.slam.windup + 5 && !slam; i++) { step(s); slam = s.events.find((e) => e.type === "bossSlam") ?? null; }
    assert.ok(slam);
    return { slam, lost: 5000 - s.player.hp };
  };
  const still = dodge(false), moved = dodge(true);
  assert.equal(still.slam.hit, true); assert.ok(still.lost > 0);
  assert.equal(moved.slam.hit, false); assert.equal(moved.lost, 0);
});

test("phase 2 calls staff (capped), who give no loot or xp, and the volley fires config.boss.volley.shots projectiles", () => {
  const s = arena(), b = engage(s);
  hitFor(s, b, b.hp - Math.floor(b.hpMax * 0.4));
  let shots = 0;
  for (let i = 0; i < 1500; i++) {
    step(s);
    for (const e of s.events) if (e.type === "bossVolley") shots += e.shots;
    assert.ok(s.monsters.filter((m) => m.summoned && m.ai !== "dead").length <= config.boss.summon.max);
  }
  assert.ok(shots >= config.boss.volley.shots && shots % config.boss.volley.shots === 0);
  const adds = s.monsters.filter((m) => m.summoned);
  assert.ok(adds.length > 0 && adds.every((m) => config.boss.summon.types.includes(m.type)));
  const xp = s.player.xp, ground = s.groundItems.length;
  const add = adds.find((m) => m.ai !== "dead");
  hitFor(s, add, add.hp + 1);
  assert.equal(s.player.xp, xp); assert.equal(s.groundItems.length, ground);
});

test("AC-R-045-3/-4 killing the boss: guaranteed rare-or-better drops (the first a unique or a rare of its base), bossDefeated, then scene victory with run stats", () => {
  const s = arena(), b = engage(s);
  s.player.gold += 100;
  hitFor(s, b, b.hp);
  const gear = s.groundItems.filter((g) => g.item?.kind === "gear");
  assert.ok(gear.length >= config.boss.guaranteedDrops);
  assert.ok(gear.every((g) => g.item.rarity === "rare" || g.item.rarity === "unique"));
  assert.ok(gear[0].item.rarity === "unique" || gear[0].item.rarity === "rare");
  for (const g of gear) assert.ok(cheb(g.tile, b.tile) <= config.dropRadius);
  assert.equal(s.bossDefeated, true); assert.equal(s.scene, "floor");
  let n = 0;
  while (s.scene !== "victory" && n++ < config.victoryDelayTicks + 5) step(s);
  assert.equal(s.scene, "victory"); assert.ok(n <= config.victoryDelayTicks);
  assert.ok(types(s).includes("victory") || s.eventLog.some((e) => e.type === "victory"));
  const st = s.victory.stats;
  assert.ok(st.kills >= 1 && st.level === s.player.level && st.gold === s.player.gold && st.deepestDepth === 9);
  assert.ok(st.ticks <= s.tick && st.seconds === Math.floor(st.ticks / config.tickHz) && st.bossAttempts === 1);
  assert.ok(s.eventLog.some((e) => e.type === "autosave" && e.reason === "victory"));
  const t = s.tick; step(s); assert.equal(s.tick, t, "the simulation rests on the victory screen");
});

test("AC-R-045-5 keep playing: back in the Lobby with the character unchanged, bossDefeated stays, the boss never returns", () => {
  const s = arena(), b = engage(s);
  hitFor(s, b, b.hp);
  for (let i = 0; i < config.victoryDelayTicks + 2; i++) step(s);
  assert.equal(s.scene, "victory");
  const keep = { level: s.player.level, gold: s.player.gold, inv: structuredClone(s.inventory), eq: structuredClone(s.equipment), stash: structuredClone(s.stash) };
  assert.equal(applyInput(s, { t: "keepPlaying" }).ok, true);
  assert.equal(s.scene, "town"); assert.equal(s.depth, 0); assert.equal(s.bossDefeated, true); assert.equal(s.victory, null);
  assert.deepEqual({ level: s.player.level, gold: s.player.gold, inv: s.inventory, eq: s.equipment, stash: s.stash }, keep);
  assert.equal(s.deepestDepth, 9);
  assert.equal(applyInput(s, { t: "keepPlaying" }).ok, false, "only from the victory screen");
  assert.equal(keepPlaying(s).ok, false);
  assert.ok(s.events.some((e) => e.type === "autosave" && e.reason === "town"));
  teleportFloor(s, 9);
  assert.equal(s.monsters.length, 0, "the boss is not respawned");
  teleportFloor(s, 8);
  assert.equal(s.depth, 8);
  const town = newGame(1, { start: "town" }); assert.equal(applyInput(town, { t: "keepPlaying" }).ok, false);
});

test("AC-R-045-6 / QF-04-9 the boss resets to full health and phase 1 when the hero leaves the arena or dies", () => {
  for (const how of ["leave", "die"]) {
    const s = arena(), b = engage(s);
    hitFor(s, b, b.hp - Math.floor(b.hpMax * 0.3)); step(s);
    assert.equal(b.boss.phase, 2);
    if (how === "leave") { s.player.tile = { ...s.floor.entry }; assert.equal(applyInput(s, { t: "useStairs", dir: "up" }).ok, true); step(s); assert.equal(s.depth, 8); }
    else { s.player.hp = 1; s.player.hpMax = 1; s.scene = "dead"; assert.equal(respawn(s).ok, true); assert.equal(s.depth, 0); }
    teleportFloor(s, 9);
    const nb = bossOf(s);
    assert.ok(nb && nb !== b && nb.hp === nb.hpMax && nb.boss.phase === 1 && nb.boss.engaged === false, how);
    assert.equal(s.bossDefeated, false);
  }
});

test("AC-R-043-2 (amended) clearing floor 8 unlocks the stairs to the arena; the stairs stay locked until then, killing by cheat array edits does not count", () => {
  const s = newGame(4, { start: "town" });
  teleportFloor(s, config.maxDepth);
  s.player.hpMax = s.player.hp = 1e7;
  assert.equal(s.bossUnlocked, false);
  assert.equal(applyInput(s, { t: "useStairs", dir: "down" }).ok, false);
  assert.ok(types(s).includes("stairsLocked"));
  const live = s.monsters.filter((m) => m.ai !== "dead");
  assert.ok(live.length > 5);
  live.slice(0, -1).forEach((m) => hitFor(s, m, m.hp));
  assert.equal(s.bossUnlocked, false, "one monster is still alive");
  const last = live[live.length - 1];
  hitFor(s, last, last.hp);
  assert.equal(s.bossUnlocked, true); assert.ok(types(s).includes("stairsUnlocked"));
  s.player.tile = { x: s.floor.exit.x, y: s.floor.exit.y - 0 }; s.player.path = []; s.player.next = null;
  assert.equal(applyInput(s, { t: "useStairs", dir: "down" }).ok, true);
  assert.equal(s.depth, 9); assert.equal(s.floor.theme, "executive");
  assert.equal(bossOf(s).tier, "boss");
  assert.ok(s.events.some((e) => e.type === "autosave" && e.reason === "floor"));
  // no way down from the arena, and the Lobby elevator still goes to floor 8
  assert.equal(applyInput(s, { t: "useStairs", dir: "down" }).ok, false);
  teleportFloor(s, 0);
  assert.equal(s.deepestDepth, 9);
  assert.equal(applyInput(s, { t: "useStairs", dir: "down" }).ok, true);
});

test("Mute does not silence the boss and Reply-All does not push it back; its hits do not stagger it", () => {
  const s = arena(), b = engage(s, null);
  s.player.skills["mute"] = 1; s.player.mp = s.player.mpMax = 100; s.player.tile = { x: b.tile.x, y: b.tile.y + 2 };
  s.player.castT = 0;
  assert.equal(applyInput(s, { t: "cast", skill: "mute", tile: s.player.tile }).ok, true);
  assert.equal(b.muteT, 0);
  assert.ok(s.events.some((e) => e.type === "resisted"));
  const before = { ...b.tile };
  damageMonster(s, b, 50, { source: "player", from: s.player.tile, knock: true });
  assert.deepEqual(b.tile, before); assert.notEqual(b.ai, "stagger");
});

test("the encounter is deterministic and survives a JSON round trip mid-fight", () => {
  const run = () => { const s = arena(5), b = engage(s); hitFor(s, b, Math.floor(b.hp * 0.6)); for (let i = 0; i < 700; i++) step(s); return s; };
  assert.equal(hashState(run()), hashState(run()));
  const a = arena(5), b0 = engage(a); hitFor(a, b0, Math.floor(b0.hp * 0.6)); for (let i = 0; i < 200; i++) step(a);
  const c = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 400; i++) { step(a); step(c); }
  assert.equal(hashState(a), hashState(c));
});

import { createBotMemory, decide, BOT } from "../bot/policy.js";
test("the careful bot dodges: during a slam wind-up it walks out of the circle, and holds still rather than walking back in", () => {
  const s = arena(), b = engage(s);
  let tele = null;
  for (let i = 0; i < 600 && !tele; i++) { step(s); tele = s.events.find((e) => e.type === "bossTelegraph" && e.kind === "slam") ?? null; }
  s.player.tile = { x: tele.tile.x, y: tele.tile.y }; s.player.next = null; s.player.path = [];
  const mem = createBotMemory({ depth: 9 });
  const cmd = decide(s, mem);
  assert.equal(cmd.t, "moveTo");
  const d = Math.sqrt((cmd.tile.x - tele.tile.x) ** 2 + (cmd.tile.y - tele.tile.y) ** 2);
  assert.ok(d > tele.radius + BOT.dodgeMargin - 0.01, "the target tile is outside the circle");
  assert.equal(decide(s, mem), null, "already on the way: no new order (and no attack that would walk back in)");
  assert.equal(b.boss.windup.kind, "slam");
});
