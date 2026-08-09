/* =====================================================================
   SELECTION + STAGE OVERLAY + DRAGGING
   ===================================================================== */
import { S, $, NS, round, toast, markDirty } from './state.js';
import { renderLayers, highlightLayer } from './layers.js';
import { renderInspector } from './inspector.js';
import { openPaint } from './paint.js';
import { wrapFor, readXf, patchXf } from './transform.js';
import { reindex } from './ingest.js';
import { rebuild } from './timeline.js';
import { renderAll } from './render.js';

export function recFromNode(n) {
  while (n && n !== S.svg) {
    if (n.dataset && n.dataset.saf) return S.byUid.get(n.dataset.saf);
    n = n.parentNode;
  }
  return null;
}

export function select(uids, { add = false, toggle = false } = {}) {
  if (!add && !toggle) S.sel.clear();
  uids.forEach(u => {
    if (toggle && S.sel.has(u)) S.sel.delete(u); else S.sel.add(u);
  });
  renderLayers(); renderOverlay(); renderInspector();
}

export function selectedRecs() { return [...S.sel].map(u => S.byUid.get(u)).filter(Boolean); }

export function renderOverlay() {
  const ov = $('#overlay'); ov.innerHTML = '';
  if (!S.svg) return;
  const wrapRect = $('#stagewrap').getBoundingClientRect();
  ov.setAttribute('viewBox', `0 0 ${wrapRect.width} ${wrapRect.height}`);
  const draw = (rec, cls) => {
    if (!rec || !rec.node.isConnected) return;
    let b; try { b = rec.node.getBoundingClientRect(); } catch (e) { return; }
    if (!b.width && !b.height) return;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', b.x - wrapRect.x - 1); r.setAttribute('y', b.y - wrapRect.y - 1);
    r.setAttribute('width', b.width + 2); r.setAttribute('height', b.height + 2);
    if (cls) r.setAttribute('class', cls);
    ov.appendChild(r);
  };
  if (S.hot && !S.sel.has(S.hot)) draw(S.byUid.get(S.hot), 'hot');
  const picked = selectedRecs();
  if (picked.length <= 150) picked.forEach(r => draw(r, ''));
}

/* Position is one field of the static transform model — see transform.js
   for why it lives on a wrapper rather than the element itself. */
export const moveWrap = wrapFor;

export function userScale() {
  try { const m = S.svg.getScreenCTM(); return (m && m.a) ? m.a : 1; } catch (e) { return 1; }
}

/* Drop any element whose ancestor is also selected, so nested items
   don't get shifted twice. */
export function topSel() {
  return selectedRecs().filter(r => {
    let p = r.parentUid;
    while (p) { if (S.sel.has(p)) return false; p = S.byUid.get(p)?.parentUid; }
    return true;
  });
}

export function nudge(dx, dy) {
  const recs = topSel(); if (!recs.length) return;
  recs.forEach(r => {
    const o = readXf(r.node);
    patchXf(r.node, { x: o.x + dx, y: o.y + dy });
  });
  renderOverlay();
  markDirty();
}

/* Position only — rotation, scale and skew are left alone. The Transform
   panel has its own reset for those. */
export function resetPositions() {
  if (!S.svg) return;
  let n = 0;
  S.items.forEach(rec => {
    const t = readXf(rec.node);
    if (t.x || t.y) { patchXf(rec.node, { x: 0, y: 0 }); n++; }
  });
  renderOverlay();
  markDirty();
  toast(n ? `Reset ${n} position${n > 1 ? 's' : ''}` : 'Nothing has been moved.');
}

/* ---------------------------------------------------------------------
   Deleting artwork. Clips that pointed at a removed element have to be
   cleaned up too, or the timeline keeps a lane that can never play.
   --------------------------------------------------------------------- */
