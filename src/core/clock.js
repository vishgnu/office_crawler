// Fixed-timestep accumulator (AC-R-113-1). Works in integer "millisecond x tickHz" units, so any
// chunking of the same elapsed time gives the same tick count.
export function advance(acc, dtMs, tickHz) {
  acc += dtMs * tickHz;
  const ticks = Math.floor(acc / 1000);
  return { acc: acc - ticks * 1000, ticks };
}
