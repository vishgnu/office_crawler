// Prices are pure functions of the item (AC-R-057-5/-6). All numbers come from config.
import { config } from "../config.js";
import { bases } from "../content/items.js";

/** Gold a vendor pays for an item. Rarity steps dominate; affixes add up to affixWorth each at their range maximum. */
export function sellValue(item) {
  const base = bases[item.base];
  const baseValue = base?.value ?? 1;
  if (item.kind !== "gear") return Math.max(1, Math.round(baseValue * config.consumableValueMult)); // potions and consumables
  let points = 0;
  for (const a of item.affixes ?? []) points += a.range[1] > 0 ? a.value / a.range[1] : 0;
  const scale = baseValue * (1 + item.ilvl * config.ilvlValue);
  return Math.max(1, Math.floor(scale * (config.rarityValue[item.rarity] + points * config.affixWorth)));
}

export function buyPrice(item) {
  const sell = sellValue(item);
  return Math.max(sell + 1, Math.ceil(sell * config.buyOverSell));
}