export function deleteSelected() {
  if (!S.svg || !S.sel.size) { toast('Nothing selected.'); return; }
  const recs = topSel();
  if (!recs.length) return;

  const doomed = new Set();
  recs.forEach(r => { doomed.add(r.uid); descendants(r.uid).forEach(u => doomed.add(u)); });

  const labels = recs.slice(0, 3).map(r => r.label).join(', ');
  recs.forEach(r => {
    const p = r.node.parentNode;
    const outer = (p && p.dataset && p.dataset.safMove) ? p : r.node;
    outer.remove();
  });

  S.clips.forEach(c => { c.targets = c.targets.filter(u => !doomed.has(u)); });
  const orphaned = S.clips.filter(c => !c.targets.length).length;
  S.clips = S.clips.filter(c => c.targets.length);
  if (!S.clips.some(c => c.id === S.activeClip)) S.activeClip = null;

  S.sel.clear();
  reindex();
  rebuild(true);
  renderAll();
  markDirty();
  toast(`Deleted ${recs.length === 1 ? labels : recs.length + ' elements'}` +
        (orphaned ? ` · ${orphaned} empty lane${orphaned > 1 ? 's' : ''} removed` : ''), 'ok');
}

export function descendants(uid) {
  const out = [];
  const rec = S.byUid.get(uid); if (!rec) return out;
  const stack = [...S.items.filter(i => i.parentUid === uid)];
  while (stack.length) {
    const it = stack.pop(); out.push(it.uid);
    S.items.filter(i => i.parentUid === it.uid).forEach(c => stack.push(c));
  }
  return out;
}

let DRAG = null;
let BAND = null;
let lastPick = null;   // fallback target for dblclick, see bindStage

/* ---------------------------------------------------------------------
   Rubber-band select. Dragging from empty canvas used to do nothing at
   all, which reads as "I can't select more than one thing".
   --------------------------------------------------------------------- */
function bandRect() {
  let el = $('#marquee');
  if (!el) {
    el = document.createElementNS(NS, 'rect');
    el.setAttribute('id', 'marquee');
    $('#overlay').appendChild(el);
  }
  return el;
}

function beginBand(e) {
  BAND = { x0: e.clientX, y0: e.clientY, add: e.shiftKey, base: [...S.sel], moved: false };
}

function moveBand(e) {
  if (!BAND) return;
  const dx = Math.abs(e.clientX - BAND.x0), dy = Math.abs(e.clientY - BAND.y0);
  if (!BAND.moved && dx < 4 && dy < 4) return;
  BAND.moved = true;

  const wrap = $('#stagewrap').getBoundingClientRect();
  const x = Math.min(BAND.x0, e.clientX), y = Math.min(BAND.y0, e.clientY);
  const w = Math.abs(e.clientX - BAND.x0), h = Math.abs(e.clientY - BAND.y0);

  const box = { left: x, top: y, right: x + w, bottom: y + h };
  const hits = S.items.filter(it => {
    if (it.kind === 'group' || !it.node.isConnected) return false;
    let b; try { b = it.node.getBoundingClientRect(); } catch (err) { return false; }
    if (!b.width && !b.height) return false;
    return b.left < box.right && b.right > box.left && b.top < box.bottom && b.bottom > box.top;
  }).map(it => it.uid);

  S.sel = new Set(BAND.add ? [...BAND.base, ...hits] : hits);
  renderLayers(); renderInspector();
  renderOverlay();               // clears the overlay, so redraw the band after
  const r = bandRect();
  r.setAttribute('x', x - wrap.x); r.setAttribute('y', y - wrap.y);
  r.setAttribute('width', w); r.setAttribute('height', h);
}

function endBand() {
  if (!BAND) return;
  const { moved } = BAND;
  BAND = null;
  $('#marquee')?.remove();
  if (moved) renderOverlay();
}

