/* =====================================================================
   SELECTION + STAGE OVERLAY
   ===================================================================== */
import { S, $, NS, round, toast, markDirty } from './state.js';
import { renderLayers, highlightLayer } from './layers.js';
import { renderInspector } from './inspector.js';
import { openPaint } from './paint.js';

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

/* Elements are repositioned by a dedicated <g> wrapper, never by their own
   transform — GSAP owns that, and would wipe the offset the moment it tweens. */
export function moveWrap(node) {
  const p = node.parentNode;
  if (p && p.dataset && p.dataset.safMove) return p;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'saf-move'); g.dataset.safMove = '1';
  p.insertBefore(g, node); g.appendChild(node);
  return g;
}

export function wrapOffset(g) {
  const m = (g.getAttribute('transform') || '').match(/translate\(\s*(-?[\d.eE+-]+)[\s,]+(-?[\d.eE+-]+)/);
  return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
}

export function setOffset(g, x, y) { g.setAttribute('transform', `translate(${round(x, 2)} ${round(y, 2)})`); }

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
    const g = moveWrap(r.node), o = wrapOffset(g);
    setOffset(g, o.x + dx, o.y + dy);
  });
  renderOverlay();
  markDirty();
}

export function resetPositions() {
  if (!S.svg) return;
  const wraps = [...S.svg.querySelectorAll('[data-saf-move]')];
  wraps.forEach(g => setOffset(g, 0, 0));
  renderOverlay();
  markDirty();
  toast(wraps.length ? `Reset ${wraps.length} position${wraps.length > 1 ? 's' : ''}` : 'Nothing has been moved.');
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

function pickAt(e) {
  const rec = recFromNode(e.target);
  if (!rec) return null;
  if (S.tool === 'group') { let p = rec; while (p.parentUid) p = S.byUid.get(p.parentUid); return p; }
  return rec;
}

export function bindStage() {
  const stage = $('#stage');

  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const target = pickAt(e);
    if (!target) { select([]); return; }
    const kids = target.kind === 'group' && S.tool === 'group'
      ? descendants(target.uid).concat([target.uid]) : [target.uid];
    // clicking outside the current selection re-selects before the drag starts
    const inSel = kids.every(u => S.sel.has(u));
    if (!inSel || e.shiftKey || e.metaKey || e.ctrlKey)
      select(kids, { add: e.shiftKey, toggle: e.metaKey || e.ctrlKey });

    DRAG = { x0: e.clientX, y0: e.clientY, moved: false, wraps: null, lock: null };
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', e => {
    if (!DRAG) {
      const rec = recFromNode(e.target);
      const u = rec ? rec.uid : null;
      if (u !== S.hot) { S.hot = u; renderOverlay(); highlightLayer(u); }
      return;
    }
    const dxS = e.clientX - DRAG.x0, dyS = e.clientY - DRAG.y0;
    if (!DRAG.moved) {
      if (Math.hypot(dxS, dyS) < 3) return;
      DRAG.moved = true;
      stage.style.cursor = 'grabbing';
      DRAG.wraps = topSel().map(r => {
        const g = moveWrap(r.node);
        return { g, base: wrapOffset(g) };
      });
      if (!DRAG.wraps.length) { DRAG = null; stage.style.cursor = ''; return; }
    }
    const k = userScale();
    let dx = dxS / k, dy = dyS / k;
    if (e.shiftKey) {                       // axis lock
      if (Math.abs(dxS) > Math.abs(dyS)) dy = 0; else dx = 0;
    }
    DRAG.wraps.forEach(w => setOffset(w.g, w.base.x + dx, w.base.y + dy));
    renderOverlay();
    $('#stat').textContent = `Δ ${round(dx, 1)}, ${round(dy, 1)}`;
  });

  const endDrag = () => {
    if (!DRAG) return;
    const moved = DRAG.moved; DRAG = null;
    stage.style.cursor = '';
    if (moved) { $('#stat').textContent = S.fileName; renderOverlay(); markDirty(); }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('mouseleave', () => { S.hot = null; renderOverlay(); highlightLayer(null); });
  stage.addEventListener('dblclick', e => {
    const rec = pickAt(e); if (!rec) return;
    if (!S.sel.has(rec.uid)) select([rec.uid]);
    openPaint(e.clientX, e.clientY);
  });
  window.addEventListener('resize', () => renderOverlay());
}
