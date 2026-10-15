// The S2 panels as DOM above the canvas: the Desk Drawer (inventory, paper doll, belt) on the right, the Employee File /
// Skills / NPC window on the left, the HUD slot layer (skill bar, belt, panel buttons), tooltips, the held-item ghost, the
// toast and a live region. Plain data in (game.core, game.ui), commands out (game.input / game.openPanel); no game rules here.
// Everything is a real <button>: keyboard (arrows in the grid, Enter picks up and places, Esc puts back), focus ring,
// labelled, contrast >= 4.5:1 (see style.css tokens and test/ui-contrast.test.js).
import { content, itemAt, config, treeView, questView } from "../core/index.js";
import { T } from "./text.js";
import { itemIcon, skillIcon, rarityMark, arrow, coinIcon } from "./icons.js";
import { describeItem, compareToEquipped, unmetGear, allocPreview, dropCheck, rarityName, statLabel, xpRatio, xpProgress } from "./itemview.js";
import { hudLayout, drawerLayout, placeTip } from "./layout.js";
import { keyLabel, DEFAULT_KEYS } from "../input/keymap.js";
import { sellValue, buyPrice, classById } from "../core/index.js";
import { renderTree, nodeTipHtml, nodeFor } from "./tree.js";
import { paintBust } from "./slots.js";
import { figures } from "./figureHost.js";
import { owedLine } from "./messages.js";
import { journalModel, journalHtml, trackerOf } from "./journal.js";
import { questDialogModel, questDialogHtml } from "./questdialog.js";

const S = content.strings;
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SLOT_LABEL = { head: T.slotHead, amulet: T.slotAmulet, weapon: T.slotWeapon, body: T.slotBody, offhand: T.slotOffhand, hands: T.slotHands, belt: T.slotBelt, feet: T.slotFeet, ring1: T.slotRing1, ring2: T.slotRing2 };
const DOLL = { head: [3, 1, 2, 2], amulet: [5, 1, 1, 1], weapon: [1, 2, 2, 3], body: [3, 3, 2, 3], offhand: [6, 2, 2, 3], hands: [1, 5, 2, 2], belt: [3, 6, 2, 1], feet: [6, 5, 2, 2], ring1: [5, 5, 1, 1], ring2: [5, 6, 1, 1] };
const ATTR_BASE = { grit: "", agility: T.raisesDefense, stamina: T.raisesHealth, focus: T.raisesMana };
const fmt = (n) => String(Math.round(n * 100) / 100);
/** Hint and tooltip of one attribute for the player's class (CR6-01). The power attribute (class data derived.powerAttr, else config.derived.powerAttr) raises damage; the others do not. */
export function attrHint(classId, k) {
  const d = { ...config.derived, ...(classById(classId)?.derived ?? {}) }, power = d.powerAttr ?? "grit", dmg = d.damagePerGrit ?? { min: 1, max: 1 };
  const parts = [];
  const per = dmg.min === dmg.max ? fmt(dmg.min) : `${fmt(dmg.min)}–${fmt(dmg.max)}`;
  if (k === power) parts.push(`${T.attrDamageTip.replace("{free}", d.gritFree).replace("{n}", per)}`);
  if (k === "agility") parts.push(T.attrAgilityTip.replace("{d}", fmt(d.defensePerAgility)).replace("{a}", fmt(d.attackRatingPerAgility)));
  if (k === "stamina") parts.push(T.attrStaminaTip.replace("{n}", fmt(d.hpPerStamina)));
  if (k === "focus") parts.push(T.attrFocusTip.replace("{n}", fmt(d.mpPerFocus)));
  const base = ATTR_BASE[k];
  const text = k === power ? (base ? T.raisesDamageAnd.replace("{x}", base.replace(/^raises /, "")) : T.raisesDamage) : (k === "grit" ? T.gritNoDamage : base);
  return { text, tip: parts.join(" ") };
}
const RESISTS = [["fire", T.resistFire], ["cold", T.resistCold], ["shock", T.resistShock], ["acid", T.resistAcid]];
// ---- pure markup builders (exported so a unit test can feed them hostile ids and names, CR-02) ----
export const escHtml = esc;
export const nameLineHtml = (it, size = 13) => `<span class="l-${esc(it.rarity)}">${rarityMark(it.rarity, size)} ${esc(it.name)}</span>`;
export function itemBoxHtml(it, { fill = false, pos = null, cls = "", unmet = false } = {}) {
  const warn = unmet ? '<span class="warn" aria-hidden="true">!</span>' : "";
  const style = pos ? ` style="--x:${Number(pos.x) || 0};--y:${Number(pos.y) || 0};--w:${Number(it.w) || 1};--h:${Number(it.h) || 1}"` : "";
  return `<span class="item r-${esc(it.rarity)}${fill ? " fill" : ""}${cls ? " " + esc(cls) : ""}" data-item="${esc(it.id)}"${style}>${itemIcon(it)}<span class="rm">${rarityMark(it.rarity, 11)}</span>${warn}</span>`;
}
export const rowItemHtml = (it, tipKey, right, mainText = "") => `<li class="row" data-tip="${esc(tipKey)}"><span class="ricon" style="--rw:${Number(it.w) || 1};--rh:${Number(it.h) || 1}">${itemIcon(it)}</span><span class="rname">${nameLineHtml(it, 14)}<small>${esc(mainText)}</small></span>${right}</li>`;
const num = (n) => Number(n).toLocaleString("en-US");

