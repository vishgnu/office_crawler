// Quest journal and tracker (R7, ADR-0007): pure view models and markup. Plain data in (snapshot.quests, the pouch), no game rules here.
// Quest texts (titles, next-step lines) come from the core (content/quests.js); only the labels around them live in T.
import * as core from "../core/index.js";
import { T } from "./text.js";
import { rarityName } from "./itemview.js";

const { content } = core;

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATE_TEXT = { unavailable: T.stateLocked, available: T.stateAvailable, active: T.stateActive, ready: T.stateReady, completed: T.stateCompleted };
const ids = () => content.questIds;
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? "");

/** Reward of a quest as lines of text: gold, experience, gear kind with its rarity, potions. Empty when the quest pays nothing (main3) or is unknown.
 *  The numbers come from the core's rewardSummary(questId) (the same function the payout uses); no formula here (CR7-05). */
export function rewardLines(id) {
  if (!content.quests[id]) return [];
  const r = core.rewardSummary(id);
  if (!r) return [];
  const out = [];
  if (r.gold > 0) out.push(fill(T.rewardGold, { n: r.gold }));
  if (r.xp > 0) out.push(fill(T.rewardXp, { n: r.xp }));
  if (r.gear) {
    const kind = r.gear.slot === "weapon" ? T.rewardGearWeapon : r.gear.slot === "accessory" ? T.rewardGearAccessory : T.rewardGearArmour;
    out.push(fill(r.gear.maxRarity && r.gear.maxRarity === r.gear.minRarity ? T.rewardGearExact : T.rewardGear, { kind, rarity: rarityName(r.gear.minRarity) }));
  }
  if (r.potions > 0) out.push(fill(T.rewardPotions, { n: r.potions }));
  return out;
}

/** The quest the tracker shows: the pinned one while it is not completed, else the first active or ready quest; null when none is. `qv` is snapshot.quests. */
export function trackerOf(qv) {
  if (!qv) return null;
  const id = qv[qv.pinned] && qv[qv.pinned].state !== "completed" ? qv.pinned : ids().find((k) => qv[k] && (qv[k].state === "active" || qv[k].state === "ready"));
  return id ? { id, title: qv[id].title, text: qv[id].nextStep } : null;
}

/** Progress text of one quest ("3/8", a main quest: "Step 3/4" inside its arc), "" when it has no count (or the arc is locked). */
export function progressText(q) {
  if (content.mainIds.includes(q.id)) return q.state === "unavailable" ? "" : `${T.stepLabel} ${q.step}/${q.stepCount}`;
  if ((q.state !== "active" && q.state !== "ready") || !(q.goal > 0)) return "";
  return T.progressLabel.replace("{n}", String(q.progress)).replace("{goal}", String(q.goal));
}

/** Journal data: { active, locked, completed: [entry], pouch }. `active` is every open quest in content order (the three main quests, then the sides), so the active
 *  main quest comes first; `locked` holds the main quests whose predecessor is not done (no next step, the lock line instead); `completed` the finished ones. */
export function journalModel(qv, pouch = [], scene = "floor") {
  const out = { active: [], locked: [], completed: [], pouch: [] };
  if (!qv) return out;
  const mains = content.mainIds;
  for (const id of ids()) {
    const q = qv[id];
    if (!q) continue;
    const isMain = mains.includes(id), locked = q.state === "unavailable", last = id === mains[mains.length - 1];
    const e = {
      id, title: q.title, kind: isMain ? "main" : "side", state: q.state, stateText: STATE_TEXT[q.state] ?? q.state, giver: q.giver, nextStep: locked ? "" : q.nextStep,
      blurb: isMain && !locked ? content.quests[id].blurb ?? "" : "", lockedText: locked ? fill(content.lockedLine, { previous: content.quests[mains[mains.indexOf(id) - 1]]?.title ?? "" }) : "",
      progress: progressText(q), pinned: qv.pinned === id,
      canPin: !locked && q.state !== "completed" && qv.pinned !== id, canUnpin: !isMain && qv.pinned === id,
      rewards: q.state === "completed" || locked ? [] : rewardLines(id), verdict: last && q.state === "active" && q.step === q.stepCount && scene !== "victory",
    };
    e.label = [e.title, e.stateText, e.pinned ? T.pinnedMark : null, e.giver ? `${T.giverLabel}: ${e.giver}` : null, e.progress || null, e.lockedText || null, e.nextStep ? `${T.nextStepLabel}: ${e.nextStep}` : null, e.rewards.length ? `${T.rewardLabel}: ${e.rewards.join(", ")}` : null].filter(Boolean).join(", ");
    (q.state === "completed" ? out.completed : locked ? out.locked : out.active).push(e);
  }
  for (const p of pouch) out.pouch.push({ id: p.id, quest: p.quest, name: content.quests[p.quest]?.item?.name ?? p.id });
  return out;
}

