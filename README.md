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

**Select** — click a shape, **shift-click** to add or remove more, or drag from empty
canvas to rubber-band a group. Whatever is selected is what a preset applies to, and a
preset always starts a new lane for the current selection. Drag a shape to move it;
**hold Shift mid-drag** to lock it to a straight rail (see below).

**Transform** — move, scale, rotate and skew the artwork itself, with **no animation on
it at all**. Written to a dedicated wrapper so GSAP never overwrites it and any transform
already in the source file keeps working. Clips animate on top of whatever you set here.

**Delete** — `Del` removes whatever is selected, from the canvas or the layer tree, and
cleans up any lane left with nothing to animate. There is a Delete button on the stage
toolbar too.

**Paint** — double-click anything on the canvas for an HSV colour wheel: hue ring
outside, saturation/value square inside, with a hex field, eyedropper and a stroke-width
slider with matching pixel entry.
Painting a group reaches its leaves, and colour is written as inline style as well as
an attribute so it still lands on Illustrator/Figma exports that drive fills from a
`<style>` block.

**Text** — type straight onto the canvas with font, size, weight, letter-spacing,
alignment and colour. Each line becomes its own `<text>` element so lines animate
separately, and **Split into letters** turns every character into its own element —
individually selectable, individually animatable. Seven text presets carry their own
stagger, so Typewriter, Letter cascade, Letter pop, Letter flip, Letter wave, Letters
from edges and Letter shimmer spread across the letters in one click.

Fonts are web-safe stacks on purpose: an SVG carries no font with it, so anything
exotic silently falls back on a machine that lacks it.

**Navigate** — Photoshop's canvas controls. **Alt + middle-drag** scrubby-zooms,
**middle-drag** pans, **Alt/Ctrl + wheel** zooms toward the pointer, **Space + drag**
pans, and the wheel scrolls. Zoom is a CSS transform on the stage container, so the
document's own coordinates never change and exports stay exactly as authored.

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

**Looping** — a **Looping (global)** section in the inspector: on/off, how many cycles
(or forever), a pause between them, and ping-pong. The ↻ button in the transport is a
quick on/off that also jumps to the section. Separate from a single lane's own repeat,
and carried into the GSAP, HTML, WordPress and Animated SVG exports.

**Panels** — drag any inspector section by its header to reorder it, and it stays that
way. Panel order and which sections are open persist per browser, independently of the
project, so opening a different file keeps your layout. **Reset panels** restores the
default arrangement.

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

## Files

Everything lives under **File** in the top bar:

| Item | What it does |
|---|---|
| New… | Empties the stage and starts a fresh project |
| Open… | Opens an `.svg` or a `.saf.json` project |
| Export as ▸ | PNG at 2x or 4x, JPEG at 2x, or the code export sheet |
| Open Recent ▸ | The last eight projects, stored locally and openable offline |
| Close / Close All | Closes the project; Close All also clears the recent list |
| Save | Writes back to the file you opened |
| Save As… | Writes to a new file and switches to it |
| Save a Copy… | Writes a copy without changing which file you are editing |

Save and Save As mean what they mean in a desktop app: where the browser supports the
File System Access API the studio keeps the file handle, so **Save** overwrites the file
you opened instead of dropping another numbered copy in Downloads. Elsewhere it falls
back to a download and Save behaves like Save As.

PNG and JPEG capture the canvas exactly as it looks at the current playhead — a still is
a still, so "what you can see" is the only frame that isn't a guess. JPEG has no alpha,
so it is filled with the current stage background.

The studio also autosaves the open project to `localStorage` (debounced, plus a flush on
unload) and reopens it on your next visit. Nothing is loaded over the top of it — with
nothing stored the stage starts empty and the sample is one click away under File.

## This does not have to stay a static site

Nothing here is locked into being "just HTML". It is a Vite app deployed on Vercel,
which means a backend is an additive step, not a rewrite — add an `api/` directory and
those files become serverless functions on the same domain, same deploy, same git push.
The client-side-only decision was made deliberately for v1 to ship fast and cost nothing
to run; none of it forecloses the following.

