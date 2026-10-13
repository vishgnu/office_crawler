import { test } from "node:test";
import assert from "node:assert/strict";
import { config, content, newGame, step, applyInput, spawnMonster, hashState, giveGold, vendorStock } from "../src/core/index.js";
import { buildGrid, flood } from "../src/core/grid.js";
import { FLOOR, STAIRS_DOWN } from "../src/core/tiles.js";

const cmd = (s, c) => applyInput(s, c);
const town = (seed = 3) => newGame({ seed, start: "town" });
const until = (s, f, max = 3000) => { for (let i = 0; i < max && !f(); i++) step(s); return f(); };
const npc = (s, id) => s.floor.npcs.find((n) => n.id === id);

test("AC-R-040-1 / AC-R-100-1 a game started in the Lobby: scene town, depth 0, no monsters, lobby theme with reception and breakroom", () => {
  const s = town();
  assert.equal(s.scene, "town"); assert.equal(s.depth, 0);
  assert.deepEqual(s.monsters, []);
  assert.equal(s.floor.theme, "lobby");
  assert.equal(s.floor.name, content.strings.lobbyName);
  const kinds = s.floor.rooms.map((r) => r.kind);
  assert.ok(kinds.includes("reception") && kinds.includes("breakroom"));
  assert.equal(s.deepestDepth, 1);
});

test("the default newGame still starts on floor 1 (the real game opts in with start: 'town')", () => {
  const s = newGame(5);
  assert.equal(s.scene, "floor"); assert.equal(s.depth, 1);
});

test("AC-R-040-2 nothing hostile exists in the Lobby: step(3000) keeps monsters empty and hp unchanged", () => {
  const s = town(); const hp = s.player.hp;
  for (let i = 0; i < 3000; i++) step(s);
  assert.deepEqual(s.monsters, []);
  assert.equal(s.player.hp, hp);
  assert.equal(s.tick, 3000);
});

test("AC-R-040-5 spawning a hostile in the Lobby is rejected", () => {
  const s = town();
  assert.equal(spawnMonster(s, "zombie-intern", { x: 8, y: 8 }), null);
  assert.deepEqual(s.monsters, []);
});

test("AC-R-040-3 the Lobby has a way down (the elevator) and four NPCs on distinct tiles, each reachable from the hero", () => {
  const s = town(), f = s.floor, g = buildGrid(f);
  assert.equal(f.tiles[f.exit.y * f.w + f.exit.x], STAIRS_DOWN);
  assert.deepEqual(f.npcs.map((n) => n.id).sort(), ["healer", "potions", "stash", "vendor"]);
  assert.equal(new Set(f.npcs.map((n) => `${n.tile.x},${n.tile.y}`)).size, 4);
  const { dist } = flood(g, s.player.tile.x, s.player.tile.y);
  for (const n of f.npcs) {
    assert.equal(f.tiles[n.tile.y * f.w + n.tile.x], FLOOR);
    let near = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && dist[(n.tile.y + dy) * f.w + n.tile.x + dx] >= 0) near = true;
    assert.ok(near, `${n.id} cannot be reached`);
  }
  assert.ok(dist[f.exit.y * f.w + f.exit.x] >= 0);
  assert.equal(g.walkable(f.npcs[0].tile.x, f.npcs[0].tile.y), false); // NPCs stand in the way
});

test("AC-R-041-1 / AC-R-005-4 clicking an NPC walks there and opens its dialog with a string-table line", () => {
  for (const id of ["vendor", "healer", "potions", "stash"]) {
    const s = town();
    assert.equal(cmd(s, { t: "click", tile: npc(s, id).tile }).ok, true);
    assert.ok(until(s, () => s.ui.dialog), `${id} dialog`);
    assert.equal(s.ui.dialog.npc, id);
    for (const key of s.ui.dialog.lines) assert.ok(content.strings[key].length > 0);
    assert.ok(content.strings[s.ui.dialog.nameKey].length > 0);
    if (id === "vendor" || id === "potions") assert.equal(s.vendor.id, content.npcs[id].vendorId);
    else assert.equal(s.vendor, null);
  }
});

