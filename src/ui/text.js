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
  titleGoal: "Find out why the floors went dark \u2014 and who\u2019s responsible.",
  attributes: "Attributes", pointsToSpend: "Points to spend", derived: "Derived stats", unusable: "Gear you cannot use yet", unusableNone: "None. Everything in the drawer fits you.",
  raisesDamage: "raises damage", raisesDamageAnd: "raises damage and {x}", gritNoDamage: "needed by some gear; no damage for your class",
  attrDamageTip: "Each point above {free} adds {n} damage to weapon hits and skills.", attrAgilityTip: "Each point adds {d} defense and {a} attack rating.", attrStaminaTip: "Each point adds {n} health.", attrFocusTip: "Each point adds {n} mana.", raisesDefense: "raises defense and aim", raisesHealth: "raises health", raisesMana: "raises mana", gearWord: "gear",
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
  msgBeltFull: "Belt is full", msgReqs: "Requirements not met", msgBlocked: "Two-handed weapon in the way", msgRespawned: "Back in the Lobby.", msgRestock: "Your belt is empty: restock potions at the Break Room Barista.", msgFloor: "Floor", msgLobby: "The Lobby",
  msgHeldWorld: "Place the item first, or press Esc to put it back.",
  stairsLocked: "The way down is locked. Something waits below.",
  // map (R-075) and Emergency Exit (R-046)
  mapTitle: "Map", openMap: "Map", closeMap: "Close map (M)", mapLegend: "You, stairs, people, exit door", mapUnexplored: "Nothing explored yet.",
  msgPortalOpen: "Emergency Exit: a door opens. Step through to return here.", msgPortalUse: "You step through the Emergency Exit.", msgPortalBack: "The Emergency Exit leads back to your floor.", msgExitUse: "Emergency Exit used.", useItem: "Use", exitItemHint: "Right-click to use, or press its belt key.", exitEffect: "Door to the Lobby; walk back through it",
  // S3 title, save, options, victory, boss
  pointsHint: "You have points to spend: C for attributes, S for skills.",
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

