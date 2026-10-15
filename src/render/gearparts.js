// Gear part painters (ADR-0008 section 1): the pipeline entry (hook dispatch, error isolation, per-draw gear state). The 21 painters live in
// gearparts-weapons.js (weapon + off-hand) and gearparts-armour.js (head, body, hands, feet); the rarity trim and geometry helpers in gearkit.js.
// A painter is `(g, slot, category, tier, A)`: `A` is the anchor set the class painter computes (see heroes.js), the same function serves all three classes.
// Painters are pure functions of (category, tier, anchors, pose): no Math.random, no Date, no core RNG (AC-R-262-1 scans this file).
import { parseSignature, gearSignature } from "./gearlooks.js";
import { WEAPON_PAINTERS, OFFHAND_PAINTERS } from "./gearparts-weapons.js";
import { HEAD_PAINTERS, BODY_PAINTERS, HANDS_PAINTERS, FEET_PAINTERS, SLEEVES } from "./gearparts-armour.js";

export { trim } from "./gearkit.js";

/** Which slot a hook point of the class painter belongs to. */
export const HOOK_SLOT = { legs: "feet", feet: "feet", torso: "body", head: "head", hands: "hands", weaponBack: "weapon", weaponFront: "weapon", offhand: "offhand" };
export const HOOKS = Object.keys(HOOK_SLOT);

/** Category -> painter (the 21 categories). A category without an entry draws nothing (the class painter keeps its own look). */
export const PART_PAINTERS = { ...WEAPON_PAINTERS, ...OFFHAND_PAINTERS, ...HEAD_PAINTERS, ...BODY_PAINTERS, ...HANDS_PAINTERS, ...FEET_PAINTERS };
const NONE = () => {};

/** Sleeve colour of the worn body part, or null (no body part, or a sleeveless one): the near and far arm follow the garment. */
export const bodySleeve = (G) => { const l = worn(G, "body"); return l ? SLEEVES[l.cat] ?? null : null; };

/**
 * Per-draw gear state for the class painters: `looks` = { head, body, hands, feet, weapon, offhand } (look | null), `dead` = slots whose painter threw,
 * `failed` = slots that threw during the current draw (the baker redraws the frame without them), `onError(slot, err)` is told once per throw.
 */
export function makeGear(input, onError) {
  const looks = parseSignature(typeof input === "string" ? input : gearSignature(input));
  if (!looks) return null;
  for (const k of Object.keys(looks)) if (looks[k]) return { looks, dead: {}, failed: [], onError };
  return null;
}

/** The look worn in a slot, or null (empty, painter failed earlier, or no gear at all). */
export const worn = (G, slot) => (G && !G.dead[slot] ? G.looks[slot] : null);

/**
 * Paint the part for one hook point. No gear, nothing worn in the slot or a dead slot: returns false and draws nothing (the class painter keeps its own look).
 * A painter that throws is caught: the slot is marked dead for the rest of the signature, the error is reported once, the frame carries on.
 */
export function gearHook(g, hook, G, A) {
  if (!G) return false;
  const slot = HOOK_SLOT[hook], look = G.looks[slot];
  if (!look || G.dead[slot]) return false;
  A.hook = hook;
  g.save();
  try {
    (PART_PAINTERS[look.cat] ?? NONE)(g, slot, look.cat, look.tier, A);
    g.restore();
    return true;
  } catch (err) {
    try { g.restore(); } catch { /* a broken context state is the baker's problem, not the frame's */ }
    G.dead[slot] = true; G.failed.push(slot); G.onError?.(slot, err);
    return false;
  }
}
