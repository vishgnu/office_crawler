// Key bindings (pure). `options.keys` maps an action id to a KeyboardEvent.code. The game resolves every key press through
// resolveKey(): a bound key becomes the action's canonical default code (so the rest of the shell keeps one set of codes),
// the default code of an action that was moved elsewhere does nothing, and everything else (aliases, Escape) passes through.
// Not remappable: Escape (pause, close, put back), the mouse buttons, and the aliases K (skills), Tab (map), the numpad belt keys.

/** action id -> default code. Spec name: config.defaultKeys (src/core is frozen, so the table lives here). */
export const DEFAULT_KEYS = Object.freeze({
  inventory: "KeyI", character: "KeyC", skills: "KeyS", map: "KeyM", journal: "KeyJ",
  skill1: "F1", skill2: "F2", skill3: "F3", skill4: "F4",
  belt1: "Digit1", belt2: "Digit2", belt3: "Digit3", belt4: "Digit4",
});
export const ACTIONS = Object.keys(DEFAULT_KEYS);
/** Codes that cannot be bound (pause / back, browser or OS keys, modifiers). */
export const RESERVED = new Set(["Escape", "Tab", "Enter", "Space", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "ContextMenu", "CapsLock", "F5", "F11", "F12"]);
const BINDABLE = /^(Key[A-Z]|Digit[0-9]|F[1-4]|F[6-9]|F10|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Comma|Period|Slash|Semicolon|Quote|Backquote|BracketLeft|BracketRight|Backslash|Minus|Equal)$/;

export const defaultKeys = () => ({ ...DEFAULT_KEYS });

/** A complete, valid bindings object from stored data: unknown actions are dropped, invalid codes fall back to the default, and any clash resets everything to the defaults. */
export function normalizeKeys(raw) {
  const src = raw && typeof raw === "object" ? raw : {}, out = {};
  for (const a of ACTIONS) out[a] = typeof src[a] === "string" && BINDABLE.test(src[a]) && !RESERVED.has(src[a]) ? src[a] : DEFAULT_KEYS[a];
  return new Set(Object.values(out)).size === ACTIONS.length ? out : defaultKeys();
}

/** Which action uses this code, or null. */
export const actionOf = (keys, code) => ACTIONS.find((a) => keys[a] === code) ?? null;

/**
 * Bind `code` to `action`. Rejects reserved or unbindable keys and a key another action already uses (QF-01-6: the player
 * must free it first). Returns { ok: true, keys } with a new object, or { ok: false, reason: "reserved" | "invalid" | "conflict" | "unknown", with? }.
 */
export function bindKey(keys, action, code) {
  if (!ACTIONS.includes(action)) return { ok: false, reason: "unknown" };
  if (typeof code !== "string" || RESERVED.has(code)) return { ok: false, reason: "reserved" };
  if (!BINDABLE.test(code)) return { ok: false, reason: "invalid" };
  const other = actionOf(keys, code);
  if (other && other !== action) return { ok: false, reason: "conflict", with: other };
  return { ok: true, keys: { ...keys, [action]: code } };
}

/**
 * Translate a pressed code. Returns the canonical (default) code of the bound action, the code itself when it is an alias or
 * not part of the table, or null when it is the default code of an action that was moved to another key.
 */
export function resolveKey(code, keys = DEFAULT_KEYS) {
  const a = actionOf(keys, code);
  if (a) return DEFAULT_KEYS[a];
  if (Object.values(DEFAULT_KEYS).includes(code)) return null; // its action lives elsewhere now
  return code;
}

/** Short label for a code: KeyB -> B, Digit1 -> 1, ArrowUp -> Up. */
export function keyLabel(code) {
  if (typeof code !== "string") return "";
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ").replace(/^Arrow/, "").replace("BracketLeft", "[").replace("BracketRight", "]")
    .replace("Backquote", "`").replace("Semicolon", ";").replace("Quote", "'").replace("Comma", ",").replace("Period", ".").replace("Slash", "/").replace("Backslash", "\\").replace("Minus", "-").replace("Equal", "=");
}

export const sameKeys = (a, b) => ACTIONS.every((k) => a?.[k] === b?.[k]);
