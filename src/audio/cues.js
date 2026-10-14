// Pure mapping: core / ui bus event -> cue descriptors. No Web Audio, no DOM; runs in Node.
// A descriptor: { cue, name, gain, prio, tile, delay }
//   cue   kit sound id (identical in all three kits: swing, hitFlesh, ... ding)
//   name  logical id used by cueLog and the spec (attack, hit, death, pickup, uiClick, levelUp, potion, ...)
//   gain  relative level 0..1 before distance attenuation   prio 1..10 (voice limiter)   tile where it happened (or null)   delay seconds
import { audioConfig } from "./config.js";

export const SFX_IDS = ["swing", "hitFlesh", "hitPaper", "miss", "hurtZombie", "hurtImp", "hurtManager", "deathZombie", "deathImp", "deathManager",
  "heroHurt", "heartbeat", "potion", "coin", "pickupItem", "pickupRare", "pickupUnique", "levelUp", "castStapler", "castReplyAll", "castCoffee",
  "castMute", "uiClick", "uiOpen", "uiEquip", "stairs", "ding"];
export const ZONES = ["lobby", "open-plan", "basement"];

/** Voice class of each monster type (the kits have three monster voices). Unknown types fall back to "Imp". */
export const MONSTER_VOICE = {
  "zombie-intern": "Zombie",
  "printer-imp": "Imp", "temp-worker": "Imp", "printer-demon": "Imp", consultant: "Imp",
  "middle-manager": "Manager", "vending-machine": "Manager", auditor: "Manager",
};
const PAPER_MONSTERS = new Set(["printer-imp", "printer-demon", "consultant", "auditor", "temp-worker"]);
const voiceOf = (type) => MONSTER_VOICE[type] ?? "Imp";

// Every cast skill has a cue built from the existing kit voices (no new kit sounds): SKILL_CUE is the main voice, SKILL_LAYER an optional
// second voice [cue, gain, delay] that gives heavy, electric or cold skills their own character.
export const SKILL_CUE = {
  "stapler-throw": "castStapler", "reply-all": "castReplyAll", "coffee-break": "castCoffee", mute: "castMute",
  "pallet-slam": "hitFlesh", "floor-buffer": "castReplyAll", "demolition-day": "hitFlesh", "fire-drill": "ding", lockout: "uiEquip", "dolly-charge": "swing",
  "wet-floor": "uiOpen", "traffic-cone": "uiEquip",
  "pen-volley": "castStapler", "card-fan": "castStapler", intern: "ding", "department-meeting": "ding", "hard-close": "hitFlesh",
  "server-overheat": "castReplyAll", "power-surge": "castMute", "blue-screen": "castReplyAll", "cold-boot": "castMute", firewall: "uiEquip",
  quarantine: "castMute", "restore-backup": "castCoffee", "turn-it-off": "castReplyAll",
};
export const SKILL_LAYER = {
  "pallet-slam": ["deathZombie", 0.45, 0.03], "demolition-day": ["deathManager", 0.6, 0.05], "dolly-charge": ["hitFlesh", 0.6, 0.12], "hard-close": ["ding", 0.6, 0.08],
  "server-overheat": ["hitPaper", 0.6, 0.05], "power-surge": ["hitPaper", 0.5, 0.04], "blue-screen": ["deathImp", 0.5, 0.06], firewall: ["castCoffee", 0.5, 0.05],
  quarantine: ["uiEquip", 0.5, 0.06], "turn-it-off": ["castMute", 0.7, 0.1], "department-meeting": ["uiOpen", 0.6, 0.1], "traffic-cone": ["uiOpen", 0.5, 0.05],
};
const PICKUP_CUE = { normal: "pickupItem", magic: "pickupItem", rare: "pickupRare", unique: "pickupUnique" };

/** Per-cue cooldown in seconds (default audioConfig.defaultCooldown). */
export const COOLDOWNS = {
  swing: 0.08, hitFlesh: 0.05, hitPaper: 0.05, miss: 0.1,
  hurtZombie: 0.15, hurtImp: 0.15, hurtManager: 0.15, deathZombie: 0.08, deathImp: 0.08, deathManager: 0.08,
  heroHurt: 0.12, heartbeat: 0.3, coin: 0.06, pickupItem: 0.08, uiClick: 0.04, uiOpen: 0.1, uiEquip: 0.08, stairs: 0.5, ding: 0.5,
  castStapler: 0.1, castReplyAll: 0.2, castCoffee: 0.3, castMute: 0.2, levelUp: 1.0, potion: 0.2, pickupRare: 0.2, pickupUnique: 0.3,
};

