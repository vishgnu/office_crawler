// R7-0.2 AC-R-245-1 (no side effects on trading, healing, stash; hand-in to another NPC refused) and the readers of a ground entry without `item`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyInput, config, content, snapshot, enterFloor, dropItem, makeItem, step, hashStateWithout } from "../src/core/index.js";
import { itemFloorOf } from "../src/core/systems/quests.js";
import { decide, createBotMemory } from "../bot/policy.js";

function near(s, npcId) {
  const n = s.floor.npcs.find((o) => o.id === npcId);
  s.player.tile = { x: n.tile.x, y: n.tile.y + 1 };
  s.ui.dialog = null;
  assert.ok(applyInput(s, { t: "interact", id: npcId }).ok);
}
const open3 = (seed) => { // a game with all three quests accepted, and the same game without
  const a = newGame(seed, { start: "town" }), b = newGame(seed, { start: "town" });
  for (const id of content.sideIds) { near(a, content.quests[id].giver); assert.ok(applyInput(a, { t: "questAccept", id }).ok); }
  return [a, b];
};
const noIds = (k, v) => (k === "id" ? undefined : v); // item ids differ when dialogs minted vendor stock in another order
const econ = (s) => JSON.stringify({ gold: s.player.gold, inv: s.inventory, belt: s.belt, stash: s.stash, hp: s.player.hp }, noIds);

test("AC-R-245-1 / AC-R-258-1 five side quests, givers vendor/healer/potions/stash/vendor, no new NPC", () => {
  assert.equal(content.sideIds.length, config.quests.sideCount);
  assert.deepEqual(content.sideIds.map((id) => content.quests[id].giver), ["vendor", "healer", "potions", "stash", "vendor"]);
  assert.deepEqual(Object.keys(content.npcs).sort(), ["healer", "potions", "stash", "vendor"]);
});

test("AC-R-245-1 vendor trading gives identical results with the quests open (buy, sell)", () => {
  const [a, b] = open3(4);
  for (const s of [a, b]) {
    near(s, "vendor");
    s.player.gold = 5000;
    const idx = s.vendor.stock.findIndex((e) => !e.unlimited);
    assert.ok(applyInput(s, { t: "buy", index: idx }).ok);
    const it = s.inventory.items[s.inventory.items.length - 1];
    assert.ok(applyInput(s, { t: "sell", id: it.id }).ok);
    assert.ok(applyInput(s, { t: "buy", index: 0 }).ok);
  }
  assert.equal(econ(a), econ(b));
});

test("AC-R-245-1 healing and the stash give identical results with the quests open", () => {
  const [a, b] = open3(4);
  for (const s of [a, b]) {
    s.player.hp = 1;
    near(s, "healer");
    assert.ok(applyInput(s, { t: "heal" }).ok);
    const w = makeItem("lukewarm-coffee"); w.id = "ix1"; w.x = 0; w.y = 0; s.inventory.items.push(w);
    near(s, "stash");
    assert.ok(applyInput(s, { t: "stash", id: "ix1", to: "stash" }).ok);
  }
  assert.equal(econ(a), econ(b));
  assert.equal(a.player.hp, a.player.hpMax);
  assert.equal(a.stash.items.length, 1);
});

test("AC-R-245-1 decline leaves the quest available with no state change; a hand-in to a different NPC is refused", () => {
  const s = newGame(2, { start: "town" });
  near(s, "vendor");
  const h = hashStateWithout(s, { paths: ["ui", "vendor", "events", "eventLog"] });
  assert.ok(applyInput(s, { t: "closeDialog" }).ok);
  assert.equal(hashStateWithout(s, { paths: ["ui", "vendor", "events", "eventLog"] }), h);
  assert.equal(s.quests.sq1.s, "available");
  s.quests.sq2 = { s: "ready", p: 1 }; s.player.pouch.push({ id: "qi-sq2", quest: "sq2" });
  near(s, "vendor");
  const r = applyInput(s, { t: "questHandIn", id: "sq2" });
  assert.deepEqual([r.ok, r.error], [false, "wrong npc"]);
  assert.equal(s.quests.sq2.s, "ready");
});

// ---- readers of a ground entry without `item` (ADR-0007 risk 3, contract 4.4) ----
function withEntry(seed) {
  const s = newGame(seed, { start: "town" });
  near(s, "healer"); applyInput(s, { t: "questAccept", id: "sq2" }); s.ui.dialog = null;
  enterFloor(s, itemFloorOf(seed));
  return s;
}

test("loot.js: the ground cap never evicts the quest entry (keep) and does not throw on an entry without item", () => {
  const s = withEntry(3);
  for (let i = 0; i < config.groundItemCap + 20; i++) dropItem(s, makeItem("lukewarm-coffee"), s.player.tile);
  assert.equal(s.groundItems.filter((g) => g.quest === "sq2").length, 1);
  assert.ok(s.groundItems.length <= config.groundItemCap);
});

test("intent.js: pickup orders and walking over use only tile and id of the entry; hover-style lookups by tile work", () => {
  const s = withEntry(3), e = s.groundItems.find((g) => g.quest);
  assert.ok(e.tile && e.id && !e.item && !e.gold);
  assert.equal(applyInput(s, { t: "pickup", id: "nope" }).ok, false);
  s.monsters = [];
  assert.ok(applyInput(s, { t: "pickup", id: e.id }).ok);
  assert.ok(s.groundItems.find((g) => g.tile.x === e.tile.x && g.tile.y === e.tile.y));
});

test("bot nextLoot: the quest entry is an ordinary pickup target (tile and id only), no throw", () => {
  const s = withEntry(3), e = s.groundItems.find((g) => g.quest);
  s.monsters = [];
  s.player.tile = { x: e.tile.x - 1, y: e.tile.y };
  const mem = createBotMemory();
  let cmd = null;
  for (let i = 0; i < 5 && !cmd; i++) cmd = decide(snapshot(s), mem);
  assert.ok(cmd);
  assert.equal(JSON.stringify(snapshot(s).groundItems.find((g) => g.quest).item), undefined);
});

test("snapshot of a state holding a quest entry and a pouch item round-trips through JSON", () => {
  const s = withEntry(3);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(snapshot(s))));
  step(s, []);
});
