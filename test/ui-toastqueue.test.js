// CR7L-01 / CR7L-02 (late R7 review): the toast lane with a fake clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createToastQueue } from "../src/ui/toastqueue.js";

function lane() {
  let t = 1000; const timers = []; const shown = [];
  const q = createToastQueue({ show: (n) => shown.push(n.text), now: () => t, setT: (fn, ms) => { timers.push({ at: t + ms, fn }); return timers.length; }, clearT: (id) => { if (id && timers[id - 1]) timers[id - 1].fn = null; } });
  const advance = (ms) => { t += ms; for (const x of timers) if (x.fn && x.at <= t) { const f = x.fn; x.fn = null; f(); } };
  return { q, shown, advance, set: (v) => { t = v; } };
}
const quest = { quest: true, kind: "quest.completed", qid: "sq1" }, passive = (kind) => ({ passive: true, kind });

test("CR7L-01 a level-up and a quest reward in one dispatch: both are shown, in order, each once", () => {
  const { q, shown, advance } = lane();
  q.begin();
  q.offer("Level 5!", undefined, passive("levelup"));
  q.offer("Quest done (60 gold)", 4000, quest);
  q.offer("Floor 3: Archives", undefined, passive("floorEnter"));
  q.end();
  assert.deepEqual(shown, ["Quest done (60 gold)"], "the reward goes first and keeps the lane");
  assert.deepEqual(q.waiting(), ["Level 5!", "Floor 3: Archives"]);
  advance(4000); assert.deepEqual(shown, ["Quest done (60 gold)", "Level 5!"]);
  advance(3200); assert.deepEqual(shown, ["Quest done (60 gold)", "Level 5!", "Floor 3: Archives"]);
  advance(10000); assert.equal(shown.length, 3, "nothing is shown twice");
});

test("CR7L-01 two passive lines of one dispatch (no quest) are shown one after the other, not overwritten", () => {
  const { q, shown, advance } = lane();
  q.begin(); q.offer("Level 2!", undefined, passive("levelup")); q.offer("Floor 2", undefined, passive("floorEnter")); q.end();
  assert.deepEqual(shown, ["Level 2!"]); advance(3200); assert.deepEqual(shown, ["Level 2!", "Floor 2"]);
});

test("CR7L-02 a direct toast does not cut a held quest line short and does not empty the waiting list", () => {
  const { q, shown, advance } = lane();
  q.offer("Quest accepted", 4000, quest);
  q.offer("Level 2!", undefined, passive("levelup"));
  q.offer("Your bag is full", undefined, {}); // direct
  q.offer("You have unspent points", undefined, {});
  assert.deepEqual(shown, ["Quest accepted"]);
  assert.deepEqual(q.waiting(), ["Your bag is full", "You have unspent points", "Level 2!"], "direct lines go ahead of passive ones, behind the quest line");
  advance(4000); advance(3200); advance(3200); advance(3200);
  assert.deepEqual(shown, ["Quest accepted", "Your bag is full", "You have unspent points", "Level 2!"]);
});

test("CR7L-02 a direct toast with nothing held shows at once and leaves the queue alone; two potion lines both wait", () => {
  const { q, shown, advance } = lane();
  q.offer("Quest done", 4000, quest);
  q.offer("Drank a coffee", undefined, passive("potion"));
  q.offer("Drank water", undefined, passive("potion"));
  assert.deepEqual(q.waiting(), ["Drank a coffee", "Drank water"], "different potion lines are not merged away");
  advance(4000); advance(3200); advance(3200);
  assert.deepEqual(shown, ["Quest done", "Drank a coffee", "Drank water"]);
  q.offer("Not enough gold", undefined, {});
  assert.equal(shown.at(-1), "Not enough gold");
});

test("a later quest line replaces the shown one at once; the earlier waiting lines survive; floor names do not pile up", () => {
  const { q, shown, advance, set } = lane();
  q.offer("Quest step A", 4000, quest);
  q.offer("Floor 1", undefined, passive("floorEnter"));
  q.offer("Floor 2", undefined, passive("floorEnter"));
  assert.deepEqual(q.waiting(), ["Floor 2"]);
  advance(1000);
  q.offer("Quest step B", 4000, quest);
  assert.equal(shown.at(-1), "Quest step B"); assert.deepEqual(q.waiting(), ["Floor 2"]);
  q.drop("none"); q.reset(); assert.deepEqual(q.waiting(), []);
  void set;
});

test("toastDrop removes a waiting quest line; the same text is not queued twice; the cap holds", () => {
  const { q, advance } = lane();
  q.offer("Q", 4000, quest);
  q.offer("Return for your reward", 4000, { quest: true, kind: "quest.step", qid: "sq9" });
  q.offer("Return for your reward", 4000, { quest: true, kind: "quest.step", qid: "sq9" });
  assert.equal(q.waiting().length, 1);
  q.drop("sq9"); assert.equal(q.waiting().length, 0);
  for (let i = 0; i < 20; i++) q.offer(`line ${i}`, undefined, {});
  assert.ok(q.waiting().length <= 8);
  advance(10); // no timers fire early
});

test("a direct line replaces a world line on show at once (a refusal is not delayed by a level-up); the waiting list survives", () => {
  const { q, shown, advance } = lane();
  q.begin(); q.offer("Level 2!", undefined, passive("levelup")); q.offer("Floor 2", undefined, passive("floorEnter")); q.end();
  q.offer("Not enough mana", undefined, {});
  assert.deepEqual(shown, ["Level 2!", "Not enough mana"]); assert.deepEqual(q.waiting(), ["Floor 2"]);
  advance(3200); assert.deepEqual(shown, ["Level 2!", "Not enough mana", "Floor 2"], "the waiting line still gets its turn");
});
