# S3 UI notes (UI-S3: shell, save UI, options, victory, boss bar, audio wiring)

Date: 2026-10-14. For the WORLD-S3 package and the reviewer.

## What the shell now provides to the render layer (src/render/world.js, fx.js, light.js, labels.js were not touched)

- `game.options` (persisted) is also on the state as `state.options` (`volume`, `muted`, `kit`, `keys`, `highContrast`, `lowFx`, `reducedMotion`, `screenShake`, `textScale`). Rendering reads flags through the existing channels: `game.hc` / `fx.hc` (set by `game.setHc`, atlas rebuilt on change), `game.lowFx` / `fx.lowFx` (`game.setLowFx`). The shell skips `fx.shake()` when `reducedMotion` is on or `screenShake` is off, and skips `fx.drawHurt()` (the red edge flash) under `reducedMotion`. WORLD effects that flash or move the whole screen (boss slam ring flash, phase roar, victory confetti) should honour a flag in `env`: today `env` carries `lowFx` and `hc` only; the one-line addition is `env.reducedMotion = !!game.options.reducedMotion` in `game.render` (src/game.js, UI owns it, ask).
- Events on the bus that are not core events: `ui:click`, `ui:open`, `ui:close` (screens, panels, Options). `fx.handle` receives them and ignores them.
- Boss data the HUD uses: `m.tier === "boss"`, `m.boss.engaged`, `m.boss.phase`, `m.boss.windup.kind`, `config.boss.phase2At`. The boss name comes from `content.bosses[type].name`. The old target bar crashed for a boss target (it looked the type up in `content.monsters` only); fixed in `src/render/hud.js` (`hudState().target` and the bar draw).
- The telegraph for screen readers: core `bossTelegraph {kind}` goes through `messageFor` into the toast and the live region (`strings.bossTelegraphSlam` / `bossTelegraphVolley`; `bossPhase`, `bossSummon`, `stairsUnlocked` have lines too). The ground circle / fan itself is WORLD's.
- The Lobby elevator / floor 8 stairs marker should show unlocked from `state.bossUnlocked`; the toast on unlock is wired (`stairsUnlocked`).

## Things WORLD might see in the UI

- `scene === "victory"`: the shell shows an overlay (`menu === "victory"`); the canvas keeps rendering the arena behind it. The game loop does not step in that scene (`menu()` is truthy).
- HUD boss bar sits at the top centre (`y = 34 * scale`, 20 px high at 1x; on phone widths at `L.target.y`). The normal target bar is not drawn for the boss while its bar is up. Keep the top 60 px clear of floaters if WORLD adds labels there.
- High contrast now toggles at runtime (`options.highContrast`): the atlas is rebuilt with `hc` (same path as a resize). `?hc=1` still works and switches the option on for the session.

## Contract notes for the reviewer

- `config.defaultKeys` (spec name) is `DEFAULT_KEYS` in `src/input/keymap.js` (src/core is frozen). `config.audio.*` stays in `src/audio/config.js`. Both are exposed through `options` in the state and the hook.
- Key remapping covers inventory, character, skills, map, skills 1-4 and potions 1-4. Not remappable: Escape, Tab (map alias), K (skills alias), the numpad belt keys, the mouse (shown as fixed in Options). Binding a key another action uses is rejected (QF-01-6 proposal), with `ui.notice = {kind:"options", key:"optKeysConflict", text}` while a game runs and a message in the panel.
- Text size scales the overlay screens (title, pause, options, victory) by real font size, and the drawers' text panels, tooltips, toast and the panel buttons through CSS `zoom`. The inventory grid, the HUD slot layer and the canvas HUD keep their pixel sizes by design (their geometry is layout-driven).
- Blood and gore: there is no gore in the renderer, so Options shows "always off" instead of a switch (a switch that does nothing would be misleading). `ui.fx.gore` stays false.
- Autosave is silent (no toast, no sound): `SILENT_EVENTS.autosave`. Failures show as a toast (`saveFailed`) and `ui.notice`.
- Save wiring: `createSaveStore(createAdapter())` in `src/main.js`; autosave on the core `autosave` events; forced save on `pagehide` and `visibilitychange: hidden`; at boot a stored save is validated once, so a damaged or too-new save is reported on the title screen at start (AC-NFR-D03-2/-3).
- Export is a Blob + anchor download (`a.download`). The CSP (`default-src 'none'`) did not need a change: no fetch or navigation is involved, and `blob:` is not blocked for downloads in Chromium. Import reads the chosen file with `File.text()` or accepts pasted text.

## Not done (see the result JSON)

- `content.story` start / boss / victory story screens (AC-R-104-2) are not in this package's brief; the victory screen shows `victoryText`.
- Firefox / WebKit runs of the new e2e were not done (the S3 e2e runs on Chromium like the others).
