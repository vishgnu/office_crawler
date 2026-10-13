// Playable classes (AC-R-010-1). MVP has exactly one melee class; the name is a working name (QF-06-1).
export const classes = [
  { id: "clerk", name: "Clerk", kind: "melee", attrs: { grit: 10, agility: 10, stamina: 10, focus: 10 } },
];
export const defaultClass = classes[0].id;
