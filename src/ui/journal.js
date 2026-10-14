// Quest journal and tracker (R7, ADR-0007): pure view models and markup. Plain data in (snapshot.quests, the pouch), no game rules here.
// Quest texts (titles, next-step lines) come from the core (content/quests.js); only the labels around them live in T.
import { content } from "../core/index.js";
import { T } from "./text.js";

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATE_TEXT = { available: T.stateAvailable, active: T.stateActive, ready: T.stateReady, completed: T.stateCompleted };
const ids = () => content.questIds;

/** The quest the tracker shows: the pinned one while it is not completed, else the first active or ready quest; null when none is. `qv` is snapshot.quests. */
export function trackerOf(qv) {
  if (!qv) return null;
  const id = qv[qv.pinned] && qv[qv.pinned].state !== "completed" ? qv.pinned : ids().find((k) => qv[k] && (qv[k].state === "active" || qv[k].state === "ready"));
  return id ? { id, title: qv[id].title, text: qv[id].nextStep } : null;
}

/** Progress text of one quest ("3/8", main: "Step 3/6"), "" when it has no count. */
export function progressText(q) {
  if (q.id === "main") return `${T.stepLabel} ${q.step}/${q.stepCount}`;
  if ((q.state !== "active" && q.state !== "ready") || !(q.goal > 0)) return "";
  return T.progressLabel.replace("{n}", String(q.progress)).replace("{goal}", String(q.goal));
}

/** Journal data: { active: [entry], completed: [entry], pouch: [{id, quest, name}] }; main first, then the side quests in content order. */
export function journalModel(qv, pouch = [], scene = "floor") {
  const out = { active: [], completed: [], pouch: [] };
  if (!qv) return out;
  for (const id of ids()) {
    const q = qv[id];
    if (!q) continue;
    const e = {
      id, title: q.title, kind: id === "main" ? "main" : "side", state: q.state, stateText: STATE_TEXT[q.state] ?? q.state, giver: q.giver, nextStep: q.nextStep,
      progress: progressText(q), pinned: qv.pinned === id, canPin: q.state !== "completed" && id !== "main" && qv.pinned !== id, canUnpin: id !== "main" && qv.pinned === id,
      verdict: id === "main" && q.state === "active" && q.step === q.stepCount && scene !== "victory",
    };
    e.label = [e.title, e.stateText, e.pinned ? T.pinnedMark : null, e.giver ? `${T.giverLabel}: ${e.giver}` : null, e.progress || null, e.nextStep ? `${T.nextStepLabel}: ${e.nextStep}` : null].filter(Boolean).join(", ");
    (q.state === "completed" ? out.completed : out.active).push(e);
  }
  for (const p of pouch) out.pouch.push({ id: p.id, quest: p.quest, name: content.quests[p.quest]?.item?.name ?? p.id });
  return out;
}

const entryHtml = (e, idx) => `<li class="jq s-${esc(e.state)}${e.pinned ? " pinned" : ""}" tabindex="0" data-fk="j.q.${idx}" data-testid="journal-quest-${esc(e.id)}" data-quest="${esc(e.id)}" data-state="${esc(e.state)}" aria-label="${esc(e.label)}">`
  + `<div class="jh"><b class="jt">${esc(e.title)}</b><span class="jk">${esc(e.kind === "main" ? T.mainQuestLabel : T.sideQuestLabel)}</span></div>`
  + `<div class="jm"><span class="js" data-testid="journal-state-${esc(e.id)}">${esc(e.stateText)}</span>${e.pinned ? `<span class="jpm" data-testid="journal-pinned-${esc(e.id)}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 0.8 7.6 4.4 11.4 4.8 8.6 7.4 9.4 11.2 6 9.3 2.6 11.2 3.4 7.4 0.6 4.8 4.4 4.4Z" fill="currentColor"/></svg> ${esc(T.pinnedMark)}</span>` : ""}`
  + `${e.progress ? `<span class="jp" data-testid="journal-progress-${esc(e.id)}">${esc(e.progress)}</span>` : ""}</div>`
  + `${e.giver ? `<div class="jg">${esc(T.giverLabel)}: <span data-testid="journal-giver-${esc(e.id)}">${esc(e.giver)}</span></div>` : ""}`
  + `${e.nextStep ? `<p class="jn"><span class="jl">${esc(T.nextStepLabel)}</span> <span data-testid="journal-next-${esc(e.id)}">${esc(e.nextStep)}</span></p>` : ""}`
  + `${e.canPin || e.canUnpin ? `<button class="mini jpin" type="button" data-testid="journal-pin-${esc(e.id)}" data-fk="j.p.${esc(e.id)}" data-pin="${esc(e.canUnpin ? "main" : e.id)}" aria-label="${esc(`${e.canUnpin ? T.unpinAction : T.pinAction}: ${e.title}`)}">${esc(e.canUnpin ? T.unpinAction : T.pinAction)}</button>` : ""}`
  + `${e.verdict ? `<button class="mini jverdict" type="button" data-testid="journal-verdict" data-fk="j.v" data-verdict="1">${esc(T.readVerdict)}</button>` : ""}</li>`;

/** The journal panel body (header with the close button is added by the caller's closeBtn). */
export function journalHtml(model, closeBtn) {
  let h = `<div class="ph"><h2>${esc(T.journalTitle)}</h2>${closeBtn("journal", T.journalClose)}</div><div class="pb"><div class="journal" data-testid="journal">`;
  let n = 0;
  h += `<section class="jsec"><h3>${esc(T.journalActive)}</h3>${model.active.length ? `<ul class="jlist" data-testid="journal-active">${model.active.map((e) => entryHtml(e, n++)).join("")}</ul>` : `<p class="sk-note">${esc(T.journalEmpty)}</p>`}</section>`;
  h += `<section class="jsec"><h3>${esc(T.journalPouch)}</h3>${model.pouch.length ? `<ul class="jlist jpouch" data-testid="journal-pouch">${model.pouch.map((p) => `<li data-testid="journal-pouch-${esc(p.quest)}" tabindex="0">${esc(p.name)}</li>`).join("")}</ul>` : `<p class="sk-note" data-testid="journal-pouch-empty">${esc(T.journalPouchEmpty)}</p>`}</section>`;
  if (model.completed.length) h += `<section class="jsec"><h3>${esc(T.journalCompleted)}</h3><ul class="jlist" data-testid="journal-completed">${model.completed.map((e) => entryHtml(e, n++)).join("")}</ul></section>`;
  return h + `</div></div>`;
}
