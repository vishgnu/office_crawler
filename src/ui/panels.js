// The S2 panels as DOM above the canvas: the Desk Drawer (inventory, paper doll, belt) on the right, the Employee File /
// Skills / NPC window on the left, the HUD slot layer (skill bar, belt, panel buttons), tooltips, the held-item ghost, the
// toast and a live region. Plain data in (game.core, game.ui), commands out (game.input / game.openPanel); no game rules here.
// Everything is a real <button>: keyboard (arrows in the grid, Enter picks up and places, Esc puts back), focus ring,
// labelled, contrast >= 4.5:1 (see style.css tokens and test/ui-contrast.test.js).
import { content, itemAt, config } from "../core/index.js";
import { T } from "./text.js";
import { itemIcon, skillIcon, rarityMark, arrow, coinIcon } from "./icons.js";
import { describeItem, compareToEquipped, unmetGear, allocPreview, dropCheck, rarityName, statLabel, xpRatio, xpProgress } from "./itemview.js";
import { hudLayout, drawerLayout, placeTip } from "./layout.js";
import { sellValue, buyPrice } from "../core/index.js";

const S = content.strings;
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SLOT_LABEL = { head: T.slotHead, amulet: T.slotAmulet, weapon: T.slotWeapon, body: T.slotBody, offhand: T.slotOffhand, hands: T.slotHands, belt: T.slotBelt, feet: T.slotFeet, ring1: T.slotRing1, ring2: T.slotRing2 };
const DOLL = { head: [3, 1, 2, 2], amulet: [5, 1, 1, 1], weapon: [1, 2, 2, 3], body: [3, 3, 2, 3], offhand: [6, 2, 2, 3], hands: [1, 5, 2, 2], belt: [3, 6, 2, 1], feet: [6, 5, 2, 2], ring1: [5, 5, 1, 1], ring2: [5, 6, 1, 1] };
const ATTR_HINT = { grit: T.raisesDamage, agility: T.raisesDefense, stamina: T.raisesHealth, focus: T.raisesMana };
const RESISTS = [["fire", T.resistFire], ["cold", T.resistCold], ["shock", T.resistShock], ["acid", T.resistAcid]];
const num = (n) => Number(n).toLocaleString("en-US");