// ---- R5: character selection, save slots, skill tree (UI-R5) ----
Object.assign(T, {
  // title
  newGame: "New game", loadGame: "Load game", saveSlots: "Save slots", continueAs: "Continue", manageSaves: "Manage saves",
  // character selection (variant A, Lobby lineup)
  csTitle: "Lobby, 08:57", csSub: "Pick who walks through the elevator doors", csClasses: "Class", csKeys: "choose", csLoadKey: "load game", csConfidential: "CONFIDENTIAL, FLOOR 0",
  csName: "Character name", csNameHint: "1 to 16 characters", csNamePlaceholder: "Type a name", csSuggest: "Suggest", csStart: "Start", csStartHint: "Type a name to start", csLoad: "Load game", csBack: "Back",
  csNameError: "Enter a name, 1 to 16 letters, digits, spaces, hyphens or apostrophes.", csSelected: "SELECTED", csPlaystyle: "Playstyle", csBranches: "Skill branches", csStats: "Starting stats",
  csStatHealth: "Health", csStatMana: "Mana", csStatDamage: "Damage", csStatAgility: "Agility", csOutOf: "out of 5",
  csSlotNew: "New character saves to slot", csSlotsUsed: "slots used", csSlotFull: "All 5 slots are full. Choose a slot to replace.", csChooseSlot: "Choose a slot",
  csReplaceTitle: "Replace this character?", csReplaceText: "will be replaced by a new character. A copy is kept for undo until the next delete or overwrite in that slot.", csReplaceYes: "Replace and start",
  csDoorsOpen: "The elevator doors open.", csError: "Could not start the character.",
  // slots manager
  slTitle: "Save slots", slIntro: "Five characters, one per slot. The game saves to the slot you are playing.", slEmpty: "Empty", slEmptyText: "No character saved here yet", slSlot: "Slot", slLevel: "Level", slLobby: "Lobby", slFloor: "Floor",
  slPlayed: "played", slLast: "Last played", slMostRecent: "Most recent", slPlaying: "Playing now", slLoad: "Load", slContinueHere: "Playing", slRename: "Rename", slExport: "Export", slImport: "Import", slDelete: "Delete", slNew: "New character here", slReplace: "Replace with new character",
  slUndoDelete: "Undo delete", slUndoReplace: "Undo replace", slDamaged: "Damaged", slDamagedText: "This save could not be read. The text was kept so you can export it.", slNewer: "From a newer version", slNewerText: "Saved by a newer version of the game. It is left untouched.",
  slExportDamaged: "Export damaged text", slClose: "Close", slSave: "Save", slCancel: "Cancel", slRenameLabel: "New name", slNowPlayingHint: "Quit to title to delete or replace the character you are playing.",
  slDeleteTitle: "Delete this character?", slDeleteText: "A copy is kept for undo until the next delete or overwrite in that slot.", slDeleteYes: "Delete", slDeleteForever: "Delete forever",
  slImportTitle: "Import a character into slot", slImportReplaceTitle: "Replace this character?", slImportReplaceText: "will be replaced by the imported character. A copy is kept for undo.", slImportReplaceYes: "Replace",
  slMigrated: "Your old save was moved to slot 1.", slUsage: "Storage used on this device", slLoaded: "Loaded", slDeleted: "Deleted", slUndone: "Restored", slRenamed: "Renamed", slImported: "Imported", slExported: "Exported",
  slLoadFirst: "The running game is saved first.", slBack: "Back to the list",
  errPlaying: "That is the character you are playing. Quit to the title first.", errAnotherTab: "This game is open in another tab. Close it there to play here.", errQuota: "Storage is full. Export a slot or delete a character.",
  errWrite: "Could not write to storage.", errNoStorage: "Saving is not available here.",
  // skill tree
  trTitle: "Skills", trPoints: "Skill points", trReset: "Respec", trRespecAsk: "Reset all skills?", trRespecRefund: "You get {n} skill point{s} back. Your skills go back to the signature skill only.", trRespecOnce: "You can only do this once.", trRespecCost: "It costs {g} gold.", trRespecYes: "Reset, get {n} back", trResetHint: "Take back every point (Lobby only).", trResetNone: "Respec is only possible in the Lobby.",
  castRefused: { "no-direction": "Pick a direction or a target first.", "no-mana": "Not enough mana", cooldown: "Not ready yet.", "no-target": "No target there.", silenced: "You cannot use skills right now." },
  trTier: "Tier", trLevelOf: "Level", trNeeds: "Needs", trNow: "Now", trNext: "Next level", trAura: "Aura", trAuraOn: "Aura on", trAuraOff: "Aura off", trSignature: "Signature", trCost: "Mana", trReserve: "reserves", trPassive: "Passive",
  trAssign: "Assign to bar", trSelectNote: "Hover a skill for its numbers. F1 to F4 pick the bar skill.", trBranchSpent: "Points spent", trNothing: "nothing yet",
  trStateLearned: "Learned", trStateAvailable: "Available", trStateLockedLevel: "Locked", trStateLockedPrereq: "Locked", trStateMaxed: "Max level", trStateNoPoints: "No points",
  trRespecDone: "Skill points returned.", trRespecFail: { "not-in-town": "Respec is only possible in the Lobby.", dead: "You cannot do that now.", "respec-off": "Respec is switched off.", "respec-used": "You already used your respec.", "no-gold": "Not enough gold to respec.", "nothing-to-respec": "Nothing to respec: no skill points are spent yet." },
  trLearnFail: { "level-gate": "Your level is too low.", prereq: "Learn the earlier skill first.", "no-points": "No skill points left.", "max-level": "Already at maximum level.", basic: "Basic attacks are free.", "wrong-class": "Not a skill of your class." },
  trAuraFail: { "no-mana": "Not enough mana to reserve.", "not-learned": "Learn the aura first." },
  clsFacilities: "Facilities Manager",
});

