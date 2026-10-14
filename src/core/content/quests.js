// Quest content as data (R-240, ADR-0007). Structure and text live here; every number a balance pass may touch lives in config.quests.
// All text is working text written for this game (R-255): the customer may rename it, only this file changes.
// `{giver}` in the `next` lines is replaced by the giver NPC's name string.

// The main quest is three arcs over ONE stored milestone block (state.quests.main.m, ADR-0007 amendment R7-4 A1). Each step has exactly one completion
// predicate `when`: { milestone: "memo" | "unlocked" | "defeated" | "verdict" } or { depth: N } (floor N reached). A later step implies the earlier ones.
const main = {
  id: "main", kind: "main", arc: 1, title: "Why the Lights Went Out",
  blurb: "The lights went out overnight, and nobody upstairs will say why.",
  steps: [
    { id: "memo", title: "Read the memo", line: "Take the lift down.", when: { milestone: "memo" }, target: { kind: "elevator" } },
    { id: "dark-floor", title: "Find the dark floor", line: "Reach floor 1 and look for what cut the power.", when: { depth: 1 }, target: { kind: "elevator" } },
    { id: "cables", title: "Follow the cables", line: "Follow the power cables down to floor 3.", when: { depth: 3 }, target: { kind: "stairs-down" } },
  ],
};

const main2 = {
  id: "main2", kind: "main", arc: 2, title: "The Paper Trail",
  blurb: "The cables lead to a paper trail, and the paper trail leads down.",
  unlock: "A new assignment is on your desk: The Paper Trail.",
  steps: [
    { id: "go-deeper", title: "Go deeper", line: "Reach floor 4. Visit the Lobby first: the staff may pay in gear.", when: { depth: 4 }, target: { kind: "stairs-down" } },
    { id: "records", title: "Check the records floor", line: "Reach floor 5 and look for where the paperwork goes.", when: { depth: 5 }, target: { kind: "stairs-down" } },
    { id: "mail-room", title: "Find the mail room", line: "Reach floor 6 and find the mail room.", when: { depth: 6 }, target: { kind: "stairs-down" } },
  ],
};

const main3 = {
  id: "main3", kind: "main", arc: 3, title: "Final Notice",
  blurb: "Somebody on the top floor signed off on all of it.",
  unlock: "A new assignment is on your desk: Final Notice.",
  steps: [
    { id: "back-stairs", title: "Take the back stairs", line: "Reach floor 7 by the back stairs.", when: { depth: 7 }, target: { kind: "stairs-down" } },
    { id: "executive-floor", title: "Open the executive floor", line: "Reach floor 8 and find the way up to the Executive Suite.", when: { milestone: "unlocked" }, target: { kind: "stairs-down" } },
    { id: "face-director", title: "Face the Regional Director", line: "Defeat the Regional Director.", when: { milestone: "defeated" }, target: { kind: "stairs-down" } },
    { id: "report", title: "File the report", line: "Read the verdict.", when: { milestone: "verdict" }, target: null },
  ],
};

/** Shown in the journal for a quest that is not yet open; `{previous}` is the title of the quest before it. */
export const lockedLine = "Locked. Finish {previous} first.";

const sq1 = {
  id: "sq1", kind: "side", title: "Intern Overflow", giver: "vendor", salt: 1,
  objective: { type: "kill" },
  text: {
    offer: "The interns keep clocking in and nobody ever clocks them out. Thin the herd on the first two floors and I will make it worth your while.",
    progress: "Still shuffling around down there. Keep going.",
    ready: "The corridors are quiet at last. Here is your share of the petty cash.",
    done: "Quiet corridors, tidy shelves. Thank you.",
  },
  next: {
    available: "Talk to the {giver} in the Lobby about the intern problem.",
    active: "Defeat zombie interns on floors 1 and 2.",
    ready: "Return to {giver} in the Lobby for your reward.",
  },
  reward: { gold: true, xp: true, potions: true, gear: false },
};

const sq2 = {
  id: "sq2", kind: "side", title: "The Missing Badge", giver: "healer", salt: 2,
  objective: { type: "item" },
  item: { name: "Lost Staff Badge", description: "A laminated badge on a frayed lanyard. Somebody will want it back." },
  text: {
    offer: "A colleague went down to the lower floors and never came back, and their badge is still on the sign-in sheet. Find it, and I will see you are looked after.",
    progress: "No badge yet? Try the rooms off the main corridors on the third and fourth floors.",
    ready: "That is the one. Take this, it should fit you better than it fit them.",
    done: "The badge is back where it belongs. Take care down there.",
  },
  next: {
    available: "Talk to the {giver} in the Lobby about a missing badge.",
    active: "Find the lost badge on floor 3 or 4.",
    ready: "Return to {giver} in the Lobby with the badge.",
  },
  reward: { gold: true, xp: true, potions: false, gear: true },
};

