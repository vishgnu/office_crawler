// Room placement and corridor carving on a tile grid (tiles start as all wall).
import { FLOOR, WALL, DOOR } from "../tiles.js";

export const roomCentre = (r) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });

/** Rejection-sample non-overlapping rooms, keeping a 2-tile gap so corridors fit between them. */
export function placeRooms(rng, w, h, kinds) {
  const target = rng.int(7, 11), rooms = [];
  for (let attempt = 0; attempt < 300 && rooms.length < target; attempt++) {
    const rw = rng.int(5, 10), rh = rng.int(5, 9);
    const r = { x: rng.int(2, w - rw - 3), y: rng.int(2, h - rh - 3), w: rw, h: rh, kind: "" };
    const clash = rooms.some((o) => r.x < o.x + o.w + 2 && o.x < r.x + r.w + 2 && r.y < o.y + o.h + 2 && o.y < r.y + r.h + 2);
    if (clash) continue;
    r.kind = rng.pick(kinds);
    rooms.push(r);
  }
  return rooms;
}

export function carveRooms(tiles, w, rooms) {
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y * w + x] = FLOOR;
}

/** Minimum spanning tree over centre distances (Prim) plus `extra` random loop edges. */
export function planCorridors(rng, rooms, extra = 2) {
  const dist = (a, b) => { const p = roomCentre(rooms[a]), q = roomCentre(rooms[b]); return Math.abs(p.x - q.x) + Math.abs(p.y - q.y); };
  const inTree = new Set([0]), edges = [];
  while (inTree.size < rooms.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < rooms.length; b++) {
      if (inTree.has(b)) continue;
      const d = dist(a, b);
      if (!best || d < best.d) best = { a, b, d };
    }
    edges.push([best.a, best.b]);
    inTree.add(best.b);
  }
  for (let i = 0; i < extra && rooms.length > 2; i++) {
    const a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1);
    if (a !== b && !edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) edges.push([a, b]);
  }
  return edges;
}

/** Carve an L-shaped corridor between two room centres. `horizontalFirst` picks the bend. */
export function carveCorridor(tiles, w, a, b, horizontalFirst) {
  const set = (x, y) => { if (tiles[y * w + x] === WALL) tiles[y * w + x] = FLOOR; };
  const hLine = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y); };
  const vLine = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) set(x, y); };
  if (horizontalFirst) { hLine(a.y, a.x, b.x); vLine(b.x, a.y, b.y); } else { vLine(a.x, a.y, b.y); hLine(b.y, a.x, b.x); }
}

/** Where a corridor pierces a room's wall ring and has wall on both sides, mark a door. */
export function placeDoors(tiles, w, rooms) {
  const isWall = (x, y) => tiles[y * w + x] === WALL;
  for (const r of rooms) {
    for (let x = r.x; x < r.x + r.w; x++) for (const y of [r.y - 1, r.y + r.h]) {
      if (tiles[y * w + x] === FLOOR && isWall(x - 1, y) && isWall(x + 1, y)) tiles[y * w + x] = DOOR;
    }
    for (let y = r.y; y < r.y + r.h; y++) for (const x of [r.x - 1, r.x + r.w]) {
      if (tiles[y * w + x] === FLOOR && isWall(x, y - 1) && isWall(x, y + 1)) tiles[y * w + x] = DOOR;
    }
  }
}
