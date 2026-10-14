// __app.quests and __app.cheat.completeQuest (R7-0.3, contract section 2.7): thin forwards, checked with a stub shell.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installTestHook } from "../src/testhook/index.js";
import { newGame, snapshot, applyInput } from "../src/core/index.js";

function rig({ withCheatWrapper = false } = {}) {
  const calls = [], win = {};
  const game = { core: newGame(5, { class: "facilities-manager", name: "Hook", start: "town" }), render() {}, getState() { return snapshot(this.core); },
    input(cmd) { calls.push(cmd); return applyInput(this.core, cmd); }, cheat: {} };
  if (withCheatWrapper) { game.cheat.setQuestStep = (...a) => { calls.push(["wrapper", "setQuestStep", ...a]); return { ok: true, wrapped: true }; }; game.cheat.completeQuest = (...a) => { calls.push(["wrapper", "completeQuest", ...a]); return { ok: true, wrapped: true }; }; }
  const api = installTestHook(game, {}, win);
  return { api, game, calls, win };
}

test("describe() lists the quests member and cheat docs name completeQuest", () => {
  const { api, win } = rig();
  assert.equal(win.__app, api);
  assert.ok(api.describe().some((m) => m.name === "quests" && m.kind === "obj" && m.doc));
  assert.deepEqual(Object.keys(api.quests).sort(), ["accept", "handIn", "pin", "readVerdict", "setStep", "state", "talk"]);
  assert.equal(typeof api.cheat.completeQuest, "function");
});

test("state() is snapshot.quests; pin, accept, handIn and readVerdict forward the input commands; talk forwards to interact", () => {
  const { api, calls } = rig();
  const st = api.quests.state();
  assert.equal(st.pinned, "main"); assert.equal(st.main.step, 1); assert.equal(st.sq1.state, "available");
  api.quests.pin("sq1"); api.quests.accept("sq1"); api.quests.handIn("sq1"); api.quests.talk("vendor"); api.quests.readVerdict();
  assert.deepEqual(calls, [{ t: "questPin", id: "sq1" }, { t: "questAccept", id: "sq1" }, { t: "questHandIn", id: "sq1" }, { t: "interact", id: "vendor" }, { t: "storyRead", id: "victory" }]);
  assert.equal(api.quests.state().pinned, "sq1");
});

test("setStep and completeQuest use the shell's cheat wrapper when it exists, otherwise the core cheat directly", () => {
  const w = rig({ withCheatWrapper: true });
  assert.deepEqual(w.api.quests.setStep("main", 3), { ok: true, wrapped: true });
  assert.deepEqual(w.api.cheat.completeQuest("sq1"), { ok: true, wrapped: true });
  assert.deepEqual(w.calls, [["wrapper", "setQuestStep", "main", 3], ["wrapper", "completeQuest", "sq1"]]);
  const d = rig();
  assert.deepEqual(d.api.quests.setStep("main", 4), { ok: true });
  assert.equal(d.api.quests.state().main.step, 4);
  assert.deepEqual(d.api.quests.setStep("sq2", 2), { ok: true });
  assert.equal(d.api.quests.state().sq2.state, "ready"); assert.equal(d.game.core.player.pouch.length, 1);
  assert.deepEqual(d.api.cheat.completeQuest("main"), { ok: true });
  assert.equal(d.api.quests.state().main.state, "completed");
  assert.equal(d.api.quests.setStep("main", 2).ok, false, "forward only");
});

test("bad arguments and no running game answer with an error, never throw", () => {
  const { api, game } = rig();
  for (const bad of [undefined, null, 5, ""]) { assert.equal(api.quests.pin(bad).ok, false); assert.equal(api.quests.setStep(bad, 1).ok, false); assert.equal(api.cheat.completeQuest(bad).ok, false); assert.equal(api.quests.talk(bad).ok, false); }
  game.core = null;
  for (const r of [api.quests.accept("sq1"), api.quests.handIn("sq1"), api.quests.pin("sq1"), api.quests.setStep("main", 2), api.quests.readVerdict(), api.quests.talk("vendor"), api.cheat.completeQuest("main")]) assert.equal(r.ok, false);
  assert.equal(api.quests.state(), null);
});
