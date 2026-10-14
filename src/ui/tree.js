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

function nodeHtml(n, c, bar, row, parents, kids) {
  const learned = n.level > 0, canLearn = n.canLearn, p = c.player;
  const verb = learned ? T.upgrade : T.learn;
  const needs = n.requires.length ? `. ${T.trNeeds}: ${n.requires.map((r) => `${r.name} ${r.level}`).join(", ")}` : "";
  const label = `${n.name}. ${T.trTier} ${n.tier}. ${T.trLevelOf} ${n.level} / ${n.maxLevel}. ${STATE_WORD[n.state]}${n.lockReason ? `. ${n.lockReason}` : ""}${needs}${n.signature ? `. ${T.trSignature}` : ""}`;
  let h = `<li class="tnode st-${n.state}${n.signature ? " sig" : ""}${n.assigned !== null ? " bar" : ""}" data-testid="skill-${esc(n.id)}" data-state="${esc(n.state)}" data-tier="${Number(n.tier)}" style="--col:${Number(n.col) || 0};--row:${row}">`;
  // R6 tier connector (G2 #14 / N8): drawn from n.requires over the fixed column grid; CSS only, no measuring. The first prerequisite sets the elbow.
  const from = n.requires.map((r) => parents.get(r.id)).find((x) => x);
  if (from) { const dx = (Number(n.col) || 0) - from.col; h += `<i class="lk ${dx > 0 ? "l" : dx < 0 ? "r" : "s"}${n.requires.every((r) => r.met) ? " ok" : ""}" style="--span:${Math.abs(dx)}" aria-hidden="true"></i>`; }
  if (kids.has(n.id)) h += `<i class="kd${n.level > 0 ? " ok" : ""}" aria-hidden="true"></i>`;
  h += `<button type="button" class="tn-main" data-tip="node:${esc(n.id)}" data-fk="n.${esc(n.id)}" data-testid="node-${esc(n.id)}" aria-label="${esc(label)}"><span class="tn-ic">${skillIcon(n.iconKey)}${learned ? '<em class="mk" aria-hidden="true">✓</em>' : ""}</span>`;
  h += `<span class="tn-name">${esc(n.name)}</span><span class="tn-lv"><span class="pp" aria-hidden="true">${pips(n)}</span><span data-testid="level-${esc(n.id)}">${n.level}</span>/${n.maxLevel}</span>`;
  h += `<span class="tn-st">${esc(STATE_WORD[n.state])}</span>${n.state === "locked-level" && n.lockReason ? `<span class="tn-lock">${esc(n.lockReason)}</span>` : ""}${n.requires.length ? `<span class="tn-req">${esc(T.trNeeds)}: ${esc(n.requires.map((r) => r.name).join(", "))}</span>` : ""}</button>`;
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
export function renderTree(c, opts = {}) {
  const p = c.player, v = treeView(c), bar = p.skillBar, cls = classById(p.class), basic = content.skills[cls?.basic];
  let h = `<div class="ph"><span class="phi">${skillIcon(`class:${v.classId}`)}</span><h2>${esc(T.trTitle)}</h2><button class="xbtn" type="button" data-close="skills" data-testid="close-skills" aria-label="${esc(T.closeSkills)}">×</button></div>`;
  h += `<div class="pb"><div class="skills tree" data-testid="skills-panel" data-class="${esc(v.classId)}">@TABS@`;
  h += `<div class="tr-head"><p class="sp"><b>${esc(T.trPoints)}: <span data-testid="skill-points">${v.points}</span></b></p>`;
  const refund = v.branches.reduce((a, b) => a + b.nodes.reduce((m, n) => m + n.level - (n.signature ? 1 : 0), 0), 0);
  // ADV-R6-02: with nothing to give back a paid (gold) or counted (once) respec is never offered; the core says "nothing-to-respec" too
  const charged = v.respec.mode === "gold" || v.respec.mode === "once";
  const reason = v.respec.available && refund < 1 && charged ? "nothing-to-respec" : v.respec.reason;
  v.respec.available = v.respec.available && reason === null;
  const hint = v.respec.available ? T.trResetHint : reason === "not-in-town" ? T.trResetNone : T.trRespecFail[reason] ?? T.trResetNone;
  h += `<button class="mini respec" type="button" data-testid="respec" data-respec="1" data-fk="rs" ${v.respec.available ? "" : "disabled"} title="${esc(hint)}"${v.respec.available ? "" : ` aria-describedby="rs-note"`}>${esc(T.trReset)}</button></div>`;
  h += `<p class="sk-note" id="rs-note" data-testid="respec-note">${esc(hint)}</p>`;
  if (opts.confirmRespec && v.respec.available && refund > 0) {
    h += `<div class="rs-confirm" role="alertdialog" aria-modal="true" aria-labelledby="rs-title" aria-describedby="rs-text" data-testid="respec-confirm"><h3 id="rs-title">${esc(T.trRespecAsk)}</h3>`;
    h += `<p id="rs-text" data-testid="respec-refund">${esc(T.trRespecRefund.replace("{n}", refund).replace("{s}", refund === 1 ? "" : "s"))}${v.respec.cost > 0 ? ` ${esc(T.trRespecCost.replace("{g}", v.respec.cost))}` : ""}${v.respec.mode === "once" ? ` ${esc(T.trRespecOnce)}` : ""}</p>`;
    h += `<div class="rs-btns"><button class="mini yes" type="button" data-respec-yes="1" data-testid="respec-yes" data-fk="rs.yes">${esc(T.trRespecYes.replace("{n}", refund))}</button><button class="mini" type="button" data-respec-no="1" data-testid="respec-no" data-fk="rs.no">${esc(T.slCancel)}</button></div></div>`;
  }
  h += `<p class="sk-note">${esc(T.trSelectNote)}</p>`;
  if (basic) {
    h += `<h3 class="basic-h">${esc(T.basicAttack)}</h3><ul class="slist"><li class="srow" data-testid="skill-${esc(basic.id)}" title="${esc(S[basic.textKey] ?? "")}"><div class="sic">${skillIcon(basic.id)}</div><div class="sbody"><div class="sname"><b>${esc(basic.name)}</b></div><div class="stext">${esc(S[basic.textKey] ?? "")}</div></div><span></span>`;
    h += `<div class="sassign" role="group" aria-label="${esc(T.assignTo)} ${esc(basic.name)}"><span>${esc(T.assignTo)}</span>`;
    for (let i = 0; i < bar.hotkeys.length; i++) { const on = bar.hotkeys[i] === basic.id; h += `<button class="mini key${on ? " on" : ""}" type="button" data-testid="assign-${esc(basic.id)}-${i}" data-assign="${esc(basic.id)}" data-slot="${i}" data-fk="a.${esc(basic.id)}.${i}" aria-pressed="${on}" aria-label="${esc(T.assignTo)} F${i + 1}: ${esc(basic.name)}${on ? ", " + esc(T.assigned) : ""}">F${i + 1}</button>`; }
    h += `</div></li></ul>`;
  }
  for (const b of v.branches) {
    h += `<section class="branch" data-testid="branch-${esc(b.id)}" aria-label="${esc(b.name)}"><h3><span class="bic">${skillIcon(b.iconKey)}</span>${esc(b.name)} <em>${esc(T.trBranchSpent)}: ${b.spent}</em></h3>`;
    // one fixed grid per branch: a label column, then three node columns; tier t is grid row t (R6). Edges come from treeView (b.edges).
    const tiers = [...new Set(b.nodes.map((n) => n.tier))].sort((a, z) => a - z);
    const parents = new Map(b.nodes.map((n) => [n.id, n])), kids = new Set(b.edges.map((e) => e.from));
    h += `<ul class="tnodes">`;
    tiers.forEach((t, i) => {
      h += `<li class="tl" style="--row:${i + 1}">${esc(T.trTier)} ${Number(t)}</li>`;
      h += b.nodes.filter((n) => n.tier === t).sort((a, z) => a.col - z.col).map((n) => nodeHtml(n, c, bar, i + 1, parents, kids)).join("");
    });
    h += `</ul></section>`;
  }
  return h + `</div></div>`;
}

/** Look a node up for the tooltip (null when the id is not in this class's tree). */
export function nodeFor(c, id) {
  for (const b of treeView(c).branches) { const n = b.nodes.find((x) => x.id === id); if (n) return n; }
  return null;
}
