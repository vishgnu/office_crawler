// The save slot manager (R-220..R-227, customer: "save slots in the Options menu"). One component, three homes: the Options screen, the
// Load game dialog (title, pause, class selection) and the pick list. It talks to the shell only through `h`:
//   h.session(cmd) -> {ok, ...}   h.slots() -> game.slots   h.playing() -> bool   h.download(name, text)
// The UI never reads the storage adapter (CR-15): undo goes through { t: "restoreSlot" }, export through { t: "exportSlot" }, and the card
// shows an Undo button only when the slot entry says hasPrev (guarded: an entry without the field counts as "has an undo copy").
//   h.onNewHere(slot)  open the class selection for this slot        h.emit(type)  UI click cue
// Text comes from T / the core strings; the character name is always set with textContent.
import { content, config } from "../core/index.js";
import { validateName } from "../core/name.js";
import { T } from "./text.js";
import { figures } from "./figureHost.js";
import { createSaveStatus, trapDialog } from "./savestatus.js";

const S = content.strings;
const SLOT_COUNT = 5;
const CLASS_NAME = Object.fromEntries(content.classes.map((c) => [c.id, c.name]));
const ERR = { "bad-name": S.errBadName, "bad-slot": S.errBadSlot, "empty-slot": S.errEmptySlot, occupied: S.errOccupied, "confirm-required": S.errConfirm, corrupt: S.errCorrupt, newer: S.errNewer, quota: T.errQuota,
  "too-large": S.errCorrupt, "stale-owner": T.errAnotherTab, "save-failed-before-switch": T.errPreSwitch, "write-failed": T.errWrite, "another-tab": T.errAnotherTab, playing: T.errPlaying, "no-storage": T.errNoStorage, "bad-class": S.errBadClass };
export const errorText = (code) => ERR[code] ?? S.errCorrupt;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Slots whose delete / replace / import can still be undone in this page session (the store keeps one .prev copy per slot). */
const undoable = new Map();
export const markUndo = (slot, kind) => undoable.set(slot, kind);

// ---- ID-badge bust: the class figure from the render package, cropped to head and shoulders ----
// R8 (ADR-0008 section 5): the bust follows the worn gear. `look` is a gear signature; anything malformed (a hand-edited index) draws the bare bust.
// Sources are cached per class + look in a small LRU (8 canvases of 480 x 600, about 9 MB at most); a changed look paints a new source.
const BUST_LRU = 8, LOOK_OK = /^[-a-z0-9]{1,4}(\|[-a-z0-9]{1,4}){5}$/;
const bustSrc = new Map();
export const cleanLook = (look) => (typeof look === "string" && look.length <= 40 && LOOK_OK.test(look) && look !== "-|-|-|-|-|-" ? look : "");
export const bustCacheSize = () => bustSrc.size;
function bustSource(classId, look) {
  const key = `${classId}/${look}`;
  let c = bustSrc.get(key);
  if (c) { bustSrc.delete(key); bustSrc.set(key, c); return c; } // most recently used goes last
  c = document.createElement("canvas"); c.width = 480; c.height = 600;
  figures.draw(c, `hero.${classId}`, look ? { anim: "portrait", look } : { anim: "portrait" });
  bustSrc.set(key, c);
  while (bustSrc.size > BUST_LRU) bustSrc.delete(bustSrc.keys().next().value);
  return c;
}
export function paintBust(canvas, classId, look = "") {
  const g = canvas.getContext("2d"), src = bustSource(classId, cleanLook(look)), s = canvas.width;
  canvas.dataset.look = cleanLook(look); // for tests and the e2e: the look this canvas was last painted with
  g.clearRect(0, 0, s, s);
  g.fillStyle = "#17123a"; g.fillRect(0, 0, s, s);
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 140, 262, 200, 200, 0, 0, s, s); // head and shoulders of the 480 x 600 portrait
}

