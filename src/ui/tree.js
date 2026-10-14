// The skill tree panel (S / K), R5. Renders treeView(state) from the core: three branches of the player's class, tiers, prerequisites, level gates,
// points, learn, respec (Lobby), the F1 to F4 assignment from the tree and the aura toggle. No rules here: every number, state and lock reason
// is computed by the core (treeView / skillView); this file only lays them out. All states carry text as well as colour (NFR-A07).
import { treeView, content, classById } from "../core/index.js";
import { T } from "./text.js";
import { skillIcon } from "./icons.js";

const S = content.strings;
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATE_WORD = { learned: T.trStateLearned, available: T.trStateAvailable, "locked-level": T.trStateLockedLevel, "locked-prereq": T.trStateLockedPrereq, maxed: T.trStateMaxed, "no-points": T.trStateNoPoints };
const KIND_WORD = { active: T.activeSkills.replace(/s$/, ""), passive: T.trPassive, aura: T.trAura };

/** Rows "Damage 12-20 (fire)" for tooltips. */
export const rowsHtml = (rows) => rows.map((r) => `<div class="tb">${esc(S[r.labelKey] ?? r.labelKey)}: <b>${esc(r.value)}</b>${r.type ? ` <span class="ty ty-${esc(r.type)}">(${esc(r.type)})</span>` : ""}</div>`).join("");

/** Tooltip body of one node: text, cost, numbers now and at the next level, requirements, lock reason. */
export function nodeTipHtml(n) {
  let h = `<div class="tn"><span>${esc(n.name)}</span></div><div class="tk">${esc(KIND_WORD[n.kind] ?? n.kind)} · ${esc(T.trTier)} ${n.tier} · ${esc(T.trLevelOf)} ${n.level} / ${n.maxLevel}${n.bonus ? ` (+${n.bonus})` : ""}${n.signature ? ` · ${esc(T.trSignature)}` : ""}</div>`;
  h += `<div class="tb">${esc(S[n.textKey] ?? "")}</div>`;
  if (n.cost.mana) h += `<div class="tb">${esc(T.trCost)}: <b>${n.cost.mana}</b>${n.cost.reserve ? ` · ${esc(T.trReserve)} ${n.cost.reserve}%` : ""}</div>`;
  if (n.now.length) h += `<div class="tv"><h4>${esc(T.trNow)} (${esc(T.trLevelOf)} ${n.level})</h4>${rowsHtml(n.now)}</div>`;
  if (n.next.length) h += `<div class="tv nx"><h4>${esc(T.trNext)} (${n.level + 1})</h4>${rowsHtml(n.next)}</div>`;
  if (n.requires.length) h += `<div class="tr">${n.requires.map((r) => `<span class="${r.met ? "yes" : "no"}">${r.met ? "✓" : "✗"} ${esc(r.name)} ${r.level}</span>`).join("")}</div>`;
  if (n.reqLevel > 1) h += `<div class="tr"><span class="${n.lockReason && /level/i.test(n.lockReason) ? "no" : "yes"}">${n.lockReason && /level/i.test(n.lockReason) ? "✗" : "✓"} ${esc(T.level)} ${n.reqLevel}</span></div>`;
  if (n.lockReason) h += `<div class="vd dn">${esc(n.lockReason)}</div>`;
  return h;
}

function pips(n) {
  let h = "";
  for (let i = 1; i <= n.maxLevel; i++) h += `<i class="${i <= n.level ? "on" : ""}${i > n.level - 0 && i <= n.level + n.bonus ? " bo" : ""}"></i>`;
  return h;
}

function nodeHtml(n, c, bar) {
  const learned = n.level > 0, canLearn = n.canLearn, p = c.player;
  const lock = n.lockReason ?? (n.state === "no-points" ? T.trStateNoPoints : STATE_WORD[n.state]);
  const verb = learned ? T.upgrade : T.learn;
  const label = `${n.name}. ${T.trLevelOf} ${n.level} / ${n.maxLevel}. ${STATE_WORD[n.state]}${n.lockReason ? `. ${n.lockReason}` : ""}${n.signature ? `. ${T.trSignature}` : ""}`;
  let h = `<li class="tnode st-${n.state}${n.signature ? " sig" : ""}${n.assigned !== null ? " bar" : ""}" data-testid="skill-${esc(n.id)}" data-state="${esc(n.state)}" data-tier="${Number(n.tier)}" style="--col:${Number(n.col) || 0}">`;
  h += `<button type="button" class="tn-main" data-tip="node:${esc(n.id)}" data-fk="n.${esc(n.id)}" data-testid="node-${esc(n.id)}" aria-label="${esc(label)}"><span class="tn-ic">${skillIcon(n.iconKey)}${learned ? '<em class="mk" aria-hidden="true">✓</em>' : ""}</span>`;
  h += `<span class="tn-name">${esc(n.name)}</span><span class="tn-lv"><span class="pp" aria-hidden="true">${pips(n)}</span><span data-testid="level-${esc(n.id)}">${n.level}</span>/${n.maxLevel}</span>`;
  h += `<span class="tn-st">${esc(lock)}</span></button>`;
  if (n.kind !== "passive" || n.maxLevel > 0) {
    h += `<button class="learn" type="button" data-testid="learn-${esc(n.id)}" data-learn="${esc(n.id)}" data-fk="l.${esc(n.id)}" ${canLearn ? "" : "disabled"} aria-label="${esc(verb)} ${esc(n.name)}${n.state === "maxed" ? ", " + esc(T.maxed) : ""}">${esc(n.state === "maxed" ? T.maxed : verb)}</button>`;
  }
  if (n.kind === "active" && learned) {
    h += `<div class="sassign" role="group" aria-label="${esc(T.assignTo)} ${esc(n.name)}"><span class="sr">${esc(T.assignTo)}</span>`;
    for (let i = 0; i < bar.hotkeys.length; i++) {
      const on = bar.hotkeys[i] === n.id;
      h += `<button class="mini key${on ? " on" : ""}" type="button" data-testid="assign-${esc(n.id)}-${i}" data-assign="${esc(n.id)}" data-slot="${i}" data-fk="a.${esc(n.id)}.${i}" aria-pressed="${on}" aria-label="${esc(T.assignTo)} F${i + 1}: ${esc(n.name)}${on ? ", " + esc(T.assigned) : ""}">F${i + 1}</button>`;
    }
    h += `</div>`;
  }
  if (n.kind === "aura" && learned) {
    const on = p.aura === n.id;
    h += `<button class="mini aura${on ? " on" : ""}" type="button" data-testid="aura-${esc(n.id)}" data-aura="${esc(n.id)}" data-fk="au.${esc(n.id)}" aria-pressed="${on}">${esc(on ? T.trAuraOn : T.trAuraOff)}</button>`;
  }
  return h + `</li>`;
}

