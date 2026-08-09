/* =====================================================================
   PAINT — solid fills, linear and radial gradients
   ===================================================================== */
import { S, $, NS, clamp, round, toast, markDirty } from './state.js';
import { parseColor } from './color.js';
import { reindex } from './ingest.js';
import { selectedRecs } from './selection.js';
import { renderLayers, renderSwatches } from './layers.js';
import { createWheel } from './wheel.js';

let wheel = null;   // live handle to the mounted colour wheel, if any

function ensureDefs() {
  let d = S.svg.querySelector('defs');
  if (!d) { d = document.createElementNS(NS, 'defs'); S.svg.insertBefore(d, S.svg.firstChild); }
  return d;
}

function gradCSS() {
  const p = S.paint;
  const st = [...p.stops].sort((a, b) => a.o - b.o)
    .map(s => `${s.c} ${round(s.o * 100, 1)}%`).join(', ');
  return p.type === 'radial'
    ? `radial-gradient(circle at ${p.cx * 100}% ${p.cy * 100}%, ${st})`
    : `linear-gradient(${p.angle}deg, ${st})`;
}

function writeGradient() {
  const p = S.paint, defs = ensureDefs();
  const want = p.type === 'radial' ? 'radialGradient' : 'linearGradient';
  let g = p.gradId ? S.svg.querySelector(`[id="${p.gradId}"]`) : null;
  if (g && g.tagName !== want) { g.remove(); g = null; }
  if (!g) {
    g = document.createElementNS(NS, want);
    p.gradId = 'saf-grad-' + (++S.gradId);
    g.setAttribute('id', p.gradId);
    defs.appendChild(g);
  }
  g.setAttribute('gradientUnits', 'objectBoundingBox');
  if (p.type === 'linear') {
    // CSS angle convention: 0deg points up, sweeping clockwise
    const rad = (p.angle - 90) * Math.PI / 180, c = Math.cos(rad) / 2, sn = Math.sin(rad) / 2;
    g.setAttribute('x1', round(.5 - c, 4)); g.setAttribute('y1', round(.5 - sn, 4));
    g.setAttribute('x2', round(.5 + c, 4)); g.setAttribute('y2', round(.5 + sn, 4));
    ['cx', 'cy', 'r'].forEach(a => g.removeAttribute(a));
  } else {
    g.setAttribute('cx', p.cx); g.setAttribute('cy', p.cy); g.setAttribute('r', p.r);
    ['x1', 'y1', 'x2', 'y2'].forEach(a => g.removeAttribute(a));
  }
  g.innerHTML = '';
  [...p.stops].sort((a, b) => a.o - b.o).forEach(st => {
    const n = document.createElementNS(NS, 'stop');
    n.setAttribute('offset', round(st.o, 4));
    n.setAttribute('stop-color', st.c);
    n.setAttribute('stop-opacity', round(st.a, 3));
    g.appendChild(n);
  });
  return `url(#${p.gradId})`;
}

/* Which nodes a paint actually lands on.

   Selecting a <g> and setting fill on it looks like nothing happened,
   because every child carries its own fill and wins. Illustrator and Figma
   both nest heavily, so painting has to reach the leaves. */
const PAINTABLE = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline',
                           'polygon', 'text', 'tspan', 'use', 'image']);

function paintTargets(node) {
  if (PAINTABLE.has(node.tagName.toLowerCase())) return [node];
  const leaves = [...node.querySelectorAll('*')]
    .filter(n => PAINTABLE.has(n.tagName.toLowerCase()));
  return leaves.length ? leaves : [node];
}

function applyPaint() {
  const p = S.paint, recs = selectedRecs();
  if (!recs.length) return;
  const value = p.type === 'none' ? 'none'
              : p.type === 'solid' ? p.solid
              : writeGradient();

  const nodes = new Set();
  recs.forEach(r => paintTargets(r.node).forEach(n => nodes.add(n)));

  nodes.forEach(node => {
    // Inline style, not just the attribute. Illustrator and Figma export a
    // <style> block with class rules, and a class rule outranks a
    // presentation attribute — set only the attribute and the shape visibly
    // does not change. Inline style beats both.
    node.style.setProperty(p.role, value);
    node.setAttribute(p.role, value);
    node.style.setProperty(p.role + '-opacity', round(p.alpha, 3));
    node.setAttribute(p.role + '-opacity', round(p.alpha, 3));
    if (p.role === 'stroke' && p.type !== 'none' && !node.getAttribute('stroke-width'))
      node.setAttribute('stroke-width', 2);
  });
  const pv = $('#gradPrev'); if (pv) pv.style.background = p.type === 'solid' ? p.solid
    : p.type === 'none' ? 'transparent' : gradCSS();
  refreshIndexSoon();
}