function pickAt(e) {
  let rec = recFromNode(e.target);
  // Pointer capture (and anything else that retargets an event) can hand us
  // the stage container instead of the shape. Fall back to hit-testing the
  // actual coordinates before giving up.
  if (!rec && e.clientX != null) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (under) rec = recFromNode(under);
  }
  if (!rec) return null;
  if (S.tool === 'group') { let p = rec; while (p.parentUid) p = S.byUid.get(p.parentUid); return p; }
  return rec;
}

/* ---------------------------------------------------------------------
   SHIFT-CONSTRAINED DRAGGING — the straight rail.

   Holding Shift locks movement to a single straight line through the
   point where Shift was pressed, running along the direction the drag was
   already travelling. The element slides forward and backward along that
   line and nowhere else. This is a projection onto one fixed vector, not
   angle snapping: there are no 45-degree increments and no preferred
   directions, and the line never changes while Shift stays down.

   Both transitions are seamless. Engaging Shift anchors the rail at the
   element's current position, so t starts at zero and nothing moves.
   Releasing Shift banks the difference between where the element sits and
   where the pointer is into an offset, so free dragging resumes 1:1 from
   exactly where the element already is. Neither edge produces a jump.
   --------------------------------------------------------------------- */
const RAIL_MIN = 2;        // user units of travel needed to trust a direction
const DRAG_START = 3;      // screen px before a press becomes a drag

function applyDrag(clientX, clientY, shift) {
  if (!DRAG || !DRAG.moved || !DRAG.wraps) return;

  const k = userScale();
  const rawX = (clientX - DRAG.x0) / k;
  const rawY = (clientY - DRAG.y0) / k;

  // Remember which way the pointer is actually travelling. Used to seed the
  // rail when Shift is pressed while the pointer sits near its start point.
  const mdx = rawX - DRAG.prevRawX, mdy = rawY - DRAG.prevRawY;
  const step = Math.hypot(mdx, mdy);
  if (step > 0.4) { DRAG.dirX = mdx / step; DRAG.dirY = mdy / step; }
  DRAG.prevRawX = rawX; DRAG.prevRawY = rawY;

  let appX, appY;

  if (shift) {
    if (!DRAG.rail) {
      // Establish the rail once, from the direction the drag has taken so
      // far, and never recompute it while Shift stays down.
      let ux, uy;
      const len = Math.hypot(rawX, rawY);
      if (len >= RAIL_MIN) { ux = rawX / len; uy = rawY / len; }
      else if (DRAG.dirX || DRAG.dirY) { ux = DRAG.dirX; uy = DRAG.dirY; }
      else { ux = 1; uy = 0; }
      DRAG.rail = { ux, uy, rawX, rawY, appX: DRAG.appX, appY: DRAG.appY };
    }
    const r = DRAG.rail;
    // signed distance along the rail — negative simply means backwards
    const t = (rawX - r.rawX) * r.ux + (rawY - r.rawY) * r.uy;
    appX = r.appX + r.ux * t;
    appY = r.appY + r.uy * t;
  } else {
    if (DRAG.rail) {
      // Leaving the rail: bank the gap so the element does not snap to the
      // pointer. It carries on from exactly where it is.
      DRAG.offX = DRAG.appX - rawX;
      DRAG.offY = DRAG.appY - rawY;
      DRAG.rail = null;
    }
    appX = rawX + DRAG.offX;
    appY = rawY + DRAG.offY;
  }

  DRAG.appX = appX; DRAG.appY = appY;
  DRAG.wraps.forEach(w => patchXf(w.node, { x: w.base.x + appX, y: w.base.y + appY }));
  renderOverlay();

  $('#stat').textContent = DRAG.rail
    ? `Δ ${round(appX, 1)}, ${round(appY, 1)} · locked`
    : `Δ ${round(appX, 1)}, ${round(appY, 1)}`;
}

