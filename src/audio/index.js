// Audio engine: bus events -> cues -> the selected sound kit (Web Audio, procedural, no files).
//   const audio = createAudio({ bus, getState, options });
//   audio.unlock()   call from the first pointerdown / keydown (autoplay policy); the AudioContext is created there, not before
// Cues are decided (limiter, cueLog) even while locked, so tests and the first moments of play behave the same.
import { audioConfig as C } from "./config.js";
import { mapEvent, ambientZone, COOLDOWNS } from "./cues.js";
import { createVoiceLimiter } from "./limiter.js";
import { place } from "./spatial.js";
import { createSoundKit as gothic } from "./kits/gothic.js";
import { createSoundKit as chiptune } from "./kits/chiptune.js";
import { createSoundKit as foley } from "./kits/foley.js";

export const KITS = { gothic, chiptune, foley };
export const KIT_IDS = Object.keys(KITS);
const CHANNELS = ["master", "sfx", "ambient"];
const ALIAS = { effects: "sfx", music: "ambient" };
const clamp01 = (v) => (Number.isFinite(+v) ? Math.max(0, Math.min(1, +v)) : null);

/**
 * @param {object} p
 * @param {{on:Function}} p.bus            the shell bus (src/bus.js)
 * @param {() => object|null} p.getState   current core state (or null on the title screen)
 * @param {object} [p.options]             persisted options object: { kit, muted, volume:{master,sfx,ambient} }; read at start, written on change
 * @param {object} [p.deps]                test seams: { AudioContext, kits, now, pollMs }
 */
