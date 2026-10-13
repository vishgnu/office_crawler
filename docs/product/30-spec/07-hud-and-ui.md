# 07 HUD and UI

Areas: G UI/HUD (R-070..R-077), J text (R-102..R-104), NFR-A03..A06. Contract: `10-tech-and-testability.md`. UI elements carry stable `data-testid`s or entries under `getState().ui` so tests do not depend on pixels.

### R-070 Health and mana gauges in the HUD (must · MVP)

- **AC-R-070-1** `S1` `E2E` — Given a running game, When `getState().ui.hud` is read, Then `hud.health.value === player.hp`, `hud.health.max === player.hpMax`, `hud.mana.value === player.mp`, `hud.mana.max === player.mpMax`, and fill ratios equal value/max within 0.01.
- **AC-R-070-2** `S1` `E2E` — Given the player takes 10 damage, When `step(1)` after the hit, Then `hud.health.value` equals the new `player.hp` in that same snapshot (no lag over 1 tick).
- **AC-R-070-3** `S1` `E2E` — Given the HUD, When read, Then `hud.health.shape` and `hud.mana.shape` are different values (e.g. cup vs jug) and each gauge exposes a numeric text label "value / max" (NFR-A03: not colour alone).
- **AC-R-070-4** `S1` `E2E` — Given hp = 0 or mp = 0, When the HUD is read, Then the ratio is exactly 0 and no negative fill; given hp = hpMax the ratio is exactly 1.
- **AC-R-070-5** `S1` `E2E` — Given a screenshot at 1280x720, When the gauge regions (from `hud.health.rect`, `hud.mana.rect`) are checked, Then each lies fully inside the viewport and does not overlap the other (layout sanity; the look is QF-07-1).

### R-071 Skill bar and belt on the HUD (must · MVP)

- **AC-R-071-1** `S2` `E2E` — Given a running game, When `ui.hud.skillBar` is read, Then it lists the primary and secondary skill and the 4 hotkey slots with the assigned skill ids matching `player.skillBar`.
- **AC-R-071-2** `S2` `E2E` — Given `belt`, When `ui.hud.belt` is read, Then it has 4 slots, each mirroring `belt[i]` (item or empty) and showing its key label from `options.keys`.
- **AC-R-071-3** `S2` `E2E` — Given a skill with insufficient mana, When the HUD is read, Then that skill's bar entry has `disabled === true`.

### R-072 Character panel (must · MVP)

- **AC-R-072-1** `S2` `E2E` — Given `key('KeyC')`, When pressed, Then `ui.panels.character === true`, and the panel text contains `level`, `xp / xpNext`, the four attributes, `attrPoints`, `skillPoints`, `hp / hpMax`, `mp / mpMax`, `damage` range and `defense`, all equal to the corresponding `player` fields.
- **AC-R-072-2** `S2` `E2E` — Given the panel open and a level-up, When it happens, Then the displayed values update in the next snapshot.
- **AC-R-072-3** `S2` `E2E` — Given the panel open, When `key('KeyC')` or `Escape`-close is used, Then `ui.panels.character === false`.

### R-073 Inventory and equipment panel (must · MVP)

- **AC-R-073-1** `S2` `E2E` — Given `key('KeyI')`, When pressed, Then `ui.panels.inventory === true`, a 10x4 grid and the ten equipment slots are shown, and each placed item appears at its grid cell with its size.
- **AC-R-073-2** `S2` `E2E` — Given the panel, When an item is clicked, Then `cursorItem` is set and the cursor shows it; a second click on a free area of the grid places it (AC-R-055-2).
- **AC-R-073-3** `S2` `E2E` — Given the panel open next to the vendor panel, When the inventory is read, Then both panels do not overlap at 1280x720 (rect check).
- **AC-R-073-4** `S2` `E2E` — Given an item with rarity, When shown in the inventory, Then its cell border and mark follow AC-R-051-2.

### R-074 Skill panel (must · MVP)

- **AC-R-074-1** `S2` `E2E` — Given `key('KeyS')`, When pressed, Then `ui.panels.skills === true` and the panel lists the 4 active skills, 2 passive skills and the basic attack with current level, max level, mana cost and the unspent `skillPoints`.
- **AC-R-074-2** `S2` `E2E` — Given `skillPoints >= 1`, When the upgrade control of skill X is clicked, Then AC-R-014-2 holds; with 0 points the controls are disabled.

### R-075 Minimap / automap overlay (should · MVP)

- **AC-R-075-1** `S2` `E2E` — Given a new floor, When `floor.explored` is read, Then only tiles within `config.exploreRadius` of the player (and previously visited ones) are marked; after moving 10 tiles the explored set is a strict superset of before.
- **AC-R-075-2** `S2` `E2E` — Given `key('KeyM')` (or `Tab`), When pressed, Then `ui.panels.map` toggles and the map shows only explored tiles plus the player marker at `player.tile`.

