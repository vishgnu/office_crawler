// Recording canvas context for the render tests (R8): every method call and property set goes into a running hash, so two draws can be compared without pixels.
// Same call stream = same pixels. Used by render-r8-gear.test.js and by the pre-R8 golden (fixtures/render-hero-pre-r8.json).
import { createHash } from "node:crypto";

export function recorder() {
  const h = createHash("sha1"); let n = 0;
  const num = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : typeof v === "object" && v !== null ? "{}" : v);
  const put = (s) => { h.update(s); h.update("\n"); n++; };
  const store = {};
  const g = new Proxy(store, {
    get: (t, k) => {
      if (k === "canvas") return { width: 104, height: 96 };
      if (k === "measureText") return (s) => ({ width: String(s).length * 7 });
      if (k === "createRadialGradient" || k === "createLinearGradient") return (...a) => { put(k + ":" + a.map(num).join(",")); return { addColorStop: (...b) => put("stop:" + b.map(num).join(",")) }; };
      if (k in t) return t[k];
      return (...a) => { put(k + ":" + a.map(num).join(",")); };
    },
    set: (t, k, v) => { t[k] = v; put("set " + String(k) + "=" + num(v)); return true; },
  });
  return { g, count: () => n, digest: () => h.copy().digest("hex") };
}
