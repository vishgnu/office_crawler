// The Lobby (town, depth 0): a fixed, hand-placed layout. No monsters can exist here (R-040).
import { WALL, FLOOR, STAIRS_DOWN } from "../tiles.js";
import { carveRooms, carveCorridor, placeDoors, roomCentre } from "./rooms.js";
import { strings } from "../content/strings.js";
import { npcs } from "../content/npcs.js";
import { hash32 } from "../hash.js";

const W = 30, H = 16;

export function generateTown(seed = 0) {
  const tiles = new Array(W * H).fill(WALL);
  const rooms = [{ x: 2, y: 2, w: 12, h: 11, kind: "reception" }, { x: 17, y: 2, w: 11, h: 11, kind: "breakroom" }];
  carveRooms(tiles, W, rooms);
  carveCorridor(tiles, W, roomCentre(rooms[0]), roomCentre(rooms[1]), true);
  placeDoors(tiles, W, rooms);
  const exit = { x: 8, y: 3 }, entry = { x: 8, y: 9 };
  tiles[exit.y * W + exit.x] = STAIRS_DOWN; // the elevator (QF-01-1)
  const at = { vendor: { x: 4, y: 5 }, healer: { x: 12, y: 5 }, potions: { x: 20, y: 4 }, stash: { x: 25, y: 9 } };
  const props = [
    ["reception-desk", 7, 5], ["reception-desk", 8, 5], ["reception-desk", 9, 5],
    ["plant", 3, 11], ["plant", 12, 11], ["chair", 5, 8], ["chair", 11, 8], ["plant", 18, 11], ["chair", 23, 6], ["chair", 24, 6],
  ].map(([type, x, y], i) => ({ id: `pr${i + 1}`, type, x, y, blocks: type !== "chair" }));
  return {
    depth: 0, seed: hash32(seed, 0), theme: "lobby", name: strings.lobbyName, town: true, w: W, h: H, tiles, rooms, entry, exit, props,
    npcs: Object.values(npcs).map((n) => ({ id: n.id, kind: n.kind, tile: at[n.id] })), spawns: [], budget: 0,
  };
}