const sq3 = {
  id: "sq3", kind: "side", title: "Toner Tyrant", giver: "potions", salt: 3,
  objective: { type: "elite" },
  elite: { name: "The Toner Tyrant" },
  text: {
    offer: "Somebody on the fourth floor has been hoarding every toner cartridge in the building and shouting about the budget. Put a stop to it.",
    progress: "He is still down there, sitting on the supply cupboard. Do not take him lightly.",
    ready: "Finally, someone who can say no to him. Take this, and a few refills on the house.",
    done: "The cartridges are flowing again. Thank you.",
  },
  next: {
    available: "Talk to the {giver} in the Lobby about the toner shortage.",
    active: "Defeat the Toner Tyrant on floor 4.",
    ready: "Return to {giver} in the Lobby for your reward.",
  },
  reward: { gold: true, xp: true, potions: true, gear: true },
};

const sq4 = {
  id: "sq4", kind: "side", title: "The Misfiled Ledger", giver: "stash", salt: 4,
  objective: { type: "item" },
  item: { name: "Misfiled Ledger", description: "A heavy ledger with a sticky note: 'Return to Storage. Urgent.'" },
  text: {
    offer: "Somebody on the fifth or sixth floor borrowed a ledger from my shelves and never brought it back. It is badly overdue. Find it, and I will make the late fee disappear.",
    progress: "Not back yet. Try the side rooms on the fifth and sixth floors.",
    ready: "That is the one, spine cracked and all. Take these for your trouble.",
    done: "Back on the shelf where it belongs. The shelves thank you.",
  },
  next: {
    available: "Talk to the {giver} in the Lobby about an overdue ledger.",
    active: "Find the missing ledger on floor 5 or 6.",
    ready: "Return to {giver} in the Lobby with the ledger.",
  },
  reward: { gold: true, xp: true, potions: true, gear: false },
};

const sq5 = {
  id: "sq5", kind: "side", title: "Slide Deck Surplus", giver: "vendor", salt: 5,
  objective: { type: "kill" },
  text: {
    offer: "The consultants upstairs leave their slide decks everywhere, and I am the one who gets the toner bill. Clear a few of them out and I will find you something from the good shelf.",
    progress: "Still handing out slides down there. Keep at it.",
    ready: "Quiet at last. This was at the back of the shelf. It should help you more than it helps me.",
    done: "No more slides. I owe you one.",
  },
  next: {
    available: "Talk to the {giver} in the Lobby about the consultants.",
    active: "Defeat Consultants on floors 5 and 6.",
    ready: "Return to {giver} in the Lobby for your reward.",
  },
  reward: { gold: true, xp: true, potions: false, gear: true },
};

export const quests = { main, main2, main3, sq1, sq2, sq3, sq4, sq5 };
export const mainIds = ["main", "main2", "main3"];
/** The ten main steps in journal order: each step plus its arc id, its arc number, its 1-based index inside the arc (`arcStep`) and its global index `n` (1..10). */
export const mainSteps = mainIds.flatMap((id) => quests[id].steps.map((s) => ({ ...s, arcId: id, arc: quests[id].arc, arcStep: quests[id].steps.indexOf(s) + 1 })))
  .map((s, i) => ({ ...s, n: i + 1 }));
export const sideIds = ["sq1", "sq2", "sq3", "sq4", "sq5"];
export const questIds = [...mainIds, ...sideIds];
/** Labels of map targets (the UI may translate them; core data keeps one English text). */
export const markerLabels = { elevator: "Elevator", "stairs-down": "Stairs down", "stairs-up": "Stairs up" };

/** A fresh quest state (plain JSON, hashed, saved from v4; v5 adds sq4 and sq5). Milestones of the main quests only ever grow; main2 and main3 have no stored entry. */
export const newQuestState = () => ({
  main: { m: { memo: false, depth: 0, unlocked: false, defeated: false, verdict: false } },
  ...Object.fromEntries(sideIds.map((id) => [id, { s: "available", p: 0 }])),
  pinned: "main",
});
