// Character names (R4 contract section 6, R-211). Pure: no randomness, no clock.
export const NAME_MAX = 16;
export const DEFAULT_NAME = "Employee";
// Unicode letters and digits (no emoji, no control or markup characters), space, hyphen and apostrophe.
const ALLOWED = /^[\p{L}\p{N} '’-]+$/u;

/** validateName(name) -> { ok: true, name } (trimmed, inner space runs collapsed) | { ok: false, error: "bad-name" }. */
export function validateName(name) {
  if (typeof name !== "string") return { ok: false, error: "bad-name" };
  const clean = name.trim().replace(/ {2,}/g, " ");
  if (clean.length < 1 || [...clean].length > NAME_MAX || !ALLOWED.test(clean)) return { ok: false, error: "bad-name" };
  return { ok: true, name: clean };
}

const SUGGESTIONS = [
  "Sir Stapleton", "Desk Pilot 7", "Agent Break-Room", "Captain Cubicle", "Lady Lanyard", "Doctor Reply-All", "Baron Binder", "Ctrl-Alt Hero",
  "Paper Jam Pilot", "Lord Of Leave", "Admiral Agenda", "Chief Of Chairs", "Mister Mandate", "Madam Memo", "Sergeant Standup", "Cubicle Cadet 3",
  "Duchess Of Desks", "Major Meeting", "Tab Wrangler", "Inbox Zero Hero", "Queen Of Quota", "Knight Of Notes", "Sir Reboot", "Coffee Captain",
];
export const suggestionCount = SUGGESTIONS.length;
/** suggestName(index) -> one of 24 fixed names (index wraps; no randomness). */
export const suggestName = (index = 0) => SUGGESTIONS[((Math.trunc(Number(index)) || 0) % SUGGESTIONS.length + SUGGESTIONS.length) % SUGGESTIONS.length];
