// Quest section of the NPC window (R7, AC-R-249-2, AC-R-247-4): pure view model and markup. Plain data in (snapshot.quests), no game rules here.
// The quest text comes from content/quests.js; reward numbers from the core rewardSummary (the one source the payout uses).
import { content } from "../core/index.js";
import { T } from "./text.js";
import { progressText, rewardLines } from "./journal.js";

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** The quests this NPC gives, with the line to show for the quest's state: [{id, title, state, text, progress, rewards, accept, handIn}]. `qv` is snapshot.quests. */
export function questDialogModel(qv, npcId) {
  if (!qv) return [];
  const out = [];
  for (const id of content.sideIds) {
    const def = content.quests[id], q = qv[id];
    if (!q || def.giver !== npcId) continue;
    const st = q.state;
    out.push({
      id, title: q.title, state: st, text: st === "available" ? def.text.offer : st === "active" ? def.text.progress : st === "ready" ? def.text.ready : def.text.done,
      progress: st === "active" ? progressText(q) : "", rewards: st === "completed" ? [] : rewardLines(id), accept: st === "available", handIn: st === "ready",
    });
  }
  return out;
}

const STATE_TEXT = () => ({ available: T.stateAvailable, active: T.stateActive, ready: T.stateReady, completed: T.stateCompleted });

/** The markup of the quest section; `notice` (an id or null) shows the bag-full message under that quest. "" when the NPC has no quests. */
export function questDialogHtml(model, notice = null) {
  if (!model.length) return "";
  const names = STATE_TEXT();
  const entry = (e) => {
    const rw = e.rewards.length ? `<p class="nq-rw" data-testid="npc-quest-reward-${esc(e.id)}"><b>${esc(T.rewardLabel)}:</b> ${esc(e.rewards.join(", "))}</p>` : "";
    const label = [e.title, names[e.state], e.progress, e.rewards.length ? `${T.rewardLabel}: ${e.rewards.join(", ")}` : null].filter(Boolean).join(", ");
    let acts = "";
    if (e.accept) acts = `<div class="nq-acts"><button class="rbtn pri" type="button" data-testid="quest-accept-${esc(e.id)}" data-fk="q.a.${esc(e.id)}" data-qaccept="${esc(e.id)}" aria-label="${esc(`${T.questAccept}: ${e.title}`)}">${esc(T.questAccept)}</button><button class="rbtn" type="button" data-testid="quest-decline-${esc(e.id)}" data-fk="q.d.${esc(e.id)}" data-qdecline="${esc(e.id)}" aria-label="${esc(`${T.questDecline}: ${e.title}`)}">${esc(T.questDecline)}</button></div>`;
    else if (e.handIn) acts = `<div class="nq-acts"><button class="rbtn pri" type="button" data-testid="quest-handin-${esc(e.id)}" data-fk="q.h.${esc(e.id)}" data-qhandin="${esc(e.id)}" aria-label="${esc(`${T.questHandIn}: ${e.title}`)}">${esc(T.questHandIn)}</button></div>`;
    const warn = notice === e.id ? `<p class="nq-warn" role="alert" data-testid="quest-bagfull">${esc(T.bagFullNotice)}</p>` : "";
    return `<li class="nq s-${esc(e.state)}" data-testid="npc-quest-${esc(e.id)}" data-quest="${esc(e.id)}" data-state="${esc(e.state)}" role="group" aria-label="${esc(label)}">`
      + `<div class="nq-h"><b class="nq-t">${esc(e.title)}</b><span class="nq-s" data-testid="npc-quest-state-${esc(e.id)}">${esc(names[e.state])}</span></div>`
      + `<p class="nq-x" data-testid="npc-quest-text-${esc(e.id)}">${esc(e.text)}</p>`
      + `${e.progress ? `<p class="nq-p" data-testid="npc-quest-progress-${esc(e.id)}">${esc(T.progressNow)}: ${esc(e.progress)}</p>` : ""}${rw}${warn}${acts}</li>`;
  };
  return `<section class="nqs" data-testid="npc-quests" aria-label="${esc(T.questDialogLabel)}"><ul class="nql">${model.map(entry).join("")}</ul></section>`;
}