export function createPanels(root, game) {
  const doc = root.ownerDocument, core = () => game.core;
  root.innerHTML = `
    <div class="hudui" id="hudui" data-testid="hud-ui"></div>
    <div id="stack">
      <aside class="drawer" id="pleft" data-testid="drawer-left" aria-label="${esc(T.character)}"></aside>
      <aside class="drawer" id="pright" data-testid="drawer-inventory" aria-label="${esc(T.inventory)}"></aside>
    </div>
    <div class="tip" id="tip" role="tooltip" hidden></div>
    <div class="ghost" id="ghost" hidden aria-hidden="true"></div>
    <div class="toast" id="toast" data-testid="toast" hidden></div>
    <div class="sr" id="live" role="status" aria-live="polite" data-testid="live"></div>`;
  const el = { hud: root.querySelector("#hudui"), left: root.querySelector("#pleft"), right: root.querySelector("#pright"), tip: root.querySelector("#tip"), ghost: root.querySelector("#ghost"), toast: root.querySelector("#toast"), live: root.querySelector("#live") };
  const view = { cur: { x: 0, y: 0 }, hoverKey: null, hoverEl: null, last: { x: -999, y: -999 }, drag: null, grab: { gx: 0, gy: 0 }, sigs: { hud: "", left: "", right: "" }, stats: {}, preview: null, toastId: 0, toastTimer: 0, sellArm: null, sellTimer: 0 };

  // ------------------------------------------------------------ lookups
  const cellPx = () => drawerLayout(game.w, game.h).cell;
  const itemFor = (key) => {
    const c = core(), [kind, v] = key.split(":");
    if (!c) return null;
    switch (kind) {
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
  const itemBox = (it, { fill = false, pos = null, cls = "" } = {}) => {
    const warn = unmetOf(it) ? '<span class="warn" aria-hidden="true">!</span>' : "";
    const style = pos ? ` style="--x:${pos.x};--y:${pos.y};--w:${it.w};--h:${it.h}"` : "";
    return `<span class="item r-${it.rarity}${fill ? " fill" : ""}${cls ? " " + cls : ""}" data-item="${esc(it.id)}"${style}>${itemIcon(it)}<span class="rm">${rarityMark(it.rarity, 11)}</span>${warn}</span>`;
  };
  const nameLine = (it, size = 13) => `<span class="l-${it.rarity}">${rarityMark(it.rarity, size)} ${esc(it.name)}</span>`;
  const legend = () => `<ul class="legend" aria-label="${esc(T.rarityKey)}"><li class="lh">${esc(T.rarityKey)}</li>${["normal", "magic", "rare", "unique"].map((r) =>
    `<li class="l-${r}"><span class="swatch r-${r}"></span>${rarityMark(r, 14)}<span>${esc(rarityName(r))}</span></li>`).join("")}</ul>`;

  // ------------------------------------------------------------ Desk Drawer
  function renderInventory(c) {
    const p = c.player, held = c.cursorItem, origin = game.heldOrigin;
    let h = `<div class="ph"><h2>${esc(T.inventory)}</h2>${closeBtn("inventory", T.closeInventory)}</div><div class="pb"><div class="inv">${tabsHtml("inventory")}`;
    h += `<div class="dollrow"><div class="doll" role="group" aria-label="${esc(T.equipment)}">`;
    for (const k of Object.keys(DOLL)) {
      const d = DOLL[k], it = c.equipment[k], ghost = held && origin?.kind === "slot" && origin.k === k ? held : null;
      h += `<button class="slot${ghost ? " ghosted" : ""}" type="button" data-testid="slot-${k}" data-slot="${k}" data-fk="s.${k}" ${it ? `data-tip="eq:${k}"` : ""} style="grid-column:${d[0]}/span ${d[2]};grid-row:${d[1]}/span ${d[3]}" aria-label="${esc(SLOT_LABEL[k])}: ${it ? esc(itemLabel(it)) : T.empty}">${it ? itemBox(it, { fill: true }) : ghost ? itemBox(ghost, { fill: true, cls: "dim" }) : `<span class="lb">${esc(SLOT_LABEL[k])}</span>`}</button>`;
    }
    h += `</div><div class="side">${legend()}<div class="beltbox"><h4>${esc(T.belt)} <kbd>1</kbd>–<kbd>4</kbd></h4><div class="bgrid" role="group" aria-label="${esc(T.beltKeys)}">`;
    c.belt.forEach((it, i) => {
      const ghost = held && origin?.kind === "belt" && origin.i === i ? held : null;
      h += `<button class="bslot" type="button" data-testid="bslot-${i}" data-belt="${i}" data-fk="b.${i}" ${it ? `data-tip="belt:${i}"` : ""} aria-label="${esc(T.belt)} ${i + 1}: ${it ? esc(it.name) : T.empty}">${it ? itemBox(it, { fill: true }) : ghost ? itemBox(ghost, { fill: true, cls: "dim" }) : `<span class="lb">${i + 1}</span>`}</button>`;
    });
    h += `</div></div><p class="keyhint">${esc(T.dragHint)}</p></div></div>`;
    // grid: 40 cell buttons under an absolutely positioned item layer
    h += `<div class="gridwrap"><div class="gi"><div class="grid" role="group" aria-label="${esc(T.inventoryGrid)}">`;
    for (let y = 0; y < c.inventory.h; y++) for (let x = 0; x < c.inventory.w; x++) {
      const it = itemAt(c.inventory, x, y), cur = view.cur.x === x && view.cur.y === y;
      h += `<button class="cell" type="button" data-testid="cell-${x}-${y}" data-x="${x}" data-y="${y}" data-fk="c.${x}.${y}" ${it ? `data-tip="inv:${esc(it.id)}"` : ""} tabindex="${cur ? 0 : -1}" aria-label="${T.cell} ${x + 1},${y + 1}: ${it ? esc(itemLabel(it)) : T.empty}"></button>`;
    }
    h += `</div><div class="items">${c.inventory.items.map((it) => itemBox(it, { pos: { x: it.x, y: it.y }, })).join("")}`;
    if (held && origin?.kind === "grid") h += itemBox(held, { pos: { x: origin.x, y: origin.y }, cls: "dim origin" });
    h += `</div></div></div>`;
    h += `<div class="footrow"><div class="gold" data-testid="gold">${coinIcon()}<span>${num(p.gold)} ${esc(T.gold)}</span></div><div class="notice" data-notice>`;
    h += held ? `<span class="heldline">${esc(T.onCursor)}: ${nameLine(held)}</span><span class="reason" data-reason></span><button class="mini" type="button" data-act="putback" data-testid="put-back">${esc(T.putBack)}</button><button class="mini" type="button" data-act="dropfloor" data-testid="drop-floor">${esc(T.dropOnFloor)}</button>` : "";
    return h + `</div></div></div></div>`;
  }

  // ------------------------------------------------------------ Employee File
  const statRow = (key, label, value) => `<div class="d"><span>${esc(label)}</span><b data-stat="${key}">${value}</b></div>`;
  function renderCharacter(c) {
    const p = c.player, xpv = xpProgress(p), pct = xpv.pct, pts = p.attrPoints;
    let h = `<div class="ph"><h2>${esc(T.fileTitle)}</h2>${closeBtn("character", T.closeCharacter)}</div><div class="pb"><div class="sheet" data-testid="employee-file">${tabsHtml("character")}`;
    h += `<div class="fh"><div class="photo"><svg viewBox="0 0 62 74" width="100%" height="100%" aria-hidden="true"><circle cx="31" cy="34" r="15" fill="#f6c49c" stroke="#0d0a1c" stroke-width="3"/><path d="M15 30Q16 14 31 15Q47 14 47 30Q38 22 31 24Q22 22 15 30Z" fill="#2a1a26" stroke="#0d0a1c" stroke-width="2.5"/><path d="M6 74Q8 54 31 54Q54 54 56 74Z" fill="#3b6cf0" stroke="#0d0a1c" stroke-width="3"/><path d="M31 54L36 62L31 74L26 62Z" fill="#ffb81f" stroke="#0d0a1c" stroke-width="2"/></svg></div>`;
    h += `<div><h2>${esc(content.classes[0].name)}</h2><p>${esc(T.jobTitle)} · <span data-stat="level">${esc(T.level)} ${p.level}</span></p><p>${esc(c.floor.name)}</p></div><div class="stamp" aria-hidden="true">${esc(T.probation)}</div></div>`;
    h += `<div class="xpl" title="${esc(T.xpTotal)}: ${num(xpv.total)}"><span>${esc(T.experience)}</span><span data-stat="xp" data-testid="xp-label" data-total="${xpv.total}">${xpv.capped ? esc(T.xpMax) : `${num(xpv.into)} / ${num(xpv.span)} ${esc(T.xpToLevel)} ${p.level + 1} (${pct}%)`}</span></div><div class="xpb2" role="img" title="${esc(T.xpTotal)}: ${num(xpv.total)}" aria-label="${esc(T.experience)} ${pct}%, ${esc(T.xpTotal)} ${num(xpv.total)}"><i style="width:${pct}%"></i></div>`;
    h += `<section class="sc-attr"><h3>${esc(T.attributes)} <em>${esc(T.pointsToSpend)}: <b data-stat="attrPoints">${pts}</b></em></h3>`;
    for (const k of T.attrOrder) {
      const own = p.attrs[k], tot = p.attrsTotal?.[k] ?? own, bonus = tot - own;
      h += `<div class="attr"><div class="an"><b>${esc(T.statAttr[k])}</b><small>${esc(ATTR_HINT[k])}</small></div><div class="av"><span data-stat="${k}">${tot}</span>${bonus ? ` <small>(${own} +${bonus} ${esc(T.gearWord)})</small>` : ""}</div>`;
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

  // ------------------------------------------------------------ Skills
  function renderSkills(c) {
    const p = c.player, bar = p.skillBar, defs = Object.values(content.skills);
    let h = `<div class="ph"><h2>${esc(T.skillsTitle)}</h2>${closeBtn("skills", T.closeSkills)}</div><div class="pb"><div class="skills" data-testid="skills-panel">${tabsHtml("skills")}`;
    h += `<p class="sp"><b>${esc(T.skillPointsLeft)}: <span data-testid="skill-points">${p.skillPoints}</span></b></p><p class="sk-note">${esc(T.rightMouse)}</p>`;
    const row = (d) => {
      const lvl = d.id === "strike" ? 1 : p.skills[d.id] ?? 0;
      const learnable = d.kind !== "basic", maxed = lvl >= d.maxLevel, canLearn = learnable && p.skillPoints > 0 && !maxed;
      const cost = d.mana ? d.mana(Math.max(1, lvl)) : 0, assignable = d.kind === "basic" || (d.kind === "active" && lvl > 0);
      let r = `<li class="srow" data-testid="skill-${d.id}"><div class="sic">${skillIcon(d.id)}</div><div class="sbody"><div class="sname"><b>${esc(d.name)}</b><span class="meta"><span class="slv">${esc(T.skillLevel)} <span data-testid="level-${d.id}">${lvl}</span>/${d.kind === "basic" ? 1 : d.maxLevel}</span>${d.kind === "active" ? ` <span class="smana">\u00b7 ${esc(T.manaCost)} ${cost}</span>` : ""}</span></div><div class="stext">${esc(S[d.text] ?? "")}</div></div>`;
      r += learnable ? `<button class="learn" type="button" data-testid="learn-${d.id}" data-learn="${d.id}" data-fk="l.${d.id}" ${canLearn ? "" : "disabled"} aria-label="${esc(lvl ? T.upgrade : T.learn)} ${esc(d.name)}${maxed ? ", " + esc(T.maxed) : ""}">${esc(maxed ? T.maxed : lvl ? T.upgrade : T.learn)}</button>` : "<span></span>";
      if (assignable) {
        r += `<div class="sassign" role="group" aria-label="${esc(T.assignTo)} ${esc(d.name)}"><span>${esc(T.assignTo)}</span>`;
        for (let i = 0; i < bar.hotkeys.length; i++) {
          const on = bar.hotkeys[i] === d.id;
          r += `<button class="mini key${on ? " on" : ""}" type="button" data-testid="assign-${d.id}-${i}" data-assign="${d.id}" data-slot="${i}" data-fk="a.${d.id}.${i}" aria-pressed="${on}" aria-label="${esc(T.assignTo)} F${i + 1}: ${esc(d.name)}${on ? ", " + esc(T.assigned) : ""}">F${i + 1}</button>`;
        }
        r += `</div>`;
      }
      return r + `</li>`;
    };
    h += `<h3>${esc(T.basicAttack)}</h3><ul class="slist">${defs.filter((d) => d.kind === "basic").map(row).join("")}</ul>`;
    h += `<h3>${esc(T.activeSkills)}</h3><ul class="slist">${defs.filter((d) => d.kind === "active").map(row).join("")}</ul>`;
    h += `<h3>${esc(T.passiveSkills)}</h3><ul class="slist">${defs.filter((d) => d.kind === "passive").map(row).join("")}</ul>`;
    return h + `</div></div>`;
  }

  // ------------------------------------------------------------ NPC windows
  const rowItem = (it, tipKey, right) => `<li class="row" data-tip="${tipKey}"><span class="ricon" style="--rw:${it.w};--rh:${it.h}">${itemIcon(it)}</span><span class="rname">${nameLine(it, 14)}<small>${esc(describeItem(it, core().player).main[0]?.text ?? "")}</small></span>${right}</li>`;
  function renderNpc(c) {
    const d = c.ui.dialog;
    if (!d) return "";
    let h = `<div class="ph"><h2>${esc(S[d.nameKey] ?? "")}</h2>${closeBtn("npc", T.closeWindow)}</div><div class="pb"><div class="npc" data-testid="npc-window" data-kind="${esc(d.kind)}">${tabsHtml("npc")}`;
    h += `<p class="say">“${esc(d.lines.map((k) => S[k] ?? "").join(" "))}”</p><div class="gold" data-testid="npc-gold">${coinIcon()}<span>${num(c.player.gold)} ${esc(T.gold)}</span></div>`;
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
  function tabsHtml(active) { // phone: one panel at a time, tabs switch (Gear / Employee File / Skills / talk)
    const D = drawerLayout(game.w, game.h);
    if (!D.phone) return "";
    const tabs = [["inventory", T.tabGear], ["character", T.tabFile], ["skills", T.tabSkills]];
    if (core().ui.dialog) tabs.push(["npc", T.tabNpc]);
    return `<div class="tabs" role="tablist" aria-label="${esc(T.panelTabs)}">${tabs.map(([k, label]) => `<button type="button" role="tab" class="tab${k === active ? " on" : ""}" data-open="${k}" data-testid="tab-${k}" aria-selected="${k === active}">${esc(label)}</button>`).join("")}</div>`;
  }

  // ------------------------------------------------------------ HUD slot layer + panel buttons
  function renderHud(c) {
    const L = hudLayout(game.w, game.h), s = L.scale, p = c.player, bar = p.skillBar, panels = game.panels();
    const fs = Math.max(10, Math.round(8.5 * s)), ctl = (r) => `left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px;--fs:${fs}px`;
    let h = `<div class="hgroup" role="group" aria-label="${esc(T.skillBar)}">`;
    for (let i = 0; i < 4; i++) {
      const id = bar.hotkeys[i], def = id ? content.skills[id] : null, lvl = id === "strike" ? 1 : id ? p.skills[id] ?? 0 : 0, cost = def?.mana ? def.mana(Math.max(1, lvl)) : 0;
      const dis = !!def && (lvl < 1 || p.mp < cost), sel = bar.selected === i;
      const label = def ? `F${i + 1}: ${def.name}${cost ? `, ${T.manaCost} ${cost}` : ""}${sel ? `, ${T.selectedSkill}` : ""}${dis ? `, ${T.notEnoughMana}` : ""}` : `F${i + 1}: ${T.slotEmpty}`;
      h += `<button class="sk${sel ? " on" : ""}${dis ? " dis" : ""}${def ? "" : " none"}" type="button" data-testid="hud-skill-${i}" data-skill-slot="${i}" data-fk="h.s.${i}" aria-pressed="${sel}" aria-disabled="${dis}" style="${ctl(L.skills[i])}" aria-label="${esc(label)}" title="${esc(def ? def.name : T.slotEmpty)}"><span class="kb">F${i + 1}</span>${def ? skillIcon(id) : ""}${sel ? '<span class="sel" aria-hidden="true"></span>' : ""}</button>`;
      if (def && L.showNames) h += `<span class="sn" aria-hidden="true" style="left:${(L.skills[i].x - 3).toFixed(1)}px;top:${(L.skills[i].y + L.skills[i].h).toFixed(1)}px;width:${(L.skills[i].w + 6).toFixed(1)}px;--fs:${fs}px">${esc(def.name)}</span>`;
    }
    h += `</div><div class="hgroup" role="group" aria-label="${esc(T.beltKeys)}">`;
    for (let i = 0; i < 4; i++) {
      const it = c.belt[i];
      h += `<button class="hb${it ? "" : " none"}" type="button" data-testid="hud-belt-${i}" data-use-belt="${i}" data-fk="h.b.${i}" ${it ? `data-tip="belt:${i}"` : ""} style="${ctl(L.belt[i])}" aria-label="${it ? `${i + 1}: ${esc(T.drink)} ${esc(it.name)}` : `${i + 1}: ${esc(T.beltEmpty)}`}"><span class="kb">${i + 1}</span>${it ? itemIcon(it) : ""}</button>`;
    }
    h += `</div>`;
    const xr = L.xp, xt = xpProgress(p);
    h += `<div class="xptip" data-testid="hud-xp" tabindex="-1" title="${esc(T.xpTotal)}: ${num(xt.total)}" aria-label="${esc(T.experience)} ${xt.pct}%, ${esc(T.xpTotal)} ${num(xt.total)}" style="left:${(xr.x - 2).toFixed(1)}px;top:${(xr.y - fs - 8).toFixed(1)}px;width:${(xr.w + 4).toFixed(1)}px;height:${(xr.h + fs + 10).toFixed(1)}px"></div>`;
    const badge = (n, what) => (n > 0 ? `<span class="bdg" aria-label="${n} ${esc(what)}">${n}</span>` : "");
    h += `<div class="dock" role="group" aria-label="${esc(T.toggleLabel)}">`;
    h += `<button class="hbtn" type="button" data-testid="dock-inventory" data-fk="h.d.i" data-open="inventory" aria-pressed="${panels.inventory}"><span>${esc(T.openInventory)}</span><kbd>I</kbd></button>`;
    h += `<button class="hbtn" type="button" data-testid="dock-character" data-fk="h.d.c" data-open="character" aria-pressed="${panels.character}"><span>${esc(T.openCharacter)}</span><kbd>C</kbd>${badge(p.attrPoints, T.attrPointsBadge)}</button>`;
    h += `<button class="hbtn" type="button" data-testid="dock-skills" data-fk="h.d.s" data-open="skills" aria-pressed="${panels.skills}"><span>${esc(T.openSkills)}</span><kbd>S</kbd>${badge(p.skillPoints, T.skillPointsBadge)}</button>`;
    h += `<button class="hbtn" type="button" data-testid="dock-map" data-fk="h.d.m" data-open="map" aria-pressed="${panels.map}"><span>${esc(T.openMap)}</span><kbd>M</kbd></button></div>`;
    return h;
  }

  // ------------------------------------------------------------ rendering driver
  const restoreFocus = (fk) => { if (fk) root.querySelector(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true }); };
  function renderInto(node, html) {
    const fk = root.contains(doc.activeElement) && node.contains(doc.activeElement) ? doc.activeElement.dataset.fk : null;
    const body = node.querySelector(".pb"), top = body ? body.scrollTop : 0;
    node.innerHTML = html;
    const nb = node.querySelector(".pb");
    if (nb) nb.scrollTop = top;
    restoreFocus(fk);
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
    const c = core(), menu = game.menu(), D = drawerLayout(game.w, game.h);
    root.hidden = !c;
    root.toggleAttribute("inert", !!menu);
    if (!c) { view.sigs = { hud: "", left: "", right: "" }; hideTip(); return; }
    const st = root.style;
    st.setProperty("--top", D.top + "px"); st.setProperty("--bottom", D.bottom + "px"); st.setProperty("--lw", D.leftW + "px"); st.setProperty("--rw", D.rightW + "px"); st.setProperty("--cw", D.cell + "px");
    st.setProperty("--hudtop", Math.floor(D.hudTop) + "px");
    root.classList.toggle("phone", D.phone);
    const u = game.ui, p = c.player, held = c.cursorItem;
    const leftOpen = !!u.left, rightOpen = u.inventory;
    root.classList.toggle("open-left", leftOpen); root.classList.toggle("open-right", rightOpen);
    const frontLeft = leftOpen && (u.front === "left" || !rightOpen);
    root.classList.toggle("front-left", frontLeft); root.classList.toggle("front-right", rightOpen && !frontLeft);
    el.left.classList.toggle("open", leftOpen); el.right.classList.toggle("open", rightOpen);
    el.left.dataset.panel = u.left ?? ""; el.right.dataset.panel = "inventory";
    el.left.setAttribute("aria-label", u.left === "skills" ? T.skills : u.left === "npc" ? (S[c.ui.dialog?.nameKey] ?? "") : T.character);

    const hudSig = sigOf(game.w, game.h, p.skillBar.hotkeys, p.skillBar.selected, p.skills, p.mp >= 0 && p.skillBar.hotkeys.map((id) => (id && content.skills[id]?.mana ? p.mp < content.skills[id].mana(Math.max(1, id === "strike" ? 1 : p.skills[id] ?? 0)) : 0)), c.belt.map((b) => b?.id ?? 0), p.attrPoints, p.skillPoints, u.inventory, u.left, u.map, p.xp, p.level);
    if (hudSig !== view.sigs.hud) { view.sigs.hud = hudSig; renderInto(el.hud, renderHud(c)); }

    const base = [game.w, game.h, u.front, held?.id ?? 0, game.heldOrigin, !!view.drag, p.level, p.xp, p.xpNext, p.attrs, p.attrsTotal, p.attrPoints, p.skillPoints, p.hp, p.hpMax, p.mp, p.mpMax, p.gold, p.damage, p.defense, p.attackRating, p.resist, p.skills, p.skillBar.hotkeys,
      c.inventory.items.map((i) => [i.id, i.x, i.y]), Object.values(c.equipment).map((i) => i?.id ?? 0), c.belt.map((b) => b?.id ?? 0), c.floor.name];
    if (rightOpen) { const sg = sigOf(base); if (sg !== view.sigs.right) { view.sigs.right = sg; renderInto(el.right, renderInventory(c)); } } else view.sigs.right = "";
    if (leftOpen) {
      const sg = sigOf(base, u.left, u.vendorTab, view.sellArm, c.ui.dialog, c.vendor && [c.vendor.id, c.vendor.stock.map((e) => e.item.id)], c.stash.items.map((i) => i.id));
      if (sg !== view.sigs.left) {
        view.sigs.left = sg;
        renderInto(el.left, u.left === "skills" ? renderSkills(c) : u.left === "npc" ? renderNpc(c) : renderCharacter(c));
        if (u.left === "character") flashChanged();
        if (view.preview && u.left === "character") showPreview(view.preview);
      }
    } else { view.sigs.left = ""; view.stats = {}; }
    syncGhost();
    syncToast();
    if (view.hoverKey && !itemFor(view.hoverKey)) hideTip(); // the item under the cursor was equipped, used, sold or dropped
    else if (!leftOpen && !rightOpen && !view.hoverEl?.closest?.("#hudui")) hideTip();
  }

  // ------------------------------------------------------------ toast + live region
  function syncToast() {
    const t = game.ui.toast;
    if (!t || t.id === view.toastId) return;
    view.toastId = t.id;
    el.toast.textContent = t.text; el.toast.hidden = false;
    el.live.textContent = ""; el.live.textContent = t.text;
    clearTimeout(view.toastTimer);
    view.toastTimer = setTimeout(() => { el.toast.hidden = true; if (game.ui.toast?.id === t.id) game.ui.toast = null; }, 3200);
  }

  // ------------------------------------------------------------ tooltip
  const heroRect = () => {
    const cam = game.camera();
    if (!cam) return { x: -9, y: -9, w: 0, h: 0 };
    const z = cam.z, cx = game.w / 2 + (game.inset || 0), cy = game.h / 2 + 12 * z;
    return { x: cx - 26 * z, y: cy - 62 * z, w: 52 * z, h: 74 * z };
  };
  const rectOf = (n) => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  function tipHtml(d, cmp, extra) {
    let h = `<div class="tn l-${d.rarity}">${rarityMark(d.rarity, 15)}<span>${esc(d.name)}</span></div><div class="tk">${esc(d.rarityName)} · ${esc(d.base)} · ${d.size} ${esc(T.cells)}</div>`;
    for (const m of d.main) h += `<div class="tb">${esc(m.text)}</div>`;
    for (const a of d.affixes) h += `<div class="ta l-${d.rarity}">${esc(a.text)}</div>`;
    if (d.twoHanded) h += `<div class="tk">${esc(T.twoHanded)}</div>`;
    if (d.reqs.length) h += `<div class="tr">${d.reqs.map((r) => `<span class="${r.ok ? "yes" : "no"}">${r.ok ? "✓" : "✗"} ${esc(r.detail)}</span>`).join("")}</div>`;
    if (d.flavour) h += `<div class="tf">“${esc(d.flavour)}”</div>`;
    if (extra) h += `<div class="tv">${esc(extra)}</div>`;
    if (cmp) {
      h += `<div class="cmp"><h4>${esc(T.compareTitle)}</h4>`;
      h += cmp.equipped ? `<div class="cn l-${cmp.equipped.rarity}">${rarityMark(cmp.equipped.rarity, 13)}<span>${esc(cmp.equipped.name)}</span></div>` : `<div class="cn">${esc(T.nothingEquipped)}</div>`;
      h += `<div class="dl">${cmp.deltas.map((x) => `<div class="df ${x.delta > 0 ? "up" : "dn"}">${arrow(x.delta > 0)}<span>${x.delta > 0 ? "+" : "−"}${Math.abs(x.delta)} ${esc(x.label)}</span></div>`).join("")}</div>`;
      h += `<div class="vd ${cmp.verdict}">${esc(cmp.verdictText)}</div>${d.unmet ? `<div class="vd dn">${esc(T.cannotEquipYet)}</div>` : ""}</div>`;
    }
    return h;
  }
  function showTip(key, anchor) {
    const c = core();
    if (!c || c.cursorItem) return hideTip();
    const it = itemFor(key);
    if (!it) return hideTip();
    const kind = key.split(":")[0], d = describeItem(it, c.player);
    const cmp = kind === "inv" || kind === "vendor" || kind === "stash" ? compareToEquipped(c, it) : null;
    const price = kind === "vendor" ? `${T.price}: ${buyPrice(it)} ${T.gold}` : `${T.sellsFor} ${sellValue(it)} ${T.gold}`;
    el.tip.className = `tip r-${it.rarity}`;
    el.tip.innerHTML = tipHtml(d, cmp, price);
    el.tip.hidden = false;
    el.tip.style.left = "0px"; el.tip.style.top = "0px"; el.tip.style.maxHeight = "";
    const D = drawerLayout(game.w, game.h), w = el.tip.offsetWidth, h = el.tip.offsetHeight;
    const panelNode = anchor.closest(".drawer"), itemNode = kind === "inv" && anchor.matches(".cell") ? root.querySelector(`.item[data-item="${CSS.escape(it.id)}"]`) : null, anchorRect = rectOf(itemNode ?? anchor);
    const drawers = [el.left, el.right].filter((n) => n.classList.contains("open")).map(rectOf);
    let pos;
    if (D.phone) {
      const y = Math.min(Math.max(8, anchorRect.y + anchorRect.h + 6), Math.max(8, D.bottom - h));
      pos = { x: 8, y, h };
      el.tip.style.right = "8px"; el.tip.style.width = "auto";
    } else {
      el.tip.style.right = ""; el.tip.style.width = "";
      pos = placeTip({ w, h, anchor: anchorRect, panel: panelNode ? rectOf(panelNode) : null, side: panelNode === el.left ? "left" : "right", drawers, hero: heroRect(), bounds: { left: 8, top: 8, right: game.w - 8, bottom: D.hudTop - 8 - (el.toast.hidden ? 0 : 52) }, keepClear: [...root.querySelectorAll(".plus,.dock .hbtn")].map(rectOf) });
    }
    el.tip.style.left = pos.x + "px"; el.tip.style.top = pos.y + "px";
    el.tip.style.maxHeight = Math.max(80, D.hudTop - 16) + "px";
    view.hoverKey = key;
    game.ui.tooltip = { key, ...d, compare: cmp, rect: { x: pos.x, y: pos.y, w, h: pos.h } };
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

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !core()) return;
    const d = b.dataset;
    if (b.matches(".cell,.slot,.bslot")) { if (e.detail === 0) { const t = targetOf(b); if (t) activate(t); } return; } // keyboard activation (pointer path is handled on pointerdown)
    if (d.close) game.closePanel(d.close);
    else if (d.open) { if (b.classList.contains("tab")) game.openPanel(d.open); else game.togglePanel(d.open); }
    else if (d.alloc) game.input({ t: "allocate", attr: d.alloc });
    else if (d.learn) game.input({ t: "learnSkill", id: d.learn });
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
