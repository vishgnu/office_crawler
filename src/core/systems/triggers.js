// Passive triggers (ADR-0005 op `trigger`): effects that fire when something happens to the hero. Today: on kill (Commission).
import { skills, at, } from "../content/skills.js";
import { emit } from "../events.js";
import { giveGold } from "./loot.js";

/** The hero killed `m`: run the `then` ops of every learned passive with an on-kill trigger. */
export function onKill(state, m) {
  const p = state.player;
  if (p.hp <= 0 || m.summoned) return;
  for (const [id, level] of Object.entries(p.skills)) {
    const def = skills[id];
    if (!def || def.kind !== "passive" || !(level > 0)) continue;
    for (const e of def.effects) {
      if (e.op !== "trigger" || e.on !== "kill") continue;
      for (const t of e.then) {
        if (t.op === "mana") { const v = Math.round(at(t.amount, level)); p.mp = Math.min(p.mpMax - (p.mpReserved ?? 0), p.mp + v); emit(state, { type: "trigger", skill: id, kind: "mana", value: v }); }
        else if (t.op === "gold") { const v = Math.round(at(t.amount, level)) + (t.perDepth ?? 0) * Math.max(1, state.depth); giveGold(state, v); emit(state, { type: "trigger", skill: id, kind: "gold", value: v }); }
      }
    }
  }
}
