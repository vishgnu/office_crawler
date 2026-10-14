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
  fileTitle: "Employee File", jobTitle: "Junior Associate", fileDesk: "Open-plan floor", probation: "PROBATION", experience: "Experience", xpTotal: "Total experience", xpOf: "of", xpToLevel: "to level", xpMax: "Max level",
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
  buyTab: "Buy", sellTab: "Sell", buy: "Buy", sell: "Sell", sellSure: "Sure?", stashPut: "Put away", stashTake: "Take", heal: "Heal me", healed: "You feel much better.", alreadyHealthy: "You are not hurt.",
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
  // map (R-075) and Emergency Exit (R-046)
  mapTitle: "Floor map", openMap: "Map", closeMap: "Close map (M)", mapLegend: "You, stairs, people, exit door", mapUnexplored: "Nothing explored yet.",
  msgPortalOpen: "Emergency Exit: a door opens. Step through to return here.", msgPortalUse: "You step through the Emergency Exit.", msgPortalBack: "The Emergency Exit leads back to your floor.", msgExitUse: "Emergency Exit used.", useItem: "Use", exitItemHint: "Right-click to use, or press its belt key.", exitEffect: "Door to the Lobby; walk back through it",
  // S3 title, save, options, victory, boss
  storyContinue: "Get to work", storyKicker: "Story", confirmImportTitle: "Replace your character?", confirmImportText: "Importing replaces the character in this browser. The current one is kept once as a damaged-save backup you can export.",
  continueGame: "Continue", options: "Options", back: "Back", exportSave: "Export save", importSave: "Import save", deleteCharacter: "Delete character", exportCorrupt: "Export damaged save",
  confirmNewTitle: "Start a new game?", confirmNewText: "This replaces your saved character. Export the save first if you want to keep it.", confirmDeleteTitle: "Delete the character?", confirmDeleteText: "The saved character is removed. Your options stay.",
  confirmYes: "Yes, continue", confirmNo: "Cancel", importTitle: "Import a save", importFile: "Choose a save file", importPaste: "Or paste the save text here", importGo: "Import pasted text", importPasteLabel: "Pasted save text",
  noSaveYet: "No saved game yet.", saveFound: "A saved game was found.",
  victoryQuit: "Quit to title", victoryBoss: "Boss defeated", saveExported: "Save exported.",
  bossBar: "Boss health", bossPhaseMark: "Phase 2 starts here", bossPhaseLabel: "Phase", telegraphLive: "Warning",
  // options
  optionsTitle: "Options", optSound: "Sound", optVolumeMaster: "Master volume", optVolumeSfx: "Effects volume", optVolumeAmbient: "Ambient volume", optMute: "Mute all sound", optKit: "Sound set",
  kitFoley: "Foley (default)", kitGothic: "Gothic", kitChiptune: "Chiptune", kitPreview: "Preview", kitPreviewNote: "Plays a short sample of the selected set.",
  optKeys: "Keys", optKeysHint: "Select an action, then press the new key. Esc cancels.", optKeysPress: "Press a key", optKeysRestore: "Restore default keys", optKeysConflict: "That key is already used by", optKeysReserved: "That key cannot be used.", optKeysInvalid: "That key cannot be bound.", optKeysSet: "Key set",
  actInventory: "Desk Drawer", actCharacter: "Employee File", actSkills: "Skills", actMap: "Map", actSkill1: "Skill 1", actSkill2: "Skill 2", actSkill3: "Skill 3", actSkill4: "Skill 4", actBelt1: "Potion 1", actBelt2: "Potion 2", actBelt3: "Potion 3", actBelt4: "Potion 4",
  optMouse: "Mouse (fixed)", optMouseLeft: "Left button: walk, attack, pick up", optMouseRight: "Right button: use the selected skill", optMouseNote: "Mouse buttons cannot be changed. Esc always pauses or goes back.",
  optAccess: "Accessibility", optHighContrast: "High contrast", optLowFx: "Reduced effects (cheaper lighting)", optReduceMotion: "Reduce motion and flashing", optShake: "Screen shake", optTextSize: "Text size",
  sizeNormal: "Normal", sizeLarge: "Large", sizeHuge: "Extra large", optGore: "Blood and gore", optGoreOff: "Always off", on: "On", off: "Off",
  optRarity: "Item rarity is shown by shape and border as well as colour:", optSaved: "Options are saved on this device.",
  errorExport: "Export save",
  statAttr: { grit: "Grit", agility: "Agility", stamina: "Stamina", focus: "Focus" },
  attrOrder: ["grit", "agility", "stamina", "focus"],
};
