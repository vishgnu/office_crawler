// Keyboard mapping (pure). Panel keys are handled by the UI layer; F1-F4 and the belt keys 1-4 go to the core as
// { t: "key", code } (QF-01-1/QF-01-4). Escape has a priority chain, see game.key().
export const PANEL_KEYS = { KeyI: "inventory", KeyC: "character", KeyS: "skills", KeyK: "skills" };
export const SKILL_KEYS = ["F1", "F2", "F3", "F4"];
export const BELT_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4", "Numpad1", "Numpad2", "Numpad3", "Numpad4"];

/** Keys whose browser default must be suppressed while playing (function keys, Tab). */
export const preventsDefault = (code) => SKILL_KEYS.includes(code);

/** Which panel a key toggles, or null. */
export const panelFor = (code) => PANEL_KEYS[code] ?? null;
