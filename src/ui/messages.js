// Core event -> one line of player-facing feedback (toast + live region). Pure; events with no line return null.
import { content } from "../core/index.js";
import { T } from "./text.js";
import { unmetReason } from "./itemview.js";

const S = content.strings;

const findItem = (state, id) => state.cursorItem?.id === id ? state.cursorItem
  : state.inventory.items.find((i) => i.id === id) ?? Object.values(state.equipment).find((i) => i?.id === id)
  ?? state.vendor?.stock.find((e) => e.item.id === id)?.item ?? null;

// CR6-07: a refused cast (core event castRefused { skill, reason }) gets one short line; holding a key repeats the refusal every tick, so the same line is shown at most once per second.
const THROTTLE_MS = 1000, lastShown = new Map();
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
function throttled(key) { const t = now(), last = lastShown.get(key); if (last !== undefined && t - last < THROTTLE_MS && t >= last) return true; lastShown.set(key, t); return false; }

export function messageFor(ev, state) {
  switch (ev.type ?? ev.t) {
    case "castRefused": { // guarded: older cores never send it; an unknown reason has no line
      const text = T.castRefused[ev.reason];
      return text && !throttled(ev.reason === "no-mana" ? "mana" : "cast:" + ev.reason) ? text : null;
    }
    case "reqNotMet": { const it = findItem(state, ev.id); return (it && unmetReason(state.player, it)) || T.msgReqs; }
    case "wrongSlot": return T.wrongSlot;
    case "slotBlocked": return T.offhandBlocked;
    case "inventoryFull": return T.msgFull;
    case "beltFull": return T.msgBeltFull;
    case "cannotAfford": return `${T.msgAfford} (${ev.price} ${T.gold})`;
    case "placeRejected": return ev.reason === "outOfBounds" ? T.outOfBounds : ev.reason === "blocked" ? T.blocked : T.wrongSlot;
    case "stairsLocked": return S.stairsLocked;
    case "noMana": return throttled("mana") ? null : T.notEnoughMana;
    case "levelup": return `${T.msgLevel} ${ev.level}.`;
    case "skillLearned": return `${T.msgLearn} ${content.skills[ev.skill]?.name ?? ev.skill} (${T.skillLevel} ${ev.level}).`;
    case "buy": return `${T.msgBuy} ${ev.name} (${ev.price} ${T.gold}).`;
    case "sell": return `${T.msgSell} ${ev.name} (${ev.value} ${T.gold}).`;
    case "equip": return `${T.msgEquip} ${ev.name}.`;
    case "unequip": return `${T.msgUnequip} ${ev.name}.`;
    case "potion": return `${T.msgPotion} ${ev.value} ${ev.restores === "hp" ? T.health : T.mana}.`;
    case "allocate": return `${T.msgAlloc} ${T.statAttr[ev.attr] ?? ev.attr}.`;
    case "healed": return T.healed;
    case "respawn": return T.msgRespawned;
    case "portalOpen": return T.msgPortalOpen;
    case "portalUse": return T.msgPortalBack;
    case "bossTelegraph": return ev.kind === "slam" ? S.bossTelegraphSlam : ev.kind === "volley" ? S.bossTelegraphVolley : null; // also the screen-reader warning (live region)
    case "bossPhase": return S.bossPhase2;
    case "bossSummon": return S.bossSummon;
    case "stairsUnlocked": return S.bossStairsUnlocked;
    case "floorEnter": return ev.depth === 0 ? S.lobbyName : `${T.floorWord} ${ev.depth}: ${state.floor.name}`;
    default: return null;
  }
}
