// Town NPCs (R-041). `vendorId` makes the NPC open a trading window; `potionsOnly` limits the stock to potions.
export const npcs = {
  vendor: { id: "vendor", kind: "vendor", vendorId: "supplies", nameKey: "npcVendor", dialogKey: "dialogVendor" },
  healer: { id: "healer", kind: "healer", nameKey: "npcHealer", dialogKey: "dialogHealer" },
  potions: { id: "potions", kind: "vendor", vendorId: "potions", potionsOnly: true, nameKey: "npcPotions", dialogKey: "dialogPotions" },
  stash: { id: "stash", kind: "stash", nameKey: "npcStash", dialogKey: "dialogStash" },
};
export const npcIds = Object.keys(npcs);
