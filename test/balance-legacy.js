// R7-3 golden proof helper: the numbers the balance pass changed (docs/reviews/R7-balance.md), put back to their pre-R7-3 values for the length of one call.
// A recorded run replayed under these values must hash exactly as it did before the pass (the stripped pre-quest goldens), which proves the pass changed nothing but those numbers.
// Everything is restored in `finally`. Not a test file itself (no tests in it); it lives in test/ so the test files can import it.
import { config } from "../src/core/config.js";
import { monsters } from "../src/core/content/monsters.js";
import { bases } from "../src/core/content/items.js";

const OLD_HP = { "zombie-intern": 14, "printer-imp": 8, "temp-worker": 10, "printer-demon": 12, "middle-manager": 60, "vending-machine": 90, consultant: 22, auditor: 70 };

/** Run `fn` with the pre-R7-3 balance numbers in place; returns what `fn` returns. */
export function withLegacyBalance(fn) {
  const keep = {
    depthMult: config.depthMult, xpPct: config.scaling.xpPct, champ: config.championChance, vend: monsters["vending-machine"].minDepth, exit: bases["emergency-exit"].value,
    hp: Object.fromEntries(Object.keys(OLD_HP).map((id) => [id, monsters[id].hpBase])),
  };
  try {
    config.depthMult = { hp: [1, 1, 1, 1, 1, 1, 1, 1], damage: [1, 1, 1, 1, 1, 1, 1, 1] };
    config.scaling.xpPct = 20; config.championChance = 0.3; monsters["vending-machine"].minDepth = 4; bases["emergency-exit"].value = 25;
    for (const [id, hp] of Object.entries(OLD_HP)) monsters[id].hpBase = hp;
    return fn();
  } finally {
    config.depthMult = keep.depthMult; config.scaling.xpPct = keep.xpPct; config.championChance = keep.champ; monsters["vending-machine"].minDepth = keep.vend; bases["emergency-exit"].value = keep.exit;
    for (const [id, hp] of Object.entries(keep.hp)) monsters[id].hpBase = hp;
  }
}