const PRIO = {
  levelUp: 10, heroHurt: 9, pickupUnique: 8, deathManager: 7, deathZombie: 6, deathImp: 6, castStapler: 6, castReplyAll: 6, castCoffee: 6, castMute: 6,
  heartbeat: 6, potion: 6, pickupRare: 6, stairs: 6, ding: 6, hitFlesh: 5, hitPaper: 5, swing: 4, coin: 4, pickupItem: 4, uiEquip: 3, uiOpen: 3,
  uiClick: 3, miss: 2, hurtZombie: 2, hurtImp: 2, hurtManager: 2,
};

export const CUE_SECONDS = {"swing": 0.71, "hitFlesh": 0.66, "hitPaper": 0.46, "miss": 0.62, "hurtZombie": 0.97, "hurtImp": 0.91, "hurtManager": 0.84, "deathZombie": 1.01, "deathImp": 1.05, "deathManager": 1.03, "heroHurt": 0.69, "heartbeat": 0.86, "potion": 0.96, "coin": 0.86, "pickupItem": 0.67, "pickupRare": 0.95, "pickupUnique": 0.93, "levelUp": 1.04, "castStapler": 0.79, "castReplyAll": 0.92, "castCoffee": 0.99, "castMute": 0.59, "uiClick": 0.56, "uiOpen": 0.87, "uiEquip": 0.8, "stairs": 1.0, "ding": 0.96}; // longest of the three kits (measure-*.json) + 50 ms
const d = (cue, name, extra = {}) => ({ cue, name, gain: 1, prio: PRIO[cue] ?? 3, tile: null, delay: 0, dur: CUE_SECONDS[cue] ?? audioConfig.fallbackVoiceSeconds, ...extra });
const monsterOf = (s, id) => s?.monsters?.find((m) => m.id === id) ?? null;
const tileOf = (m) => (m?.tile ? { x: m.tile.x, y: m.tile.y } : null);
const reject = (extra) => [d("uiClick", "reject", { gain: 0.5, ...extra })];
const click = (gain = 1) => () => [d("uiClick", "uiClick", { gain })];