// ---- R5 fix round: save status banners, load confirmation, slot cards ----
Object.assign(T, {
  svMemory: "Saving is off in this browser", svMemoryText: "Your progress is kept only while this tab stays open. Allow site storage for this page (private windows often block it) and reload.",
  svFull: "Storage is full", svFullText: "New progress cannot be saved. Export a character or delete one you no longer need.",
  svOther: "This game is open in another tab", svOtherText: "Saves from this tab are paused so the two tabs do not overwrite each other.",
  svStale: "Another session still holds the saves", svStaleText: "A tab that was open before did not close cleanly. If it is gone, take over the saves here.",
  svTakeOver: "Take over saves", svTakeTitle: "Take over saves in this tab?", svTakeText: "The other tab will stop saving. Close it first if it is still open, or its newer progress may be lost.", svTakeYes: "Take over here", svTaken: "This tab now saves.",
  svDismiss: "Dismiss",
  notices: {
    "no-active-slot": "Nothing was saved because no character is active. Start or load a character first.",
    "pre-switch-save-failed": "The running game could not be saved before switching, so nothing was changed. Free some space, then try again.",
    "migration-failed": "Your old save could not be moved into a slot. It is still on this device: export it from Save slots if you need it.",
    "attributes-refunded": "Your attribute points were refunded because your class now scales from {attr}. Spend them again in the Employee File.",
    "attributes-refunded-generic": "Your attribute points were refunded because your class now scales from a different attribute. Spend them again in the Employee File.",
    generic: "Saving ran into a problem.",
  },
  errPreSwitch: "The running game could not be saved first, so nothing was changed. Free some space and try again.",
  slLoadTitle: "Load this character?", slLoadText: "The running game is saved first, but unsaved floor progress is lost: you come back at the floor entrance. Cancel keeps the game as it is.", slLoadYes: "Load", slDeepest: "Deepest", slDeepestLobby: "Lobby only",
});

// ---- R7: quest journal, tracker, quest dialogue and toasts (contract section 2.5; quest texts come from content/quests.js) ----
Object.assign(T, {
  journalTitle: "Journal", openJournal: "Journal", journalClose: "Close Journal (J)", journalActive: "Active", journalCompleted: "Completed", journalEmpty: "No quests yet.",
  journalPouch: "Quest items", journalPouchEmpty: "You carry no quest items.", journalNew: "updated", journalPanel: "Quests",
  nextStepLabel: "Next step", giverLabel: "Given by", progressLabel: "{n}/{goal}", stepLabel: "Step", pinAction: "Pin", unpinAction: "Unpin", pinnedMark: "Pinned",
  stateLocked: "Locked", stateAvailable: "Available", stateActive: "Active", stateReady: "Ready to hand in", stateCompleted: "Completed",
  mainQuestLabel: "Main quest", sideQuestLabel: "Side quest",
  questAccept: "Accept", questDecline: "Decline", questHandIn: "Hand in", rewardLabel: "Reward", rewardGold: "{n} gold", rewardXp: "{n} experience",
  rewardGear: "{kind} (at least {rarity})", rewardPotions: "{n} potions",
  readVerdict: "Read the verdict", verdictRefused: "There is no verdict to read yet.", trackerLabel: "Quest tracker",
  mapMarkerStairsDown: "Stairs down", mapMarkerStairsUp: "Stairs up", mapMarkerNpc: "Talk here", mapMarkerElevator: "Elevator",
  rewardGearArmour: "an armour piece", rewardGearAccessory: "a ring, amulet or belt", rewardGearExact: "{kind} ({rarity})", rewardGearWeapon: "a weapon", progressNow: "Progress",
  owedOne: "1 item waits until your bag has room.", owedMany: "{n} items wait until your bag has room.", owedBadge: "reward items waiting for bag room", owedTitle: "Waiting for bag room",
  toastQuestDone: "{title}: completed", toastQuestRewards: "{title}: completed ({rewards})", slotMainDone: "Main quest complete", slotQuestAria: "Quest: {step}, {n} of {m} side quests done",
  questDialogLabel: "Quests of this person",
  slotQuestLine: "{step} · {n}/{m}", toastQuest: "{title}: {next}", keyJournal: "Journal", pauseJournal: "Journal",
});
