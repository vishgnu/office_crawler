// Procedural office floors: rooms, corridors, doors, stairs, props, monsters. Pure and seeded.
import { createRng } from "../../rng.js";
import { hash32 } from "../hash.js";
import { config } from "../config.js";
import { WALL, STAIRS_UP, STAIRS_DOWN } from "../tiles.js";
import { themes, themeForDepth } from "../content/themes.js";
import { strings } from "../content/strings.js";
import { generateTown } from "./town.js";
import { generateArena } from "./arena.js";
import { buildGrid, flood } from "../grid.js";
import { placeRooms, carveRooms, planCorridors, carveCorridor, placeDoors, roomCentre } from "./rooms.js";
import { placeProps } from "./props.js";
import { populate } from "./population.js";
import { validateFloor } from "./validate.js";

// Build a floor from fixed rooms and corridor edges. Stairs: entry in room `entryRoom`, exit in the
// room farthest from it (path length).
function assemble(seed, depth, rooms, edges, bends, entryRoom) {
  const { w, h } = config.floorSize;
  const tiles = new Array(w * h).fill(WALL);
  carveRooms(tiles, w, rooms);
  edges.forEach(([a, b], i) => carveCorridor(tiles, w, roomCentre(rooms[a]), roomCentre(rooms[b]), bends[i]));
  placeDoors(tiles, w, rooms);

  const entry = roomCentre(rooms[entryRoom]);
  const floor = {
    depth, seed, theme: themeForDepth(depth), w, h, tiles, rooms: rooms.map((r) => ({ ...r })),
    name: strings[themes[themeForDepth(depth)].nameKey], bossStairs: depth >= config.maxDepth, // the way down from the last floor leads to the boss arena; locked until the floor is cleared
    entry, exit: null, props: [], spawns: [], npcs: [], budget: 0,
  };
  const { dist } = flood(buildGrid(floor), entry.x, entry.y);
  let far = -1;
  rooms.forEach((r, i) => {
    const c = roomCentre(r), d = dist[c.y * w + c.x];
    if (i !== entryRoom && d > far) { far = d; floor.exit = c; }
  });
  tiles[entry.y * w + entry.x] = STAIRS_UP;
  tiles[floor.exit.y * w + floor.exit.x] = STAIRS_DOWN;
  return floor;
}

function attempt(rng, floorSeed, depth) {
  const { w, h } = config.floorSize;
  const rooms = placeRooms(rng, w, h, themes[themeForDepth(depth)].roomKinds);
  if (rooms.length < config.minRooms) return null;
  const edges = planCorridors(rng, rooms);
  const bends = edges.map(() => rng.next() < 0.5);
  const floor = assemble(floorSeed, depth, rooms, edges, bends, rng.int(0, rooms.length - 1));
  placeProps(rng, floor);
  populate(rng, floor);
  return floor;
}

/** Known-good layout used when random generation keeps failing validation (never throws). */
export function fallbackFloor(floorSeed, depth) {
  const rooms = [
    { x: 4, y: 4, w: 9, h: 7, kind: "cubicle" }, { x: 24, y: 4, w: 8, h: 7, kind: "conference" },
    { x: 44, y: 4, w: 8, h: 7, kind: "copy" }, { x: 4, y: 24, w: 8, h: 8, kind: "storage" },
    { x: 24, y: 24, w: 9, h: 8, kind: "cubicle" }, { x: 36, y: 42, w: 9, h: 8, kind: "copy" },
  ];
  const kinds = themes[themeForDepth(depth)].roomKinds;
  rooms.forEach((r, i) => { r.kind = kinds[i % kinds.length]; });
  const floor = assemble(floorSeed, depth, rooms, [[0, 1], [1, 2], [0, 3], [1, 4], [4, 5]], [true, true, false, false, false], 0);
  populate(createRng(hash32(floorSeed, 999)), floor);
  return floor;
}

export function generateFloor(seed, depth = 1) {
  if (depth <= 0) return generateTown(seed);
  if (depth >= config.bossDepth) return generateArena(seed);
  const floorSeed = hash32(seed, depth); // a floor regenerates identically on re-entry
  for (let a = 0; a < config.maxGenAttempts; a++) {
    const floor = attempt(createRng(hash32(floorSeed, a)), floorSeed, depth);
    if (floor && validateFloor(floor).ok) return floor;
  }
  return fallbackFloor(floorSeed, depth);
}
