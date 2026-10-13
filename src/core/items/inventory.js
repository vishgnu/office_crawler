// Grid inventory rules (AC-R-055). A grid is { w, h, items }; each item inside it carries its top-left cell as x, y.
// Used for the inventory and the stash. All functions are pure rules on plain data; events are emitted by callers.

export const newGrid = (w, h) => ({ w, h, items: [] });

const overlaps = (a, ax, ay, b) => ax < b.x + b.w && b.x < ax + a.w && ay < b.y + b.h && b.y < ay + a.h;

export const inBounds = (grid, item, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x + item.w <= grid.w && y + item.h <= grid.h;

/** Items already in the grid that the block at (x, y) would cover (the item itself, if inside, is ignored). */
export const coveredBy = (grid, item, x, y) => grid.items.filter((o) => o !== item && overlaps(item, x, y, o));

export const canPlace = (grid, item, x, y) => inBounds(grid, item, x, y) && coveredBy(grid, item, x, y).length === 0;

export const itemAt = (grid, x, y) => grid.items.find((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) ?? null;

/** First fitting top-left cell, scanning row by row (AC-R-055-6), or null. */
export function findSpot(grid, item) {
  for (let y = 0; y + item.h <= grid.h; y++) for (let x = 0; x + item.w <= grid.w; x++) if (canPlace(grid, item, x, y)) return { x, y };
  return null;
}

export function place(grid, item, x, y) {
  item.x = x; item.y = y;
  grid.items.push(item);
  return item;
}

export function remove(grid, item) {
  const i = grid.items.indexOf(item);
  if (i < 0) return false;
  grid.items.splice(i, 1);
  delete item.x; delete item.y;
  return true;
}

/** Add an item at the first free spot. Returns true, or false when nothing fits (the item is untouched). */
export function autoplace(grid, item) {
  const spot = findSpot(grid, item);
  if (!spot) return false;
  place(grid, item, spot.x, spot.y);
  return true;
}

export const findById = (grid, id) => grid.items.find((o) => o.id === id) ?? null;

/**
 * Cursor click on a cell. `holder` is { cursorItem }. Empty cursor: pick up the item under the cell.
 * Held item: place it with its top-left on the cell; exactly one covered item is swapped onto the cursor;
 * out of bounds or two covered items is rejected and nothing changes.
 * Returns { ok, action: "pick"|"place"|"swap"|"none", error? }.
 */
export function clickCell(grid, holder, x, y) {
  const held = holder.cursorItem;
  if (!held) {
    const hit = Number.isInteger(x) && Number.isInteger(y) ? itemAt(grid, x, y) : null;
    if (!hit) return { ok: true, action: "none" };
    remove(grid, hit);
    holder.cursorItem = hit;
    return { ok: true, action: "pick", item: hit };
  }
  if (!inBounds(grid, held, x, y)) return { ok: false, error: "outOfBounds" };
  const covered = coveredBy(grid, held, x, y);
  if (covered.length > 1) return { ok: false, error: "blocked" };
  if (covered.length === 1) {
    const other = covered[0];
    remove(grid, other);
    place(grid, held, x, y);
    holder.cursorItem = other;
    return { ok: true, action: "swap", item: held, swapped: other };
  }
  place(grid, held, x, y);
  holder.cursorItem = null;
  return { ok: true, action: "place", item: held };
}

/** Plain copy of positions so a multi-step change can be undone. */
export const snapshotGrid = (grid) => ({ items: [...grid.items], pos: grid.items.map((i) => [i.x, i.y]) });
export function restoreGrid(grid, snap) {
  for (const i of grid.items) { delete i.x; delete i.y; }
  grid.items = [...snap.items];
  snap.items.forEach((i, k) => { i.x = snap.pos[k][0]; i.y = snap.pos[k][1]; });
}
