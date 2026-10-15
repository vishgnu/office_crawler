// Playable classes (ADR-0005 section 1, R-200, R-201). Names are working names (R-233, QF-11-1): ids are stable, names live in strings only.
// Starting attributes sum to 44 for every class (parity check in test/classes.test.js). `derived` overrides config.derived key by key.
// `bot` carries policy hints for bot/policy.js (the policy itself stays class-agnostic data-driven code).
export const classes = [
  {
    id: "facilities-manager", name: "Facilities Manager", role: "melee",
    blurbKey: "classFacilitiesBlurb", figureKey: "hero.facilities-manager",
    attrs: { grit: 16, agility: 8, stamina: 14, focus: 6 },
    derived: { powerAttr: "grit", hpPerLevel: 16, mpPerLevel: 3, hpPerStamina: 3, mpPerFocus: 1, damagePerGrit: { min: 0.5, max: 0.5 }, unarmed: { min: 2, max: 4 } },
    basic: "strike",
    startKit: { weapon: "pipe-wrench", healthPotions: 4, manaPotions: 0, extra: [] },
    signature: "pallet-slam",
    branches: ["maintenance", "safety", "logistics"],
    affixTag: "facilities",
    bot: { stance: "melee", kite: 0, potionHp: 0.4, manaReserve: 0.15, attrWeights: { stamina: 3, grit: 3, agility: 2, focus: 1 },
      priority: ["demolition-day", "floor-buffer", "pallet-slam", "coffee-break"],
      buildOrder: [["pallet-slam", 2], ["dress-code", 2], ["floor-buffer", 2], ["coffee-break", 2], ["fire-drill", 1], ["lockout", 1], ["demolition-day", 1], ["pallet-slam", 5], ["floor-buffer", 5], ["dress-code", 5], ["coffee-break", 5], ["fire-drill", 5]] },
  },
  {
    id: "sales-rep", name: "Sales Rep", role: "ranged",
    blurbKey: "classSalesBlurb", figureKey: "hero.sales-rep",
    attrs: { grit: 8, agility: 16, stamina: 10, focus: 10 },
    derived: { powerAttr: "agility", damagePerGrit: { min: 0.8, max: 0.8 }, hpPerLevel: 9, mpPerLevel: 5, hpPerStamina: 3, mpPerFocus: 1, unarmed: { min: 2, max: 3 } },
    basic: "toss",
    startKit: { weapon: "letter-opener", healthPotions: 4, manaPotions: 0, extra: [] },
    signature: "stapler-throw",
    branches: ["pitch", "networking", "closing"],
    affixTag: "sales",
    bot: { stance: "ranged", kite: 2, potionHp: 0.45, manaReserve: 0.1, attrWeights: { agility: 3, stamina: 3, focus: 2, grit: 1 },
      priority: ["hard-close", "pen-volley", "reply-all", "stapler-throw"],
      buildOrder: [["stapler-throw", 2], ["hustle", 2], ["intern", 2], ["upsell", 2], ["pen-volley", 2], ["reply-all", 2], ["hard-close", 2], ["department-meeting", 1], ["card-fan", 1], ["commission", 1], ["stapler-throw", 5], ["pen-volley", 5], ["hard-close", 5]] },
  },
  {
    id: "it-wizard", name: "IT Wizard", role: "caster",
    blurbKey: "classItBlurb", figureKey: "hero.it-wizard",
    attrs: { grit: 6, agility: 10, stamina: 8, focus: 20 },
    derived: { powerAttr: "focus", damagePerGrit: { min: 0.6, max: 0.6 }, hpPerLevel: 9, mpPerLevel: 7, hpPerStamina: 3, mpPerFocus: 2, unarmed: { min: 1, max: 2 } },
    basic: "zap",
    startKit: { weapon: "usb-staff", healthPotions: 3, manaPotions: 1, extra: [] },
    signature: "server-overheat",
    branches: ["infrastructure", "security", "helpdesk"],
    affixTag: "it",
    bot: { stance: "caster", kite: 2, potionHp: 0.5, manaReserve: 0.1, attrWeights: { stamina: 3, focus: 3, agility: 1 },
      priority: ["blue-screen", "turn-it-off", "power-surge", "quarantine", "cold-boot", "server-overheat"],
      buildOrder: [["server-overheat", 2], ["cold-boot", 2], ["mute", 2], ["power-surge", 2], ["restore-backup", 2], ["firewall", 2], ["blue-screen", 1], ["turn-it-off", 1], ["quarantine", 1], ["server-overheat", 5], ["power-surge", 5], ["cold-boot", 5], ["overclock", 5]] },
  },
];
export const defaultClass = classes[0].id;
export const classById = (id) => classes.find((c) => c.id === id);
/** Classes that existed in older saves, with the class they become (ADR-0005 section 9). */
export const retiredClasses = { clerk: { migrateTo: "facilities-manager" } };
