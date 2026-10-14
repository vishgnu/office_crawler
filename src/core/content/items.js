// Item bases (data only). Names are original office objects; no brands (ip-denylist-brands.txt).
// slot: where it is worn (ring fits ring1 or ring2). size: w x h cells in the 10x4 inventory (max 2x4).
// damage / defense are the base contributions; reqs are checked against the hero's own attributes.
// minIlvl: lowest item level at which the base can drop. value: base sell value in gold.
const gear = (id, name, slot, w, h, minIlvl, value, extra = {}) => ({ id, name, kind: "gear", slot, w, h, minIlvl, value, reqs: {}, ...extra });
const req = (level, attrs = {}) => ({ level, ...attrs });

const list = [
  // Weapons (one-handed)
  gear("ruler-rapier", "Ruler Rapier", "weapon", 1, 3, 1, 12, { damage: { min: 1, max: 3 }, reqs: req(1) }),
  gear("pipe-wrench", "Pipe Wrench", "weapon", 1, 3, 1, 12, { damage: { min: 3, max: 6 }, reqs: req(1) }),
  gear("usb-staff", "USB Staff", "weapon", 1, 3, 1, 12, { damage: { min: 1, max: 3 }, reqs: req(1) }),
  gear("letter-opener", "Letter Opener", "weapon", 1, 2, 1, 10, { damage: { min: 1, max: 4 }, reqs: req(1) }),
  gear("stapler-mace", "Stapler Mace", "weapon", 1, 3, 3, 24, { damage: { min: 3, max: 6 }, reqs: req(3, { grit: 12 }) }),
  gear("keyboard-sword", "Keyboard Sword", "weapon", 1, 3, 6, 40, { damage: { min: 4, max: 8 }, reqs: req(5, { grit: 14 }) }),
  gear("hole-punch-hammer", "Hole Punch Hammer", "weapon", 2, 3, 10, 70, { damage: { min: 6, max: 11 }, reqs: req(9, { grit: 18 }) }),
  // Weapons (two-handed: also fill the off-hand slot)
  gear("mop-halberd", "Mop Halberd", "weapon", 2, 4, 8, 60, { damage: { min: 6, max: 13 }, twoHanded: true, reqs: req(7, { grit: 17 }) }),
  gear("extinguisher-club", "Extinguisher Club", "weapon", 2, 3, 14, 110, { damage: { min: 10, max: 20 }, twoHanded: true, reqs: req(13, { grit: 22 }) }),
  // Off-hand
  gear("clipboard-shield", "Clipboard Shield", "offhand", 2, 2, 1, 14, { defense: 3, reqs: req(1) }),
  gear("binder-buckler", "Binder Buckler", "offhand", 2, 2, 7, 36, { defense: 6, reqs: req(6, { grit: 13 }) }),
  gear("serving-tray-aegis", "Serving Tray Aegis", "offhand", 2, 3, 15, 90, { defense: 11, reqs: req(14, { grit: 18 }) }),
  // Head
  gear("visor-cap", "Visor Cap", "head", 2, 2, 1, 9, { defense: 1, reqs: req(1) }),
  gear("hard-hat", "Hard Hat", "head", 2, 2, 4, 28, { defense: 4, reqs: req(4, { stamina: 12 }) }),
  gear("headset", "Headset", "head", 2, 1, 9, 50, { defense: 3, reqs: req(8, { focus: 14 }) }),
  // Body
  gear("cardigan", "Cardigan", "body", 2, 3, 1, 15, { defense: 3, reqs: req(1) }),
  gear("blazer", "Blazer", "body", 2, 3, 5, 45, { defense: 7, reqs: req(5, { stamina: 13 }) }),
  gear("hi-vis-vest", "Hi-Vis Vest", "body", 2, 3, 9, 70, { defense: 11, reqs: req(8, { stamina: 15 }) }),
  gear("pinstripe-suit", "Pinstripe Suit", "body", 2, 3, 16, 130, { defense: 18, reqs: req(15, { stamina: 19 }) }),
  // Hands
  gear("wrist-brace", "Wrist Brace", "hands", 2, 2, 1, 8, { defense: 1, reqs: req(1) }),
  gear("rubber-gloves", "Rubber Gloves", "hands", 2, 2, 6, 34, { defense: 3, reqs: req(5, { agility: 13 }) }),
  gear("typing-mitts", "Typing Mitts", "hands", 2, 2, 13, 80, { defense: 6, reqs: req(12, { agility: 18 }) }),
  // Feet
  gear("sneakers", "Sneakers", "feet", 2, 2, 1, 9, { defense: 1, reqs: req(1) }),
  gear("loafers", "Loafers", "feet", 2, 2, 5, 30, { defense: 3, reqs: req(4, { agility: 12 }) }),
  gear("steel-toe-boots", "Steel-Toe Boots", "feet", 2, 2, 12, 75, { defense: 7, reqs: req(11, { stamina: 17 }) }),
  // Belts (worn; not the potion belt)
  gear("cable-tie-belt", "Cable Tie Belt", "belt", 2, 1, 1, 8, { defense: 1, reqs: req(1) }),
  gear("leather-belt", "Leather Belt", "belt", 2, 1, 6, 30, { defense: 3, reqs: req(5) }),
  gear("tool-belt", "Tool Belt", "belt", 2, 1, 13, 80, { defense: 5, reqs: req(12, { stamina: 16 }) }),
  // Rings and badges
  gear("paperclip-ring", "Paperclip Ring", "ring", 1, 1, 1, 12, { reqs: req(1) }),
  gear("rubber-band-ring", "Rubber Band Ring", "ring", 1, 1, 5, 30, { reqs: req(4) }),
  gear("lapel-badge", "Lapel Badge", "ring", 1, 1, 11, 65, { reqs: req(10) }),
  // Amulets and ID cards
  gear("id-card", "ID Card", "amulet", 1, 2, 1, 14, { reqs: req(1) }),
  gear("lanyard", "Lanyard", "amulet", 1, 2, 6, 40, { reqs: req(5) }),
  gear("access-badge", "Access Badge", "amulet", 1, 2, 14, 100, { reqs: req(13) }),
];

