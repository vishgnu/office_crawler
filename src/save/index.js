// Public API of the save package. Pure apart from the storage adapter you hand in.
export { serialize, deserialize, check, loadSave, toSave, schemaProblem, checksumOf, rleEncode, rleDecode, SAVE_FORMAT, SAVE_KEYS, PLAYER_KEYS } from "./format.js";
export { migrate, MIGRATIONS } from "./migrate.js";
export { createSaveStore, createAdapter, createMemoryAdapter, createWebStorageAdapter } from "./storage.js";
export { createSlotStore, emptyIndex, textSum } from "./slots.js";
export { createSession, slotsView } from "./session.js";
