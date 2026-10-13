// Tile codes stored in floor.tiles (plain numbers so the floor round-trips JSON).
export const VOID = 0;
export const FLOOR = 1;
export const WALL = 2;
export const DOOR = 3;
export const STAIRS_UP = 4;   // the floor's entry
export const STAIRS_DOWN = 5; // the floor's exit

export const isWalkableTile = (c) => c === FLOOR || c === DOOR || c === STAIRS_UP || c === STAIRS_DOWN;
export const isOpaqueTile = (c) => c === VOID || c === WALL;
