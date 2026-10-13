// Player-visible text of the S2 UI (panels, tooltips, windows, HUD controls). The core string table lives in
// src/core (not editable from the UI package), so the UI keeps its own single table here; every visible UI string
// comes from it (AC-R-102-2 spirit). Item, skill, NPC and floor names still come from the core registries.
export const T = {
  inventory: "Desk Drawer", character: "Employee File", skills: "Skills", gear: "Gear",
  close: "Close", closeInventory: "Close Desk Drawer (I)", closeCharacter: "Close Employee File (C)", closeSkills: "Close Skills (S)", closeWindow: "Close window",
  openInventory: "Inventory", openCharacter: "File", openSkills: "Skills",
  equipment: "Equipment, paper doll", inventoryGrid: "Inventory, 10 by 4 cells", belt: "Belt", beltKeys: "Potion belt, keys 1 to 4", skillBar: "Skills, F1 to F4",
  slotHead: "Head", slotBody: "Body", slotHands: "Gloves", slotFeet: "Shoes", slotBelt: "Belt", slotWeapon: "Weapon", slotOffhand: "Off-hand", slotRing1: "Ring", slotRing2: "Ring", slotAmulet: "ID",
  empty: "empty", cell: "Cell",
  rarityKey: "Rarity key", keys: "Keys",
  keyHintPotions: "Potions", keyHintSkills: "Skills", dragHint: "Drag, or click then click. Right-click: equip or use. Esc: put back.",
  rarityNormal: "Common", rarityMagic: "Magic", rarityRare: "Rare", rarityUnique: "Unique",
  keyNormal: "square mark, thin border", keyMagic: "diamond mark, solid border", keyRare: "star mark, double border", keyUnique: "crown mark, dashed border",
  gold: "gold", goldWord: "Gold", sellsFor: "Sells for", price: "Price", cells: "cells", needsMet: "Requirements met",
  damage: "Damage", defense: "Defense", restores: "Restores", health: "health", mana: "mana", attackRating: "Attack Rating",
  hpMax: "Max Health", mpMax: "Max Mana", damageAvg: "Damage (avg)",
  resistFire: "Fire Resist", resistCold: "Cold Resist", resistShock: "Shock Resist", resistAcid: "Acid Resist",
  level: "Level", twoHanded: "Two-handed: also fills the off-hand slot",
  youHave: "you have", needMore: "need", more: "more",
  compareTitle: "Compared with equipped", nothingEquipped: "Nothing equipped in this slot.", sameStats: "Same stats.",
  verdictUp: "Upgrade: better in every changed stat.", verdictDown: "Downgrade: worse in every changed stat.", verdictMixed: "Mixed: better in some stats, worse in others.",
  cannotEquipYet: "You cannot use this yet.", onCursor: "In hand",
  // held item / drop feedback
  holding: "Holding", dropOnFloor: "Drop on floor", putBack: "Put back", dropHere: "Drop here", wrongSlot: "Wrong slot for this item",
  needsReq: "Needs", outOfBounds: "Does not fit there", blocked: "Two items are in the way", beltOnlyPotions: "The belt only takes potions",
  offhandBlocked: "A two-handed weapon blocks the off-hand", inventoryFull: "The drawer is full", noRoomForSwap: "No room to swap",
  notice: "Notice",
  // employee file
  fileTitle: "Employee File", jobTitle: "Junior Associate", fileDesk: "Open-plan floor", probation: "PROBATION", experience: "Experience",
  attributes: "Attributes", pointsToSpend: "Points to spend", derived: "Derived stats", unusable: "Gear you cannot use yet", unusableNone: "None. Everything in the drawer fits you.",
  raisesDamage: "raises damage", raisesDefense: "raises defense and aim", raisesHealth: "raises health", raisesMana: "raises mana", gearWord: "gear",
  previewHint: "Hover or focus a + to preview its effect.", previewNone: "No points left. Level up to earn more.", addPoint: "Add one point to", left: "left", unlocks: "Unlocks",
  statHealth: "Health", statMana: "Mana", statDamage: "Damage", statDefense: "Defense", statAttackRating: "Attack rating", statSkillPoints: "Skill points", statGold: "Gold", statXpLeft: "To next level",
  needsWord: "needs", moreWord: "more",
  // skills
  skillsTitle: "Skills", basicAttack: "Basic attack", activeSkills: "Active skills", passiveSkills: "Passive skills", skillLevel: "Level", manaCost: "Mana", skillPointsLeft: "Skill points",
  learn: "Learn", upgrade: "Upgrade", maxed: "Max level", assignTo: "Assign to", assigned: "Assigned", unassign: "Clear slot", selectedSkill: "Selected for the right mouse button", rightMouse: "Right mouse button uses the selected skill.",
  noSkillSelected: "No skill selected. Learn one in the Skills panel (S).",
  // npc windows
  buyTab: "Buy", sellTab: "Sell", buy: "Buy", sell: "Sell", stashPut: "Put away", stashTake: "Take", heal: "Heal me", healed: "You feel much better.", alreadyHealthy: "You are not hurt.",
  nothingToSell: "Nothing to sell.", lockerEmpty: "The locker is empty.", yourDrawer: "In your desk drawer", inLocker: "In the locker", stockEmpty: "Sold out.", unlimited: "always in stock",
  // hud
  hudLevel: "Level", attrPointsBadge: "attribute points", skillPointsBadge: "skill points", selectedMark: "selected", notEnoughMana: "Not enough mana", mpShort: "mana",
  slotEmpty: "Empty slot", beltEmpty: "Empty belt slot", drink: "Drink", toggleLabel: "Panels",
  floorWord: "Floor",
  // death
  respawn: "Respawn in the Lobby", respawnHint: "Back to the Lobby with full health. Nothing is lost.",
  // phone tabs
  tabGear: "Gear", tabFile: "Employee File", tabSkills: "Skills", tabNpc: "Talk", panelTabs: "Panels",
  // messages
  msgEquip: "Equipped", msgUnequip: "Unequipped", msgBuy: "Bought", msgSell: "Sold", msgPickup: "Picked up", msgLevel: "Level up! Now level", msgPotion: "Restored", msgLearn: "Learned", msgAlloc: "Raised", msgFull: "Inventory full", msgAfford: "Not enough gold", msgNoPath: "No way there",
  msgBeltFull: "Belt is full", msgReqs: "Requirements not met", msgBlocked: "Two-handed weapon in the way", msgRespawned: "Back in the Lobby.", msgFloor: "Floor", msgLobby: "The Lobby",
  msgHeldWorld: "Place the item first, or press Esc to put it back.",
  stairsLocked: "The way down is locked. Something waits below.",
  statAttr: { grit: "Grit", agility: "Agility", stamina: "Stamina", focus: "Focus" },
  attrOrder: ["grit", "agility", "stamina", "focus"],
};
