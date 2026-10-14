// Options: the persisted settings object (defaults, normalising) and the Options panel (DOM). The panel only talks to a controller
// (`ctl`, built in main.js): it never touches audio, storage or the game itself. All visible text comes from the T table.
import { audioConfig } from "../audio/config.js";
import { ACTIONS, defaultKeys, normalizeKeys, keyLabel } from "../input/keymap.js";
import { T } from "./text.js";
import { rarityMark } from "./icons.js";

export const TEXT_SCALES = [1, 1.25, 1.5];
const KITS = ["foley", "gothic", "chiptune"];
const clamp01 = (v, d) => (Number.isFinite(+v) && v !== null && v !== "" ? Math.max(0, Math.min(1, +v)) : d);

/** The full default options object (spec: options{keys, volume, muted, kit, reducedMotion, textScale, ...}). */
export function defaultOptions() {
  return {
    volume: { master: audioConfig.defaultMaster, sfx: audioConfig.defaultBus.sfx, ambient: audioConfig.defaultBus.ambient },
    muted: false, kit: audioConfig.defaultKit, keys: defaultKeys(),
    highContrast: false, lowFx: false, reducedMotion: false, screenShake: true, textScale: 1,
  };
}

/** Stored data -> a complete, valid options object (unknown fields dropped, bad values replaced by defaults). */
export function normalizeOptions(raw) {
  const d = defaultOptions(), r = raw && typeof raw === "object" ? raw : {}, v = r.volume && typeof r.volume === "object" ? r.volume : {};
  return {
    volume: { master: clamp01(v.master, d.volume.master), sfx: clamp01(v.sfx, d.volume.sfx), ambient: clamp01(v.ambient, d.volume.ambient) },
    muted: r.muted === true, kit: KITS.includes(r.kit) ? r.kit : d.kit, keys: normalizeKeys(r.keys),
    highContrast: r.highContrast === true, lowFx: r.lowFx === true, reducedMotion: r.reducedMotion === true,
    screenShake: r.screenShake !== false, textScale: TEXT_SCALES.includes(+r.textScale) ? +r.textScale : 1,
  };
}

const ACTION_LABEL = { inventory: T.actInventory, character: T.actCharacter, skills: T.actSkills, map: T.actMap, skill1: T.actSkill1, skill2: T.actSkill2, skill3: T.actSkill3, skill4: T.actSkill4, belt1: T.actBelt1, belt2: T.actBelt2, belt3: T.actBelt3, belt4: T.actBelt4 };
const KIT_LABEL = { foley: T.kitFoley, gothic: T.kitGothic, chiptune: T.kitChiptune };
const SIZE_LABEL = { 1: T.sizeNormal, 1.25: T.sizeLarge, 1.5: T.sizeHuge };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
let uid = 0;
function field(label, input, testid) {
  const id = `opt${++uid}`, row = el("div", "opt-row"), lab = el("label", "", label);
  input.id = id; lab.htmlFor = id; if (testid) input.dataset.testid = testid;
  row.append(lab, input);
  return row;
}

/**
 * Build the Options panel. ctl: { get(), setVolume(ch, v), setMuted(b), setKit(id), previewKit(), setFlag(name, bool), setTextScale(n),
 * setKey(action, code) -> {ok, reason?, with?}, restoreKeys(), capture(bool), click() }. onBack() leaves the panel.
 */