// Potions: coffee restores health, water restores mana (AC-R-056-4). tier unlocks by player level at the vendor (QF-04-3).
const potion = (id, name, restores, restore, tier, minIlvl, value) =>
  ({ id, name, kind: "potion", slot: "potion", restores, restore, tier, w: 1, h: 1, minIlvl, value, reqs: {} });
const potionList = [
  potion("lukewarm-coffee", "Lukewarm Coffee", "hp", 25, 1, 1, 6),
  potion("strong-coffee", "Strong Coffee", "hp", 50, 2, 4, 16),
  potion("triple-espresso", "Triple Espresso", "hp", 100, 3, 10, 40),
  potion("paper-cup-of-water", "Paper Cup of Water", "mp", 15, 1, 1, 6),
  potion("water-bottle", "Water Bottle", "mp", 30, 2, 4, 16),
  potion("cooler-jug", "Cooler Jug", "mp", 60, 3, 10, 40),
];

// Consumables that are not potions (R-046): kind "consumable", 1x1, belt-able, one per item. effect names what using it does.
const consumable = (id, name, effect, minIlvl, value) => ({ id, name, kind: "consumable", slot: "consumable", effect, w: 1, h: 1, minIlvl, value, reqs: {} });
const consumableList = [consumable("emergency-exit", "Emergency Exit", "portal", 1, 5)];

export const bases = Object.fromEntries([...list, ...potionList, ...consumableList].map((b) => [b.id, b]));
export const consumableBases = consumableList;
export const gearBases = list;
export const potionBases = potionList;

// Equipment slot keys (AC-R-053-1) and which item slot each accepts.
export const slotKeys = ["head", "body", "hands", "feet", "belt", "weapon", "offhand", "ring1", "ring2", "amulet"];
export const slotAccepts = (slotKey) => (slotKey === "ring1" || slotKey === "ring2" ? "ring" : slotKey);

// Rarity display (AC-R-051-2): mark and border differ per rarity independently of colour (NFR-A03).
export const rarities = {
  normal: { id: "normal", rank: 0, name: "Normal", mark: "-", border: "plain", color: "#d6d3cb" },
  magic: { id: "magic", rank: 1, name: "Magic", mark: "+", border: "single", color: "#6f93ff" },
  rare: { id: "rare", rank: 2, name: "Rare", mark: "*", border: "double", color: "#ffd24d" },
  unique: { id: "unique", rank: 3, name: "Unique", mark: "#", border: "ornate", color: "#f08a3c" },
};
export const rarityOrder = ["normal", "magic", "rare", "unique"];