### R-076 Main menu, pause menu, options, game over/victory screens (must · MVP)

- **AC-R-076-1** `S1` `E2E` — Given the title screen, When read, Then `scene === 'title'` and it offers "New game"; "Continue" is present and enabled only if a valid save exists (S3), "Options" present (S3).
- **AC-R-076-2** `S1` `E2E` — Given scene `floor`, When `key('Escape')`, Then `ui.menu === 'pause'` with "Resume" and "Quit to title" (S3: also "Options"); choosing "Resume" clears `ui.menu` and `paused === false`; choosing "Quit to title" gives `scene === 'title'`.
- **AC-R-076-3** `S1` `E2E` — Given `scene === 'dead'`, When the screen is read, Then a game-over screen shows with a "Restart" control (AC-R-023-2, AC-R-023-3).
- **AC-R-076-4** `S3` `E2E` — Given the boss is defeated, When `scene === 'victory'`, Then the victory screen is shown with "Keep playing" and "Quit to title".
- **AC-R-076-5** `S3` `E2E` — Given the options screen, When opened from the title and pause menus, Then it shows the volume sliders (AC-R-082-1), key rebinding (AC-NFR-A01-1), reduced motion and text size options (AC-NFR-A05-1, AC-NFR-A04-2), and "Back" returns to the screen it came from.
- **AC-R-076-7** `S1` `E2E` — Given menus, When controls are clicked with the mouse, Then they activate on click (`click` event), and a click on the canvas behind an open modal menu does not move the player.

### R-077 Monster health bar on target, experience bar (should · MVP)

- **AC-R-077-1** `S2` `E2E` — Given a targeted or hovered living monster, When `ui.hud.target` is read, Then it equals `{id, name, hp, hpMax}` of that monster, ratio = hp/hpMax; when no target, it is `null`.
- **AC-R-077-2** `S2` `E2E` — Given `xp` and `xpNext`, When `ui.hud.xpBar` is read, Then ratio equals `(xp - xpPrev) / (xpNext - xpPrev)` within 0.01, 0 at the start of a level.

### R-102 Original names, text and story throughout (must · MVP)

- **AC-R-102-1** `S1` `E2E` — Given the title screen, the HUD, a pause menu and (later) the town, vendor and inventory screens, When all visible text is scraped, Then every string is present in `content.strings` (single string table, NFR-A06) and none matches a denylist term.
- **AC-R-102-2** `S1` `Unit` — Given source files, When searched for user-visible string literals in UI code, Then none exists outside `content.strings` (a lint rule or grep test) (NFR-A06).
- **AC-R-102-3** `S2` `Unit` — Given registries of monsters, items, affixes, uniques, NPCs, skills, classes and zones, When all `name` and text fields are scanned, Then none matches the denylists (AC-NFR-L01-1) and none is empty.
- **AC-R-102-4** `S1` `E2E` — Given the game title shown on the title screen and in `document.title`, When read, Then it is the working title "Office Crawler" or a facilitator-approved replacement (QF-07-3) and passes AC-NFR-L03-1.

### R-103 Tone: light dark-comedy satire (should · MVP)

- **AC-R-103-1** `S2` `Unit` — Given `content.strings`, When scanned against `denylist-real-brands.txt` and a list of blocked offensive terms `denylist-offensive.txt` (QF-07-4), Then no match.
- **AC-R-103-2** `S2` `Unit` — Given the item base registry, When weapon bases are read, Then each is an office object (flag `officeObject: true` in the registry, for example stapler, letter opener, chair leg) and none is a conventional fantasy weapon name list entry (`content.blockedWeaponWords`).
- **AC-R-103-3** `S2` `E2E` — Given a kill, When effects are read, Then `ui.fx.gore === false` (no gore by default).

### R-104 Short original story frame (should · MVP)

- **AC-R-104-1** `S3` `Unit` — Given `content.story`, When read, Then it has three entries (start, boss, victory), each of 3 to 5 lines (`lines.length` between 3 and 5), non-empty, and passes the denylist scan.
- **AC-R-104-2** `S3` `E2E` — Given `newGame()`, When the first scene starts, Then the start story text is shown and can be dismissed with a click or key; the boss text shows on entering the boss floor; the victory text on `scene === 'victory'`.

### NFR-A03 Colour-blind-safe loot and UI (must)

