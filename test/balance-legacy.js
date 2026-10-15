// R7-3 golden proof helper: the numbers the balance pass changed (docs/reviews/R7-balance.md), put back to their pre-R7-3 values for the length of one call.
// A recorded run replayed under these values must hash exactly as it did before the pass (the stripped pre-quest goldens), which proves the pass changed nothing but those numbers.
// R8 (CORE-R8-1) added its own knobs to the list so the same proof still holds: the floor 1 population rules, the entry grace and the start potions are switched off or put back here.
// Everything is restored in `finally`. Not a test file itself (no tests in it); it lives in test/ so the test files can import it.
import { config } from "../src/core/config.js";
import { monsters } from "../src/core/content/monsters.js";
import { bases } from "../src/core/content/items.js";
import { classes } from "../src/core/content/classes.js";

const OLD_POTIONS = 2; // health potions on the belt at the start of every class before R8-B3
const OLD_HP = { "zombie-intern": 14, "printer-imp": 8, "temp-worker": 10, "printer-demon": 12, "middle-manager": 60, "vending-machine": 90, consultant: 22, auditor: 70 };

/** Run `fn` with the pre-R7-3 balance numbers in place; returns what `fn` returns. Synchronous only (CR7L-05). */
export function withLegacyBalance(fn) {
  const keep = {
    depthMult: config.depthMult, xpPct: config.scaling.xpPct, champ: config.championChance, vend: monsters["vending-machine"].minDepth, exit: bases["emergency-exit"].value,
    early: config.population.early, xpMult: config.xpMult, potionMarkup: config.potionBuyOverSell, kits: classes.map((c) => c.startKit.healthPotions), grace: config.entryGrace, boss: { hp: config.boss.hpMult, dmg: config.boss.damageMult }, spam: config.spamTicks,
    hp: Object.fromEntries(Object.keys(OLD_HP).map((id) => [id, monsters[id].hpBase])),
  };
  try {
    config.depthMult = { hp: [1, 1, 1, 1, 1, 1, 1, 1], damage: [1, 1, 1, 1, 1, 1, 1, 1] };
    config.scaling.xpPct = 20; config.championChance = 0.3; monsters["vending-machine"].minDepth = 4; bases["emergency-exit"].value = 25;
    config.potionBuyOverSell = config.buyOverSell; for (const c of classes) c.startKit.healthPotions = OLD_POTIONS; // R8-B3
    config.xpMult = null; config.entryGrace = null; config.population.early = null; // R8-B2, R8-B1 (floor 1 pack rules)
    config.boss.hpMult = 3; config.boss.damageMult = 0.7; // CR7L-05: the boss numbers of the pre-R7-3 balance (R7-balance.md item 6)
    config.spamTicks = -1; // R11-F03: the click-spam strike-back rule did not exist
    for (const [id, hp] of Object.entries(OLD_HP)) monsters[id].hpBase = hp;
    const out = fn();
    if (out && typeof out.then === "function") throw new Error("withLegacyBalance is synchronous: the numbers are restored when fn returns");
    return out;
  } finally {
    config.depthMult = keep.depthMult; config.scaling.xpPct = keep.xpPct; config.championChance = keep.champ; monsters["vending-machine"].minDepth = keep.vend; bases["emergency-exit"].value = keep.exit;
    config.potionBuyOverSell = keep.potionMarkup; classes.forEach((c, i) => { c.startKit.healthPotions = keep.kits[i]; });
    config.entryGrace = keep.grace; config.population.early = keep.early; config.xpMult = keep.xpMult;
    config.spamTicks = keep.spam; config.boss.hpMult = keep.boss.hp; config.boss.damageMult = keep.boss.dmg;
    for (const [id, hp] of Object.entries(keep.hp)) monsters[id].hpBase = hp;
  }
}
