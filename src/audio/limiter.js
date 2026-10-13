// Voice limiter: polyphony cap, per-cue cooldown and a reserve for critical cues. Pure; time is passed in (seconds).
import { audioConfig as C } from "./config.js";

export function createVoiceLimiter(opts = {}) {
  const cfg = { ...C, ...opts };
  const cooldowns = opts.cooldowns ?? {};
  let voices = [];            // { cue, end }
  const last = new Map();     // cue -> last accepted time
  const stats = { played: 0, cooldown: 0, full: 0 };
  const purge = (now) => { voices = voices.filter((v) => v.end > now); };
  return {
    /** Ask to start `cue` (priority prio, lasting dur seconds) at time now. Returns { ok, reason? }. */
    tryPlay(cue, prio, now, dur = cfg.fallbackVoiceSeconds) {
      purge(now);
      const cd = cooldowns[cue] ?? cfg.defaultCooldown;
      const prev = last.get(cue);
      if (prev !== undefined && now - prev < cd && now >= prev) { stats.cooldown++; return { ok: false, reason: "cooldown" }; }
      const cap = prio >= cfg.criticalPriority ? cfg.maxVoices : cfg.maxVoices - cfg.criticalReserve;
      if (voices.length >= cap) { stats.full++; return { ok: false, reason: "full" }; }
      voices.push({ cue, end: now + dur });
      last.set(cue, now);
      stats.played++;
      return { ok: true };
    },
    active(now) { purge(now); return voices.length; },
    stats: () => ({ ...stats }),
    reset() { voices = []; last.clear(); stats.played = stats.cooldown = stats.full = 0; },
  };
}
