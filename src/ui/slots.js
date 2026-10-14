// The save slot manager (R-220..R-227, customer: "save slots in the Options menu"). One component, three homes: the Options screen, the
// Load game dialog (title, pause, class selection) and the pick list. It talks to the shell only through `h`:
//   h.session(cmd) -> {ok, ...}   h.slots() -> game.slots   h.playing() -> bool   h.download(name, text)   h.adapter (for the undo copies)
//   h.onNewHere(slot)  open the class selection for this slot        h.emit(type)  UI click cue
// Text comes from T / the core strings; the character name is always set with textContent.
import { content } from "../core/index.js";
import { validateName } from "../core/name.js";
import { T } from "./text.js";
import { drawFigure } from "../render/figure.js";
import { HERO_ACCENT } from "../render/styles/vector/heroes.js";

const S = content.strings;
const SLOT_COUNT = 5;
const CLASS_NAME = Object.fromEntries(content.classes.map((c) => [c.id, c.name]));
const prevKey = (n) => `office-crawler.slot.${n}.prev`;
const ERR = { "bad-name": S.errBadName, "bad-slot": S.errBadSlot, "empty-slot": S.errEmptySlot, occupied: S.errOccupied, "confirm-required": S.errConfirm, corrupt: S.errCorrupt, newer: S.errNewer, quota: T.errQuota,
  "too-large": S.errCorrupt, "write-failed": T.errWrite, "another-tab": T.errAnotherTab, playing: T.errPlaying, "no-storage": T.errNoStorage, "bad-class": S.errBadClass };
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
const bustSrc = new Map();
function bustSource(classId) {
  let c = bustSrc.get(classId);
  if (c) return c;
  c = document.createElement("canvas"); c.width = 240; c.height = 300;
  drawFigure(c, `hero.${classId}`, { anim: "portrait" });
  bustSrc.set(classId, c);
  return c;
}
export function paintBust(canvas, classId) {
  const g = canvas.getContext("2d"), src = bustSource(classId), s = canvas.width;
  g.clearRect(0, 0, s, s);
  g.fillStyle = "#17123a"; g.fillRect(0, 0, s, s);
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 40, 6, 160, 160, 0, 0, s, s);
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
const where = (e) => (e.depth > 0 ? `${T.slFloor} ${e.depth}` : T.slLobby);
export const slotSummary = (e) => `${CLASS_NAME[e.class] ?? e.class} · ${T.slLevel} ${e.level} · ${where(e)} · ${fmtPlay(e.playSec)} ${T.slPlayed}`;

/**
 * createSlotsView(h, { mode, onClose }). mode "options" embeds in the Options panel (no Close button); "dialog" is the modal Load dialog.
 * Returns a root element with destroy(); the element re-renders itself after each command.
 */