test("the potion seller sells only potions: every strength tier allowed at the level (AC-R-041-4); the vendor also sells gear", () => {
  const s = town(); s.player.level = 12;
  s.player.tile = { x: 19, y: 5 };
  assert.equal(cmd(s, { t: "interact", id: "potions" }).ok, true);
  const stock = s.vendor.stock;
  assert.ok(stock.every((e) => e.unlimited && (e.item.kind === "potion" || e.item.base === "emergency-exit")));
  assert.ok(stock.some((e) => e.item.restores === "hp") && stock.some((e) => e.item.restores === "mp"));
  assert.equal(new Set(stock.filter((e) => e.item.kind === "potion").map((e) => e.item.base)).size, 6);
  assert.ok(stock.some((e) => e.item.base === "emergency-exit"));
  const t = town(); t.player.tile = { x: 5, y: 6 };
  cmd(t, { t: "interact", id: "vendor" });
  assert.ok(t.vendor.stock.some((e) => !e.unlimited));
});

test("openVendor needs a vendor NPC within interactRange in the Lobby", () => {
  const s = town();
  assert.equal(cmd(s, { t: "openVendor" }).ok, false); // standing at the entry, far from everyone
  assert.equal(s.vendor, null);
  s.player.tile = { x: 4, y: 6 };
  assert.equal(cmd(s, { t: "openVendor" }).ok, true);
  assert.equal(cmd(s, { t: "openVendor", id: "potions" }).ok, false); // the barista is in the other room
  const f = newGame(1);
  assert.equal(applyInput(f, { t: "openVendor" }).ok, false); // not on a floor either
});

test("AC-R-041-2/-3 the healer restores health for free, and changes nothing at full health", () => {
  const s = town(); s.player.tile = { x: 11, y: 6 };
  cmd(s, { t: "interact", id: "healer" });
  assert.equal(s.ui.dialog.npc, "healer");
  assert.equal(cmd(s, { t: "heal" }).ok, false); // full health
  s.player.hp = 3; const gold = s.player.gold;
  assert.equal(cmd(s, { t: "heal" }).ok, true);
  assert.equal(s.player.hp, s.player.hpMax); assert.equal(s.player.gold, gold);
  const t = town();
  assert.equal(cmd(t, { t: "heal" }).ok, false); // no healer dialog
});

test("AC-R-041-6 the dialog closes when the hero walks away or presses Escape", () => {
  const s = town(); s.player.tile = { x: 4, y: 6 };
  cmd(s, { t: "interact", id: "vendor" });
  assert.ok(s.ui.dialog && s.vendor);
  cmd(s, { t: "moveTo", tile: { x: 8, y: 11 } });
  assert.ok(until(s, () => !s.ui.dialog, 600));
  assert.equal(s.vendor, null);
  assert.ok(Math.max(Math.abs(s.player.tile.x - 4), Math.abs(s.player.tile.y - 5)) > config.interactRange);
  const t = town(); t.player.tile = { x: 24, y: 9 };
  cmd(t, { t: "interact", id: "stash" });
  assert.ok(t.ui.dialog);
  cmd(t, { t: "key", code: "Escape" });
  assert.equal(t.ui.dialog, null); assert.equal(t.paused, false);
  cmd(t, { t: "key", code: "Escape" });
  assert.equal(t.paused, true);
});

test("AC-R-041-5 NPC names and dialog lines come from the string table", () => {
  for (const n of Object.values(content.npcs)) {
    assert.ok(content.strings[n.nameKey]?.length > 0, n.id);
    assert.ok(content.strings[n.dialogKey]?.length > 0, n.id);
  }
});

test("AC-R-040-4 / QF-01-1 clicking the elevator takes the hero to the deepest reached floor (floor 1 for a new game)", () => {
  const s = town();
  assert.equal(cmd(s, { t: "click", tile: s.floor.exit }).ok, true);
  assert.ok(until(s, () => s.depth !== 0));
  assert.equal(s.depth, 1); assert.equal(s.scene, "floor");
  assert.deepEqual(s.player.tile, s.floor.entry);
  s.deepestDepth = 5;
  cmd(s, { t: "useStairs", dir: "up" });
  assert.ok(until(s, () => s.depth === 0));
  assert.equal(s.scene, "town");
  cmd(s, { t: "useStairs", dir: "down" });
  assert.ok(until(s, () => s.depth !== 0));
  assert.equal(s.depth, 5);
});

test("the town is deterministic and part of the JSON state", () => {
  const run = () => { const s = town(9); cmd(s, { t: "interact", id: "vendor" }); for (let i = 0; i < 400; i++) step(s); return s; };
  assert.equal(hashState(run()), hashState(run()));
  const s = run();
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