- **AC-NFR-A03-1** `S2` `Unit` — Covered by AC-R-051-2 and AC-R-051-3 (rarity not by colour alone) and AC-R-070-3 (health vs mana by shape and label).
- **AC-NFR-A03-2** `S2` `Unit` — Given the palette for the four rarity colours and the health and mana colours, When each pair is transformed with the deuteranopia, protanopia and tritanopia simulation matrices, Then the perceptual difference (CIE76 delta E) between every pair is at least `config.minDeltaE` (default proposal 20) or the pair differs in the non-colour channel (mark or shape) (QF-07-5).

### NFR-A04 Text size and contrast (should)

- **AC-NFR-A04-1** `S3` `E2E` — Given 1080p, When computed font sizes of all HUD and panel text are read, Then each is at least 14 px.
- **AC-NFR-A04-2** `S3` `E2E` — Given the options "text size" setting changed to large, When applied, Then `options.textScale` rises and computed sizes scale by that factor.
- **AC-NFR-A04-3** `S3` `Unit` — Given the UI colour tokens for text and its background, When contrast is computed, Then body text pairs have ratio at least 4.5:1.

### NFR-A05 Reduced motion / flashing (should)

- **AC-NFR-A05-1** `S3` `E2E` — Given "reduce motion" on, When a hit and a level-up occur, Then `ui.fx.shake === 0` and `ui.fx.flash === 0`; persisted (AC-R-082-3 style).
- **AC-NFR-A05-2** `S3` `Unit` — Given the effect timelines, When the flash frequency of every effect is computed, Then no effect flashes more than 3 times per second.

### NFR-A06 Language (should)

- **AC-NFR-A06-1** `S1` `Unit` — Given `content.strings`, When it is read, Then it is one table keyed by id with English values and every string id used in code exists in it (AC-R-102-2).

## Not covered by an AC here

- Visual quality of the HUD gauges (coffee cup / water cooler jug look), panels and fonts: decided by the art-direction variant pick and independent visual review, not by state ACs (QF-07-1).

## Questions for the facilitator

- **QF-07-1** R-070 look ("original-looking gauges") cannot be asserted by state. Accept the visual reviewer as the gate? The ACs here only check values, shapes and layout.
- **QF-07-2** Keyboard operation of menus is not required anywhere; no AC written. Add a requirement?
- **QF-07-3** Is "Office Crawler" the approved game title for the build (Q1 says internal-only working title)?
- **QF-07-4** R-103 "no real-world offensive content" needs a list or a reviewer. Who supplies it?
- **QF-07-5** NFR-A03 asks for a palette "checked for" three colour-blind types. The delta E threshold is a proposal.

## Coverage

| Requirement | ACs | Slices | Levels |
|---|---|---|---|
| R-070 Health and mana gauges in the HUD (must · MVP) | R-070-1, R-070-2, R-070-3, R-070-4, R-070-5 | S1 | E2E |
| R-071 Skill bar and belt on the HUD (must · MVP) | R-071-1, R-071-2, R-071-3 | S2 | E2E |
| R-072 Character panel (must · MVP) | R-072-1, R-072-2, R-072-3 | S2 | E2E |
| R-073 Inventory and equipment panel (must · MVP) | R-073-1, R-073-2, R-073-3, R-073-4 | S2 | E2E |
| R-074 Skill panel (must · MVP) | R-074-1, R-074-2 | S2 | E2E |
| R-075 Minimap / automap overlay (should · MVP) | R-075-1, R-075-2 | S2 | E2E |
| R-076 Main menu, pause menu, options, game over/victory screens (must · MVP) | R-076-1, R-076-2, R-076-3, R-076-4, R-076-5, R-076-7 | S1, S3 | E2E |
| R-077 Monster health bar on target, experience bar (should · MVP) | R-077-1, R-077-2 | S2 | E2E |
| R-102 Original names, text and story throughout (must · MVP) | R-102-1, R-102-2, R-102-3, R-102-4 | S1, S2 | E2E, Unit |
| R-103 Tone: light dark-comedy satire (should · MVP) | R-103-1, R-103-2, R-103-3 | S2 | E2E, Unit |
| R-104 Short original story frame (should · MVP) | R-104-1, R-104-2 | S3 | E2E, Unit |
| NFR-A03 Colour-blind-safe loot and UI (must) | NFR-A03-1, NFR-A03-2 | S2 | Unit |
| NFR-A04 Text size and contrast (should) | NFR-A04-1, NFR-A04-2, NFR-A04-3 | S3 | E2E, Unit |
| NFR-A05 Reduced motion / flashing (should) | NFR-A05-1, NFR-A05-2 | S3 | E2E, Unit |
| NFR-A06 Language (should) | NFR-A06-1 | S1 | Unit |

Total ACs in this file: 44 (S1 13, S2 22, S3 9).