const entryHtml = (e, idx) => `<li class="jq s-${esc(e.state)}${e.pinned ? " pinned" : ""}" tabindex="0" data-fk="j.q.${idx}" data-testid="journal-quest-${esc(e.id)}" data-quest="${esc(e.id)}" data-state="${esc(e.state)}" aria-label="${esc(e.label)}">`
  + `<div class="jh"><b class="jt">${esc(e.title)}</b><span class="jk">${esc(e.kind === "main" ? T.mainQuestLabel : T.sideQuestLabel)}</span></div>`
  + `<div class="jm"><span class="js" data-testid="journal-state-${esc(e.id)}">${esc(e.stateText)}</span>${e.pinned ? `<span class="jpm" data-testid="journal-pinned-${esc(e.id)}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 0.8 7.6 4.4 11.4 4.8 8.6 7.4 9.4 11.2 6 9.3 2.6 11.2 3.4 7.4 0.6 4.8 4.4 4.4Z" fill="currentColor"/></svg> ${esc(T.pinnedMark)}</span>` : ""}`
  + `${e.progress ? `<span class="jp" data-testid="journal-progress-${esc(e.id)}">${esc(e.progress)}</span>` : ""}</div>`
  + `${e.blurb ? `<p class="jb" data-testid="journal-blurb-${esc(e.id)}">${esc(e.blurb)}</p>` : ""}`
  + `${e.lockedText ? `<p class="jn jlock" data-testid="journal-lock-${esc(e.id)}">${esc(e.lockedText)}</p>` : ""}`
  + `${e.giver ? `<div class="jg">${esc(T.giverLabel)}: <span data-testid="journal-giver-${esc(e.id)}">${esc(e.giver)}</span></div>` : ""}`
  + `${e.nextStep ? `<p class="jn"><span class="jl">${esc(T.nextStepLabel)}</span> <span data-testid="journal-next-${esc(e.id)}">${esc(e.nextStep)}</span></p>` : ""}`
  + `${e.rewards.length ? `<p class="jn jrw"><span class="jl">${esc(T.rewardLabel)}</span> <span data-testid="journal-reward-${esc(e.id)}">${esc(e.rewards.join(", "))}</span></p>` : ""}`
  + `${e.canPin || e.canUnpin ? `<button class="mini jpin" type="button" data-testid="journal-pin-${esc(e.id)}" data-fk="j.p.${esc(e.id)}" data-pin="${esc(e.canUnpin ? "main" : e.id)}" aria-label="${esc(`${e.canUnpin ? T.unpinAction : T.pinAction}: ${e.title}`)}">${esc(e.canUnpin ? T.unpinAction : T.pinAction)}</button>` : ""}`
  + `${e.verdict ? `<button class="mini jverdict" type="button" data-testid="journal-verdict" data-fk="j.v" data-verdict="1">${esc(T.readVerdict)}</button>` : ""}</li>`;

/** The journal panel body (header with the close button is added by the caller's closeBtn). */
export function journalHtml(model, closeBtn) {
  let h = `<div class="ph"><h2>${esc(T.journalTitle)}</h2>${closeBtn("journal", T.journalClose)}</div><div class="pb"><div class="journal" data-testid="journal">`;
  let n = 0;
  const open = [...model.active, ...(model.locked ?? [])]; // the locked main quests follow the open ones in the same list
  h += `<section class="jsec"><h3>${esc(T.journalActive)}</h3>${open.length ? `<ul class="jlist" data-testid="journal-active">${open.map((e) => entryHtml(e, n++)).join("")}</ul>` : `<p class="sk-note">${esc(T.journalEmpty)}</p>`}</section>`;
  h += `<section class="jsec"><h3>${esc(T.journalPouch)}</h3>${model.pouch.length ? `<ul class="jlist jpouch" data-testid="journal-pouch">${model.pouch.map((p) => `<li data-testid="journal-pouch-${esc(p.quest)}" tabindex="0">${esc(p.name)}</li>`).join("")}</ul>` : `<p class="sk-note" data-testid="journal-pouch-empty">${esc(T.journalPouchEmpty)}</p>`}</section>`;
  if (model.completed.length) h += `<section class="jsec"><h3>${esc(T.journalCompleted)}</h3><ul class="jlist" data-testid="journal-completed">${model.completed.map((e) => entryHtml(e, n++)).join("")}</ul></section>`;
  return h + `</div></div>`;
}
