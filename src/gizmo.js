/* =====================================================================
   TRANSFORM GIZMO — the box with corner handles

   Drawn into the selection overlay in screen space, but every calculation
   happens in the SVG root's user space, so it behaves identically at any
   zoom and on elements nested any depth.

   A single selection gets a box that rotates with the element, taken from
   the wrapper's natural bounds pushed through its full screen matrix. A
   multi-selection gets the axis-aligned union instead — a group of
   differently-rotated shapes has no one honest angle to draw.

   Corner handles scale uniformly, always. One factor drives both axes, so
   the artwork cannot be pinched or squeezed no matter how the corner is
   dragged. Scale X and Y remain separately editable in the Transform
   panel for anyone who deliberately wants that.
   ===================================================================== */
import { S, $, NS, round, clamp, markDirty } from './state.js';
import { readXf, patchXf, wrapFor } from './transform.js';
import { rootBBox, toLocalDelta } from './align.js';
import { topSel } from './selection.js';

const HANDLE = 9;          // screen px
const ROTATE_ARM = 26;     // distance from the top edge to the rotate knob
const MIN_SCALE = 0.02;

let GIZ = null;            // live drag state
let onCommit = null;       // refresh panels once a drag finishes
let redraw = () => {};     // selection.js hands us its renderOverlay

export function onGizmoCommit(fn) { onCommit = fn; }
export function setGizmoRedraw(fn) { redraw = fn; }

/* ---------------------------------------------------------------------
   Geometry
   --------------------------------------------------------------------- */
const screenPt = (m, x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });

/* The element's four corners in screen space, measured from its *static*
   geometry.

   The child's getBBox() is pre-transform, and the wrapper's screen matrix
   stops short of the child's transform — which is where GSAP writes the
   animation. Taken together they describe where the artwork sits at rest,
   so the box holds still instead of pulsing along with a playing timeline.
   Measuring the wrapper's box, or the element's client rect, folds the
   animation straight back in. */
export function staticQuad(node) {
  const g = wrapFor(node);
  let b, m;
  try { b = node.getBBox(); m = g.getScreenCTM(); } catch (e) { return null; }
  if (!m || (!b.width && !b.height)) return null;
  return [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]]
    .map(([x, y]) => screenPt(m, x, y));
}

/* Screen-space corners of the gizmo, clockwise from top-left. */
function corners(wrapRect) {
  const recs = topSel();
  if (!recs.length) return null;
  const off = p => ({ x: p.x - wrapRect.x, y: p.y - wrapRect.y });

  if (recs.length === 1) {
    const q = staticQuad(recs[0].node);
    return q ? q.map(off) : null;
  }

  // several elements — axis-aligned union, still from static geometry
  let l = Infinity, t = Infinity, r = -Infinity, bt = -Infinity;
  recs.forEach(rec => {
    const q = staticQuad(rec.node);
    if (!q) return;
    q.forEach(p => {
      l = Math.min(l, p.x); t = Math.min(t, p.y);
      r = Math.max(r, p.x); bt = Math.max(bt, p.y);
    });
  });
  if (!isFinite(l) || r <= l) return null;
  return [{ x: l, y: t }, { x: r, y: t }, { x: r, y: bt }, { x: l, y: bt }].map(off);
}

/* ---------------------------------------------------------------------
   Drawing
   --------------------------------------------------------------------- */
export function renderGizmo(ov, wrapRect) {
  if (GIZ) return;                       // frozen for the duration of a drag
  const pts = corners(wrapRect);
  if (!pts) return;

  const mk = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const g = mk('g', { id: 'gizmo' });
  g.appendChild(mk('polygon', { class: 'giz-box', points: pts.map(p => `${p.x},${p.y}`).join(' ') }));

  // rotate knob, on the outward normal of the top edge
  const midTop = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  const midBot = { x: (pts[3].x + pts[2].x) / 2, y: (pts[3].y + pts[2].y) / 2 };
  let nx = midTop.x - midBot.x, ny = midTop.y - midBot.y;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  const knob = { x: midTop.x + nx * ROTATE_ARM, y: midTop.y + ny * ROTATE_ARM };
  g.appendChild(mk('line', { class: 'giz-arm', x1: midTop.x, y1: midTop.y, x2: knob.x, y2: knob.y }));
  g.appendChild(mk('circle', { class: 'giz-rot', 'data-giz': 'rotate', cx: knob.x, cy: knob.y, r: 6 }));

  pts.forEach((p, i) => {
    g.appendChild(mk('rect', {
      class: 'giz-handle', 'data-giz': 'scale', 'data-corner': i,
      x: p.x - HANDLE / 2, y: p.y - HANDLE / 2, width: HANDLE, height: HANDLE,
    }));
  });

  ov.appendChild(g);
}

/* ---------------------------------------------------------------------
   Dragging
   --------------------------------------------------------------------- */