export const xpFileHtml = (xpv, level) => { // Employee File XP row: label, bar and the total as visible text (R8-T F1)
  const pct = xpv.pct;
  return `<div class="xpl" title="${esc(T.xpTotal)}: ${num(xpv.total)}"><span>${esc(T.experience)}</span><span data-stat="xp" data-testid="xp-label" data-total="${Number(xpv.total) || 0}">${xpv.capped ? esc(T.xpMax) : `${num(xpv.into)} / ${num(xpv.span)} ${esc(T.xpToLevel)} ${level + 1} (${pct}%)`}</span></div><div class="xpb2" role="img" title="${esc(T.xpTotal)}: ${num(xpv.total)}" aria-label="${esc(T.experience)} ${pct}%, ${esc(T.xpTotal)} ${num(xpv.total)}"><i style="width:${pct}%"></i></div><div class="xpt" data-stat="xp-total" data-testid="xp-total">${esc(T.xpTotal)}: ${num(xpv.total)}</div>`;
};
/** The HUD XP hover box (transparent, takes no pointer events): an image with a spoken label, not a focus stop. */
export const xpTipHtml = (xt, xr, fs) => `<div class="xptip" data-testid="hud-xp" role="img" title="${esc(T.xpTotal)}: ${num(xt.total)}" aria-label="${esc(T.experience)} ${xt.pct}%, ${esc(T.xpTotal)} ${num(xt.total)}" style="left:${(xr.x - 2).toFixed(1)}px;top:${(xr.y - fs - 8).toFixed(1)}px;width:${(xr.w + 4).toFixed(1)}px;height:${(xr.h + fs + 10).toFixed(1)}px"></div>`;
/** Tooltip bottom edge: above the HUD band and above a real (non-duplicate) toast, but never lower than ~130 px of room (R8-U2, F8). */
export const tipLimit = (hudTop, toastTop = null) => {
  let b = hudTop - 8;
  if (toastTop !== null) b = Math.min(b, toastTop - 8);
  return Math.max(b, Math.min(hudTop - 8, 130));
};
export function createPanels(root, game) {
  const doc = root.ownerDocument, core = () => game.core;
  root.innerHTML = `
    <div class="hudui" id="hudui" data-testid="hud-ui"></div>
    <div id="stack">
      <aside class="drawer" id="pleft" data-testid="drawer-left" aria-label="${esc(T.character)}"></aside>
      <aside class="drawer" id="pright" data-testid="drawer-inventory" aria-label="${esc(T.inventory)}"></aside>
    </div>
    <div class="tracker" id="tracker" data-testid="tracker" role="group" hidden><span class="tr-in"><span class="tr-l"></span><span class="tr-t" data-testid="tracker-text"></span></span></div>
    <div class="tip" id="tip" role="tooltip" hidden></div>
    <div class="ghost" id="ghost" hidden aria-hidden="true"></div>
    <div class="toast" id="toast" data-testid="toast" hidden></div>
    <div class="sr" id="live" role="status" aria-live="polite" data-testid="live"></div>`;
  const el = { hud: root.querySelector("#hudui"), left: root.querySelector("#pleft"), right: root.querySelector("#pright"), tip: root.querySelector("#tip"), ghost: root.querySelector("#ghost"), toast: root.querySelector("#toast"), tracker: root.querySelector("#tracker"), live: root.querySelector("#live") };
  const view = { cur: { x: 0, y: 0 }, hoverKey: null, hoverEl: null, last: { x: -999, y: -999 }, drag: null, grab: { gx: 0, gy: 0 }, sigs: { hud: "", left: "", right: "" }, stats: {}, preview: null, toastId: 0, toastTimer: 0, sellArm: null, sellTimer: 0, respecAsk: false };

  // ------------------------------------------------------------ lookups
  const cellPx = () => drawerLayout(game.w, game.h, game.options?.textScale).cell;
  const itemFor = (key) => {
    const c = core(), [kind, v] = key.split(":");
    if (!c) return null;
    switch (kind) {
      case "node": return nodeFor(c, v) ? { node: v } : null;
      case "inv": return c.inventory.items.find((i) => i.id === v) ?? null;
      case "eq": return c.equipment[v] ?? null;
      case "belt": return c.belt[Number(v)] ?? null;
      case "vendor": return c.vendor?.stock[Number(v)]?.item ?? null;
      case "stash": return c.stash.items.find((i) => i.id === v) ?? null;
      case "cursor": return c.cursorItem;
      default: return null;
    }
  };
  const unmetOf = (it) => it.kind === "gear" && describeItem(it, core().player).unmet;
  const itemLabel = (it) => `${it.name}, ${rarityName(it.rarity)}, ${it.w} by ${it.h} ${T.cells}${unmetOf(it) ? `, ${T.msgReqs.toLowerCase()}` : ""}`;

  // ------------------------------------------------------------ item markup
  const itemBox = (it, o = {}) => itemBoxHtml(it, { ...o, unmet: !!unmetOf(it) });
  const nameLine = nameLineHtml;
  const legend = () => `<ul class="legend" aria-label="${esc(T.rarityKey)}"><li class="lh">${esc(T.rarityKey)}</li>${["normal", "magic", "rare", "unique"].map((r) =>
    `<li class="l-${r}"><span class="swatch r-${r}"></span>${rarityMark(r, 14)}<span>${esc(rarityName(r))}</span></li>`).join("")}</ul>`;

  // ------------------------------------------------------------ Desk Drawer
  function renderInventory(c) {
    const p = c.player, held = c.cursorItem, origin = game.heldOrigin;
    let h = `<div class="ph"><span class="phi">${skillIcon("panel:drawer")}</span><h2>${esc(T.inventory)}</h2>${closeBtn("inventory", T.closeInventory)}</div><div class="pb"><div class="inv">${tabsHtml("inventory")}`;
    h += `<div class="dollrow"><div class="doll" role="group" aria-label="${esc(T.equipment)}">`;
    for (const k of Object.keys(DOLL)) {
      const d = DOLL[k], it = c.equipment[k], ghost = held && origin?.kind === "slot" && origin.k === k ? held : null;
      h += `<button class="slot${ghost ? " ghosted" : ""}" type="button" data-testid="slot-${k}" data-slot="${k}" data-fk="s.${k}" ${it ? `data-tip="eq:${esc(k)}"` : ""} style="grid-column:${d[0]}/span ${d[2]};grid-row:${d[1]}/span ${d[3]}" aria-label="${esc(SLOT_LABEL[k])}: ${it ? esc(itemLabel(it)) : T.empty}">${it ? itemBox(it, { fill: true }) : ghost ? itemBox(ghost, { fill: true, cls: "dim" }) : `<span class="lb">${esc(SLOT_LABEL[k])}</span>`}</button>`;
    }
    h += `</div><div class="side">${legend()}<div class="beltbox"><h4>${esc(T.belt)} <kbd>${esc(keyLabel(c.options?.keys?.belt1 ?? DEFAULT_KEYS.belt1))}</kbd>–<kbd>${esc(keyLabel(c.options?.keys?.belt4 ?? DEFAULT_KEYS.belt4))}</kbd></h4><div class="bgrid" role="group" aria-label="${esc(T.beltKeys)}">`;
    c.belt.forEach((it, i) => {
      const ghost = held && origin?.kind === "belt" && origin.i === i ? held : null;
      h += `<button class="bslot" type="button" data-testid="bslot-${i}" data-belt="${i}" data-fk="b.${i}" ${it ? `data-tip="belt:${Number(i)}"` : ""} aria-label="${esc(T.belt)} ${i + 1}: ${it ? esc(it.name) : T.empty}">${it ? itemBox(it, { fill: true }) : ghost ? itemBox(ghost, { fill: true, cls: "dim" }) : `<span class="lb">${i + 1}</span>`}</button>`;
    });
    h += `</div></div></div></div><p class="keyhint">${esc(T.dragHint)}</p>`; // R8-A1: the hint spans the drawer under the doll row (in the narrow side column it was four lines and made the row taller than the doll)
    // grid: 40 cell buttons under an absolutely positioned item layer
    h += `<div class="gridwrap"><div class="gi"><div class="grid" role="group" aria-label="${esc(T.inventoryGrid)}">`;
    for (let y = 0; y < c.inventory.h; y++) for (let x = 0; x < c.inventory.w; x++) {
      const it = itemAt(c.inventory, x, y), cur = view.cur.x === x && view.cur.y === y;
      h += `<button class="cell" type="button" data-testid="cell-${x}-${y}" data-x="${x}" data-y="${y}" data-fk="c.${x}.${y}" ${it ? `data-tip="inv:${esc(it.id)}"` : ""} tabindex="${cur ? 0 : -1}" aria-label="${T.cell} ${x + 1},${y + 1}: ${it ? esc(itemLabel(it)) : T.empty}"></button>`;
    }
    h += `</div><div class="items">${c.inventory.items.map((it) => itemBox(it, { pos: { x: it.x, y: it.y }, })).join("")}`;
    if (held && origin?.kind === "grid") h += itemBox(held, { pos: { x: origin.x, y: origin.y }, cls: "dim origin" });
    h += `</div></div></div>`;
    h += `<div class="footrow"><div class="gold" data-testid="gold">${coinIcon()}<span>${num(p.gold)} ${esc(T.gold)}</span></div>`;
    if (p.owed?.length) h += `<div class="owed" data-testid="inv-owed" role="status" title="${esc(T.owedTitle)}: ${esc(p.owed.map((i) => i.name).join(", "))}">${esc(owedLine(p.owed.length))}</div>`;
    h += `<div class="notice" data-notice>`;
    h += held ? `<span class="heldline">${esc(T.onCursor)}: ${nameLine(held)}</span><span class="reason" data-reason></span><button class="mini" type="button" data-act="putback" data-testid="put-back">${esc(T.putBack)}</button><button class="mini" type="button" data-act="dropfloor" data-testid="drop-floor">${esc(T.dropOnFloor)}</button>` : `<span class="touchhint" data-testid="touch-hint" title="${esc(T.touchHint)}">${esc(T.touchHint)}</span>`; // R11-09: the drag hint is hidden on a phone to save rows; this one line stays in the footer (CSS shows it on the phone only) so a touch user still learns the pick-up, put-down flow
    return h + `</div></div></div></div>`;
  }

  // ------------------------------------------------------------ Employee File
  const statRow = (key, label, value) => `<div class="d"><span>${esc(label)}</span><b data-stat="${key}">${value}</b></div>`;
  function renderCharacter(c) {
    const p = c.player, xpv = xpProgress(p), pct = xpv.pct, pts = p.attrPoints;
    let h = `<div class="ph"><span class="phi">${skillIcon("panel:file")}</span><h2>${esc(T.fileTitle)}</h2>${closeBtn("character", T.closeCharacter)}</div><div class="pb"><div class="sheet" data-testid="employee-file">${tabsHtml("character")}`;
    h += `<div class="fh"><div class="photo"><canvas width="120" height="144" data-bust="${esc(p.class)}" data-look="${esc(figures.look(c.equipment))}" aria-hidden="true"></canvas></div>`;
    h += `<div><h2 data-testid="file-name" title="${esc(p.name ?? "")}">${esc(p.name ?? "")}</h2><p data-testid="file-class" title="${esc(classById(p.class)?.name ?? "")}">${esc(classById(p.class)?.name ?? "")} · <span data-stat="level">${esc(T.level)} ${p.level}</span></p><p title="${esc(c.floor.name)}">${esc(c.floor.name)}</p></div><div class="stamp" aria-hidden="true">${esc(T.probation)}</div></div>`;
    h += xpFileHtml(xpv, p.level);
    h += `<section class="sc-attr"><h3>${esc(T.attributes)} <em>${esc(T.pointsToSpend)}: <b data-stat="attrPoints">${pts}</b></em></h3>`;
    for (const k of T.attrOrder) {
      const own = p.attrs[k], tot = p.attrsTotal?.[k] ?? own, bonus = tot - own, hint = attrHint(p.class, k);
      h += `<div class="attr"><div class="an" title="${esc(hint.tip)}"><b>${esc(T.statAttr[k])}</b><small>${esc(hint.text)}</small></div><div class="av"><span data-stat="${k}">${tot}</span>${bonus ? ` <small>(${own} +${bonus} ${esc(T.gearWord)})</small>` : ""}</div>`;
      h += `<button class="plus" type="button" data-testid="alloc-${k}" data-alloc="${k}" data-fk="p.${k}" ${pts < 1 ? "disabled" : ""} aria-label="${esc(T.addPoint)} ${esc(T.statAttr[k])}. ${pts} ${esc(T.left)}">+</button></div>`;
    }
    h += `<p class="apv" data-testid="alloc-preview">${esc(pts ? T.previewHint : T.previewNone)}</p></section>`;
    const blocked = unmetGear(c);
    h += `<section class="sc-blk"><h3>${esc(T.unusable)}</h3>${blocked.length ? `<ul class="blocked" data-testid="unmet-list">${blocked.map(({ item, missing }) => `<li>${nameLine(item)}: ${esc(T.needsWord)} ${missing.map((m) => `${esc(m.text)} (${m.need - m.have} ${esc(T.moreWord)})`).join(", ")}</li>`).join("")}</ul>` : `<p class="blocked">${esc(T.unusableNone)}</p>`}</section>`;
    h += `<section class="sc-der"><h3>${esc(T.derived)}</h3><div class="dstats">`;
    h += statRow("hp", T.statHealth, `${p.hp} / ${p.hpMax}`) + statRow("mp", T.statMana, `${p.mp} / ${p.mpMax}`);
    h += statRow("damage", T.statDamage, `${p.damage.min}–${p.damage.max}`) + statRow("defense", T.statDefense, p.defense);
    h += statRow("attackRating", T.statAttackRating, p.attackRating) + statRow("skillPoints", T.statSkillPoints, p.skillPoints);
    for (const [k, label] of RESISTS) h += statRow(`resist.${k}`, label, p.resist?.[k] ?? 0);
    h += statRow("gold", T.statGold, num(p.gold));
    return h + `</div></section></div></div>`;
  }

  // ------------------------------------------------------------ Skills (the class tree, ui/tree.js)
  const renderSkills = (c) => renderTree(c, { confirmRespec: view.respecAsk }).replace("@TABS@", tabsHtml("skills"));

  // ------------------------------------------------------------ NPC windows
  const rowItem = (it, tipKey, right) => rowItemHtml(it, tipKey, right, describeItem(it, core().player).main[0]?.text ?? "");
  function renderNpc(c) {
    const d = c.ui.dialog;
    if (!d) return "";
    let h = `<div class="ph"><span class="phi">${skillIcon("panel:talk")}</span><h2>${esc(S[d.nameKey] ?? "")}</h2>${closeBtn("npc", T.closeWindow)}</div><div class="pb"><div class="npc" data-testid="npc-window" data-kind="${esc(d.kind)}">${tabsHtml("npc")}`;
    h += `<p class="say">“${esc(d.lines.map((k) => S[k] ?? "").join(" "))}”</p><div class="gold" data-testid="npc-gold">${coinIcon()}<span>${num(c.player.gold)} ${esc(T.gold)}</span></div>`;
    if (c.quests) h += questDialogHtml(questDialogModel(questView(c), d.npc), c.player.owed?.length ?? 0);
    if (d.kind === "vendor" && c.vendor) {
      const tab = game.ui.vendorTab;
      h += `<div class="vtabs" role="tablist"><button type="button" role="tab" data-testid="tab-buy" data-vtab="buy" aria-selected="${tab === "buy"}" class="${tab === "buy" ? "on" : ""}">${esc(T.buyTab)}</button><button type="button" role="tab" data-testid="tab-sell" data-vtab="sell" aria-selected="${tab === "sell"}" class="${tab === "sell" ? "on" : ""}">${esc(T.sellTab)}</button></div>`;
      if (tab === "buy") {
        h += `<ul class="rows" data-testid="vendor-stock">${c.vendor.stock.map((e, i) => rowItem(e.item, `vendor:${i}`, `<span class="rprice">${coinIcon()} ${e.price}</span><button class="rbtn" type="button" data-testid="buy-${i}" data-buy="${i}" data-fk="by.${i}" ${c.player.gold < e.price ? "disabled" : ""} aria-label="${esc(T.buy)} ${esc(e.item.name)}, ${e.price} ${esc(T.gold)}">${esc(T.buy)}</button>`)).join("") || `<li class="empty">${esc(T.stockEmpty)}</li>`}</ul>`;
      } else {
        h += `<ul class="rows" data-testid="vendor-sell">${c.inventory.items.map((it) => rowItem(it, `inv:${it.id}`, `<span class="rprice">${coinIcon()} ${sellValue(it)}</span><button class="rbtn${view.sellArm === it.id ? " arm" : ""}" type="button" data-testid="sell-${esc(it.id)}" data-sell="${esc(it.id)}" data-fk="se.${esc(it.id)}" aria-label="${esc(view.sellArm === it.id ? T.sellSure : T.sell)} ${esc(it.name)}, ${sellValue(it)} ${esc(T.gold)}">${esc(view.sellArm === it.id ? T.sellSure : T.sell)}</button>`)).join("") || `<li class="empty">${esc(T.nothingToSell)}</li>`}</ul>`;
      }
    } else if (d.kind === "healer") {
      const hurt = c.player.hp < c.player.hpMax;
      h += `<button class="heal" type="button" data-testid="heal" data-act="heal" data-fk="heal" ${hurt ? "" : "disabled"}>${esc(T.heal)}</button><p class="sk-note">${esc(hurt ? `${c.player.hp} / ${c.player.hpMax}` : T.alreadyHealthy)}</p>`;
    } else if (d.kind === "stash") {
      h += `<h3>${esc(T.inLocker)}</h3><ul class="rows" data-testid="stash-items">${c.stash.items.map((it) => rowItem(it, `stash:${it.id}`, `<button class="rbtn" type="button" data-testid="stash-take-${esc(it.id)}" data-stash="${esc(it.id)}" data-to="inventory" data-fk="st.${esc(it.id)}" aria-label="${esc(T.stashTake)} ${esc(it.name)}">${esc(T.stashTake)}</button>`)).join("") || `<li class="empty">${esc(T.lockerEmpty)}</li>`}</ul>`;
      h += `<h3>${esc(T.yourDrawer)}</h3><ul class="rows">${c.inventory.items.map((it) => rowItem(it, `inv:${it.id}`, `<button class="rbtn" type="button" data-testid="stash-put-${esc(it.id)}" data-stash="${esc(it.id)}" data-to="stash" data-fk="sp.${esc(it.id)}" aria-label="${esc(T.stashPut)} ${esc(it.name)}">${esc(T.stashPut)}</button>`)).join("") || `<li class="empty">${esc(T.nothingToSell)}</li>`}</ul>`;
    }
    return h + `</div></div>`;
  }

  const closeBtn = (name, label) => `<button class="xbtn" type="button" data-close="${name}" data-testid="close-${name}" aria-label="${esc(label)}">×</button>`;
  // Gear / File / Skills tabs exist on the phone only (G2 #15, intentional): on desktop Gear sits in the right drawer and File / Skills in the left one,
  // both can be open side by side, so every panel is one click or key away without tabs; on the phone a single drawer fills the screen, so tabs switch it.
  function tabsHtml(active) { // phone: one panel at a time, tabs switch (Gear / Employee File / Skills / talk)
    const D = drawerLayout(game.w, game.h, game.options?.textScale);
    if (!D.phone) return "";
    const tabs = [["inventory", T.tabGear], ["character", T.tabFile], ["skills", T.tabSkills]];
    if (core().ui.dialog) tabs.push(["npc", T.tabNpc]);
    return `<div class="tabs" role="tablist" aria-label="${esc(T.panelTabs)}">${tabs.map(([k, label]) => `<button type="button" role="tab" class="tab${k === active ? " on" : ""}" data-open="${k}" data-testid="tab-${k}" aria-selected="${k === active}">${esc(label)}</button>`).join("")}</div>`;
  }

  // ------------------------------------------------------------ HUD slot layer + panel buttons
  function renderHud(c) {
    const L = hudLayout(game.w, game.h), s = L.scale, p = c.player, bar = p.skillBar, panels = game.panels();
    const fs = Math.max(10, Math.round(9.5 * s)), ctl = (r) => `left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px;--fs:${fs}px`;
    const kl = (a) => keyLabel(c.options?.keys?.[a] ?? DEFAULT_KEYS[a]); // the key badges follow the bindings in Options
    let h = `<div class="hgroup" role="group" aria-label="${esc(T.skillBar)}">`;
    for (let i = 0; i < 4; i++) {
      const id = bar.hotkeys[i], def = id ? content.skills[id] : null, lvl = id === "strike" ? 1 : id ? p.skills[id] ?? 0 : 0, cost = def?.mana ? def.mana(Math.max(1, lvl)) : 0;
      const dis = !!def && (lvl < 1 || p.mp < cost), sel = bar.selected === i;
      const label = def ? `${kl(`skill${i + 1}`)}: ${def.name}${cost ? `, ${T.manaCost} ${cost}` : ""}${sel ? `, ${T.selectedSkill}` : ""}${dis ? `, ${T.notEnoughMana}` : ""}` : `${kl(`skill${i + 1}`)}: ${T.slotEmpty}`;
      h += `<button class="sk${sel ? " on" : ""}${dis ? " dis" : ""}${def ? "" : " none"}" type="button" data-testid="hud-skill-${i}" data-skill-slot="${i}" data-fk="h.s.${i}" aria-pressed="${sel}" aria-disabled="${dis}" style="${ctl(L.skills[i])}" aria-label="${esc(label)}" title="${esc(def ? def.name : T.slotEmpty)}"><span class="kb">${esc(kl(`skill${i + 1}`))}</span>${def ? skillIcon(id) : ""}${sel ? '<span class="sel" aria-hidden="true"></span>' : ""}</button>`;
      if (def && L.showNames) h += `<span class="sn" aria-hidden="true" style="left:${(L.skills[i].x - 3).toFixed(1)}px;top:${(L.skills[i].y + L.skills[i].h).toFixed(1)}px;width:${(L.skills[i].w + 6).toFixed(1)}px;--fs:${fs}px">${esc(def.name)}</span>`;
    }
    h += `</div><div class="hgroup" role="group" aria-label="${esc(T.beltKeys)}">`;
    for (let i = 0; i < 4; i++) {
      const it = c.belt[i];
      h += `<button class="hb${it ? "" : " none"}" type="button" data-testid="hud-belt-${i}" data-use-belt="${i}" data-fk="h.b.${i}" ${it ? `data-tip="belt:${Number(i)}"` : ""} style="${ctl(L.belt[i])}" aria-label="${it ? `${esc(kl(`belt${i + 1}`))}: ${esc(T.drink)} ${esc(it.name)}` : `${esc(kl(`belt${i + 1}`))}: ${esc(T.beltEmpty)}`}"><span class="kb">${esc(kl(`belt${i + 1}`))}</span>${it ? itemIcon(it) : ""}</button>`;
    }
    h += `</div>`;
    const xr = L.xp, xt = xpProgress(p);
    h += xpTipHtml(xt, xr, fs);
    const badge = (n, what) => (n > 0 ? `<span class="bdg" aria-label="${n} ${esc(what)}">${n > 99 ? "99+" : n}</span>` : ""); // VFIX-R7 U1: "99+" keeps the phone dock inside the screen; the label keeps the real count
    h += `<div class="dock" role="group" aria-label="${esc(T.toggleLabel)}">`;
    const ow = p.owed?.length ?? 0; // R8-Q1: reward items waiting for bag room
    h += `<button class="hbtn" type="button" data-testid="dock-inventory" data-fk="h.d.i" data-open="inventory" aria-pressed="${panels.inventory}"><span>${esc(T.openInventory)}</span><kbd>${esc(kl("inventory"))}</kbd>${ow ? `<span class="bdg" data-testid="inv-badge" aria-label="${ow} ${esc(T.owedBadge)}">${ow}</span>` : ""}</button>`;
    h += `<button class="hbtn" type="button" data-testid="dock-character" data-fk="h.d.c" data-open="character" aria-pressed="${panels.character}"><span>${esc(T.openCharacter)}</span><kbd>${esc(kl("character"))}</kbd>${badge(p.attrPoints, T.attrPointsBadge)}</button>`;
    h += `<button class="hbtn" type="button" data-testid="dock-skills" data-fk="h.d.s" data-open="skills" aria-pressed="${panels.skills}"><span>${esc(T.openSkills)}</span><kbd>${esc(kl("skills"))}</kbd>${badge(p.skillPoints, T.skillPointsBadge)}</button>`;
    h += `<button class="hbtn" type="button" data-testid="dock-map" data-fk="h.d.m" data-open="map" aria-pressed="${panels.map}"><span>${esc(T.openMap)}</span><kbd>${esc(kl("map"))}</kbd></button>`;
    const jb = game.ui.badge?.journal;
    h += `<button class="hbtn" type="button" data-testid="dock-journal" data-fk="h.d.j" data-open="journal" aria-pressed="${panels.journal}"><span>${esc(T.openJournal)}</span><kbd>${esc(kl("journal"))}</kbd>${jb ? `<span class="bdg" data-testid="journal-badge" aria-label="${esc(T.journalNew)}">!</span>` : ""}</button></div>`;
    return h;
  }

  // ------------------------------------------------------------ rendering driver
  // ADV-R6-04: a disabled or vanished target (a Learn button that just maxed out or ran out of points, Respec after a respec) hands focus to the node's own button, else the panel's close button
  const restoreFocus = (fk, scope = root) => {
    if (!fk) return;
    const find = (k) => scope.querySelector(`[data-fk="${CSS.escape(k)}"]`);
    let t = find(fk);
    if (!t || t.disabled) t = (fk.startsWith("l.") ? find("n." + fk.slice(2)) : null) ?? (fk.startsWith("q.") ? scope.querySelector(".nq button") : null) ?? (t?.closest?.(".drawer") ?? scope).querySelector?.("[data-close]") ?? null;
    t?.focus({ preventScroll: true });
  };
  function renderInto(node, html) {
    const fk = root.contains(doc.activeElement) && node.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    const body = node.querySelector(".pb"), top = body ? body.scrollTop : 0;
    node.innerHTML = html;
    if (drawerLayout(game.w, game.h, game.options?.textScale).short) { // FIX-R8T-3 L-1: title and tabs share one row on a short landscape phone (the tabs move into the header, before the close button)
      const ph = node.querySelector(".ph"), tabs = node.querySelector(".pb .tabs"), x = ph?.querySelector(".xbtn");
      if (ph && tabs && x) ph.insertBefore(tabs, x);
    }
    const nb = node.querySelector(".pb");
    if (nb) nb.scrollTop = top;
    restoreFocus(fk, node);
  }
  function flashChanged() {
    const nodes = root.querySelectorAll("#pleft [data-stat]");
    for (const n of nodes) {
      const k = n.dataset.stat, v = n.textContent;
      if (view.stats[k] !== undefined && view.stats[k] !== v) { n.classList.add("flash"); }
      view.stats[k] = v;
    }
  }
  const sigOf = (...v) => JSON.stringify(v);
  function sync() {
    const c = core(), menu = game.menu(), D = drawerLayout(game.w, game.h, game.options?.textScale);
    root.hidden = !c;
    root.toggleAttribute("inert", !!menu);
    if (!c) { view.sigs = { hud: "", left: "", right: "" }; hideTip(); return; }
    const st = root.style;
    st.setProperty("--top", D.top + "px"); st.setProperty("--bottom", D.bottom + "px"); st.setProperty("--lw", D.leftW + "px"); st.setProperty("--rw", D.rightW + "px"); st.setProperty("--cw", D.cell + "px");
    st.setProperty("--hudtop", Math.floor(D.hudTop) + "px");
    root.classList.toggle("phone", D.phone);
    root.classList.toggle("short", !!D.short); // FIX-R8T-3 L-1: short landscape phone
    root.classList.toggle("scene-dead", c.scene === "dead"); // R8-T N2: the dock goes away behind the death screen
    const u = game.ui, p = c.player, held = c.cursorItem;
    const leftOpen = !!u.left, rightOpen = u.inventory;
    { // ADV-R7-04: the dock button that had focus when a drawer opened; on the phone the dock is hidden while a drawer is open, so the re-render drops focus to <body> and the opener must be remembered here
      const a = doc.activeElement;
      if (a && a !== doc.body && el.hud.contains(a) && a.dataset?.fk) view.hudFk = a.dataset.fk;
      else if (a && a !== doc.body && !el.left.contains(a) && !el.right.contains(a)) view.hudFk = null;
    }
    if (view.respecAsk && (u.left !== "skills" || c.scene !== "town")) view.respecAsk = false; // the confirmation never outlives the panel or the Lobby
    root.classList.toggle("map-open", !!u.map); // N16: on the phone the full map keeps only its own dock button, so the map title (a canvas band at the top) is not covered
    root.classList.toggle("open-left", leftOpen); root.classList.toggle("open-right", rightOpen);
    root.classList.toggle("short-panel", !!D.short && (leftOpen || rightOpen)); // the hotbar, belt and orbs' buttons hide under the full-height panel
    const frontLeft = leftOpen && (u.front === "left" || !rightOpen);
    root.classList.toggle("front-left", frontLeft); root.classList.toggle("front-right", rightOpen && !frontLeft);
    el.left.classList.toggle("open", leftOpen); el.right.classList.toggle("open", rightOpen);
    el.left.dataset.panel = u.left ?? ""; el.right.dataset.panel = "inventory";
    el.left.setAttribute("aria-label", u.left === "journal" ? T.journalTitle : u.left === "skills" ? T.skills : u.left === "npc" ? (S[c.ui.dialog?.nameKey] ?? "") : T.character);

    const hudSig = sigOf(game.w, game.h, c.options?.keys, p.skillBar.hotkeys, p.skillBar.selected, p.skills, p.mp >= 0 && p.skillBar.hotkeys.map((id) => (id && content.skills[id]?.mana ? p.mp < content.skills[id].mana(Math.max(1, id === "strike" ? 1 : p.skills[id] ?? 0)) : 0)), c.belt.map((b) => b?.id ?? 0), p.attrPoints, p.skillPoints, u.inventory, u.left, u.map, p.xp, p.level, !!u.badge?.journal, p.owed?.length ?? 0);
    if (hudSig !== view.sigs.hud) { view.sigs.hud = hudSig; renderInto(el.hud, renderHud(c)); }

    const base = [game.w, game.h, c.options?.keys, u.front, held?.id ?? 0, game.heldOrigin, !!view.drag, p.level, p.xp, p.xpNext, p.attrs, p.attrsTotal, p.attrPoints, p.skillPoints, p.hp, p.hpMax, p.mp, p.mpMax, p.gold, p.damage, p.defense, p.attackRating, p.resist, p.skills, p.skillBar.hotkeys, p.aura, p.name, p.class, c.depth, c.scene, c.player.respecsUsed,
      c.inventory.items.map((i) => [i.id, i.x, i.y]), p.owed?.length ?? 0, Object.values(c.equipment).map((i) => i?.id ?? 0), c.belt.map((b) => b?.id ?? 0), c.floor.name];
    if (rightOpen) { const sg = sigOf(base); if (sg !== view.sigs.right) { view.sigs.right = sg; renderInto(el.right, renderInventory(c)); } } else view.sigs.right = "";
    if (leftOpen) {
      const sg = sigOf(base, u.left, u.vendorTab, view.sellArm, view.respecAsk, c.ui.dialog, c.vendor && [c.vendor.id, c.vendor.stock.map((e) => e.item.id)], c.stash.items.map((i) => i.id), (u.left === "journal" || u.left === "npc") && [c.quests, c.player.pouch, c.player.owed, c.scene]);
      if (sg !== view.sigs.left) {
        view.sigs.left = sg;
        renderInto(el.left, u.left === "skills" ? renderSkills(c) : u.left === "npc" ? renderNpc(c) : u.left === "journal" ? renderJournal(c) : renderCharacter(c));
        if (u.left === "character") { flashChanged(); for (const cv of el.left.querySelectorAll("canvas[data-bust]")) { try { paintBust(cv, cv.dataset.bust, cv.dataset.look); } catch { /* decoration */ } } }
        if (view.preview && u.left === "character") showPreview(view.preview);
      }
    } else { view.sigs.left = ""; view.stats = {}; }
    syncJournalFocus(leftOpen && u.left === "journal");
    if ((leftOpen || rightOpen) !== !!view.drawerWas) { // all drawers closed: focus goes back to the opener, not <body> (phone: the dock is visible again only now)
      view.drawerWas = leftOpen || rightOpen;
      if (!view.drawerWas && view.hudFk && (!doc.activeElement || doc.activeElement === doc.body || el.left.contains(doc.activeElement) || el.right.contains(doc.activeElement)) && !menu) {
        const t = el.hud.querySelector(`[data-fk="${CSS.escape(view.hudFk)}"]`);
        if (t && !t.disabled) t.focus({ preventScroll: true });
      }
    }
    syncNpcFocus(leftOpen && u.left === "npc" && !!c.ui.dialog);
    syncTracker(c, D, leftOpen, rightOpen, menu);
    syncGhost();
    syncToast(); layoutToast(D); syncToastDup();
    if (view.hoverKey && !itemFor(view.hoverKey)) hideTip(); // the item under the cursor was equipped, used, sold or dropped
    else if (!leftOpen && !rightOpen && !view.hoverEl?.closest?.("#hudui")) hideTip();
  }

  // ------------------------------------------------------------ journal (R7) and tracker
  const renderJournal = (c) => journalHtml(journalModel(c.quests ? questView(c) : null, c.player.pouch ?? [], c.scene), closeBtn);
  /** Opening the journal puts focus on its first quest; closing it gives focus back to what had it before (AC-R-244-2). */
  function syncJournalFocus(open) {
    if (open && !view.jOpen) {
      view.jOpen = true; const a = doc.activeElement; view.jPrev = a && a !== doc.body && !el.left.contains(a) ? (a.dataset?.fk ? { fk: a.dataset.fk } : a) : null; // the HUD is redrawn when a panel opens: remember a re-rendered button by its focus key
      el.left.querySelector('[data-fk="j.q.0"]')?.focus({ preventScroll: true });
    } else if (!open && view.jOpen) {
      view.jOpen = false; const p = view.jPrev; view.jPrev = null;
      const t = p?.fk ? root.querySelector(`[data-fk="${CSS.escape(p.fk)}"]`) : p;
      if (t?.isConnected && !t.disabled && !game.menu()) t.focus({ preventScroll: true });
    }
  }
  /** An NPC window with a quest puts focus on its first quest button (else the close button); the window is a labelled region and Escape closes it (core). */
  function syncNpcFocus(open) {
    if (open && !view.nOpen) {
      view.nOpen = true;
      const a = doc.activeElement;
      if (!a || a === doc.body || !el.left.contains(a)) (el.left.querySelector(".nq button") ?? el.left.querySelector("[data-close=npc]"))?.focus({ preventScroll: true });
    } else if (!open) view.nOpen = false;
  }
  /** One line for the pinned quest. It sits between the drawers and the dock, so it never covers a panel control. */
  function syncTracker(c, D, leftOpen, rightOpen, menu) {
    const t = el.tracker, tr = c.quests ? trackerOf(questView(c)) : null;
    t.hidden = !tr || !!menu || c.scene === "dead" || (D.phone ? leftOpen || rightOpen || !!game.ui.map : leftOpen); // VFIX-R7 U2: no pill over an open left panel; on the phone also not over the floor map's title (it covered the Skills assign buttons)
    if (!tr) return;
    const s = hudLayout(game.w, game.h).scale;
    if (D.phone) { // R11 visual M-1: the dock wraps to a second row when its five buttons do not fit (360 px with the badges); the pill sits under the real bottom of the dock instead of a fixed 54 px, so it never covers the wrapped Journal button
      const dk = el.hud.querySelector(".dock"), ts = Number.parseFloat(getComputedStyle(root).getPropertyValue("--ts")) || 1, bottom = dk && dk.getClientRects().length ? dk.getBoundingClientRect().bottom : 50;
      t.style.left = "6px"; t.style.right = "6px"; t.style.top = Math.ceil((bottom + 4) / ts) + "px";
    }
    else {
      t.style.left = (leftOpen ? D.leftW + 8 : Math.round(12 * s)) + "px";
      t.style.right = ((rightOpen ? D.rightW + 8 : 8) + 140) + "px";
      t.style.top = Math.round(170 * s) + "px";
    }
    const label = `${T.trackerLabel}: ${tr.title}`, text = tr.text;
    if (t.dataset.sig === label + "|" + text) return;
    t.dataset.sig = label + "|" + text; t.dataset.quest = tr.id; t.dataset.line = `${tr.title}: ${text}`;
    t.querySelector(".tr-l").textContent = tr.title; t.querySelector(".tr-t").textContent = text;
    t.title = `${tr.title}: ${text}`; t.setAttribute("aria-label", `${label}. ${text}`);
  }

  // ------------------------------------------------------------ toast + live region
  /** VFIX-R7 U3/U4: the toast sits just above the HUD (never over the potion belt) and, on the desktop, in the free gap between the open drawers (never over a panel). */
  function layoutToast(D) {
    const w = game.w, L = D.phone ? 0 : (game.ui.left ? D.leftW : 0), R = D.phone ? 0 : (game.ui.inventory ? D.rightW : 0);
    const free = Math.max(200, w - L - R), cx = L + (w - L - R) / 2;
    const st = el.toast.style;
    const stripToast = D.short && (game.ui.left || game.ui.inventory); // a short phone with a panel open: the toast sits in the strip under the panel
    st.setProperty("--tb", stripToast ? "1px" : Math.max(0, game.h - Math.floor(D.hudTop) + (D.phone ? 4 : 8)) + "px");
    st.setProperty("--tw", (D.phone ? Math.round(w * 0.96) : Math.round(Math.min(560, free - 24))) + "px");
    st.left = ((cx / w) * 100).toFixed(2) + "%";
  }
  /** VFIX-R7 U5: one sentence shows once. A toast that repeats the tracker pill, is hidden (it stays in the live region). */
  function syncToastDup() {
    const tx = el.toast.textContent;
    const pill = !el.tracker.hidden && el.tracker.dataset.line === tx;
    el.toast.classList.toggle("dup", !el.toast.hidden && pill);
  }
  function syncToast() {
    const t = game.ui.toast;
    if (!t || t === view.toastObj) return; // by identity: game.toast restarts its ids at 1 after the timer cleared the last one, which could equal the id shown before
    view.toastObj = t; view.toastId = t.id;
    el.toast.textContent = t.text; el.toast.title = t.text; el.toast.hidden = false;
    el.live.textContent = ""; el.live.textContent = t.text;
    syncToastDup(); // before the re-placement below: tipBottom reads the toast's dup class
    if (view.hoverKey && view.hoverEl?.isConnected && !el.tip.hidden) { layoutToast(drawerLayout(game.w, game.h, game.options?.textScale)); showTip(view.hoverKey, view.hoverEl); } // R8-U2: a tip that is already open moves out from under the new toast
    clearTimeout(view.toastTimer);
    view.toastTimer = setTimeout(() => { el.toast.hidden = true; if (game.ui.toast?.id === t.id) game.ui.toast = null; }, t.ms ?? 3200);
  }

  // ------------------------------------------------------------ tooltip
  const heroRect = () => {
    const cam = game.camera();
    if (!cam) return { x: -9, y: -9, w: 0, h: 0 };
    const z = cam.z, cx = game.w / 2 + (game.inset || 0), cy = game.h / 2 + 12 * z;
    return { x: cx - 26 * z, y: cy - 62 * z, w: 52 * z, h: 74 * z };
  };
  /** R8-U2: the tooltip ends above a visible toast (its measured box, not a guess), so a toast never covers the lower half of a tip. */
  const tipBottom = (D) => {
    let top = null;
    if (!el.toast.hidden && !el.toast.classList.contains("dup")) { const r = el.toast.getBoundingClientRect(); if (r.height) top = r.top; }
    return tipLimit(D.hudTop, top);
  };
  const rectOf = (n) => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  function tipHtml(d, cmp, extra) {
    let h = `<div class="tn l-${esc(d.rarity)}">${rarityMark(d.rarity, 15)}<span>${esc(d.name)}</span></div><div class="tk">${esc(d.rarityName)} · ${esc(d.base)} · ${esc(d.size)} ${esc(T.cells)}</div>`;
    for (const m of d.main) h += `<div class="tb">${esc(m.text)}</div>`;
    for (const a of d.affixes) h += `<div class="ta l-${esc(d.rarity)}">${esc(a.text)}</div>`;
    if (d.twoHanded) h += `<div class="tk">${esc(T.twoHanded)}</div>`;
    if (d.reqs.length) h += `<div class="tr">${d.reqs.map((r) => `<span class="${r.ok ? "yes" : "no"}">${r.ok ? "✓" : "✗"} ${esc(r.detail)}</span>`).join("")}</div>`;
    if (d.flavour) h += `<div class="tf">“${esc(d.flavour)}”</div>`;
    if (extra) h += `<div class="tv">${esc(extra)}</div>`;
    if (cmp) {
      h += `<div class="cmp"><h4>${esc(T.compareTitle)}</h4>`;
      h += cmp.equipped ? `<div class="cn l-${esc(cmp.equipped.rarity)}">${rarityMark(cmp.equipped.rarity, 13)}<span>${esc(cmp.equipped.name)}</span></div>` : `<div class="cn">${esc(T.nothingEquipped)}</div>`;
      h += `<div class="dl">${cmp.deltas.map((x) => `<div class="df ${x.delta > 0 ? "up" : "dn"}">${arrow(x.delta > 0)}<span>${x.delta > 0 ? "+" : "−"}${Math.abs(x.delta)} ${esc(x.label)}</span></div>`).join("")}</div>`;
      h += `<div class="vd ${esc(cmp.verdict)}">${esc(cmp.verdictText)}</div>${d.unmet ? `<div class="vd dn">${esc(T.cannotEquipYet)}</div>` : ""}</div>`;
    }
    return h;
  }
  function showTip(key, anchor) {
    const c = core();
    if (!c || c.cursorItem) return hideTip();
    const it = itemFor(key);
    if (!it) return hideTip();
    const kind = key.split(":")[0];
    if (kind === "node") return showNodeTip(key.slice(5), anchor);
    const d = describeItem(it, c.player);
    const cmp = kind === "inv" || kind === "vendor" || kind === "stash" ? compareToEquipped(c, it) : null;
    const price = kind === "vendor" ? `${T.price}: ${buyPrice(it)} ${T.gold}` : `${T.sellsFor} ${sellValue(it)} ${T.gold}`;
    el.tip.className = `tip r-${String(it.rarity).replace(/[^a-z-]/g, "")}`;
    el.tip.innerHTML = tipHtml(d, cmp, price);
    el.tip.hidden = false;
    el.tip.style.left = "0px"; el.tip.style.top = "0px"; el.tip.style.maxHeight = "";
    // the tip follows the text size through CSS zoom: measure in viewport px and convert back for left/top/max-height
    const ts = parseFloat(document.documentElement.style.getPropertyValue("--ts")) || 1, tr = el.tip.getBoundingClientRect();
    const D = drawerLayout(game.w, game.h, game.options?.textScale), w = Math.round(tr.width), h = Math.round(tr.height);
    const panelNode = anchor.closest(".drawer"), itemNode = kind === "inv" && anchor.matches(".cell") ? root.querySelector(`.item[data-item="${CSS.escape(it.id)}"]`) : null, anchorRect = rectOf(itemNode ?? anchor);
    const drawers = [el.left, el.right].filter((n) => n.classList.contains("open")).map(rectOf);
    let pos;
    if (D.phone) {
      const y = Math.min(Math.max(8, anchorRect.y + anchorRect.h + 6), Math.max(8, D.bottom - h));
      pos = { x: 8, y, h };
      el.tip.style.right = "8px"; el.tip.style.width = "auto";
    } else {
      el.tip.style.right = ""; el.tip.style.width = "";
      pos = placeTip({ w, h, anchor: anchorRect, panel: panelNode ? rectOf(panelNode) : null, side: panelNode === el.left ? "left" : "right", drawers, hero: heroRect(), bounds: { left: 8, top: 8, right: game.w - 8, bottom: tipBottom(D) }, keepClear: [...root.querySelectorAll(".plus,.dock .hbtn")].map(rectOf) });
    }
    el.tip.style.left = pos.x / ts + "px"; el.tip.style.top = pos.y / ts + "px";
    el.tip.style.maxHeight = Math.max(80, D.hudTop - 16) / ts + "px";
    el.tip.style.overflowY = "auto";
    view.hoverKey = key;
    game.ui.tooltip = { key, ...d, compare: cmp, rect: { x: pos.x, y: pos.y, w, h: pos.h } };
  }
  function showNodeTip(id, anchor) {
    const c = core(), n = c && nodeFor(c, id);
    if (!n) return hideTip();
    el.tip.className = "tip node";
    el.tip.innerHTML = nodeTipHtml(n);
    el.tip.hidden = false;
    el.tip.style.left = "0px"; el.tip.style.top = "0px"; el.tip.style.maxHeight = "";
    const ts = parseFloat(document.documentElement.style.getPropertyValue("--ts")) || 1, tr = el.tip.getBoundingClientRect();
    const D = drawerLayout(game.w, game.h, game.options?.textScale), w = Math.round(tr.width), h = Math.round(tr.height), anchorRect = rectOf(anchor), panelNode = anchor.closest(".drawer");
    let pos;
    if (D.phone) { pos = { x: 8, y: Math.min(Math.max(8, anchorRect.y + anchorRect.h + 6), Math.max(8, D.bottom - h)), h }; el.tip.style.right = "8px"; el.tip.style.width = "auto"; }
    else {
      el.tip.style.right = ""; el.tip.style.width = "";
      pos = placeTip({ w, h, anchor: anchorRect, panel: panelNode ? rectOf(panelNode) : null, side: "left", drawers: [el.left, el.right].filter((x) => x.classList.contains("open")).map(rectOf), hero: heroRect(), bounds: { left: 8, top: 8, right: game.w - 8, bottom: tipBottom(D) }, keepClear: [...root.querySelectorAll(".dock .hbtn")].map(rectOf) });
    }
    el.tip.style.left = pos.x / ts + "px"; el.tip.style.top = pos.y / ts + "px"; el.tip.style.maxHeight = Math.max(80, D.hudTop - 16) / ts + "px"; el.tip.style.overflowY = "auto";
    view.hoverKey = `node:${id}`;
    game.ui.tooltip = { key: `node:${id}`, name: n.name, kind: n.kind, level: n.level, maxLevel: n.maxLevel, now: n.now, next: n.next, lockReason: n.lockReason, rect: { x: pos.x, y: pos.y, w, h: pos.h } };
  }
  function hideTip() { el.tip.hidden = true; view.hoverKey = null; if (game.ui.tooltip) game.ui.tooltip = null; }

  // ------------------------------------------------------------ allocate preview
  function showPreview(attr) {
    const n = root.querySelector(".apv");
    if (!n || !core()) return;
    view.preview = attr;
    const pv = allocPreview(core(), attr), parts = pv.deltas.map((d) => `${d.delta > 0 ? "+" : "−"}${Math.abs(d.delta)} ${statLabel(d.key)}`);
    n.textContent = `${T.statAttr[attr]} ${core().player.attrs[attr]} → ${core().player.attrs[attr] + 1}: ${parts.join(", ") || T.sameStats}${pv.unlocks.length ? `. ${T.unlocks}: ${pv.unlocks.join(", ")}` : ""}`;
  }
  function clearPreview() { view.preview = null; const n = root.querySelector(".apv"); if (n && core()) n.textContent = core().player.attrPoints ? T.previewHint : T.previewNone; }

  // ------------------------------------------------------------ held item: ghost, drag, drop
  const targetOf = (node) => {
    const cell = node?.closest?.(".cell"), slot = node?.closest?.(".slot"), belt = node?.closest?.(".bslot");
    if (cell) return { t: "grid", x: Number(cell.dataset.x) - view.grab.gx, y: Number(cell.dataset.y) - view.grab.gy, cx: Number(cell.dataset.x), cy: Number(cell.dataset.y), node: cell };
    if (slot) return { t: "slot", k: slot.dataset.slot, node: slot };
    if (belt) return { t: "belt", i: Number(belt.dataset.belt), node: belt };
    return null;
  };
  const clearPreviewMarks = () => {
    root.querySelectorAll(".slot.ok,.slot.bad,.bslot.ok,.bslot.bad").forEach((n) => n.classList.remove("ok", "bad"));
    root.querySelectorAll(".pv").forEach((n) => n.remove());
  };
  function showDropPreview(target) {
    clearPreviewMarks();
    const c = core(), held = c?.cursorItem, note = root.querySelector("[data-reason]");
    if (!held || !target) return;
    const chk = dropCheck(c, held, target);
    if (target.t === "grid") {
      const layer = root.querySelector(".items");
      if (layer) layer.insertAdjacentHTML("beforeend", `<span class="pv${chk.ok ? "" : " bad"}" style="--x:${Math.max(0, Math.min(target.x, c.inventory.w - 1))};--y:${Math.max(0, Math.min(target.y, c.inventory.h - 1))};--w:${held.w};--h:${held.h}"></span>`);
    } else target.node.classList.add(chk.ok ? "ok" : "bad");
    if (note && chk.reason) note.textContent = chk.reason;
  }
  function syncGhost() {
    const c = core(), held = c?.cursorItem, g = el.ghost;
    if (!held) { g.hidden = true; clearPreviewMarks(); return; }
    const px = cellPx();
    g.hidden = false;
    g.style.width = held.w * px + "px"; g.style.height = held.h * px + "px";
    if (g.dataset.id !== held.id) { g.dataset.id = held.id; g.innerHTML = itemBox(held, { fill: true }); }
    placeGhost();
  }
  function placeGhost() {
    const held = core()?.cursorItem;
    if (!held) return;
    const px = cellPx();
    el.ghost.style.left = view.last.x - (view.grab.gx + 0.5) * px + "px"; el.ghost.style.top = view.last.y - (view.grab.gy + 0.5) * px + "px";
  }
  const centreGrab = (it) => { view.grab = { gx: Math.floor((it.w - 1) / 2), gy: Math.floor((it.h - 1) / 2) }; };

  /** Try to put the item in hand on `target`. Returns true when it left the cursor (or swapped). */
  function applyDrop(target) {
    const c = core(), held = c.cursorItem;
    if (!held) return false;
    const chk = dropCheck(c, held, target);
    if (!chk.ok) { if (chk.reason) game.toast(chk.reason); return false; }
    const before = held.id;
    const r = target.t === "grid" ? game.input({ t: "invClick", grid: "inventory", x: target.x, y: target.y }) : target.t === "slot" ? game.input({ t: "slotClick", slot: target.k }) : game.input({ t: "beltClick", index: target.i });
    if (!r.ok) return false;
    if (c.cursorItem?.id === before) return false; // refused by the rules (the core already said why)
    game.heldOrigin = null;
    if (c.cursorItem) centreGrab(c.cursorItem); // a swap leaves the displaced item in hand
    return true;
  }
  function pickFrom(target) {
    const c = core();
    if (target.t === "grid") {
      const it = itemAt(c.inventory, target.cx, target.cy);
      if (!it) return false;
      view.grab = { gx: target.cx - it.x, gy: target.cy - it.y };
      game.heldOrigin = { kind: "grid", x: it.x, y: it.y };
      game.input({ t: "invClick", grid: "inventory", x: target.cx, y: target.cy });
    } else if (target.t === "slot") {
      const it = c.equipment[target.k];
      if (!it) return false;
      centreGrab(it); game.heldOrigin = { kind: "slot", k: target.k };
      game.input({ t: "slotClick", slot: target.k });
    } else if (target.t === "belt") {
      const it = c.belt[target.i];
      if (!it) return false;
      centreGrab(it); game.heldOrigin = { kind: "belt", i: target.i };
      game.input({ t: "beltClick", index: target.i });
    }
    hideTip();
    return !!c.cursorItem;
  }
  /** Click / Enter on a cell, slot or belt slot: pick up, or place what is in hand. */
  function activate(target) {
    if (core().cursorItem) { applyDrop(target); return false; }
    return pickFrom(target);
  }
  /** Right-click / E: gear is worn, potions go to the belt, one-use consumables (Emergency Exit) are used; belt items are used from the belt. */
  function quickAction(node) {
    const c = core(), cell = node.closest(".cell"), slot = node.closest(".slot"), belt = node.closest(".bslot,.hb");
    if (c.cursorItem) return;
    if (cell) {
      const it = itemAt(c.inventory, Number(cell.dataset.x), Number(cell.dataset.y));
      if (!it) return;
      if (it.kind === "potion") game.input({ t: "toBelt", id: it.id });
      else if (it.kind === "consumable") game.input({ t: "useItem", id: it.id });
      else game.input({ t: "equip", id: it.id });
    } else if (slot && c.equipment[slot.dataset.slot]) game.input({ t: "unequip", slot: slot.dataset.slot });
    else if (belt) {
      const i = Number(belt.dataset.belt ?? belt.dataset.useBelt);
      if (c.belt[i]) game.input({ t: "useBelt", index: i });
    }
    hideTip(); // the item moved or was used: its tooltip must not linger over the panel
  }

  // ------------------------------------------------------------ events
  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !core()) return;
    const target = targetOf(e.target);
    if (!target) return;
    e.preventDefault();
    view.last = { x: e.clientX, y: e.clientY };
    const wasHeld = !!core().cursorItem;
    const picked = activate(target);
    view.drag = picked ? { sx: e.clientX, sy: e.clientY, moved: false } : null;
    if (wasHeld) view.drag = null;
  });
  doc.addEventListener("pointermove", (e) => {
    view.last = { x: e.clientX, y: e.clientY };
    if (!core()?.cursorItem) return;
    placeGhost();
    if (view.drag && !view.drag.moved && Math.hypot(e.clientX - view.drag.sx, e.clientY - view.drag.sy) > 6) view.drag.moved = true;
    showDropPreview(targetOf(doc.elementFromPoint(e.clientX, e.clientY)));
  });
  doc.addEventListener("pointerup", (e) => {
    const d = view.drag;
    view.drag = null;
    if (!d || !d.moved || !core()?.cursorItem) return;
    const target = targetOf(doc.elementFromPoint(e.clientX, e.clientY));
    if (!target || !applyDrop(target)) game.returnHeld(); // dropped on nothing, or refused: back where it came from
    clearPreviewMarks();
  });
  doc.addEventListener("pointercancel", () => { if (view.drag && core()?.cursorItem) game.returnHeld(); view.drag = null; });
  doc.addEventListener("contextmenu", (e) => { e.preventDefault(); if (root.contains(e.target)) quickAction(e.target); });

  /** Open or close the respec confirmation inside the Skills panel and put focus where it belongs. */
  function askRespec(on, focusFk) { view.respecAsk = on; view.sigs.left = ""; sync(); restoreFocus(focusFk); }
  doc.addEventListener("keydown", (e) => {
    if (!view.respecAsk) return;
    if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); askRespec(false, "rs"); } // Esc closes the confirmation first, not the panel
    else if (e.code === "Tab") { // the confirmation is modal: Tab and Shift+Tab cycle inside it (CR6-08)
      const btns = [...root.querySelectorAll(".rs-confirm button")];
      if (!btns.length) return;
      const i = btns.indexOf(doc.activeElement), next = e.shiftKey ? (i <= 0 ? btns.length - 1 : i - 1) : (i < 0 || i === btns.length - 1 ? 0 : i + 1);
      e.preventDefault(); btns[next].focus({ preventScroll: true });
    }
  }, true);

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !core()) return;
    const d = b.dataset;
    if (b.matches(".cell,.slot,.bslot")) { if (e.detail === 0) { const t = targetOf(b); if (t) activate(t); } return; } // keyboard activation (pointer path is handled on pointerdown)
    if (d.pin) { game.input({ t: "questPin", id: d.pin }); return; }
    if (d.qaccept) { game.input({ t: "questAccept", id: d.qaccept }); return; }
    if (d.qdecline) { game.input({ t: "closeDialog" }); return; }
    if (d.qhandin) { game.input({ t: "questHandIn", id: d.qhandin }); return; }
    if (d.verdict) { game.readVerdict(); return; }
    if (d.close) game.closePanel(d.close);
    else if (d.open) { if (b.classList.contains("tab")) game.openPanel(d.open); else game.togglePanel(d.open); }
    else if (d.alloc) game.input({ t: "allocate", attr: d.alloc });
    else if (d.learn) { const r = game.input({ t: "learnSkill", id: d.learn }); if (!r.ok && T.trLearnFail[r.error]) game.toast(T.trLearnFail[r.error]); }
    else if (d.respecNo) { askRespec(false, "rs"); }
    else if (d.respecYes) { askRespec(false, "rs"); const r = game.input({ t: "respec" }); game.toast(r.ok ? T.trRespecDone : T.trRespecFail[r.error ?? r.reason] ?? T.trResetNone); }
    else if (d.respec) { // R6: a respec that gives points back asks first (names the points); with nothing learned it just runs
      const tv = treeView(core()), some = tv.branches.some((br) => br.nodes.some((n) => n.level - (n.signature ? 1 : 0) > 0));
      if (tv.respec.available && some) askRespec(true, "rs.no");
      else if (!some && (tv.respec.mode === "gold" || tv.respec.mode === "once")) game.toast(T.trRespecFail["nothing-to-respec"]); // never charge for nothing (ADV-R6-02)
      else { const r = game.input({ t: "respec" }); game.toast(r.ok ? T.trRespecDone : T.trRespecFail[r.error ?? r.reason] ?? T.trResetNone); }
    }
    else if (d.aura) { const r = game.input({ t: "toggleAura", id: d.aura }); if (!r.ok) game.toast(T.trAuraFail[r.error] ?? T.trAuraFail["no-mana"]); }
    else if (d.assign) game.input({ t: "assignSkill", slot: Number(d.slot), id: core().player.skillBar.hotkeys[Number(d.slot)] === d.assign ? null : d.assign });
    else if (d.skillSlot !== undefined) game.input({ t: "selectSkill", index: Number(d.skillSlot) });
    else if (d.useBelt !== undefined) game.input({ t: "useBelt", index: Number(d.useBelt) });
    else if (d.buy !== undefined) game.input({ t: "buy", index: Number(d.buy) });
    else if (d.sell) {
      const it = core().inventory.items.find((i) => i.id === d.sell);
      if (it && it.rarity !== "normal" && view.sellArm !== d.sell) { // magic and better ask once more (a sale cannot be undone)
        view.sellArm = d.sell; view.sigs.left = ""; sync(); clearTimeout(view.sellTimer);
        view.sellTimer = setTimeout(() => { view.sellArm = null; view.sigs.left = ""; sync(); }, 3000);
        return;
      }
      view.sellArm = null; clearTimeout(view.sellTimer);
      game.input({ t: "sell", id: d.sell });
    }
    else if (d.stash) game.input({ t: "stash", id: d.stash, to: d.to });
    else if (d.vtab) { game.ui.vendorTab = d.vtab; view.sigs.left = ""; sync(); }
    else if (d.act === "heal") game.input({ t: "heal" });
    else if (d.act === "putback") game.returnHeld();
    else if (d.act === "dropfloor") { game.heldOrigin = null; game.input({ t: "drop" }); }
  });

  // tooltips + allocate preview
  const over = (e) => {
    const t = e.target.closest?.("[data-tip]");
    if (t && root.contains(t)) { if (t.dataset.tip !== view.hoverKey || !view.hoverEl?.isConnected) { view.hoverEl = t; showTip(t.dataset.tip, t); } return; }
    const pl = e.target.closest?.("[data-alloc]");
    if (pl) { showPreview(pl.dataset.alloc); return; }
  };
  const out = (e) => {
    const t = e.target.closest?.("[data-tip]");
    if (t && !t.contains(e.relatedTarget)) { hideTip(); view.hoverEl = null; }
    const pl = e.target.closest?.("[data-alloc]");
    if (pl && !pl.contains(e.relatedTarget)) clearPreview();
  };
  root.addEventListener("mouseover", over); root.addEventListener("mouseout", out);
  root.addEventListener("focusin", (e) => { over(e); const c = e.target.closest?.(".cell"); if (c) view.cur = { x: Number(c.dataset.x), y: Number(c.dataset.y) }; });
  root.addEventListener("focusout", out);

  // keyboard in the grid: arrows move, E equips/uses; Enter/Space click through the click handler (detail 0)
  root.addEventListener("keydown", (e) => {
    const jq = e.target.closest?.(".jq");
    if (jq && (e.key === "ArrowDown" || e.key === "ArrowUp") && e.target === jq) { // the journal: arrows walk the quest entries
      const all = [...root.querySelectorAll(".jq")], i = all.indexOf(jq), nx = all[Math.min(all.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
      nx?.focus({ preventScroll: true }); e.preventDefault(); return;
    }
    const cell = e.target.closest?.(".cell");
    if (cell) {
      const x = Number(cell.dataset.x), y = Number(cell.dataset.y), D = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (D) {
        const nx = Math.min(config.inventory.w - 1, Math.max(0, x + D[0])), ny = Math.min(config.inventory.h - 1, Math.max(0, y + D[1]));
        view.cur = { x: nx, y: ny };
        const next = root.querySelector(`[data-fk="c.${nx}.${ny}"]`);
        if (next) { cell.tabIndex = -1; next.tabIndex = 0; next.focus({ preventScroll: true }); }
        e.preventDefault();
        return;
      }
      if (e.key === "e" || e.key === "E") { quickAction(cell); e.preventDefault(); }
    }
  });
  // a stat flash ends with its animation
  root.addEventListener("animationend", (e) => e.target.classList?.remove("flash"));

  game.onChange(sync);
  game.panelsView = { sync, showTip, hideTip, itemFor };
  return { sync, el };
}
