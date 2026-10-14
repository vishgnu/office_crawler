// S3-2/S3-6 wiring: the 12 S3 events have cues (or a reason to be silent), boss cues are loud, UI cues exist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapEvent, EVENT_MAP, SILENT_EVENTS, SFX_IDS } from "../src/audio/cues.js";

const S3_EVENTS = ["bossEngage", "bossTelegraph", "bossSlam", "bossVolley", "bossSummon", "bossPhase", "bossDefeated", "stairsUnlocked", "victory", "keepPlaying", "autosave", "resisted"];
const state = { player: { tile: { x: 5, y: 5 } }, monsters: [{ id: "m9", type: "regional-director", tile: { x: 6, y: 5 } }], projectiles: [] };

test("every S3 event is mapped to cues or listed as silent with a reason", () => {
  for (const t of S3_EVENTS) assert.ok(t in EVENT_MAP || (t in SILENT_EVENTS && SILENT_EVENTS[t].length > 10), t);
});

test("boss events give cues with their own logical names, built from existing kit sounds, at the boss tile", () => {
  const ev = { id: "m9", kind: "slam", tile: { x: 6, y: 6 }, shots: 5, adds: [], phase: 2 };
  for (const t of ["bossEngage", "bossTelegraph", "bossSlam", "bossVolley", "bossSummon", "bossPhase", "bossDefeated", "stairsUnlocked", "victory", "keepPlaying"]) {
    const d = mapEvent({ type: t, ...ev }, state);
    assert.ok(d.length >= 1, t);
    assert.ok(d.every((x) => SFX_IDS.includes(x.cue)), t);
    assert.ok(d.some((x) => x.name === t || t === "keepPlaying"), `${t} names its cue`);
  }
  assert.ok(mapEvent({ type: "bossSlam", ...ev }, state)[0].prio >= 8, "boss cues are not dropped in a busy fight");
  assert.deepEqual(mapEvent({ type: "keepPlaying" }, state).map((x) => x.name), ["uiClick"]);
  assert.equal(mapEvent({ type: "resisted", target: "m9", skill: "mute" }, state)[0].name, "resisted");
  assert.deepEqual(mapEvent({ type: "autosave", reason: "floor" }, state), []);
});

test("telegraph cue differs by kind", () => {
  const cue = (kind) => mapEvent({ type: "bossTelegraph", id: "m9", kind }, state)[0].cue;
  assert.equal(new Set(["slam", "volley", "summon"].map(cue)).size, 3);
});

test("the UI events the shell emits have cues", () => {
  for (const t of ["ui:click", "ui:open", "ui:close"]) assert.ok(mapEvent({ type: t }, state).length === 1, t);
});