const toUser = (inv, x, y) => ({ x: inv.a * x + inv.c * y + inv.e, y: inv.b * x + inv.d * y + inv.f });

function snapshot() {
  return topSel().map(rec => {
    const box = rootBBox(rec.node);
    if (!box) return null;
    return {
      node: rec.node,
      xf: readXf(rec.node),
      c: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
    };
  }).filter(Boolean);
}

function beginGizmo(e) {
  const h = e.target.closest('[data-giz]');
  if (!h || e.button !== 0) return false;

  let inv;
  try { inv = S.svg.getScreenCTM().inverse(); } catch (err) { return false; }

  const wrapRect = $('#stagewrap').getBoundingClientRect();
  const pts = corners(wrapRect);
  if (!pts) return false;

  const items = snapshot();
  if (!items.length) return false;

  // selection centre and the fixed anchor, both in root user space
  const centreScreen = {
    x: (pts[0].x + pts[2].x) / 2 + wrapRect.x,
    y: (pts[0].y + pts[2].y) / 2 + wrapRect.y,
  };
  const centre = toUser(inv, centreScreen.x, centreScreen.y);
  const start = toUser(inv, e.clientX, e.clientY);

  GIZ = {
    mode: h.dataset.giz, inv, items, centre, start,
    node: h, moved: false,
  };

  if (GIZ.mode === 'scale') {
    // Photoshop keeps the opposite corner nailed down.
    const i = +h.dataset.corner;
    const opp = pts[(i + 2) % 4];
    GIZ.anchor = toUser(inv, opp.x + wrapRect.x, opp.y + wrapRect.y);
    GIZ.startDist = Math.hypot(start.x - GIZ.anchor.x, start.y - GIZ.anchor.y) || 1;
  } else {
    GIZ.startAngle = Math.atan2(start.y - centre.y, start.x - centre.x);
  }

  try { $('#overlay').setPointerCapture(e.pointerId); } catch (err) { /* nicety */ }
  e.preventDefault();
  e.stopPropagation();
  return true;
}

function moveGizmo(e) {
  if (!GIZ) return;
  GIZ.moved = true;
  const p = toUser(GIZ.inv, e.clientX, e.clientY);

  if (GIZ.mode === 'scale') {
    const d = Math.hypot(p.x - GIZ.anchor.x, p.y - GIZ.anchor.y);
    // One factor for both axes — this is what keeps it uniform.
    const k = Math.max(MIN_SCALE, d / GIZ.startDist);
    GIZ.items.forEach(it => {
      const want = {
        x: GIZ.anchor.x + (it.c.x - GIZ.anchor.x) * k,
        y: GIZ.anchor.y + (it.c.y - GIZ.anchor.y) * k,
      };
      const dl = toLocalDelta(it.node, want.x - it.c.x, want.y - it.c.y);
      patchXf(it.node, {
        sx: clamp(it.xf.sx * k, 0.01, 100),
        sy: clamp(it.xf.sy * k, 0.01, 100),
        x: round(it.xf.x + dl.dx, 3),
        y: round(it.xf.y + dl.dy, 3),
      });
    });
    $('#stat').textContent = `scale ${Math.round(k * 100)}%`;
  } else {
    let a = Math.atan2(p.y - GIZ.centre.y, p.x - GIZ.centre.x) - GIZ.startAngle;
    let deg = a * 180 / Math.PI;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;      // conventional snap
    const rad = deg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    GIZ.items.forEach(it => {
      const vx = it.c.x - GIZ.centre.x, vy = it.c.y - GIZ.centre.y;
      const want = {
        x: GIZ.centre.x + vx * cos - vy * sin,
        y: GIZ.centre.y + vx * sin + vy * cos,
      };
      const dl = toLocalDelta(it.node, want.x - it.c.x, want.y - it.c.y);
      patchXf(it.node, {
        rot: round(it.xf.rot + deg, 2),
        x: round(it.xf.x + dl.dx, 3),
        y: round(it.xf.y + dl.dy, 3),
      });
    });
    $('#stat').textContent = `rotate ${Math.round(deg)}°`;
  }

  // Redraw the outlines but not the gizmo — renderGizmo bails while a drag
  // is live, so the handles never jump out from under the pointer.
  redraw();
}

function endGizmo() {
  if (!GIZ) return;
  const moved = GIZ.moved;
  GIZ = null;
  $('#stat').textContent = S.fileName;
  if (moved) { markDirty(); if (onCommit) onCommit(); }
  redraw();
}

export function bindGizmo() {
  const ov = $('#overlay');
  ov.addEventListener('pointerdown', beginGizmo);
  ov.addEventListener('pointermove', e => { if (GIZ) moveGizmo(e); });
  ov.addEventListener('pointerup', endGizmo);
  ov.addEventListener('pointercancel', endGizmo);
}

export const gizmoBusy = () => !!GIZ;