export function createAudio({ bus, getState = () => null, options = {}, deps = {} } = {}) {
  const kits = deps.kits ?? KITS;
  const now = deps.now ?? (() => (typeof performance !== "undefined" ? performance.now() / 1000 : 0));
  const pollMs = deps.pollMs ?? C.pollMs;
  const vol0 = options.volume ?? {};
  const vol = { master: clamp01(vol0.master) ?? C.defaultMaster, sfx: clamp01(vol0.sfx) ?? C.defaultBus.sfx, ambient: clamp01(vol0.ambient) ?? C.defaultBus.ambient };
  let muted = options.muted === true;
  let kitId = kits[options.kit] ? options.kit : C.defaultKit;
  let ctx = null, kit = null, out = null, timer = null, disposed = false, paused = false;
  let amb = null, ambZone = null;
  const limiter = createVoiceLimiter({ cooldowns: COOLDOWNS });
  const cueLog = [];
  const persist = () => { options.volume = { ...vol }; options.muted = muted; options.kit = kitId; };
  persist();

  const state = () => { try { return getState() ?? null; } catch { return null; } };
  const running = () => ctx && ctx.state !== "closed" && kit;

  function applyVolumes() {
    if (!kit) return;
    for (const ch of CHANNELS) kit.setVolume(ch, vol[ch]);
    kit.setMuted(muted);
  }

  function makeKit() {
    out = ctx.createGain();
    out.connect(ctx.destination);
    kit = kits[kitId](ctx, out);
    applyVolumes();
  }

  function stopAmbient() {
    if (amb) { try { amb.stop(ctx.currentTime); } catch { /* already stopped */ } }
    amb = null;
  }

  /** Ambient follows the state: title = soft lobby bed, then the zone of the floor; none when dead. Old fades out (0.8 s) while the new fades in (0.6 s). */
  function sync() {
    if (disposed) return;
    const s = state();
    const want = ambientZone(s);
    if (ctx && s) {
      const p = !!s.paused;
      if (p !== paused) { paused = p; try { (p ? ctx.suspend() : ctx.resume())?.catch?.(() => {}); } catch { /* ignore */ } }
    }
    if (want === ambZone && (amb || !running())) return;
    if (running()) {
      stopAmbient();
      if (want) { try { amb = kit.startAmbient(want, ctx.currentTime); } catch { amb = null; } }
    }
    ambZone = want;
  }

  function play(desc, s, tick) {
    const sp = place(s?.player?.tile, desc.tile);
    if (sp.gain <= 0) return;
    const gain = sp.gain * desc.gain;
    const t = now();
    const dur = desc.dur ?? C.fallbackVoiceSeconds;
    if (!limiter.tryPlay(desc.cue, desc.prio, t + desc.delay, dur).ok) return;
    cueLog.push({ tick, cue: desc.cue, name: desc.name, gain: Math.round(gain * 1000) / 1000, pan: Math.round(sp.pan * 1000) / 1000 });
    if (cueLog.length > C.cueLogMax) cueLog.shift();
    if (running() && ctx.state === "running" && !muted) {
      try { kit.play(desc.cue, ctx.currentTime + desc.delay, { gain, pan: sp.pan }); } catch { /* a failing voice must never break the game */ }
    }
  }

  function handle(ev) {
    if (disposed) return;
    const s = state();
    const descs = mapEvent(ev, s);
    if (!descs.length) return;
    const tick = ev.tick ?? s?.tick ?? 0;
    for (const d of descs) play(d, s, tick);
    if (ev.type === "floorEnter" || ev.type === "respawn") sync();
  }

  bus?.on("*", handle);

  const api = {
    /** Create / resume the AudioContext. Call from a user gesture. Returns true when audio can play. */
    unlock() {
      if (disposed) return false;
      if (!ctx) {
        const AC = deps.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AC) return false;
        try { ctx = new AC(); } catch { ctx = null; return false; }
        makeKit();
        if (pollMs > 0) { timer = setInterval(sync, pollMs); timer?.unref?.(); }
        ambZone = null; // start the bed now that sound is possible
      }
      try { ctx.resume?.()?.catch?.(() => {}); } catch { /* ignore */ }
      sync();
      return true;
    },
    setKit(id) {
      if (!kits[id]) return false;
      if (id === kitId && kit) return true;
      kitId = id; persist();
      if (!ctx) return true;
      stopAmbient();
      const oldKit = kit, oldOut = out;
      if (oldOut) { // let the old kit's tails finish quietly, then cut it
        oldOut.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => { try { oldOut.disconnect(); } catch { /* ignore */ } }, 1500)?.unref?.();
      }
      void oldKit;
      makeKit();
      ambZone = null;
      sync();
      return true;
    },
    setVolume(channel, v) {
      const ch = ALIAS[channel] ?? channel;
      if (!CHANNELS.includes(ch)) return false;
      const c = clamp01(v);
      if (c === null) return false;
      vol[ch] = c; persist(); applyVolumes();
      return true;
    },
    setMuted(b) { muted = !!b; persist(); applyVolumes(); },
    /** Test hook payload (audio.getState). effectiveGain = master x bus value, 0 while muted (AC-R-082-1/2). */
    getState() {
      const eff = (ch) => (muted ? 0 : ch === "master" ? vol.master : vol.master * vol[ch]);
      return {
        kit: kitId, unlocked: !!ctx, ctxState: ctx?.state ?? "none", master: vol.master, sfx: vol.sfx, ambient: vol.ambient, muted,
        effectiveGain: { master: eff("master"), sfx: eff("sfx"), ambient: eff("ambient") },
        ambientId: ambZone ? `ambient:${ambZone}` : null, voices: limiter.active(now()), limiter: limiter.stats(),
        cueLog: cueLog.map((c) => ({ ...c })),
      };
    },
    clearCueLog() { cueLog.length = 0; limiter.reset(); },
    handleEvent: handle,
    sync,
    dispose() {
      if (disposed) return;
      stopAmbient();
      disposed = true;
      clearInterval(timer);
      try { ctx?.close?.()?.catch?.(() => {}); } catch { /* ignore */ }
      ctx = kit = out = null;
    },
  };
  return api;
}

export { mapEvent, ambientZone } from "./cues.js";