/* Re-reading the whole document on every colour tick is far too slow on a
   detailed file, so the index catches up once the user stops moving. */
let idxTimer = null;
function refreshIndexSoon() {
  clearTimeout(idxTimer);
  idxTimer = setTimeout(() => {
    const keep = [...S.sel];
    reindex();
    S.sel = new Set(keep.filter(u => S.byUid.has(u)));
    renderLayers(); renderSwatches();
    markDirty();
  }, 220);
}

/* read the current paint of the first selected element into the editor */
function loadPaint() {
  const rec = selectedRecs()[0]; if (!rec) return;
  const p = S.paint;
  // read from the first node the paint would actually land on, not the group
  const src = paintTargets(rec.node)[0];
  const raw = (src.style.getPropertyValue(p.role) || src.getAttribute(p.role)
    || getComputedStyle(src)[p.role] || '').trim();
  const op = parseFloat(src.getAttribute(p.role + '-opacity'));
  p.alpha = isNaN(op) ? 1 : op;
  p.gradId = null;
  if (!raw || raw === 'none') { p.type = raw === 'none' ? 'none' : p.type; return; }
  const m = raw.match(/^url\(["']?#([^)"']+)/);
  if (m) {
    const g = S.svg.querySelector(`[id="${m[1]}"]`);
    if (g && /Gradient$/.test(g.tagName)) {
      p.gradId = m[1];
      p.type = g.tagName === 'radialGradient' ? 'radial' : 'linear';
      if (p.type === 'radial') {
        p.cx = parseFloat(g.getAttribute('cx') ?? .5);
        p.cy = parseFloat(g.getAttribute('cy') ?? .5);
        p.r = parseFloat(g.getAttribute('r') ?? .5);
      } else {
        const x1 = parseFloat(g.getAttribute('x1') ?? 0), y1 = parseFloat(g.getAttribute('y1') ?? 0);
        const x2 = parseFloat(g.getAttribute('x2') ?? 1), y2 = parseFloat(g.getAttribute('y2') ?? 0);
        p.angle = round((Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) + 90, 0);
      }
      const st = [...g.querySelectorAll('stop')].map(n => ({
        c: parseColor(n.getAttribute('stop-color'))?.hex || '#ffffff',
        o: parseFloat(n.getAttribute('offset') || 0),
        a: parseFloat(n.getAttribute('stop-opacity') ?? 1),
      }));
      if (st.length >= 2) p.stops = st;
    }
    return;
  }
  const c = parseColor(raw);
  if (c && c.hex) { p.type = 'solid'; p.solid = c.hex; }
}

function renderPaint() {
  const p = S.paint, n = S.sel.size;
  $('#paintCount').textContent = n === 1 ? (selectedRecs()[0]?.label || '1') : n + ' selected';
  const grad = p.type === 'linear' || p.type === 'radial';
  let h = '';
  h += `<div class="seg" style="margin-bottom:6px" id="paintRole">
      <button data-role="fill" class="${p.role === 'fill' ? 'on' : ''}" style="flex:1">Fill</button>
      <button data-role="stroke" class="${p.role === 'stroke' ? 'on' : ''}" style="flex:1">Stroke</button></div>`;
  h += `<div class="seg" style="margin-bottom:8px" id="paintType">
      ${[['solid', 'Solid'], ['linear', 'Linear'], ['radial', 'Radial'], ['none', 'None']].map(([v, l]) =>
        `<button data-type="${v}" class="${p.type === v ? 'on' : ''}" style="flex:1">${l}</button>`).join('')}</div>`;
  h += `<div class="gprev"><i id="gradPrev" style="background:${
      p.type === 'solid' ? p.solid : p.type === 'none' ? 'transparent' : gradCSS()}"></i></div>`;

  if (p.type === 'solid') {
    h += `<div id="pWheel"></div>
      <div class="ctl"><label>Colour</label>
        <input type="color" id="pSolid" value="${p.solid}">
        <input type="text" id="pHex" value="${p.solid}"></div>`;
  }
  if (grad) {
    h += `<div style="margin-bottom:6px">${p.stops.map((st, i) => `
      <div class="stop" data-i="${i}">
        <input type="color" data-sc="${i}" value="${st.c}">
        <input type="range" data-so="${i}" min="0" max="1" step="0.01" value="${st.o}">
        <input type="number" data-sa="${i}" min="0" max="1" step="0.05" value="${st.a}" title="stop opacity">
        <span class="x" data-sx="${i}" title="Remove stop">✕</span>
      </div>`).join('')}</div>
      <button class="btn xs" id="pAddStop" style="margin-bottom:8px">+ Add stop</button>`;
  }
  if (p.type === 'linear') {
    h += `<div class="ctl"><label>Angle</label>
        <input type="range" id="pAngleR" min="0" max="360" step="1" value="${p.angle}">
        <input type="number" id="pAngleN" min="0" max="360" step="1" value="${p.angle}"></div>`;
  }
  if (p.type === 'radial') {
    h += `<div class="ctl"><label>Centre X</label>
        <input type="range" data-rad="cx" min="0" max="1" step="0.01" value="${p.cx}">
        <input type="number" data-radn="cx" step="0.01" value="${p.cx}"></div>
        <div class="ctl"><label>Centre Y</label>
        <input type="range" data-rad="cy" min="0" max="1" step="0.01" value="${p.cy}">
        <input type="number" data-radn="cy" step="0.01" value="${p.cy}"></div>
        <div class="ctl"><label>Radius</label>
        <input type="range" data-rad="r" min="0.05" max="1.5" step="0.01" value="${p.r}">
        <input type="number" data-radn="r" step="0.01" value="${p.r}"></div>`;
  }
  if (p.type !== 'none') {
    h += `<div class="ctl"><label>Opacity</label>
        <input type="range" id="pAlphaR" min="0" max="1" step="0.01" value="${p.alpha}">
        <input type="number" id="pAlphaN" min="0" max="1" step="0.01" value="${p.alpha}"></div>`;
  }
  h += `<div class="row" style="margin:8px 0 0">
      <button class="btn sm" id="pEyedrop" title="Copy the paint of the first selected element">Sample</button>
      <button class="btn sm" id="pSwap" title="Reverse the gradient" ${grad ? '' : 'disabled'}>⇄ Reverse</button>
      </div>`;
  if (grad) h += `<p class="hint" style="margin-top:7px">Gradients can't be colour-tweened. Animate
      opacity or the angle-driven look instead.</p>`;
  $('#paintBody').innerHTML = h;
  bindPaint();
}

function bindPaint() {
  const p = S.paint, b = $('#paintBody');
  const redraw = () => { applyPaint(); renderPaint(); };

  /* The wheel drives the solid colour. It updates state and repaints the
     selection directly rather than going through renderPaint(), which would
     tear down the very element being dragged. */
  const wheelHost = b.querySelector('#pWheel');
  if (wheelHost) {
    wheel = createWheel(wheelHost, hex => {
      p.solid = hex;
      const sw = b.querySelector('#pSolid'); if (sw) sw.value = hex;
      const tx = b.querySelector('#pHex'); if (tx) tx.value = hex;
      applyPaint();
    });
    wheel.set(p.solid);
  } else wheel = null;
  b.querySelectorAll('[data-role]').forEach(el => el.onclick = () => {
    p.role = el.dataset.role; loadPaint(); renderPaint();
  });
  b.querySelectorAll('[data-type]').forEach(el => el.onclick = () => {
    p.type = el.dataset.type; p.gradId = null; redraw();
  });

  const bind = (sel, fn, ev = 'input') => { const el = b.querySelector(sel); if (el) el.addEventListener(ev, fn); };
  bind('#pSolid', e => {
    p.solid = e.target.value; applyPaint();
    const t = b.querySelector('#pHex'); if (t) t.value = p.solid;
    wheel?.set(p.solid);
  });
  bind('#pHex', e => {
    const c = parseColor(e.target.value); if (c?.hex) {
      p.solid = c.hex;
      const s2 = b.querySelector('#pSolid'); if (s2) s2.value = c.hex;
      applyPaint();
      wheel?.set(c.hex);
    }
  });
  bind('#pAngleR', e => { p.angle = +e.target.value; b.querySelector('#pAngleN').value = p.angle; applyPaint(); });
  bind('#pAngleN', e => { p.angle = +e.target.value; b.querySelector('#pAngleR').value = p.angle; applyPaint(); });
  bind('#pAlphaR', e => { p.alpha = +e.target.value; b.querySelector('#pAlphaN').value = p.alpha; applyPaint(); });
  bind('#pAlphaN', e => { p.alpha = +e.target.value; b.querySelector('#pAlphaR').value = p.alpha; applyPaint(); });

  b.querySelectorAll('[data-sc]').forEach(el => el.oninput = () => {
    p.stops[+el.dataset.sc].c = el.value; applyPaint();
  });
  b.querySelectorAll('[data-so]').forEach(el => el.oninput = () => {
    p.stops[+el.dataset.so].o = +el.value; applyPaint();
  });
  b.querySelectorAll('[data-sa]').forEach(el => el.oninput = () => {
    p.stops[+el.dataset.sa].a = +el.value; applyPaint();
  });
  b.querySelectorAll('[data-sx]').forEach(el => el.onclick = () => {
    if (p.stops.length <= 2) { toast('A gradient needs at least two stops.', 'err'); return; }
    p.stops.splice(+el.dataset.sx, 1); redraw();
  });
  const addS = b.querySelector('#pAddStop'); if (addS) addS.onclick = () => {
    const last = p.stops[p.stops.length - 1];
    p.stops.push({ c: last.c, o: Math.min(1, last.o + .2), a: 1 }); redraw();
  };

  b.querySelectorAll('[data-rad]').forEach(el => el.oninput = () => {
    p[el.dataset.rad] = +el.value;
    const n = b.querySelector(`[data-radn="${el.dataset.rad}"]`); if (n) n.value = el.value;
    applyPaint();
  });
  b.querySelectorAll('[data-radn]').forEach(el => el.oninput = () => {
    p[el.dataset.radn] = +el.value;
    const r = b.querySelector(`[data-rad="${el.dataset.radn}"]`); if (r) r.value = el.value;
    applyPaint();
  });

  const sw = b.querySelector('#pSwap'); if (sw) sw.onclick = () => {
    p.stops = p.stops.map(st => ({ ...st, o: round(1 - st.o, 4) })).reverse(); redraw();
  };
  const ey = b.querySelector('#pEyedrop'); if (ey) ey.onclick = () => { loadPaint(); renderPaint(); };
}

export function openPaint(x, y) {
  if (!S.sel.size) { toast('Select an element to paint.', 'err'); return; }
  const pop = $('#paint');
  loadPaint(); renderPaint();
  pop.classList.add('on');
  const w = pop.offsetWidth || 286, h = pop.offsetHeight || 320;
  // Guard the upper bounds: on a short window the panel is taller than the
  // room below the click, and clamp(v, 8, negative) returns the negative —
  // which parked the whole picker above the top of the screen.
  const maxLeft = Math.max(8, innerWidth - w - 8);
  const maxTop = Math.max(8, innerHeight - h - 8);
  const px = x == null ? maxLeft - 352 : clamp(x + 14, 8, maxLeft);
  const py = y == null ? 90 : clamp(y - 30, 8, maxTop);
  pop.style.left = Math.max(8, px) + 'px';
  pop.style.top = py + 'px';
}

export function bindPaintShell() {
  $('#paintClose').onclick = () => $('#paint').classList.remove('on');
  const head = $('#paintDrag'); let d = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.id === 'paintClose') return;
    const r = $('#paint').getBoundingClientRect();
    d = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.classList.add('grabbing'); head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', e => {
    if (!d) return;
    const pop = $('#paint');
    pop.style.left = clamp(e.clientX - d.dx, 4, innerWidth - pop.offsetWidth - 4) + 'px';
    pop.style.top = clamp(e.clientY - d.dy, 4, innerHeight - pop.offsetHeight - 4) + 'px';
  });
  ['pointerup', 'pointercancel'].forEach(ev => head.addEventListener(ev, () => {
    d = null; head.classList.remove('grabbing');
  }));
}
