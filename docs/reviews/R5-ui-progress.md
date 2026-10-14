# R5 UI progress (UI-R5, implementer)

Progress lines (L-15): one line per finished item, "done: X; next: Y".

- done: read inputs (R4 notes/contract, decision, A.html, game/main/screens/panels/options); audio cues for 24 skills + 18 event types, PENDING emptied, todo test replaced by a real test (test/audio.test.js 24/24); next: shell wiring (game.js/main.js/testhook).
- done: HUD chrome wired into hud.js (drawPanelChrome/snapRect from hudchrome.js, inline copy removed); next: shell wiring
- done: e2e/run-all.mjs per-script timeout (240 s default, replay/polish overrides), live summary lines, TIMEOUT marker, new script slot r5ui (to be written); next: shell wiring (game/main/testhook)
- done: shell wiring (game.js session cmds/slots getter/menus slots+create, main.js slot store+migrateLegacy+autosave to active slot, testhook slots/character/tree), icons for 24 skills/9 branches/3 classes, ui/slots.js, ui/charselect.js (variant A), ui/tree.js, screens/options integration, CSS; first look at charselect ok; next: look at slots/tree, fix e2e, new e2e r5ui, tests, shots
- done: e2e updated (ui.mjs class model, s3ui.mjs slots + class-independent boss kill via cheat.damageMonster, r5ui.mjs new: create/slots/tree), test/ui-r5.test.js, hook cheat.damageMonster; npm test 574 pass x3; next: full npm run e2e, look at screenshots, copy dist to play/
- done: final npm test 574 x3 pass, npm run e2e OK (12 scripts, r5ui 89 checks incl. migration), shots regenerated, dist copied to play/index.html
