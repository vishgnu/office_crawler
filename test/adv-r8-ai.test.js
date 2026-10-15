// ADV-R8 round 8, the re-click AI fix (R8-AI1): the hero stands blocked by a crowd in a corridor, the player keeps clicking a monster behind the one that attacks.
// Test-engineer, adversarial mode, written from docs/reviews/R8-core1-progress.md and the public input API, without reading the implementer's tests.
// Defects are `{ todo: 'ADV-R8-NN' }`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { step, applyInput } from "../src/core/index.js";
import { gameOn } from "./helpers.js";

const CORRIDOR = ["###############", "#@.....>......#", "###############"];
const CLASSES = ["facilities-manager", "sales-rep", "it-wizard"];
/** Zombies in a row in a one-wide corridor, all awake; the hero clicks the last one every `every` ticks (0 = once). Returns ticks until the nearest one was first hurt, and the hero's hp share. */
function crowd(cls, every, { seed = 3, n = 3, ticks = 600 } = {}) {
  const s = gameOn(CORRIDOR, Array.from({ length: n }, (_, i) => ["zombie-intern", 3 + i, 1]), seed, { class: cls, name: "A" });
  s.player.tile = { x: 1, y: 1 };
  s.monsters.forEach((m) => { m.ai = "chase"; });
  const target = s.monsters[n - 1].id, attacker = s.monsters[0];
  const hp0 = attacker.hp;
  let firstHit = null;
  for (let t = 0; t < ticks && s.scene !== "dead"; t++) {
    if (every ? t % every === 0 : t === 0) applyInput(s, { t: "attack", id: target });
    step(s);
    if (firstHit === null && (attacker.hp < hp0 || attacker.ai === "dead")) firstHit = t;
  }
  return { firstHit, hp: s.player.hp / s.player.hpMax, dead: s.scene === "dead" };
}

test("[R8-ai] a human click rate (a click every 3 to 60 ticks) never keeps the hero from answering the attacker in front of it: first hit within 200 ticks (3.3 s; typically 80 to 90), all three classes, 3 seeds", () => {
  for (const cls of CLASSES) for (const seed of [3, 4, 5]) for (const every of [3, 4, 5, 6, 10, 20, 30, 60, 0]) {
    const r = crowd(cls, every, { seed });
    assert.ok(r.firstHit !== null && r.firstHit <= 200, `${cls} seed ${seed} click every ${every}: first hit at ${r.firstHit}`);
  }
});

test("[R8-ai] ranged classes answer at once (they fire past the crowd), whatever the click rate", () => {
  for (const cls of ["sales-rep", "it-wizard"]) for (const every of [1, 2, 6, 0]) {
    const r = crowd(cls, every);
    assert.ok(r.firstHit !== null && r.firstHit <= 60, `${cls} every ${every}: ${r.firstHit}`);
  }
});

test("[R8-ai] ADV-R8-03 a melee hero whose player clicks every tick or every second tick (an auto-clicker, a 30 to 60 Hz touch repeat) still answers the attacker in front of it", { todo: "ADV-R8-03: issueAttack clears p.goal at every click and the retarget needs p.goal, so a click on every tick or every second tick keeps the hero standing for ever (600 ticks: 0 hits, 26 hp lost); every third tick already works" }, () => {
  for (const every of [1, 2]) {
    const r = crowd("facilities-manager", every);
    assert.ok(r.firstHit !== null && r.firstHit <= 150, `click every ${every}: first hit at ${r.firstHit}`);
  }
});

test("[R8-ai] a deeper crowd (6 in the corridor) and a second attacker behind the first: the hero ends up fighting and the game neither stalls nor kills the hero faster than without the clicks", () => {
  for (const cls of CLASSES) {
    const none = crowd(cls, 0, { n: 6, ticks: 900 }), clicking = crowd(cls, 10, { n: 6, ticks: 900 });
    assert.ok(clicking.firstHit !== null, `${cls}: fights`);
    assert.ok(clicking.dead === false || none.dead === true, `${cls}: clicking every 10 ticks does not make the hero die where not clicking survives`);
  }
});

test("[R8-ai] an unreachable click (a monster behind a wall) with an attacker in reach: the hero answers the attacker at once, 20 seeds x 3 classes, whatever the click rate", () => {
  const rows = ["###########", "#@.......##", "#######.###", "#.....#.###", "###########"];
  for (const cls of CLASSES) for (let seed = 1; seed <= 20; seed++) for (const every of [1, 7, 0]) {
    const s = gameOn(rows, [["zombie-intern", 2, 1], ["zombie-intern", 1, 3]], seed, { class: cls, name: "A" });
    s.player.tile = { x: 1, y: 1 };
    s.monsters[0].ai = "chase";
    const hp0 = s.monsters[0].hp, target = s.monsters[1].id;
    let hit = null;
    for (let t = 0; t < 200 && hit === null; t++) { if (every ? t % every === 0 : t === 0) applyInput(s, { t: "attack", id: target }); step(s); if (s.monsters[0].hp < hp0) hit = t; }
    assert.ok(hit !== null && hit <= 120, `${cls} seed ${seed} every ${every}: ${hit}`);
  }
});