/** event type -> (event, state) => descriptors[] */
export const EVENT_MAP = {
  // combat
  hit(ev, s) {
    if (ev.target === "player") return [d("heroHurt", "heroHurt")];
    const m = monsterOf(s, ev.target), type = m?.type, t = tileOf(m);
    const out = [];
    if (ev.source === "player" && !ev.skill) out.push(d("swing", "attack", { tile: t }));
    out.push(d(PAPER_MONSTERS.has(type) ? "hitPaper" : "hitFlesh", "hit", { tile: t, delay: out.length ? 0.04 : 0 }));
    out.push(d(`hurt${voiceOf(type)}`, "hurt", { tile: t, gain: 0.8, delay: 0.06 }));
    return out;
  },
  miss(ev, s) {
    const m = ev.source === "player" ? monsterOf(s, ev.target) : monsterOf(s, ev.source);
    return [d("miss", "miss", { tile: tileOf(m), gain: ev.source === "player" ? 1 : 0.7 })];
  },
  kill(ev, s) {
    const m = monsterOf(s, ev.target);
    return [d(`death${voiceOf(m?.type)}`, "death", { tile: tileOf(m) })];
  },
  death: (ev) => (ev.target === "player" ? [d("deathManager", "death", { prio: 9 })] : []),
  respawn: () => [d("ding", "respawn")],
  muted(ev, s) { return [d("castMute", "muted", { tile: tileOf(monsterOf(s, ev.target)), gain: 0.6 })]; },
  // hero
  potion: () => [d("potion", "potion")],
  healed: () => [d("castCoffee", "healed")],
  levelup: () => [d("levelUp", "levelUp")],
  skillLearned: () => [d("ding", "skillLearned", { gain: 0.8 })],
  // skills (cast always precedes burst / heal / projectile / muted, which therefore stay silent)
  cast(ev) {
    const cue = SKILL_CUE[ev.skill], layer = SKILL_LAYER[ev.skill];
    return cue ? [d(cue, "cast", { tile: null }), ...(layer ? [d(layer[0], "cast", { tile: null, gain: layer[1], delay: layer[2] })] : [])] : [];
  },
  projectile(ev, s) {
    if (ev.owner === "player") return [];                      // the cast cue covers the hero's own shots
    const pr = s?.projectiles?.find((p) => p.id === ev.id);
    const tile = pr?.pos ? { x: pr.pos.x, y: pr.pos.y } : tileOf(monsterOf(s, ev.owner));
    return [d("castStapler", "monsterShot", { tile, gain: 0.7 })];
  },
  // R4 skill events (statuses, buffs, allies, zones, dashes, crits, triggers; docs/reviews/R4-core-notes.md render_needs)
  status(ev, s) {
    const tile = tileOf(monsterOf(s, ev.target)), cue = ev.kind === "stun" ? "hitFlesh" : ev.kind === "burn" ? "hitPaper" : ev.kind === "freeze" ? "uiEquip" : "castMute";
    return [d(cue, "status", { tile, gain: ev.kind === "burn" ? 0.4 : 0.55, prio: 4 })];
  },
  crit(ev, s) { return [d("ding", "crit", { tile: tileOf(monsterOf(s, ev.target)), gain: 0.55, delay: 0.05, prio: 5 })]; },
  absorb: () => [d("uiEquip", "absorb", { gain: 0.8, prio: 5 })],
  buffStart: (ev) => [d(ev.stat === "hot" ? "castCoffee" : "ding", "buffStart", { gain: 0.5, prio: 4 })],
  buffEnd: () => [d("uiOpen", "buffEnd", { gain: 0.35, prio: 2 })],
  aura: (ev) => [d(ev.on ? "ding" : "uiOpen", ev.on ? "auraOn" : "auraOff", { gain: ev.on ? 0.7 : 0.5, prio: 4 })],
  projectileChain: (ev) => [d("castMute", "chain", { tile: ev.to ? { x: ev.to.x, y: ev.to.y } : null, gain: 0.5, prio: 4 })],
  summon: (ev) => [d("ding", "summon", { tile: ev.tile ? { x: ev.tile.x, y: ev.tile.y } : null, gain: 0.7, prio: 5 })],
  allyHurt: () => [d("hurtImp", "allyHurt", { gain: 0.4, prio: 2 })],
  allyDied: (ev) => (ev.reason === "slain" ? [d("deathImp", "allyDied", { gain: 0.6, prio: 4 })] : ev.reason === "expired" ? [d("uiOpen", "allyGone", { gain: 0.5, prio: 2 })] : []),
  zoneStart: (ev) => [d(ev.kind === "trap" ? "uiOpen" : "castReplyAll", "zoneStart", { tile: ev.tile ? { x: ev.tile.x, y: ev.tile.y } : null, gain: 0.7, prio: 4 })],
  zoneTrigger: () => [d("hitFlesh", "zoneTrigger", { gain: 0.7, prio: 5 }), d("castMute", "zoneTrigger", { gain: 0.5, delay: 0.04, prio: 4 })],
  dash: () => [d("swing", "dash", { gain: 1, prio: 5 })],
  trigger: (ev) => [d(ev.kind === "gold" ? "coin" : "ding", "trigger", { gain: 0.6, prio: 3 })],
  renamed: click(0.8),
  respec: () => [d("ding", "respec", { gain: 0.9, prio: 6 }), d("levelUp", "respec", { gain: 0.5, delay: 0.15, prio: 5 })],
  // items and money
  pickup: (ev) => [d(PICKUP_CUE[ev.rarity] ?? "pickupItem", "pickup")],
  gold: () => [d("coin", "gold")],
  buy: () => [d("coin", "buy")],
  sell: () => [d("coin", "sell")],
  equip: () => [d("uiEquip", "equip")],
  unequip: () => [d("uiOpen", "unequip", { gain: 0.8 })],
  dropped: click(0.8),
  beltSet: click(0.8),
  allocate: click(),
  skillSelected: click(0.8),
  vendorOpen: () => [d("uiOpen", "uiOpen")],
  dialog: () => [d("uiOpen", "uiOpen")],
  // refusals share one quiet cue
  noMana: () => reject(), cannotAfford: () => reject(), inventoryFull: () => reject(), beltFull: () => reject(),
  reqNotMet: () => reject(), slotBlocked: () => reject(), wrongSlot: () => reject(), placeRejected: () => reject(),
  // travel
  floorEnter: () => [d("stairs", "stairs")],
  portalOpen: () => [d("ding", "portalOpen")],
  portalUse: () => [d("stairs", "portalUse")],
  stairsLocked: () => reject({ name: "stairsLocked" }),
  // boss and finale (S3-1). Built from existing kit sounds: no new kit voices. Boss cues are loud and high priority so a busy fight never drops them.
  bossEngage: (ev, s) => [d("hurtManager", "bossEngage", { tile: tileOf(monsterOf(s, ev.id)), prio: 8 }), d("castMute", "bossEngage", { tile: tileOf(monsterOf(s, ev.id)), gain: 0.6, delay: 0.18, prio: 8 })],
  bossTelegraph(ev, s) {
    const tile = ev.tile ? { x: ev.tile.x, y: ev.tile.y } : tileOf(monsterOf(s, ev.id));
    const cue = ev.kind === "slam" ? "castReplyAll" : ev.kind === "volley" ? "castStapler" : "castCoffee";
    return [d(cue, "bossTelegraph", { tile, gain: 0.8, prio: 8 })];
  },
  bossSlam: (ev) => [d("hitFlesh", "bossSlam", { tile: ev.tile ?? null, prio: 8 }), d("deathZombie", "bossSlam", { tile: ev.tile ?? null, gain: 0.5, delay: 0.03, prio: 7 })],
  bossVolley: (ev, s) => [d("castReplyAll", "bossVolley", { tile: tileOf(monsterOf(s, ev.id)), gain: 0.9, prio: 7 })],
  bossSummon: (ev, s) => [d("ding", "bossSummon", { tile: tileOf(monsterOf(s, ev.id)), gain: 0.8, prio: 7 }), d("hurtImp", "bossSummon", { tile: tileOf(monsterOf(s, ev.id)), gain: 0.6, delay: 0.12 })],
  bossPhase: (ev, s) => [d("deathManager", "bossPhase", { tile: tileOf(monsterOf(s, ev.id)), gain: 0.8, prio: 9 }), d("ding", "bossPhase", { gain: 0.7, delay: 0.3 })],
  bossDefeated: (ev) => [d("deathManager", "bossDefeated", { tile: ev.tile ?? null, prio: 9 }), d("deathImp", "bossDefeated", { tile: ev.tile ?? null, gain: 0.7, delay: 0.25, prio: 8 })],
  stairsUnlocked: () => [d("ding", "stairsUnlocked", { prio: 7 }), d("stairs", "stairsUnlocked", { gain: 0.7, delay: 0.2 })],
  victory: () => [d("levelUp", "victory", { prio: 10 }), d("ding", "victory", { delay: 0.5, prio: 8 })],
  keepPlaying: click(),
  resisted(ev, s) { return [d("miss", "resisted", { tile: tileOf(monsterOf(s, ev.target)), gain: 0.6 })]; },
  // shell / UI hooks (emitted by main.js / ui; see S3-audio-notes.md)
  "ui:click": click(),
  "ui:open": () => [d("uiOpen", "uiOpen")],
  "ui:close": () => [d("uiOpen", "uiClose", { gain: 0.7 })],
  "ui:equip": () => [d("uiEquip", "equip")],
  "ui:heartbeat": () => [d("heartbeat", "heartbeat")],
};

