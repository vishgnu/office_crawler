// Audio tuning constants (spec 08-audio: config.audio.*). Kept here because src/core is not touched by the audio package;
// the shell may pass overrides to createAudio({ options }). Defaults follow the sound-direction decision (QF-08-3).
export const audioConfig = {
  defaultKit: "foley",                 // provisional default: C Foley-synth (decision.md)
  defaultMaster: 0.6,
  defaultBus: { sfx: 0.8, ambient: 0.5 },
  maxVoices: 12,                       // simultaneous SFX voices (polyphony cap, AC-R-080-5)
  criticalReserve: 2,                  // slots only cues of priority >= criticalPriority may use
  criticalPriority: 8,
  defaultCooldown: 0.05,               // seconds between two plays of the same cue (20 hits in a frame do not stack)
  maxSfxSeconds: 1.0,                  // longest SFX in the measurements: 0.999 s
  loopSeconds: 10,
  fallbackVoiceSeconds: 0.5,           // voice length assumed while the context is locked
  hearTiles: 18,                       // beyond this distance from the hero a positional cue is culled
  fullTiles: 3,                        // within this distance a positional cue is at full level
  minDistGain: 0.15,                   // level at hearTiles
  panTiles: 10,                        // screen-x offset (in tiles) that pans fully to one side
  maxPan: 0.8,
  cueLogMax: 256,
  pollMs: 250,                         // zone / pause sync interval
};