export const fmtPlay = (sec) => `${Math.floor((sec ?? 0) / 3600)}:${String(Math.floor(((sec ?? 0) % 3600) / 60)).padStart(2, "0")}`;
export function fmtWhen(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return "";
  const d = Math.max(0, now - ms), min = Math.floor(d / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} h ago`;
  try { return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; }
}
/** Date and time in the player's locale ("14 Oct 2026, 09:41"); `savedAt` is the contract's ISO string, `lastPlayed` the older epoch ms. */
export function fmtStamp(e) {
  const ms = typeof e?.savedAt === "string" ? Date.parse(e.savedAt) : Number.isFinite(e?.lastPlayed) ? e.lastPlayed : NaN;
  if (!Number.isFinite(ms)) return "";
  try { return new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
// `deepest` is always >= 1 (the core cannot tell the Lobby from floor 1): "Lobby only" means standing in the Lobby at deepest 1.
const deepestOf = (e) => (Number.isFinite(e.deepest) ? (e.deepest <= 1 && !(e.depth > 0) ? 0 : e.deepest) : e.depth ?? 0);
const where = (e) => (deepestOf(e) > 0 ? `${T.slDeepest} ${T.slFloor.toLowerCase()} ${deepestOf(e)}` : `${T.slDeepest}: ${T.slLobby}`);
/** The quest line of an occupied card: "<title of the current global main step> · N/M" (AC-R-252-1, ten steps over three main quests, M = sideCount), "" when the entry carries no quest fields (an empty, damaged or newer slot, or an index not yet backfilled). */
export function slotQuestText(e) {
  if (!e || e.state !== "ok" || !Number.isInteger(e.mainStep)) return "";
  const steps = content.mainSteps, step = e.mainDone ? T.slotMainDone : steps[Math.min(steps.length, Math.max(1, e.mainStep)) - 1].title;
  return T.slotQuestLine.replace("{step}", step).replace("{n}", String(e.sidesDone ?? 0)).replace("{m}", String(config.quests.sideCount));
}
export const slotSummary = (e) => `${CLASS_NAME[e.class] ?? e.class} · ${T.slLevel} ${e.level} · ${where(e)} · ${fmtPlay(e.playSec)} ${T.slPlayed}`;

/**
 * createSlotsView(h, { mode, onClose }). mode "options" embeds in the Options panel (no Close button); "dialog" is the modal Load dialog.
 * Returns a root element with destroy(); the element re-renders itself after each command.
 */
export function createSlotsView(h, { mode = "dialog", onClose = null } = {}) {
  const root = el("section", `sl-view sl-${mode}`);
  root.dataset.testid = "slots-view";
  const ac = new AbortController();
  let sub = null; // null | {kind: "delete"|"import-confirm"|"load"|"rename"|"import", n, opener?, ...}
  let msg = { text: "", undo: null };
  let status = null;
  let focusKey = null, fallbackSlot = null;

  // `list` (contract section 1) is the index with deepest, savedAt and hasPrev added; fall back to the bare index entries
  const idx = () => { const v = h.slots(), i = v?.index ?? { active: null, last: null, slots: [] }; return Array.isArray(v?.list) && v.list.length ? { ...i, slots: v.list } : i; };
  const playingSlot = () => (h.playing() ? idx().active : null);
  const say = (text, undo = null) => { msg = { text, undo }; };
  const button = (label, testid, fn, cls = "mini", aria) => {
    const b = el("button", cls, label); b.type = "button"; b.dataset.testid = testid; if (aria) b.setAttribute("aria-label", aria);
    b.addEventListener("click", (ev) => { ev.stopPropagation(); h.emit?.("ui:click"); focusKey = testid; fn(); }, { signal: ac.signal });
    return b;
  };
  const run = (cmd) => h.session(cmd);
  const fail = (r) => say(errorText(r.error));

  function card(e) {
    const n = e.n, li = el("li", `sl-card ${e.state}`);
    li.dataset.testid = `slot-${n}`; li.dataset.state = e.state;
    const active = idx().active === n, playing = playingSlot() === n;
    if (e.state === "ok") {
      li.style.setProperty("--acc", figures.accent[e.class] ?? "#ffd43b");
      li.dataset.class = e.class;
      const badge = el("div", "sl-badge"), cv = el("canvas"); cv.width = cv.height = 112; cv.setAttribute("aria-hidden", "true");
      badge.append(el("span", "sl-clip"), cv); li.append(badge);
      try { paintBust(cv, e.class, e.look); } catch { /* the figure is decoration */ }
      const body = el("div", "sl-body"), name = el("strong", "sl-name"); name.dataset.testid = `slot-name-${n}`;
      name.textContent = `${T.slSlot} ${n}: ${e.name}`;
      const tags = el("span", "sl-tags");
      if (playing) tags.append(el("span", "sl-tag now", T.slPlaying));
      else if (idx().last === n) tags.append(el("span", "sl-tag", T.slMostRecent));
      body.append(name, tags, el("span", "sl-meta", slotSummary(e)));
      const qt = slotQuestText(e);
      if (qt) { // the visible "Step · N/3" is hidden from screen readers in favour of a full sentence
        const q = el("span", "sl-meta sl-quest", qt); q.dataset.testid = `slot-quest-${n}`; q.setAttribute("aria-hidden", "true");
        const sr = el("span", "sr", T.slotQuestAria.replace("{step}", qt.split(" · ")[0]).replace("{n}", String(e.sidesDone ?? 0)).replace("{m}", String(config.quests.sideCount)));
        body.append(q, sr);
      }
      body.append(el("span", "sl-meta", `${T.slLast}: ${fmtStamp(e)}`));
      li.append(body);
      const acts = el("div", "sl-acts");
      acts.append(button(playing ? T.slContinueHere : T.slLoad, `slot-load-${n}`, () => {
        if (h.playing() && !playing) { sub = { kind: "load", n, e, opener: `slot-load-${n}` }; render(); return; } // AC-R-223-2: the running game is left only after a confirmation
        const r = run({ t: "loadSlot", slot: n }); if (!r.ok) { fail(r); render(); }
      }, "btn small pri", `${T.slLoad} ${e.name}`));
      if (playing) acts.lastChild.disabled = true;
      acts.append(button(T.slRename, `slot-rename-${n}`, () => { sub = { kind: "rename", n, opener: `slot-rename-${n}` }; render(); }, "mini", `${T.slRename} ${e.name}`));
      acts.append(button(T.slExport, `slot-export-${n}`, () => { const r = run({ t: "exportSlot", slot: n }); if (r.ok) { h.download(r.fileName ?? r.filename, r.text); say(`${T.slExported}: ${e.name}`); } else fail(r); render(); }, "mini", `${T.slExport} ${e.name}`));
      acts.append(button(T.slImport, `slot-import-${n}`, () => { sub = { kind: "import", n, opener: `slot-import-${n}` }; render(); }, "mini", `${T.slImport} ${e.name}`));
      acts.append(button(T.slNew, `slot-new-${n}`, () => h.onNewHere?.(n), "mini", `${T.slReplace}: ${e.name}`));
      acts.append(button(T.slDelete, `slot-delete-${n}`, () => { sub = { kind: "delete", n, e, opener: `slot-delete-${n}` }; render(); }, "mini warn", `${T.slDelete} ${e.name}`));
      if (playing) { for (const b of acts.querySelectorAll(`[data-testid="slot-delete-${n}"],[data-testid="slot-import-${n}"],[data-testid="slot-new-${n}"]`)) { b.disabled = true; b.title = T.slNowPlayingHint; } }
      if (undoable.get(n) === "replace" && e.hasPrev !== false && !playing) acts.append(button(T.slUndoReplace, `slot-undo-${n}`, () => undo(n, e.name), "mini"));
      li.append(acts);
    } else if (e.state === "empty") {
      const em = el("div", "sl-empty", "+"); em.setAttribute("aria-hidden", "true"); li.append(em);
      const body = el("div", "sl-body");
      const name = el("strong", "sl-name", `${T.slSlot} ${n}: ${T.slEmpty}`); name.dataset.testid = `slot-name-${n}`;
      body.append(name, el("span", "sl-meta", T.slEmptyText)); li.append(body);
      const acts = el("div", "sl-acts");
      acts.append(button(T.slNew, `slot-new-${n}`, () => h.onNewHere?.(n), "btn small pri", `${T.slNew} ${n}`));
      acts.append(button(T.slImport, `slot-import-${n}`, () => { sub = { kind: "import", n, opener: `slot-import-${n}` }; render(); }, "mini", `${T.slImport} ${n}`));
      if (undoable.get(n) === "delete" && e.hasPrev !== false) acts.append(button(T.slUndoDelete, `slot-undo-${n}`, () => undo(n, ""), "mini"));
      li.append(acts);
    } else { // bad | newer
      const em = el("div", "sl-empty bad", "!"); em.setAttribute("aria-hidden", "true"); li.append(em);
      const body = el("div", "sl-body"), name = el("strong", "sl-name", `${T.slSlot} ${n}: ${e.state === "bad" ? T.slDamaged : T.slNewer}`); name.dataset.testid = `slot-name-${n}`;
      body.append(name, el("span", "sl-meta", e.state === "bad" ? T.slDamagedText : T.slNewerText)); li.append(body);
      const acts = el("div", "sl-acts");
      acts.append(button(e.state === "bad" ? T.slExportDamaged : T.slExport, `slot-export-${n}`, () => { let r = run({ t: "exportSlot", slot: n, which: e.state === "bad" ? "bad" : "current" }); if (!r.ok && e.state === "bad") r = run({ t: "exportSlot", slot: n, which: "current" }); /* a damaged slot found at boot still holds its text under the slot key */ if (r.ok) h.download(r.fileName ?? r.filename, r.text); else fail(r); render(); }, "mini"));
      if (e.state === "bad") acts.append(button(T.slDelete, `slot-delete-${n}`, () => { sub = { kind: "delete", n, e, opener: `slot-delete-${n}` }; render(); }, "mini warn"));
      acts.append(button(T.slImport, `slot-import-${n}`, () => { sub = { kind: "import", n, opener: `slot-import-${n}` }; render(); }, "mini"));
      li.append(acts);
    }
    return li;
  }

  function undo(n, name) {
    const r = run({ t: "restoreSlot", slot: n }); // one .prev copy per slot serves both "undo delete" and "undo replace"
    if (r.ok) { undoable.delete(n); say(`${T.slUndone}${name ? `: ${name}` : ""}`); } else fail(r);
    render();
  }

  /** Close the open sub view and give focus back to the button that opened it (or, if that is gone, the first action of its card). */
  function closeSub() {
    focusKey = sub?.opener ?? null; fallbackSlot = sub?.n ?? null; sub = null; render();
  }
  /** Confirmation dialog (AC-NFR-A07-1): takes focus on Cancel (the safe choice), traps Tab, Esc cancels, focus returns on close. */
  function confirmBox(title, text, yesLabel, onYes, testid = "slot-confirm") {
    const box = el("div", "sl-confirm"); box.setAttribute("role", "alertdialog"); box.setAttribute("aria-modal", "true");
    const h3 = el("h3", "", title); h3.dataset.testid = `${testid}-title`; h3.id = `${testid}-title-id`; box.setAttribute("aria-labelledby", h3.id);
    const p = el("p", "hint", text); p.dataset.testid = `${testid}-text`; p.id = `${testid}-text-id`; box.setAttribute("aria-describedby", p.id);
    const no = button(T.slCancel, `${testid}-no`, closeSub, "btn");
    box.append(h3, p, button(yesLabel, `${testid}-yes`, onYes, "btn pri"), no);
    trapDialog(box, closeSub, ac.signal);
    queueMicrotask(() => no.focus({ preventScroll: true }));
    return box;
  }

  function importView(n) {
    const box = el("div", "sl-import");
    box.append(el("h3", "", `${T.slImportTitle} ${n}`));
    const file = el("input"); file.type = "file"; file.accept = ".json,application/json,text/plain"; file.dataset.testid = "import-file"; file.id = `sl-file-${n}`;
    const lab = el("label", "hint", T.importFile); lab.htmlFor = file.id;
    const ta = el("textarea"); ta.rows = 4; ta.dataset.testid = "import-text"; ta.setAttribute("aria-label", T.importPasteLabel); ta.spellcheck = false;
    const go = (text) => {
      const r = run({ t: "importSlot", slot: n, text, confirm: false });
      if (r.ok) { markUndo(n, "replace"); say(`${T.slImported}.`); closeSub(); return; }
      if (r.error === "occupied") { sub = { kind: "import-confirm", n, text, lost: r.lost, opener: sub?.opener }; render(); return; }
      say(errorText(r.error)); render();
    };
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (!f) return; let text = ""; try { text = await f.text(); } catch { /* reported as a failed import */ } go(text); }, { signal: ac.signal });
    const row = el("div", "btn-row");
    row.append(button(T.importGo, "import-go", () => go(ta.value), "btn small pri"), button(T.back, "import-back", closeSub, "btn small"));
    box.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && ev.target !== file) { ev.preventDefault(); ev.stopPropagation(); closeSub(); } }, { signal: ac.signal });
    queueMicrotask(() => file.focus({ preventScroll: true }));
    box.append(lab, file, el("p", "hint", T.importPaste), ta, row);
    return box;
  }

  function renameView(n, e) {
    const box = el("form", "sl-rename"); box.noValidate = true;
    const lab = el("label", "", `${T.slRenameLabel} (${e.name})`), inp = el("input"); inp.type = "text"; inp.maxLength = 16; inp.value = e.name; inp.dataset.testid = "slot-rename-input"; inp.id = `sl-rn-${n}`; lab.htmlFor = inp.id;
    inp.autocomplete = "off"; inp.spellcheck = false;
    const err = el("p", "sl-err"); err.setAttribute("role", "status"); err.dataset.testid = "slot-rename-error";
    const save = el("button", "btn small pri", T.slSave); save.type = "submit"; save.dataset.testid = "slot-rename-save";
    const cancel = button(T.slCancel, "slot-rename-cancel", closeSub, "btn small");
    box.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = validateName(inp.value);
      if (!v.ok) { err.textContent = S.errBadName; inp.focus(); return; }
      const r = run({ t: "renameSlot", slot: n, name: v.name });
      if (r.ok) { say(`${T.slRenamed}: ${r.name}`); closeSub(); } else { say(errorText(r.error)); render(); }
    }, { signal: ac.signal });
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); closeSub(); } }, { signal: ac.signal });
    box.append(lab, inp, err, save, cancel);
    queueMicrotask(() => { inp.focus(); inp.select(); });
    return box;
  }

  function render() {
    const keep = focusKey;
    root.replaceChildren();
    if (mode === "dialog") {
      const head = el("div", "sl-head"), h2 = el("h2", "", T.slTitle); h2.id = "sl-title"; head.append(h2);
      if (onClose) head.append(button("×", "slots-close-x", onClose, "xbtn", T.slClose));
      root.append(head);
    }
    status?.destroy(); status = createSaveStatus(h, { errorText, onChange: () => render() });
    root.append(status);
    root.append(el("p", "hint sl-intro", T.slIntro));
    const live = el("p", "sl-msg"); live.setAttribute("role", "status"); live.dataset.testid = "slots-message"; live.textContent = msg.text;
    root.append(live);
    if (sub?.kind === "delete") {
      const e = sub.e;
      const label = e.state === "ok" ? `${e.name} (${CLASS_NAME[e.class]}, ${T.slLevel} ${e.level})` : `${T.slSlot} ${sub.n}`;
      root.append(confirmBox(`${T.slDelete} ${label}?`, T.slDeleteText, `${T.slDeleteYes} ${e.name ?? ""}`.trim(), () => {
        const r = run({ t: "deleteSlot", slot: sub.n, confirm: true });
        if (r.ok) { markUndo(sub.n, "delete"); say(`${T.slDeleted}: ${e.name ?? `${T.slSlot} ${sub.n}`}`); } else say(errorText(r.error));
        closeSub();
      }));
    } else if (sub?.kind === "load") {
      const e = sub.e, now = idx().slots[(idx().active ?? 0) - 1], who = now?.name ? `${now.name}` : "";
      root.append(confirmBox(`${T.slLoadTitle.replace("this character", e.name ?? "this character")}`, `${who ? `${who}: ` : ""}${T.slLoadText}`, `${T.slLoadYes} ${e.name ?? ""}`.trim(), () => {
        const n = sub.n;
        const r = run({ t: "loadSlot", slot: n });
        if (r.ok) { sub = null; focusKey = null; return; } // the shell closes this view and starts the loaded game
        say(errorText(r.error)); closeSub();
      }, "slot-load-confirm"));
    } else if (sub?.kind === "import-confirm") {
      const lost = idx().slots[sub.n - 1]?.name ?? sub.lost ?? "";
      root.append(confirmBox(T.slImportReplaceTitle.replace("this character", lost || "this character"), `${lost} ${T.slImportReplaceText}`, `${T.slImportReplaceYes} ${lost}`.trim(), () => {
        const r = run({ t: "importSlot", slot: sub.n, text: sub.text, confirm: true });
        if (r.ok) { markUndo(sub.n, "replace"); say(`${T.slImported}.`); } else say(errorText(r.error));
        closeSub();
      }));
    } else if (sub?.kind === "import") root.append(importView(sub.n));
    else {
      if (sub?.kind === "rename") root.append(renameView(sub.n, idx().slots[sub.n - 1]));
      const list = el("ul", "sl-list"); list.setAttribute("aria-label", T.slTitle);
      for (const e of idx().slots.slice(0, SLOT_COUNT)) list.append(card(e));
      root.append(list);
      const foot = el("div", "sl-foot"), u = h.slots()?.usage; // usage line and Close share one row (R6 N5: Close must stay on screen at 720)
      if (u) { const p = el("p", "hint sl-usage", `${T.slUsage}: ${Math.round(u.chars / 1024)} KB / ${Math.round(u.ceiling / 1024)} KB`); p.dataset.testid = "slots-usage"; foot.append(p); }
      if (h.playing()) foot.append(el("p", "hint sl-playing", T.slNowPlayingHint));
      if (mode === "dialog" && onClose) foot.append(button(T.slClose, "slots-close", onClose, "btn"));
      if (foot.childElementCount) root.append(foot);
    }
    let target = keep && root.querySelector(`[data-testid="${keep}"]`);
    if (!target && fallbackSlot) target = root.querySelector(`[data-testid="slot-${fallbackSlot}"] button:not([disabled])`);
    fallbackSlot = null; focusKey = null;
    target?.focus({ preventScroll: true });
  }

  root.refresh = render;
  root.destroy = () => { status?.destroy(); ac.abort(); };
  render();
  return root;
}
