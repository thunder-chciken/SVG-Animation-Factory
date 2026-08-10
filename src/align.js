/* =====================================================================
   ALIGN, DISTRIBUTE AND GRID SNAP

   Everything works in the SVG root's user space, which is the only frame
   where "left edge" means the same thing for a shape at the top level and
   one nested three groups deep. Element bounds come back through
   getScreenCTM, and the move is converted into whatever space the
   element's own parent happens to be in before it is written.
   ===================================================================== */
import { S, round } from './state.js';
import { readXf, patchXf, wrapFor } from './transform.js';

/* Node bounds expressed in the root's user units. */
export function rootBBox(node) {
  let b, m;
  try {
    b = node.getBBox();
    m = S.svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
  } catch (e) { return null; }
  if (!b || (!b.width && !b.height)) return null;

  const pt = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
  const cs = [pt(b.x, b.y), pt(b.x + b.width, b.y), pt(b.x, b.y + b.height), pt(b.x + b.width, b.y + b.height)];
  const xs = cs.map(p => p.x), ys = cs.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* A root-space delta, restated in the coordinate space the element's
   wrapper actually lives in. Only the linear part matters for a delta. */
export function toLocalDelta(node, dx, dy) {
  const parent = wrapFor(node).parentNode;
  if (!parent || parent === S.svg) return { dx, dy };
  try {
    const m = S.svg.getScreenCTM().inverse().multiply(parent.getScreenCTM());
    const det = m.a * m.d - m.b * m.c;
    if (!det) return { dx, dy };
    return {
      dx: (m.d * dx - m.c * dy) / det,
      dy: (-m.b * dx + m.a * dy) / det,
    };
  } catch (e) { return { dx, dy }; }
}

export function moveByRoot(node, dx, dy) {
  if (!dx && !dy) return;
  const d = toLocalDelta(node, dx, dy);
  const t = readXf(node);
  patchXf(node, { x: round(t.x + d.dx, 3), y: round(t.y + d.dy, 3) });
}

export function artboardBox() {
  const [x, y, w, h] = (S.svg?.getAttribute('viewBox') || '0 0 100 100')
    .trim().split(/[\s,]+/).map(Number);
  return { x, y, w, h };
}

export function unionBox(boxes) {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map(b => b.x));
  const y = Math.min(...boxes.map(b => b.y));
  const r = Math.max(...boxes.map(b => b.x + b.w));
  const bt = Math.max(...boxes.map(b => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

/* ---------------------------------------------------------------------
   Align

   `to` is 'selection' or 'artboard'. Aligning a lone element to the
   selection would be a no-op, so a single target always uses the
   artboard — which is what anyone reaching for it actually meant.
   --------------------------------------------------------------------- */
export function alignNodes(recs, edge, to = 'selection') {
  const items = recs
    .map(r => ({ rec: r, box: rootBBox(r.node) }))
    .filter(i => i.box);
  if (!items.length) return 0;

  const frame = (to === 'artboard' || items.length < 2)
    ? artboardBox()
    : unionBox(items.map(i => i.box));

  items.forEach(({ rec, box }) => {
    let dx = 0, dy = 0;
    switch (edge) {
      case 'left':   dx = frame.x - box.x; break;
      case 'right':  dx = (frame.x + frame.w) - (box.x + box.w); break;
      case 'hcenter':dx = (frame.x + frame.w / 2) - (box.x + box.w / 2); break;
      case 'top':    dy = frame.y - box.y; break;
      case 'bottom': dy = (frame.y + frame.h) - (box.y + box.h); break;
      case 'vcenter':dy = (frame.y + frame.h / 2) - (box.y + box.h / 2); break;
      case 'center':
        dx = (frame.x + frame.w / 2) - (box.x + box.w / 2);
        dy = (frame.y + frame.h / 2) - (box.y + box.h / 2);
        break;
    }
    moveByRoot(rec.node, dx, dy);
  });
  return items.length;
}

/* Even gaps between the outermost two, which stay put. */
export function distributeNodes(recs, axis) {
  const items = recs
    .map(r => ({ rec: r, box: rootBBox(r.node) }))
    .filter(i => i.box);
  if (items.length < 3) return 0;

  const horiz = axis === 'h';
  const key = horiz ? 'x' : 'y';
  const size = horiz ? 'w' : 'h';
  items.sort((a, b) => (a.box[key] + a.box[size] / 2) - (b.box[key] + b.box[size] / 2));

  const first = items[0].box, last = items[items.length - 1].box;
  const span = (last[key] + last[size] / 2) - (first[key] + first[size] / 2);
  const step = span / (items.length - 1);

  items.forEach((it, i) => {
    if (i === 0 || i === items.length - 1) return;
    const want = (first[key] + first[size] / 2) + step * i;
    const has = it.box[key] + it.box[size] / 2;
    const d = want - has;
    moveByRoot(it.rec.node, horiz ? d : 0, horiz ? 0 : d);
  });
  return items.length;
}

/* ---------------------------------------------------------------------
   Grid
   --------------------------------------------------------------------- */
export const snapValue = v => {
  const g = S.grid;
  if (!g.on || g.size <= 0) return v;
  return Math.round(v / g.size) * g.size;
};

/* Snap a drag so the element's own top-left lands on the grid, rather than
   snapping the raw offset — otherwise a shape that started off-grid stays
   off-grid forever, just by a rounder amount. */
export function snapDelta(box0, dx, dy) {
  const g = S.grid;
  if (!g.on || g.size <= 0 || !box0) return { dx, dy };
  return {
    dx: snapValue(box0.x + dx) - box0.x,
    dy: snapValue(box0.y + dy) - box0.y,
  };
}
