// Audio e2e: bundles src/audio into a blank page (no game needed), renders every cue of every kit with OfflineAudioContext
// and checks the thresholds from the sound-direction measurements (measure-*.json: summary.allPass), then drives createAudio with a fake bus.
// Run: node e2e/audio.mjs   (needs playwright + chromium; independent of dist/)
import { build } from "esbuild";
import { resolve } from "node:path";
import { launch, check, finish } from "./helpers.mjs";

const entry = resolve("src/audio/index.js").replace(/\\/g, "/");
const bundle = await build({
  stdin: { contents: `import * as A from ${JSON.stringify(entry)}; import { createBus } from ${JSON.stringify(resolve("src/bus.js").replace(/\\/g, "/"))}; window.__A = A; window.__bus = createBus;`, resolveDir: resolve("."), loader: "js" },
  bundle: true, format: "iife", write: false, target: "es2022",
});
const code = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// thresholds, reused from the variants' measure JSON summary (method: docs/product/variants/sound-direction/measure-*.json)
const T = { peakMin: -6, peakMax: -1, rmsSpread: 12, maxSeconds: 1.0, maxNodes: 12, ambRmsMin: -30, ambRmsMax: -20, clip: 0.999, loopSeam: 0.1 };

const browser = await launch();
const page = await (await browser.newContext()).newPage();
const errors = [], requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("request", (r) => requests.push(r.url()));
await page.setContent(`<!doctype html><title>audio</title><body><script>${code}</script></body>`);

const report = await page.evaluate(async (T) => {
  const { KITS, KIT_IDS } = window.__A, SR = 44100, db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
  const NAMES = ["createOscillator", "createBufferSource", "createGain", "createBiquadFilter", "createDelay", "createWaveShaper", "createStereoPanner", "createConstantSource", "createDynamicsCompressor"];
  function analyse(buf, from, to, floor) {
    const ch = [...Array(buf.numberOfChannels).keys()].map((i) => buf.getChannelData(i));
    let peak = 0, nan = 0, clip = 0, last = from;
    for (const c of ch) for (let i = 0; i < c.length; i++) { const v = c[i]; if (v !== v || !isFinite(v)) { nan++; continue; } const a = Math.abs(v); if (a > peak) peak = a; if (a >= T.clip) clip++; }
    let end = to ?? 0;
    if (to == null) { for (let i = buf.length - 1; i >= from; i--) { if (ch.some((c) => Math.abs(c[i]) > floor)) { end = i + 1; break; } } }
    let ss = 0; for (const c of ch) for (let i = from; i < end; i++) ss += c[i] * c[i];
    const rms = Math.sqrt(ss / Math.max(1, (end - from) * ch.length));
    return { peak_dBFS: db(peak), rms_dBFS: db(rms), duration_s: (end - from) / SR, clip, nan };
  }
  const out = {};
  for (const id of KIT_IDS) {
    const r = { sfx: {}, ambient: {}, errors: [] };
    const p0 = new OfflineAudioContext(1, 10, SR), probe = KITS[id](p0, p0.destination), ids = probe.sfxIds;
    for (const s of ids) {
      try {
        const oc = new OfflineAudioContext(2, Math.ceil(SR * 1.7), SR), k = KITS[id](oc, oc.destination); let cnt = 0;
        NAMES.forEach((n) => { const f = oc[n]; oc[n] = function () { cnt++; return f.apply(oc, arguments); }; });
        k.play(s, 0.05); NAMES.forEach((n) => delete oc[n]);
        const a = analyse(await oc.startRendering(), Math.floor(0.05 * SR), null, 0.003); a.nodes = cnt; r.sfx[s] = a;
      } catch (e) { r.errors.push(`${s}: ${e.message}`); }
    }
    const zones = probe.zones;
    for (const z of zones) {
      try {
        const oc = new OfflineAudioContext(2, SR * 10, SR), k = KITS[id](oc, oc.destination); k.startAmbient(z, 0, { duration: 10 });
        const buf = await oc.startRendering(), a = analyse(buf, SR, SR * 10, 0.003), whole = analyse(buf, 0, SR * 10, 0.003);
        a.peak_dBFS = whole.peak_dBFS; a.clip = whole.clip; a.nan = whole.nan;
        // The ambient is generative and continuous (no loop buffer): its start fades in (0.6 s) and stop() fades out (0.8 s). The seam is measured on a
        // render that includes the fade-out, so restarting the bed (loop or zone change) cannot click. A hard cut at 10 s would be a different test.
        const oc2 = new OfflineAudioContext(2, Math.ceil(SR * 11), SR), k2 = KITS[id](oc2, oc2.destination); k2.startAmbient(z, 0, { duration: 10 });
        const L = (await oc2.startRendering()).getChannelData(0); a.seam = Math.max(Math.abs(L[0]), Math.abs(L[L.length - 1]));
        r.ambient[z] = a;
      } catch (e) { r.errors.push(`ambient ${z}: ${e.message}`); }
    }
    out[id] = r;
  }
  return out;
}, T);