export function bindStage() {
  const stage = $('#stage');

  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const target = pickAt(e);
    if (!target) {
      if (!e.shiftKey) select([]);
      beginBand(e);
      return;
    }
    lastPick = target;
    const kids = target.kind === 'group' && S.tool === 'group'
      ? descendants(target.uid).concat([target.uid]) : [target.uid];

    /* A modifier held at press time is a selection gesture, full stop —
       shift adds to (or removes from) the selection, and no drag is armed.
       Two reasons: a few stray pixels while shift-clicking used to shove the
       whole selection across the canvas instead of selecting, and the rail
       constraint is defined as Shift pressed *during* a drag, so Shift at
       press time is unambiguous. */
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      select(kids, { toggle: true, add: true });
      const n = S.sel.size;
      toast(n ? `${n} selected` : 'Nothing selected');
      return;
    }

    // clicking outside the current selection re-selects before the drag starts
    if (!kids.every(u => S.sel.has(u))) select(kids);

    DRAG = {
      x0: e.clientX, y0: e.clientY,
      pointerId: e.pointerId,
      moved: false, wraps: null,
      appX: 0, appY: 0,          // where the element currently sits
      offX: 0, offY: 0,          // compensation banked when leaving the rail
      prevRawX: 0, prevRawY: 0,
      dirX: 0, dirY: 0,          // recent travel direction
      rail: null,
      lastX: e.clientX, lastY: e.clientY,
    };
    // Capture is deliberately NOT taken here. Taking it on every press
    // retargets the follow-up mouse events — including dblclick — at the
    // stage container, and double-click-to-paint stops resolving a shape.
    // It is taken below, once the press is genuinely a drag.
  });

  stage.addEventListener('pointermove', e => {
    if (BAND) { moveBand(e); return; }
    if (!DRAG) {
      const rec = recFromNode(e.target);
      const u = rec ? rec.uid : null;
      if (u !== S.hot) { S.hot = u; renderOverlay(); highlightLayer(u); }
      return;
    }

    DRAG.lastX = e.clientX; DRAG.lastY = e.clientY;

    if (!DRAG.moved) {
      if (Math.hypot(e.clientX - DRAG.x0, e.clientY - DRAG.y0) < DRAG_START) return;
      DRAG.moved = true;
      stage.style.cursor = 'grabbing';
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      DRAG.wraps = topSel().map(r => {
        wrapFor(r.node);
        const t = readXf(r.node);
        return { node: r.node, base: { x: t.x, y: t.y } };
      });
      if (!DRAG.wraps.length) { DRAG = null; stage.style.cursor = ''; return; }
    }

    applyDrag(e.clientX, e.clientY, e.shiftKey);
  });

  /* Shift pressed or released without moving the mouse still has to take
     effect immediately, so the key itself re-runs the transform against the
     last known pointer position. This is what makes it feel magnetic
     instead of waiting for the next mouse move. */
  const onShiftKey = e => {
    if (e.key !== 'Shift' || !DRAG || !DRAG.moved) return;
    applyDrag(DRAG.lastX, DRAG.lastY, e.type === 'keydown');
  };
  window.addEventListener('keydown', onShiftKey);
  window.addEventListener('keyup', onShiftKey);

  const endDrag = () => {
    if (BAND) { endBand(); return; }
    if (!DRAG) return;
    const moved = DRAG.moved;
    DRAG = null;
    stage.style.cursor = '';
    if (moved) { $('#stat').textContent = S.fileName; renderOverlay(); markDirty(); }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('mouseleave', () => { S.hot = null; renderOverlay(); highlightLayer(null); });

  stage.addEventListener('dblclick', e => {
    // pickAt hit-tests the coordinates when the event target is unhelpful;
    // lastPick covers the remaining case where even that comes back empty.
    const rec = pickAt(e) || lastPick;
    if (!rec || !rec.node.isConnected) return;
    if (!S.sel.has(rec.uid)) select([rec.uid]);
    openPaint(e.clientX, e.clientY);
  });

  window.addEventListener('resize', () => renderOverlay());
}
