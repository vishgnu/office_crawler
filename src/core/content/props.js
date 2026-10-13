// Office props. `blocks` props are impassable; the generator never lets them cut a floor in two.
// density = props per room tile, rolled per room kind.
export const props = {
  desk: { id: "desk", blocks: true },
  partition: { id: "partition", blocks: true },
  plant: { id: "plant", blocks: true },
  "conference-table": { id: "conference-table", blocks: true },
  copier: { id: "copier", blocks: true },
  "filing-cabinet": { id: "filing-cabinet", blocks: true },
  "box-stack": { id: "box-stack", blocks: true },
  "server-rack": { id: "server-rack", blocks: true },
  generator: { id: "generator", blocks: true },
  "reception-desk": { id: "reception-desk", blocks: true },
  "cable-bundle": { id: "cable-bundle", blocks: false },
  chair: { id: "chair", blocks: false },
  "paper-stack": { id: "paper-stack", blocks: false },
};

export const propsByRoomKind = {
  cubicle: { density: 0.22, types: ["desk", "partition", "partition", "chair", "plant"] },
  conference: { density: 0.12, types: ["conference-table", "chair", "chair", "plant"] },
  copy: { density: 0.14, types: ["copier", "paper-stack", "paper-stack", "plant"] },
  storage: { density: 0.2, types: ["filing-cabinet", "box-stack", "box-stack", "paper-stack"] },
  server: { density: 0.26, types: ["server-rack", "server-rack", "server-rack", "cable-bundle", "cable-bundle"] },
  archive: { density: 0.22, types: ["filing-cabinet", "filing-cabinet", "box-stack", "paper-stack"] },
  boiler: { density: 0.14, types: ["generator", "cable-bundle", "box-stack", "cable-bundle"] },
};
