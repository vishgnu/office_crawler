# S2 render and UI needs (from the S2-3 core implementer, 2026-10-13)

Split into two parallel work packages with no shared files:
**WORLD** (src/render/styles/**, world.js, fx.js, labels.js, light.js, atlas.js, keys.js)
**UI** (src/ui/**, src/render/hud.js, src/game.js, src/main.js, src/input/**, src/testhook/**, src/style.css, src/index.html)

## WORLD
- MUST (red test today): palette.rims and FIG_DIM entries (head > 30, shadowR > 5) and figure sprites for monster types
  temp-worker, printer-demon, middle-manager, vending-machine, consultant, auditor.
- Projectiles from state.projectiles (pos, dir, kind: stapler | toner | slide); impact FX on projectile/projectileEnd events.
- Props: server-rack, generator, cable-bundle, reception-desk.
- Tilesets by floor.theme: lobby, basement (plus open-plan); the elevator is drawn at the Lobby's floor.exit; no up-stairs in the Lobby.
- NPC sprites from floor.npcs (vendor, healer, potions, stash) with nameplates.
- Player 'cast' animation; burst, heal and levelup FX.
- Monster states: stagger, flee, muted icon (muteT), hit flash (flashTicks); champions get a distinct outline, use m.name and show their modifiers.
- Floaters: state.floaters is now state-backed. Use ONE source (state), remove the event-made duplicates; keep the stacking rules from the S1 polish.
- Ground loot: rarity rings, beams, markers (16 px), plates (Okabe-Ito colours, serif for unique), from groundItems (label, rarity, mark, border, color). Gold piles.

## UI
- The game starts in the Lobby: newGame(seed, {start:'town'}); scene 'town' behaves like 'floor'.
- Input: contextmenu preventDefault; right mouse → button:2 (cast the selected skill); F1–F4 → key events with preventDefault;
  belt 1–4; I = inventory drawer, C = Employee File, S = skills panel (or a tab); Esc closes the dialog before pausing.
- Death: a Respawn control → {t:'respawn'} (Lobby, no loss), plus the existing Restart.
- Panels per docs/product/variants/inventory-panel/decision.md (side drawer, must-fix list): inventory grid, paper doll,
  belt, Employee File with allocate, skills panel (learnSkill/assignSkill), tooltips with comparison.
- Dialog window from state.ui.dialog; healer → {t:'heal'}; vendor window (buy/sell) opened from the NPC; stash.
- HUD: XP bar from xp/xpNext, level, attr/skill point indicators, skill bar with F1–F4 and the selected slot highlighted,
  belt with potion icons; stairsLocked message.
- Test hook: expose the core cheats under cheat.* (setLevel, setHp, teleportFloor, giveGold, spawnMonster, spawnItem).