export function createSlotsView(h, { mode = "dialog", onClose = null } = {}) {
  const root = el("section", `sl-view sl-${mode}`);
  root.dataset.testid = "slots-view";
  const ac = new AbortController();
  let sub = null; // null | {kind: "delete"|"replace-import"|"rename"|"import", n, ...}
  let msg = { text: "", undo: null };
  let focusKey = null;

  const idx = () => h.slots()?.index ?? { active: null, last: null, slots: [] };
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
      li.style.setProperty("--acc", HERO_ACCENT[e.class] ?? "#ffd43b");
      li.dataset.class = e.class;
      const badge = el("div", "sl-badge"), cv = el("canvas"); cv.width = cv.height = 112; cv.setAttribute("aria-hidden", "true");
      badge.append(el("span", "sl-clip"), cv); li.append(badge);
      try { paintBust(cv, e.class); } catch { /* the figure is decoration */ }
      const body = el("div", "sl-body"), name = el("strong", "sl-name"); name.dataset.testid = `slot-name-${n}`;
      name.textContent = `${T.slSlot} ${n}: ${e.name}`;
      const tags = el("span", "sl-tags");
      if (playing) tags.append(el("span", "sl-tag now", T.slPlaying));
      else if (idx().last === n) tags.append(el("span", "sl-tag", T.slMostRecent));
      body.append(name, tags, el("span", "sl-meta", slotSummary(e)), el("span", "sl-meta", `${T.slLast}: ${fmtWhen(e.lastPlayed)}`));
      li.append(body);
      const acts = el("div", "sl-acts");
      acts.append(button(playing ? T.slContinueHere : T.slLoad, `slot-load-${n}`, () => { const r = run({ t: "loadSlot", slot: n }); if (!r.ok) { fail(r); render(); } }, "btn small pri", `${T.slLoad} ${e.name}`));
      if (playing) acts.lastChild.disabled = true;
      acts.append(button(T.slRename, `slot-rename-${n}`, () => { sub = { kind: "rename", n }; render(); }, "mini", `${T.slRename} ${e.name}`));
      acts.append(button(T.slExport, `slot-export-${n}`, () => { const r = run({ t: "exportSlot", slot: n }); if (r.ok) { h.download(r.filename, r.text); say(`${T.slExported}: ${e.name}`); } else fail(r); render(); }, "mini", `${T.slExport} ${e.name}`));
      acts.append(button(T.slImport, `slot-import-${n}`, () => { sub = { kind: "import", n }; render(); }, "mini", `${T.slImport} ${e.name}`));
      acts.append(button(T.slNew, `slot-new-${n}`, () => h.onNewHere?.(n), "mini", `${T.slReplace}: ${e.name}`));
      acts.append(button(T.slDelete, `slot-delete-${n}`, () => { sub = { kind: "delete", n, e }; render(); }, "mini warn", `${T.slDelete} ${e.name}`));
      if (playing) { for (const b of acts.querySelectorAll(`[data-testid="slot-delete-${n}"],[data-testid="slot-import-${n}"],[data-testid="slot-new-${n}"]`)) { b.disabled = true; b.title = T.slNowPlayingHint; } }
      if (undoable.get(n) === "replace" && h.adapter?.getItem(prevKey(n)) !== null && !playing) acts.append(button(T.slUndoReplace, `slot-undo-${n}`, () => undo(n, e.name), "mini"));
      li.append(acts);
    } else if (e.state === "empty") {
      const em = el("div", "sl-empty", "+"); em.setAttribute("aria-hidden", "true"); li.append(em);
      const body = el("div", "sl-body");
      const name = el("strong", "sl-name", `${T.slSlot} ${n}: ${T.slEmpty}`); name.dataset.testid = `slot-name-${n}`;
      body.append(name, el("span", "sl-meta", T.slEmptyText)); li.append(body);
      const acts = el("div", "sl-acts");
      acts.append(button(T.slNew, `slot-new-${n}`, () => h.onNewHere?.(n), "btn small pri", `${T.slNew} ${n}`));
      acts.append(button(T.slImport, `slot-import-${n}`, () => { sub = { kind: "import", n }; render(); }, "mini", `${T.slImport} ${n}`));
      if (undoable.get(n) === "delete" && h.adapter?.getItem(prevKey(n)) !== null) acts.append(button(T.slUndoDelete, `slot-undo-${n}`, () => undo(n, ""), "mini"));
      li.append(acts);
    } else { // bad | newer
      const em = el("div", "sl-empty bad", "!"); em.setAttribute("aria-hidden", "true"); li.append(em);
      const body = el("div", "sl-body"), name = el("strong", "sl-name", `${T.slSlot} ${n}: ${e.state === "bad" ? T.slDamaged : T.slNewer}`); name.dataset.testid = `slot-name-${n}`;
      body.append(name, el("span", "sl-meta", e.state === "bad" ? T.slDamagedText : T.slNewerText)); li.append(body);
      const acts = el("div", "sl-acts");
      acts.append(button(e.state === "bad" ? T.slExportDamaged : T.slExport, `slot-export-${n}`, () => { const r = run({ t: "exportSlot", slot: n, which: e.state === "bad" ? "bad" : "current" }); if (r.ok) h.download(r.filename, r.text); else fail(r); render(); }, "mini"));
      if (e.state === "bad") acts.append(button(T.slDelete, `slot-delete-${n}`, () => { sub = { kind: "delete", n, e }; render(); }, "mini warn"));
      acts.append(button(T.slImport, `slot-import-${n}`, () => { sub = { kind: "import", n }; render(); }, "mini"));
      li.append(acts);
    }
    return li;
  }

  function undo(n, name) {
    const kind = undoable.get(n);
    let r;
    if (kind === "delete") r = h.session({ t: "restoreSlot", slot: n });
    else { const text = h.adapter.getItem(prevKey(n)); r = text === null ? { ok: false, error: "empty-slot" } : run({ t: "importSlot", slot: n, text, confirm: true }); }
    if (r.ok) { undoable.delete(n); say(`${T.slUndone}${name ? `: ${name}` : ""}`); } else fail(r);
    render();
  }

  function confirmBox(title, text, yesLabel, onYes, testid = "slot-confirm") {
    const box = el("div", "sl-confirm"); box.setAttribute("role", "alertdialog"); box.setAttribute("aria-label", title);
    const h3 = el("h3", "", title); h3.dataset.testid = `${testid}-title`;
    const p = el("p", "hint", text); p.dataset.testid = `${testid}-text`;
    box.append(h3, p, button(yesLabel, `${testid}-yes`, onYes, "btn pri"), button(T.slCancel, `${testid}-no`, () => { sub = null; focusKey = null; render(); }, "btn"));
    return box;
  }

  function importView(n) {
    const box = el("div", "sl-import"), occupied = idx().slots[n - 1]?.state !== "empty";
    box.append(el("h3", "", `${T.slImportTitle} ${n}`));
    const file = el("input"); file.type = "file"; file.accept = ".json,application/json,text/plain"; file.dataset.testid = "import-file"; file.id = `sl-file-${n}`;
    const lab = el("label", "hint", T.importFile); lab.htmlFor = file.id;
    const ta = el("textarea"); ta.rows = 4; ta.dataset.testid = "import-text"; ta.setAttribute("aria-label", T.importPasteLabel); ta.spellcheck = false;
    const go = (text) => {
      const r = run({ t: "importSlot", slot: n, text, confirm: false });
      if (r.ok) { markUndo(n, "replace"); sub = null; say(`${T.slImported}.`); render(); return; }
      if (r.error === "occupied") { sub = { kind: "import-confirm", n, text, lost: r.lost }; render(); return; }
      say(errorText(r.error)); render();
    };
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (!f) return; let text = ""; try { text = await f.text(); } catch { /* reported as a failed import */ } go(text); }, { signal: ac.signal });
    const row = el("div", "btn-row");
    row.append(button(T.importGo, "import-go", () => go(ta.value), "btn small pri"), button(T.back, "import-back", () => { sub = null; render(); }, "btn small"));
    box.append(lab, file, el("p", "hint", T.importPaste), ta, row);
    void occupied;
    return box;
  }

  function renameView(n, e) {
    const box = el("form", "sl-rename"); box.noValidate = true;
    const lab = el("label", "", `${T.slRenameLabel} (${e.name})`), inp = el("input"); inp.type = "text"; inp.maxLength = 16; inp.value = e.name; inp.dataset.testid = "slot-rename-input"; inp.id = `sl-rn-${n}`; lab.htmlFor = inp.id;
    inp.autocomplete = "off"; inp.spellcheck = false;
    const err = el("p", "sl-err"); err.setAttribute("role", "status"); err.dataset.testid = "slot-rename-error";
    const save = el("button", "btn small pri", T.slSave); save.type = "submit"; save.dataset.testid = "slot-rename-save";
    const cancel = button(T.slCancel, "slot-rename-cancel", () => { sub = null; render(); }, "btn small");
    box.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = validateName(inp.value);
      if (!v.ok) { err.textContent = S.errBadName; inp.focus(); return; }
      const r = run({ t: "renameSlot", slot: n, name: v.name });
      if (r.ok) { sub = null; say(`${T.slRenamed}: ${r.name}`); } else say(errorText(r.error));
      focusKey = null; render();
    }, { signal: ac.signal });
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); sub = null; render(); } }, { signal: ac.signal });
    box.append(lab, inp, err, save, cancel);
    queueMicrotask(() => { inp.focus(); inp.select(); });
    return box;
  }

  function render() {
    const keep = focusKey;
    root.replaceChildren();
    if (mode === "dialog") { const h2 = el("h2", "", T.slTitle); h2.id = "sl-title"; root.append(h2); }
    else root.append(el("h3", "sl-h", T.slTitle));
    root.append(el("p", "hint sl-intro", T.slIntro));
    const live = el("p", "sl-msg"); live.setAttribute("role", "status"); live.dataset.testid = "slots-message"; live.textContent = msg.text;
    root.append(live);
    if (sub?.kind === "delete") {
      const e = sub.e;
      const label = e.state === "ok" ? `${e.name} (${CLASS_NAME[e.class]}, ${T.slLevel} ${e.level})` : `${T.slSlot} ${sub.n}`;
      root.append(confirmBox(`${T.slDelete} ${label}?`, T.slDeleteText, `${T.slDeleteYes} ${e.name ?? ""}`.trim(), () => {
        const r = run({ t: "deleteSlot", slot: sub.n, confirm: true });
        if (r.ok) { markUndo(sub.n, "delete"); say(`${T.slDeleted}: ${e.name ?? `${T.slSlot} ${sub.n}`}`); } else say(errorText(r.error));
        sub = null; focusKey = null; render();
      }));
    } else if (sub?.kind === "import-confirm") {
      const lost = idx().slots[sub.n - 1]?.name ?? sub.lost ?? "";
      root.append(confirmBox(`${T.slImportReplaceTitle.replace("this character", lost || "this character")}`.replace(/^Replace /, "Replace ") , `${lost} ${T.slImportReplaceText}`, `${T.slImportReplaceYes} ${lost}`.trim(), () => {
        const r = run({ t: "importSlot", slot: sub.n, text: sub.text, confirm: true });
        if (r.ok) { markUndo(sub.n, "replace"); say(`${T.slImported}.`); } else say(errorText(r.error));
        sub = null; focusKey = null; render();
      }));
    } else if (sub?.kind === "import") root.append(importView(sub.n));
    else {
      if (sub?.kind === "rename") root.append(renameView(sub.n, idx().slots[sub.n - 1]));
      const list = el("ul", "sl-list"); list.setAttribute("aria-label", T.slTitle);
      for (const e of idx().slots.slice(0, SLOT_COUNT)) list.append(card(e));
      root.append(list);
      const u = h.slots()?.usage;
      if (u) { const p = el("p", "hint sl-usage", `${T.slUsage}: ${Math.round(u.chars / 1024)} KB / ${Math.round(u.ceiling / 1024)} KB`); p.dataset.testid = "slots-usage"; root.append(p); }
      if (h.playing()) root.append(el("p", "hint", T.slNowPlayingHint));
      if (msg.undo) { /* reserved */ }
      if (mode === "dialog" && onClose) root.append(button(T.slClose, "slots-close", onClose, "btn"));
    }
    if (keep) root.querySelector(`[data-testid="${keep}"]`)?.focus({ preventScroll: true });
  }

  root.refresh = render;
  root.destroy = () => ac.abort();
  render();
  return root;
}
