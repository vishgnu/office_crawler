// Tiny synchronous pub/sub. The shell passes core events through it; audio/FX/UI subscribe.
export function createBus() {
  const subs = new Map();
  return {
    on(type, fn) { (subs.get(type) ?? subs.set(type, []).get(type)).push(fn); },
    emit(event) {
      for (const fn of subs.get(event.type) ?? []) fn(event);
      for (const fn of subs.get("*") ?? []) fn(event);
    },
  };
}