/** HTML of the whole Skills drawer body for the running game. */
export function renderTree(c) {
  const p = c.player, v = treeView(c), bar = p.skillBar, cls = classById(p.class), basic = content.skills[cls?.basic];
  let h = `<div class="ph"><span class="phi">${skillIcon(`class:${v.classId}`)}</span><h2>${esc(T.trTitle)}</h2><button class="xbtn" type="button" data-close="skills" data-testid="close-skills" aria-label="${esc(T.closeSkills)}">×</button></div>`;
  h += `<div class="pb"><div class="skills tree" data-testid="skills-panel" data-class="${esc(v.classId)}">@TABS@`;
  h += `<div class="tr-head"><p class="sp"><b>${esc(T.trPoints)}: <span data-testid="skill-points">${v.points}</span></b></p>`;
  h += `<button class="mini respec" type="button" data-testid="respec" data-respec="1" data-fk="rs" ${v.respec.available ? "" : "disabled"} title="${esc(v.respec.available ? T.trResetHint : T.trResetNone)}">${esc(T.trReset)}</button></div>`;
  h += `<p class="sk-note" data-testid="respec-note">${esc(v.respec.available ? T.trResetHint : (v.respec.reason === "not-in-town" ? T.trResetNone : T.trRespecFail[v.respec.reason] ?? T.trResetNone))}</p>`;
  h += `<p class="sk-note">${esc(T.trSelectNote)}</p>`;
  if (basic) {
    h += `<h3>${esc(T.basicAttack)}</h3><ul class="slist"><li class="srow" data-testid="skill-${esc(basic.id)}" title="${esc(S[basic.textKey] ?? "")}"><div class="sic">${skillIcon(basic.id)}</div><div class="sbody"><div class="sname"><b>${esc(basic.name)}</b></div><div class="stext">${esc(S[basic.textKey] ?? "")}</div></div><span></span>`;
    h += `<div class="sassign" role="group" aria-label="${esc(T.assignTo)} ${esc(basic.name)}"><span>${esc(T.assignTo)}</span>`;
    for (let i = 0; i < bar.hotkeys.length; i++) { const on = bar.hotkeys[i] === basic.id; h += `<button class="mini key${on ? " on" : ""}" type="button" data-testid="assign-${esc(basic.id)}-${i}" data-assign="${esc(basic.id)}" data-slot="${i}" data-fk="a.${esc(basic.id)}.${i}" aria-pressed="${on}" aria-label="${esc(T.assignTo)} F${i + 1}: ${esc(basic.name)}${on ? ", " + esc(T.assigned) : ""}">F${i + 1}</button>`; }
    h += `</div></li></ul>`;
  }
  for (const b of v.branches) {
    h += `<section class="branch" data-testid="branch-${esc(b.id)}" aria-label="${esc(b.name)}"><h3><span class="bic">${skillIcon(b.iconKey)}</span>${esc(b.name)} <em>${esc(T.trBranchSpent)}: ${b.spent}</em></h3>`;
    const tiers = [...new Set(b.nodes.map((n) => n.tier))].sort((a, z) => a - z);
    for (const t of tiers) {
      h += `<div class="tier"><span class="tl">${esc(T.trTier)} ${Number(t)}</span><ul class="tnodes">${b.nodes.filter((n) => n.tier === t).sort((a, z) => a.col - z.col).map((n) => nodeHtml(n, c, bar)).join("")}</ul></div>`;
    }
    h += `</section>`;
  }
  return h + `</div></div>`;
}

/** Look a node up for the tooltip (null when the id is not in this class's tree). */
export function nodeFor(c, id) {
  for (const b of treeView(c).branches) { const n = b.nodes.find((x) => x.id === id); if (n) return n; }
  return null;
}
