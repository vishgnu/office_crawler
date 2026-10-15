# Asset licences

Checked 2026-10-15 against the tree of `office-crawler/` (R8-T, CORE-R8T-1).

**Result: the shipped game (`dist/index.html`, copied to `play/index.html`) contains no external asset.** There is nothing to attribute and no third-party licence to carry.

| Kind | What the game uses | Source | Licence |
|---|---|---|---|
| Art (sprites, tiles, props, gear, UI chrome, character-select and title screens) | Drawn at start-up by canvas and inline SVG code in `src/render/**` and `src/ui/**` (e.g. `src/render/styles/vector/`, `src/render/gearparts*.js`, `src/ui/screens.js`, `src/ui/charselect.js`). No image file is loaded. | Own code, written for this project; some painters are ported from the project's own design prototypes under `docs/product/variants/` | Project's own (same licence as the repository code) |
| Fonts | None bundled and no `@font-face` or web-font request. Text uses the visitor's system fonts: stacks `'Trebuchet MS','Segoe UI',system-ui,'Helvetica Neue','Liberation Sans',Arial,sans-serif` and `Georgia,'Times New Roman','Liberation Serif',serif` (`src/render/fx.js`, `hud.js`, `map.js`, `labels.js`, `src/style.css`). | The visitor's operating system | Not redistributed by the game |
| Audio | None. All sound is synthesised at run time with the Web Audio API (oscillators, noise, filters, a small reverb) in `src/audio/kits/{gothic,chiptune,foley}.js`. No sample file is loaded or decoded. | Own code; kits lifted from the project's own sound-direction prototypes | Project's own |
| Icons / favicon | Inline SVG or canvas in code | Own code | Project's own |

## Evidence

- File scan (excluding `node_modules`, `docs`, `test`, `e2e`): no `.png .jpg .gif .webp .svg .woff .woff2 .ttf .otf .mp3 .ogg .wav` file exists. `src/` holds only `.js`, one `.css` and one `.html` file.
- `grep` of `src/` for `new Image`, `fetch(`, `decodeAudioData`, `<img`, `<link`, `@font-face` and `http(s)://` finds nothing except the SVG namespace string; the only `url(...)` uses are in-document gradient references (`url(#sky...)`).
- `dist/index.html` contains no `data:image`, `data:font` or `base64` payload; `build.mjs` bundles only `src/main.js`, `src/style.css` and `src/index.html` into one file.
- Runtime dependencies: none (`package.json` has only `devDependencies`). Dev tools, not shipped in the bundle: `esbuild` 0.25.10 (MIT) and `playwright` 1.56.1 (Apache-2.0), used for build and tests.

## When this changes

Any future external file (font, sample, image, library) must be added to the table above with its source URL, licence and date before it is merged; `grep` above is the check.
