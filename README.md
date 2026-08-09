# SVG Animation Factory

A browser-based SVG animation studio. Drop in a logo or illustration, break it into
animatable pieces, keyframe it on a timeline, and export production-ready code.

Everything runs client-side — no upload, no account, no server. Your artwork never
leaves the browser.

## What it does

**Index** — parses any SVG and builds a labelled element tree. Shapes are named by
their colour and kind ("crimson shape 3") rather than by opaque path ids, and every
colour in the file becomes a swatch you can click to select all its users at once.
The tree is ordered front-most first, the way Photoshop and Illustrator do it, and
rows drag to restack — dropping one above another puts it in front.

**Paint** — double-click anything on the canvas for an HSV colour wheel: hue ring
outside, saturation/value square inside, with a hex field and eyedropper alongside.

**Separate** — the part that makes real logos animatable:
- split live `<text>` into one element per character or word, positioned by glyph metrics
- explode a welded compound path into separate shapes, welding each counter (the hole
  in O, A, B…) back onto its own glyph so letters don't turn into blobs

**Fills** — solid colours, linear and radial gradients written as real `<linearGradient>` /
`<radialGradient>` nodes in `<defs>`, with a sampler that reads back what's already there.

**Icons** — search 200,000+ open-source icons from [Iconify](https://icon-sets.iconify.design/)
and drop one straight onto the canvas, centred and scaled to fit. Two API calls per
search (names, then one bulk fetch per set), so previews render without a request per
tile and insertion needs no network at all. Each icon keeps its set's licence, shown on
hover. Icon markup goes through the same sanitiser as a dropped file, and internal ids
are namespaced so two icons can never collide.

**Animate** — 29 animatable properties across five groups (position, transform + 3D,
opacity/colour, CSS filters, line drawing), 41 presets, per-clip stagger, motion paths,
and a scrubable timeline.

**Lanes** — every clip is its own lane, and lanes run **in parallel by default**: a new
clip starts at zero rather than queueing behind the last one, so you can stack several
effects on one element or drive different elements at once. Drag a bar to move it in
time; drag either edge to retime it. Switch "Place at" to *After previous* when you do
want a sequence. The ruler has its own zoom — it grows to fit but never shrinks on its
own, so shortening the longest clip is something you can actually see. **Fit** pulls it
back in.

**Undo** — `Ctrl+Z` / `Ctrl+Shift+Z` across everything: clips, paint, splits, moves and
icon inserts. Steps are coalesced per gesture, so dragging a slider is one undo, not forty.

**Export** — five formats:

| Tab | Output |
|---|---|
| GSAP JS | A `gsap.matchMedia()` block scoped to `#saf-root`, reduced-motion aware |
| Animated SVG | One self-contained SMIL `.svg` — no JavaScript, works in `<img>` and CSS |
| Standalone HTML | Self-contained page, GSAP from CDN |
| WordPress / Bricks | `functions.php` enqueue + child-theme JS file + markup notes |
| CSS keyframes | Transform, opacity and filter clips (no draw-on or motion paths) |
| Indexed SVG | The cleaned markup with the ids the generated code targets |

Each tab carries its own panel explaining what the format is, what it can and can't
do, and how to put it on a page. The Animated SVG tab additionally reports what your
particular timeline loses in the conversion, rather than dropping it silently.

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
  transport.js        playback controls, lanes, bar dragging, ruler zoom
  history.js          snapshot undo/redo
  icons.js            Iconify search and insertion
  wheel.js            HSV colour wheel
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
| `Ctrl Z` | Undo |
| `Ctrl Shift Z` / `Ctrl Y` | Redo |
| `Space` | Play / pause |
| `Esc` | Deselect, close any sheet |
| `Del` | Delete the active clip |
| `↑ ↓ ← →` | Nudge selection 1px (`Shift` = 10px) |
| `P` | Open the paint popover |
| `I` | Open the icon browser |
| `Ctrl A` | Select all |
| `Ctrl E` | Export |
| `Ctrl S` | Save project file |

Drag on the canvas to move elements (`Shift` locks to an axis); double-click to paint.
In the icon browser, hold `Shift` while clicking to insert several without closing.

## Notes

- Sanitisation strips `<script>`, `on*` handlers and `javascript:` hrefs from loaded SVG.
- Elements are repositioned with a dedicated `<g>` wrapper rather than their own
  `transform`, because GSAP owns that attribute and would wipe the offset mid-tween.
- Infinitely repeating clips run as tweens beside the master timeline — folding them in
  would make the timeline infinitely long and break the scrubber.
- Undo is snapshot-based, not command-based: a dozen call sites mutate the live SVG, so
  recording an inverse for each would be a standing invitation to miss one. Neighbouring
  snapshots share their markup string by reference, and restoring skips the reparse when
  only clips changed, which keeps the common case cheap.
- Bar dragging freezes the time→pixel mapping for the length of the gesture. Rebuilding
  live would rescale the ruler under the pointer, making it impossible to drag a clip
  past the current end of the timeline.
- The only network calls in the app are to `api.iconify.design`, and only while the icon
  browser is open.
- Exports clear the playhead before serialising. GSAP writes the current frame into
  inline styles and the `transform` attribute, so cloning mid-preview would bake that
  frame in — harmless in the GSAP exports, which overwrite it immediately, but fatal in
  the SMIL file, whose animations add to whatever base state they find.
- SMIL easing is sampled from GSAP's own ease function rather than approximated with
  `keySplines`. SMIL requires every spline control point to sit inside 0–1, and the
  eases people actually reach for — `back`, `elastic`, `bounce` — all overshoot. An
  out-of-range control point makes the element invalid and the effect disappears.
