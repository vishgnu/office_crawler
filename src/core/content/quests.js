// Quest content as data (R-240, ADR-0007). Structure and text live here; every number a balance pass may touch lives in config.quests.
// All text is working text written for this game (R-255): the customer may rename it, only this file changes.
// `{giver}` in the `next` lines is replaced by the giver NPC's name string.

const main = {
  id: "main", kind: "main", title: "Why the Lights Went Out",
  steps: [
    { id: "memo", title: "Read the memo", line: "Take the lift down.", target: { kind: "elevator" } },
    { id: "dark-floor", title: "Find the dark floor", line: "Reach floor 1 and look for what cut the power.", target: { kind: "elevator" } },
    { id: "go-deeper", title: "Go deeper", line: "Reach floor 4. Visit the Lobby first: the staff may pay in gear.", target: { kind: "stairs-down" } },
    { id: "executive-floor", title: "Open the executive floor", line: "Reach floor 8 and find the way up to the Executive Suite.", target: { kind: "stairs-down" } },
    { id: "face-director", title: "Face the Regional Director", line: "Defeat the Regional Director.", target: { kind: "stairs-down" } },
    { id: "report", title: "File the report", line: "Read the verdict.", target: null },
  ],
};

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

export const quests = { main, sq1, sq2, sq3 };
export const sideIds = ["sq1", "sq2", "sq3"];
export const questIds = ["main", ...sideIds];
/** Labels of map targets (the UI may translate them; core data keeps one English text). */
export const markerLabels = { elevator: "Elevator", "stairs-down": "Stairs down", "stairs-up": "Stairs up" };

/** A fresh quest state (plain JSON, hashed, saved from v4). Milestones of the main quest only ever grow. */
export const newQuestState = () => ({
  main: { m: { memo: false, depth: 0, unlocked: false, defeated: false, verdict: false } },
  sq1: { s: "available", p: 0 }, sq2: { s: "available", p: 0 }, sq3: { s: "available", p: 0 },
  pinned: "main",
});
