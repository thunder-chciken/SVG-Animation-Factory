# SVG Animation Factory

A browser-based SVG animation studio. Drop in a logo or illustration, break it into
animatable pieces, keyframe it on a timeline, and export production-ready code.

Everything runs client-side — no upload, no account, no server. Your artwork never
leaves the browser.

## What it does

**Index** — parses any SVG and builds a labelled element tree. Shapes are named by
their colour and kind ("crimson shape 3") rather than by opaque path ids, and every
colour in the file becomes a swatch you can click to select all its users at once.

**Separate** — the part that makes real logos animatable:
- split live `<text>` into one element per character or word, positioned by glyph metrics
- explode a welded compound path into separate shapes, welding each counter (the hole
  in O, A, B…) back onto its own glyph so letters don't turn into blobs

**Paint** — solid fills, linear and radial gradients written as real `<linearGradient>` /
`<radialGradient>` nodes in `<defs>`, with a sampler that reads back what's already there.

**Animate** — 29 animatable properties across five groups (position, transform + 3D,
opacity/colour, CSS filters, line drawing), 41 presets, per-clip stagger, motion paths,
and a scrubable timeline with clip bars.

**Export** — five formats:

| Tab | Output |
|---|---|
| GSAP JS | A `gsap.matchMedia()` block scoped to `#saf-root`, reduced-motion aware |
| Standalone HTML | Self-contained page, GSAP from CDN |
| WordPress / Bricks | `functions.php` enqueue + child-theme JS file + markup notes |
| CSS keyframes | Transform, opacity and filter clips (no draw-on or motion paths) |
| Indexed SVG | The cleaned markup with the ids the generated code targets |

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build     # → dist/
npm run preview   # serve the built output
```

## Deploying

The build is static. On Vercel it is zero-config — `vercel.json` pins the framework,
build command and output directory, and adds long-lived caching for hashed assets.

## Saving work

- **Session autosave** — the current project is written to `localStorage` (debounced,
  plus a flush on unload) and restored on the next visit.
- **Save / Open project** — a `.saf.json` file holding the live markup plus every clip,
  trigger setting and hidden-element flag. Element ids are preserved inside it, so
  reopening a project keeps each clip pointed at the right shapes.

## Layout

```
index.html            markup shell only
src/
  main.js             boot and wiring — the only module with side effects
  state.js            the S object, DOM helpers, dirty signalling
  gsap.js             single GSAP import + plugin registration
  color.js            colour parsing and perceptual naming
  ingest.js           sanitise, mount, index, palette
  selection.js        selection, overlay, drag-to-move
  layers.js           layer tree and swatches
  separate.js         text and compound-path splitting
  paint.js            fill/stroke/gradient editor
  schema.js           the animatable property table
  ui.js               shared template helpers
  presets.js          the preset library
  inspector.js        right panel
  timeline.js         clip list → live GSAP timeline
  transport.js        playback controls and clip bars
  filters.js          CSS filter functions shared with the exporters
  project.js          localStorage session + .saf.json files
  render.js           the one full-UI repaint
  shell.js            topbar, dropzone, export sheet, shortcuts
  export/             one module per output format
  styles/             one stylesheet per concern
```

Modules are side-effect free on import, so the circular references between panels
(selection → inspector → timeline → transport → selection) resolve safely through
hoisted function bindings. Keep it that way: put new wiring in `main.js`.

## Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `Esc` | Deselect, close the export sheet |
| `Del` | Delete the active clip |
| `↑ ↓ ← →` | Nudge selection 1px (`Shift` = 10px) |
| `P` | Open the paint popover |
| `Ctrl A` | Select all |
| `Ctrl E` | Export |
| `Ctrl S` | Save project file |

Drag on the canvas to move elements (`Shift` locks to an axis); double-click to paint.

## Notes

- Sanitisation strips `<script>`, `on*` handlers and `javascript:` hrefs from loaded SVG.
- Elements are repositioned with a dedicated `<g>` wrapper rather than their own
  `transform`, because GSAP owns that attribute and would wipe the offset mid-tween.
- Infinitely repeating clips run as tweens beside the master timeline — folding them in
  would make the timeline infinitely long and break the scrubber.