export function createOptionsView(ctl, onBack) {
  const o = ctl.get(), root = el("section", "screen options"), box = el("div", "panel opt-panel");
  const ac = new AbortController(), sig = { signal: ac.signal };
  box.append(el("h2", "", T.optionsTitle));

  // ---- sound
  const snd = el("fieldset", "opt-group"); snd.append(el("legend", "", T.optSound));
  for (const [ch, label, id] of [["master", T.optVolumeMaster, "opt-vol-master"], ["sfx", T.optVolumeSfx, "opt-vol-sfx"], ["ambient", T.optVolumeAmbient, "opt-vol-ambient"]]) {
    const r = el("input"); r.type = "range"; r.min = "0"; r.max = "1"; r.step = "0.05"; r.value = String(o.volume[ch]);
    const out = el("output", "opt-val", `${Math.round(o.volume[ch] * 100)}%`);
    r.addEventListener("input", () => { ctl.setVolume(ch, +r.value); out.textContent = `${Math.round(+r.value * 100)}%`; });
    r.addEventListener("change", () => ctl.click());
    const row = field(label, r, id); row.append(out); snd.append(row);
  }
  const mute = el("input"); mute.type = "checkbox"; mute.checked = !!o.muted;
  mute.addEventListener("change", () => { ctl.setMuted(mute.checked); ctl.click(); });
  snd.append(field(T.optMute, mute, "opt-mute"));
  const kit = el("select");
  for (const k of KITS) { const op = el("option", "", KIT_LABEL[k]); op.value = k; kit.append(op); }
  kit.value = o.kit;
  kit.addEventListener("change", () => { ctl.setKit(kit.value); ctl.previewKit(); });
  const kitRow = field(T.optKit, kit, "opt-kit");
  const pv = el("button", "mini", T.kitPreview); pv.type = "button"; pv.dataset.testid = "opt-kit-preview"; pv.addEventListener("click", () => ctl.previewKit());
  kitRow.append(pv); snd.append(kitRow, el("p", "hint", T.kitPreviewNote));
  box.append(snd);

  // ---- keys
  const keys = el("fieldset", "opt-group"); keys.append(el("legend", "", T.optKeys), el("p", "hint", T.optKeysHint));
  const msg = el("p", "opt-msg", ""); msg.setAttribute("role", "status"); msg.dataset.testid = "opt-key-msg";
  const grid = el("div", "opt-keys"), btns = {};
  let capturing = null;
  const paint = () => { for (const a of ACTIONS) { btns[a].textContent = capturing === a ? T.optKeysPress : keyLabel(ctl.get().keys[a]); btns[a].classList.toggle("on", capturing === a); } };
  const stop = () => { if (capturing) ctl.capture(false); capturing = null; paint(); };
  for (const a of ACTIONS) {
    const lab = el("span", "opt-klabel", ACTION_LABEL[a]), b = el("button", "mini key opt-kbtn"); b.type = "button"; b.dataset.testid = `opt-key-${a}`;
    b.setAttribute("aria-label", `${ACTION_LABEL[a]}`);
    b.addEventListener("click", () => { stop(); capturing = a; ctl.capture(true); msg.textContent = ""; paint(); ctl.click(); });
    btns[a] = b; grid.append(lab, b);
  }
  document.addEventListener("keydown", (e) => {
    if (!capturing) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code === "Escape") { stop(); return; }
    if (["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"].includes(e.code)) return;
    const a = capturing, r = ctl.setKey(a, e.code);
    if (r.ok) msg.textContent = `${T.optKeysSet}: ${ACTION_LABEL[a]} = ${keyLabel(e.code)}`;
    else if (r.reason === "conflict") msg.textContent = `${T.optKeysConflict} ${ACTION_LABEL[r.with]}.`;
    else msg.textContent = r.reason === "reserved" ? T.optKeysReserved : T.optKeysInvalid;
    stop();
  }, { capture: true, signal: ac.signal });
  const restore = el("button", "mini", T.optKeysRestore); restore.type = "button"; restore.dataset.testid = "opt-keys-restore";
  restore.addEventListener("click", () => { stop(); ctl.restoreKeys(); msg.textContent = ""; paint(); ctl.click(); });
  keys.append(grid, msg, restore);
  const mouse = el("div", "opt-mouse"); mouse.dataset.testid = "opt-mouse";
  mouse.append(el("h4", "", T.optMouse), el("p", "", T.optMouseLeft), el("p", "", T.optMouseRight), el("p", "hint", T.optMouseNote));
  keys.append(mouse);
  box.append(keys);
  paint();

  // ---- accessibility
  const acc = el("fieldset", "opt-group"); acc.append(el("legend", "", T.optAccess));
  for (const [name, label, id] of [["highContrast", T.optHighContrast, "opt-hc"], ["lowFx", T.optLowFx, "opt-lowfx"], ["reducedMotion", T.optReduceMotion, "opt-reduce-motion"], ["screenShake", T.optShake, "opt-shake"]]) {
    const c = el("input"); c.type = "checkbox"; c.checked = !!o[name];
    c.addEventListener("change", () => { ctl.setFlag(name, c.checked); ctl.click(); });
    acc.append(field(label, c, id));
  }
  const size = el("select");
  for (const s of TEXT_SCALES) { const op = el("option", "", SIZE_LABEL[s]); op.value = String(s); size.append(op); }
  size.value = String(o.textScale);
  size.addEventListener("change", () => { ctl.setTextScale(+size.value); ctl.click(); });
  acc.append(field(T.optTextSize, size, "opt-text-size"));
  const gore = el("p", "opt-fixed", `${T.optGore}: ${T.optGoreOff}`); gore.dataset.testid = "opt-gore";
  acc.append(gore);
  const rar = el("p", "opt-rarity"); rar.dataset.testid = "opt-rarity";
  rar.append(`${T.optRarity} `);
  for (const [r, name] of [["normal", T.rarityNormal], ["magic", T.rarityMagic], ["rare", T.rarityRare], ["unique", T.rarityUnique]]) {
    const s = el("span", `opt-sw l-${r}`); s.innerHTML = rarityMark(r, 14); s.append(` ${name}`); rar.append(s);
  }
  acc.append(rar);
  box.append(acc);

  box.append(el("p", "hint", T.optSaved));
  const back = el("button", "btn", T.back); back.type = "button"; back.dataset.testid = "opt-back";
  back.addEventListener("click", (ev) => { ev.stopPropagation(); stop(); ctl.click(); onBack(); }, sig);
  box.append(back);
  root.append(box);
  root.destroy = () => { stop(); ac.abort(); };
  return root;
}