/** Events that exist but deliberately make no sound, with the reason. */
export const SILENT_EVENTS = {
  burst: "covered by the cast cue",
  heal: "covered by the cast cue",
  projectileEnd: "the hit / miss cue already sounded; a wall impact is too quiet to matter",
  drop: "a ground item appearing is silent; the pickup cue sounds",
  noPath: "pathing failure is a UI toast, not a sound",
  castRefused: "a UI toast (castRefused.<reason>); the noMana event already carries the reject sound",
  "ui:lowhp": "state change only; ui:heartbeat carries the pulses",
  dotTick: "damage over time already shows as floaters; a tick every half second would be noise",
  zoneEnd: "a zone fading out is silent; its start and trigger sound",
  autosave: "a background save must not interrupt play; the title and options screens show save problems as text",
};

/** Descriptors for one event; unknown events and malformed input give []. */
export function mapEvent(ev, state) {
  const fn = ev && typeof ev.type === "string" && Object.hasOwn(EVENT_MAP, ev.type) ? EVENT_MAP[ev.type] : null;
  if (!fn) return [];
  try { return fn(ev, state).filter((x) => SFX_IDS.includes(x.cue)); } catch { return []; }
}

export const mappedEventTypes = () => Object.keys(EVENT_MAP);

const zoneForDepth = (depth, split = 4) => (depth <= 0 ? "lobby" : depth <= split ? "open-plan" : "basement");

/** Which zone ambient should play for this state? The title screen plays the soft lobby bed; death and errors play none. */
export function ambientZone(state) {
  if (!state || state.scene === "title" || state.scene == null) return "lobby";
  if (state.scene === "dead" || state.scene === "error") return null;
  const theme = state.floor?.theme;
  if (ZONES.includes(theme)) return theme;
  return zoneForDepth(state.depth ?? 0);
}

export { audioConfig };