**Accounts and cloud projects.** Vercel Postgres + an auth provider, with `src/project.js`
already the single choke point for persistence — it talks to `localStorage` behind
`serialize()` / `applyProject()`, so putting an API adapter behind that interface is a
contained change rather than a refactor. Projects would sync across machines instead of
living in one browser.

**Shareable links and review.** Store a project server-side, hand out
`/p/<id>` for a read-only animated preview. Turns "email them an SVG" into a URL, and
opens the door to comments and version history.

**Server-side rendering of exports.** The one thing the browser genuinely cannot do well:
render an animation to **MP4, GIF, or Lottie**. A serverless function running headless
Chrome plus ffmpeg can play the GSAP timeline and capture frames. This is the single
biggest capability gap today, since social platforms and ad networks want video, not SVG.

**A team asset library.** Blob storage for shared logos, brand palettes and reusable
presets, so a studio builds a kit once and everyone animates from it.

**Batch and API.** Feed a directory of icons through one preset, or expose
`POST /api/animate` so a build pipeline can generate animations from CI.

Practical notes if you go this way: Vercel functions have an execution ceiling, so video
rendering wants a queue plus a longer-running worker rather than a plain request; and
adding auth means the privacy promise in the header of this README has to be rewritten
honestly, because artwork would then leave the browser.

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
  workspace.js        panel order and open state
  transform.js        static move / scale / rotate / skew
  viewport.js         canvas zoom and pan
  text.js             text creation and editing
  menu.js             File menu, recent projects, save handles
  raster.js           PNG and JPEG export
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
| `T` | Text tool |
| `Alt` + middle-drag | Zoom · middle-drag pans · `Space`+drag pans |
| `Alt`/`Ctrl` + wheel | Zoom toward the pointer |
| `Del` | Delete the selection |
| `Ctrl S` / `Ctrl Shift S` | Save / Save As |
| `Shift` + click | Add / remove from the selection |
| `Shift` during a drag | Lock movement to a straight rail |
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

Drag on the canvas to move elements; double-click one to paint it.
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
- Shift-drag is a projection onto one fixed vector, not angle snapping. The rail is
  established from the direction the drag was already travelling and never recomputed
  while Shift is held, so there are no 45-degree increments and no direction flips.
  Engaging anchors the rail at the element's current position and releasing banks the
  difference into an offset, so neither transition produces a jump.
- A modifier held at pointer-down is a selection gesture and arms no drag. Without that,
  a few stray pixels while shift-clicking shoved the whole selection across the canvas.
- Pointer capture is taken only once a press becomes a real drag. Capturing on every
  press retargets the follow-up mouse events — including `dblclick` — at the stage
  container, and double-click-to-paint stops resolving a shape.
- Canvas zoom is a CSS transform on the stage container rather than a change to the
  SVG's viewBox. The document keeps the coordinates you authored, and `getScreenCTM()`
  already folds the CSS transform in, so dragging still tracks the pointer 1:1 at any
  zoom without special-casing.
- Typed text becomes one `<text>` per line, not tspans. Tspans cannot be positioned or
  animated independently, and the letter splitter walks real `<text>` nodes.
- Static transforms are stored as a model in a data attribute rather than parsed back
  out of the transform string. Round-tripping a matrix loses which of the infinitely
  many rotate/skew/scale combinations produced it, so the sliders would drift.
- Paint writes an inline style, not just a presentation attribute. A `<style>` class
  rule outranks a presentation attribute, and Illustrator and Figma both export fills
  that way — setting only the attribute leaves the shape visibly unchanged.
- Picking a preset while the selection differs from the active clip's targets creates a
  new lane instead of rewriting that clip. Otherwise selecting new elements and clicking
  a preset silently re-skins the previous lane and appears to do nothing.
- SMIL easing is sampled from GSAP's own ease function rather than approximated with
  `keySplines`. SMIL requires every spline control point to sit inside 0–1, and the
  eases people actually reach for — `back`, `elastic`, `bounce` — all overshoot. An
  out-of-range control point makes the element invalid and the effect disappears.