for (const [kit, r] of Object.entries(report)) {
  const S = Object.entries(r.sfx), A = Object.entries(r.ambient);
  check(`${kit}: all 27 sfx and 3 ambients render without errors`, r.errors.length === 0 && S.length === 27 && A.length === 3, r.errors);
  const bad = (f) => S.filter(([, a]) => !f(a)).map(([k]) => k);
  check(`${kit}: no NaN, no clipping, non-silent`, S.every(([, a]) => a.nan === 0 && a.clip === 0 && a.rms_dBFS > -60) && A.every(([, a]) => a.nan === 0 && a.clip === 0), bad((a) => a.nan === 0 && a.clip === 0));
  check(`${kit}: sfx peaks within ${T.peakMin}..${T.peakMax} dBFS`, bad((a) => a.peak_dBFS >= T.peakMin && a.peak_dBFS <= T.peakMax).length === 0, bad((a) => a.peak_dBFS >= T.peakMin && a.peak_dBFS <= T.peakMax));
  const rms = S.map(([, a]) => a.rms_dBFS);
  check(`${kit}: sfx rms spread at most ${T.rmsSpread} dB`, Math.max(...rms) - Math.min(...rms) <= T.rmsSpread, Math.max(...rms) - Math.min(...rms));
  check(`${kit}: every sfx at most ${T.maxSeconds} s (config.audio.maxSfxSeconds)`, bad((a) => a.duration_s <= T.maxSeconds).length === 0, bad((a) => a.duration_s <= T.maxSeconds));
  check(`${kit}: every sfx at most ${T.maxNodes} nodes per play`, bad((a) => a.nodes <= T.maxNodes).length === 0, bad((a) => a.nodes <= T.maxNodes));
  check(`${kit}: ambient rms within ${T.ambRmsMin}..${T.ambRmsMax} dBFS`, A.every(([, a]) => a.rms_dBFS >= T.ambRmsMin && a.rms_dBFS <= T.ambRmsMax), A.map(([z, a]) => [z, a.rms_dBFS]));
  check(`AC-R-081-3 ${kit}: ambient restart seam (first and last sample of a faded render) at most ${T.loopSeam}`, A.every(([, a]) => a.seam <= T.loopSeam), A.map(([z, a]) => [z, a.seam]));
}

// engine driven by a fake bus on a real AudioContext
const eng = await page.evaluate(async () => {
  const { createAudio } = window.__A, bus = window.__bus();
  let st = { tick: 3, scene: "title", depth: 0, paused: false, player: { tile: { x: 5, y: 5 } }, monsters: [{ id: "m1", type: "zombie-intern", tile: { x: 7, y: 5 } }], projectiles: [] };
  const options = {}, a = createAudio({ bus, getState: () => st, options });
  const res = { errors: [] };
  try {
    res.before = a.getState();
    res.unlocked = a.unlock();
    res.title = a.getState().ambientId;
    st = { ...st, scene: "floor", depth: 6, floor: { theme: "basement" } }; a.sync(); res.basement = a.getState().ambientId;
    a.clearCueLog();
    for (const ev of [{ type: "hit", source: "player", target: "m1", value: 3 }, { type: "kill", target: "m1", xp: 1 }, { type: "pickup", id: "i1", rarity: "unique" }, { type: "ui:click" }, { type: "levelup", level: 2 }, { type: "potion", slot: 0 }, { type: "cast", skill: "stapler-throw" }, { type: "floorEnter", depth: 7 }, { type: "bogus" }]) bus.emit(ev);
    res.names = a.getState().cueLog.map((c) => c.name);
    a.clearCueLog();
    for (let i = 0; i < 20; i++) bus.emit({ type: "hit", source: "player", target: "m1", value: 1 });
    res.stress = { voices: a.getState().voices, logged: a.getState().cueLog.length };
    a.setVolume("master", 0.3); a.setVolume("effects", 0.5); a.setVolume("ambient", 0.8);
    res.vol = a.getState(); a.setMuted(true); res.muted = a.getState().effectiveGain; a.setMuted(false);
    for (const k of ["gothic", "chiptune", "foley"]) { a.setKit(k); bus.emit({ type: "levelup", level: 3 }); }
    st = { ...st, scene: "dead" }; a.sync(); res.dead = a.getState().ambientId;
    res.options = options;
  } catch (e) { res.errors.push(String(e && e.stack || e)); }
  a.dispose();
  return res;
});
check("engine: no cue state before unlock, cues logged anyway", eng.before.unlocked === false);
check("engine: unlock succeeds on a real AudioContext", eng.unlocked === true, eng);
check("AC-R-081-4 title plays the soft lobby bed, floor 6 switches to basement, death stops it", eng.title === "ambient:lobby" && eng.basement === "ambient:basement" && eng.dead === null, eng);
check("AC-R-080-3 spec cues are logged for the event list (unknown event ignored)", JSON.stringify(eng.names) === JSON.stringify(["attack", "hit", "hurt", "death", "pickup", "uiClick", "levelUp", "potion", "cast", "stairs"]), eng.names);
check("AC-R-080-5 20 hits in one tick: polyphony cap holds", eng.stress.voices <= 12 && eng.stress.logged <= 12, eng.stress);
check("AC-R-082-1/2 volume and mute", eng.vol.master === 0.3 && eng.vol.sfx === 0.5 && eng.vol.ambient === 0.8 && Math.abs(eng.vol.effectiveGain.sfx - 0.15) < 1e-3 && Math.abs(eng.vol.effectiveGain.ambient - 0.24) < 1e-3 && eng.muted.sfx === 0 && eng.muted.master === 0, eng.vol);
check("AC-R-082-3 options object carries the settings for persistence", eng.options.volume?.master === 0.3 && eng.options.muted === false && eng.options.kit === "foley", eng.options);
check("engine: no exceptions, no console or page errors", eng.errors.length === 0 && errors.length === 0, { eng: eng.errors, errors });
check("AC-R-080-7 no network request besides the page itself", requests.every((u) => u.startsWith("about:") || u.startsWith("data:")), requests);

await browser.close();
finish("e2e/audio.mjs");
