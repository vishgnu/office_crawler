// Gear looks (ADR-0008, R-260..R-262): which part the hero wears for an equipped item, and the signature string that keys the sprite cache.
// CR8-06: this is the one home of the signature grammar (table, regex, validators). Render (render/gearlooks.js re-exports it), save/slots.js and ui/slots.js
// all import it from here; test/layering.test.js pins that nothing in save/ or ui/ imports render/ and that this file has no imports and no DOM.
// Pure and DOM-free. No RNG, no clock, no allocation beyond the signature string itself.
// The category comes from the item's base id through LOOK_BY_BASE; tier from its rarity. Nothing here reads or writes game state.

/** Visible slots in signature order. */
export const VISIBLE_SLOTS = ["head", "body", "hands", "feet", "weapon", "offhand"];

/** The 21 categories per slot (ADR-0008 section 1). Index in the list = painter index of the stub parts. */
export const LOOK_CATEGORIES = {
  weapon: ["blade", "blunt", "staff", "pole", "heavy"],
  offhand: ["board", "binder", "tray"],
  head: ["cap", "helmet", "headset"],
  body: ["knit", "jacket", "vest", "suit"],
  hands: ["brace", "gloves", "mitts"],
  feet: ["sneaker", "loafer", "boot"],
};
/** One letter per category inside its slot; the signature uses it. */
const CODE = {
  weapon: { blade: "b", blunt: "n", staff: "s", pole: "p", heavy: "h" },
  offhand: { board: "b", binder: "i", tray: "t" },
  head: { cap: "c", helmet: "h", headset: "e" },
  body: { knit: "k", jacket: "j", vest: "v", suit: "s" },
  hands: { brace: "b", gloves: "g", mitts: "m" },
  feet: { sneaker: "s", loafer: "l", boot: "b" },
};
const BY_CODE = Object.fromEntries(Object.entries(CODE).map(([slot, m]) => [slot, Object.fromEntries(Object.entries(m).map(([cat, c]) => [c, cat]))]));

/** base id -> category (render side only; core/content/items.js is untouched). A test fails when a visible gear base has no entry. */
export const LOOK_BY_BASE = {
  "ruler-rapier": "blade", "letter-opener": "blade", "keyboard-sword": "blade",
  "pipe-wrench": "blunt", "stapler-mace": "blunt", "hole-punch-hammer": "blunt",
  "usb-staff": "staff", "mop-halberd": "pole", "extinguisher-club": "heavy",
  "clipboard-shield": "board", "binder-buckler": "binder", "serving-tray-aegis": "tray",
  "visor-cap": "cap", "hard-hat": "helmet", headset: "headset",
  cardigan: "knit", blazer: "jacket", "hi-vis-vest": "vest", "pinstripe-suit": "suit",
  "wrist-brace": "brace", "rubber-gloves": "gloves", "typing-mitts": "mitts",
  sneakers: "sneaker", loafers: "loafer", "steel-toe-boots": "boot",
};
/** The plain default of a slot, used for a base the table does not know (a two-handed unknown weapon uses `pole`). */
export const SLOT_DEFAULT = { head: "cap", body: "knit", hands: "brace", feet: "sneaker", weapon: "blade", offhand: "board" };
/** Categories that are held in two hands whatever the item says. */
const TWO_HANDED = new Set(["pole", "heavy"]);

export const EMPTY_SIG = "-|-|-|-|-|-";
const TIERS = { normal: 0, magic: 1, rare: 2, unique: 3 };
const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);

/**
 * The look of one worn item: { cat, tier, two } or null (nothing is drawn: empty, malformed, a slot that does not match, an invisible slot).
 * Unknown base in a visible slot: the slot's plain default. Unknown rarity counts as normal. Never throws.
 */
export function lookOf(slot, item) {
  if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.base !== "string" || !own(LOOK_CATEGORIES, slot)) return null;
  const s = item.slot;
  if (s !== undefined && s !== slot) return null; // a belt, ring or amulet (or any item that does not belong in this slot) is not drawn
  const base = item.base, known = own(LOOK_BY_BASE, base) && LOOK_CATEGORIES[slot].includes(LOOK_BY_BASE[base]);
  const two = slot === "weapon" && item.twoHanded === true;
  const cat = known ? LOOK_BY_BASE[base] : slot === "weapon" && two ? "pole" : SLOT_DEFAULT[slot];
  const tier = own(TIERS, item.rarity) ? TIERS[item.rarity] : 0;
  return { cat, tier, two: two || TWO_HANDED.has(cat) };
}

/** Signature string of the six visible slots: `-` empty, else `<code><tier>` (+ `2` for a two-handed weapon). Belt, rings and amulet are ignored. */
export function gearSignature(equipment) {
  if (!equipment || typeof equipment !== "object") return EMPTY_SIG;
  let two = false, out = "";
  for (let i = 0; i < 6; i++) {
    const slot = VISIBLE_SLOTS[i];
    let seg = "-";
    if (!(slot === "offhand" && two)) { // a two-handed weapon blocks the off-hand: it is not drawn even if a malformed state holds one
      const l = lookOf(slot, equipment[slot]);
      if (l) { seg = CODE[slot][l.cat] + l.tier + (l.two && slot === "weapon" ? "2" : ""); if (slot === "weapon" && l.two) two = true; }
    }
    out += i ? "|" + seg : seg;
  }
  return out;
}

/** The signature grammar: six segments of 1..4 chars `[-a-z0-9]` separated by `|`. The only copy of this regex. */
export const SIG_RE = /^[-a-z0-9]{1,4}(\|[-a-z0-9]{1,4}){5}$/;
/** Grammar check only (shape and length); parseSignature also checks the codes and tiers. For stored values (index `look`) and forged input. */
export const validLook = (s) => typeof s === "string" && s.length <= 40 && SIG_RE.test(s);
/** A stored look ready to draw: a valid, non-empty signature, else "" (the bare figure). */
export const cleanLook = (look) => (validLook(look) && look !== EMPTY_SIG ? look : "");
/** Parse a signature (a stored `look`) into { head, body, ... } = look | null per slot; null for anything malformed (the caller draws bare). */
export function parseSignature(sig) {
  if (typeof sig !== "string" || sig.length > 40 || !SIG_RE.test(sig)) return null;
  const parts = sig.split("|"), out = {};
  for (let i = 0; i < 6; i++) {
    const slot = VISIBLE_SLOTS[i], p = parts[i];
    if (p === "-") { out[slot] = null; continue; }
    const cat = BY_CODE[slot][p[0]], tier = p.charCodeAt(1) - 48, rest = p.slice(2);
    if (!cat || !(tier >= 0 && tier <= 3) || (rest !== "" && !(rest === "2" && slot === "weapon"))) return null;
    out[slot] = { cat, tier, two: rest === "2" || (slot === "weapon" && TWO_HANDED.has(cat)) };
  }
  if (out.weapon?.two) out.offhand = null;
  return out;
}

/** Looks of an equipment object (or signature string) per slot, or null when nothing visible is worn / the input is malformed. */
export function gearLooks(input) {
  const parsed = typeof input === "string" ? parseSignature(input) : parseSignature(gearSignature(input));
  if (!parsed) return null;
  for (let i = 0; i < 6; i++) if (parsed[VISIBLE_SLOTS[i]]) return parsed;
  return null;
}
