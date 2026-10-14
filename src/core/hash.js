// Hashing helpers. Integer-only maths so every engine gives the same result.

// 32-bit hash of a list of integers (FNV-1a over the bytes, then a murmur-style finaliser).
export function hash32(...nums) {
  let h = 0x811c9dc5;
  for (let n of nums) {
    n >>>= 0;
    for (let i = 0; i < 4; i++) { h ^= n & 255; h = Math.imul(h, 16777619); n >>>= 8; }
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Keys that are not simulation state (UI caches, perf samples) and must not change the hash.
const EXCLUDED = new Set(["ui.tooltip", "ui.hud", "perf"]);

// Canonical JSON: object keys sorted, undefined dropped, so key order never matters.
// `opts` (hashStateWithout only): { skip: Set of extra dotted paths, eventPrefixes: drop entries of `events` / `eventLog` whose type starts with one of these }.
export function canonical(value, path = "", opts = null) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    const list = opts?.eventPrefixes && (path === "events" || path === "eventLog") ? value.filter((e) => !(typeof e?.type === "string" && opts.eventPrefixes.some((x) => e.type.startsWith(x)))) : value;
    return "[" + list.map((v) => canonical(v, path + "[]", opts)).join(",") + "]";
  }
  const parts = [];
  for (const k of Object.keys(value).sort()) {
    const p = path ? path + "." + k : k;
    if (value[k] === undefined || EXCLUDED.has(p) || opts?.skip.has(p)) continue;
    parts.push(JSON.stringify(k) + ":" + canonical(value[k], p, opts));
  }
  return "{" + parts.join(",") + "}";
}

// 64-bit state hash as 16 hex chars: two FNV-1a lanes with different offsets and primes.
export function hashString(text) {
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 0x5bd1e995);
    b ^= b >>> 15;
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(a) + hex(b);
}

export const hashState = (state) => hashString(canonical(state));

/** The state hash with some dotted paths and event types left out: the proof that a change (R7 quests) did not alter gameplay. */
export const hashStateWithout = (state, { paths = [], eventPrefixes = [] } = {}) => hashString(canonical(state, "", { skip: new Set(paths), eventPrefixes: eventPrefixes.length ? eventPrefixes : null }));
