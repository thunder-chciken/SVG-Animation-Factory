/* =====================================================================
   SANITISE + INGEST + THE INDEXER
   Identify and label every renderable node so the rest of the studio can
   talk about elements by uid instead of by DOM reference.
   ===================================================================== */
import { S, $, toast, markDirty } from './state.js';
import { parseColor, colorName } from './color.js';
import { renderAll } from './render.js';
import { buildTimeline } from './timeline.js';

const RENDERABLE = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
                            'text', 'tspan', 'image', 'use', 'g', 'svg', 'foreignObject']);
const SKIP_ANCESTOR = new Set(['defs', 'clipPath', 'mask', 'marker', 'pattern', 'symbol', 'filter']);

export function sanitize(src) {
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('That file is not valid SVG markup.');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('No <svg> root element found in that file.');
  svg.querySelectorAll('script').forEach(n => n.remove());
  svg.querySelectorAll('*').forEach(n => {
    [...n.attributes].forEach(a => {
      const an = a.name.toLowerCase();
      if (an.startsWith('on')) n.removeAttribute(a.name);
      if (an === 'href' || an === 'xlink:href') {
        if (/^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
      }
    });
  });
  // Guarantee a viewBox so everything scales predictably.
  if (!svg.getAttribute('viewBox')) {
    const w = parseFloat(svg.getAttribute('width')) || 300;
    const h = parseFloat(svg.getAttribute('height')) || 150;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%'; svg.style.height = '100%'; svg.style.maxHeight = '100%';
  return svg;
}

/* Mount markup on the stage and index it, without deciding what the user
   should be told about it. loadSVG and the project loader both build on this. */
export function mountSVG(src, name = 'untitled.svg') {
  let svg;
  try { svg = sanitize(src); }
  catch (e) { toast(e.message, 'err'); return false; }
  S.raw = src; S.fileName = name;
  $('#stage').innerHTML = ''; $('#stage').appendChild(svg);
  S.svg = svg;
  S.clips = []; S.sel.clear(); S.activeClip = null; S.uid = 0; S.clipId = 0;
  $('#empty').style.display = 'none';
  $('#fileName').textContent = name;
  $('#stat').textContent = name;
  reindex();
  // Restored markup arrives with its uids already baked in; keep the counter
  // above them so freshly split elements never reuse an id a clip points at.
  S.uid = Math.max(S.uid, maxUid());
  return true;
}

export function maxUid() {
  let m = 0;
  S.items.forEach(it => { const n = /^e(\d+)$/.exec(it.uid); if (n) m = Math.max(m, +n[1]); });
  return m;
}

export function loadSVG(src, name = 'untitled.svg') {
  if (!mountSVG(src, name)) return;
  buildTimeline();
  renderAll();
  markDirty();
  toast(`Indexed ${S.items.length} elements`, 'ok');
}

/* A blank artboard you can actually put things on.

   "New" used to only empty the stage, which left no <svg> at all — so the
   text tool, and anything else that needs somewhere to draw, had nothing to
   attach to and refused. A new document is a real, empty SVG. */
export function newDocument({ w = 1200, h = 800, bg = '', name = 'untitled.svg' } = {}) {
  const rect = bg
    ? `\n  <rect id="background" x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>`
    : '';
  const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${rect}\n</svg>`;
  if (!mountSVG(src, name)) return false;
  buildTimeline();
  renderAll();
  markDirty();
  toast(`New ${w} × ${h} document`, 'ok');
  return true;
}

export function clearStage() {
  S.svg = null; S.raw = ''; S.fileName = '';
  S.items = []; S.byUid.clear(); S.sel.clear();
  S.clips = []; S.activeClip = null; S.uid = 0; S.clipId = 0;
  if (S.tl) { S.tl.kill(); S.tl = null; }
  (S.loopTweens || []).forEach(t => t.kill()); S.loopTweens = [];
  $('#stage').innerHTML = '';
  $('#overlay').innerHTML = '';
  $('#empty').style.display = '';
  $('#fileName').textContent = '—';
  $('#stat').textContent = 'no file';
  renderAll();
}

/* ---------------------------------------------------------------------
   Classification and labelling
   --------------------------------------------------------------------- */
export function classify(node) {
  const t = node.tagName.toLowerCase();
  if (t === 'g') return 'group';
  if (t === 'text' || t === 'tspan') return node.dataset.safChar !== undefined ? 'letter' : 'text';
  if (t === 'image') return 'image';
  if (t === 'use') return 'instance';
  if (t === 'line' || t === 'polyline') return 'line';
  if (t === 'path') {
    const f = (node.getAttribute('fill') || getComputedStyle(node).fill || '').toLowerCase();
    const s = (node.getAttribute('stroke') || getComputedStyle(node).stroke || '').toLowerCase();
    const noFill = f === 'none' || f === '';
    const hasStroke = s && s !== 'none';
    if (noFill && hasStroke) return 'stroke';
    return 'path';
  }
  return 'shape';
}

export function subpathCount(d) {
  if (!d) return 1;
  return (d.match(/[Mm]/g) || []).length;
}

export function safeBBox(node) {
  try { const b = node.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }
  catch (e) { return { x: 0, y: 0, w: 0, h: 0 }; }
}

export function pathLen(node) {
  try { return typeof node.getTotalLength === 'function' ? node.getTotalLength() : 0; }
  catch (e) { return 0; }
}

function labelFor(node, kind, fillC, strokeC, idx) {
  const tag = node.tagName.toLowerCase();
  const given = node.getAttribute('id');
  const cls = (node.getAttribute('class') || '').split(/\s+/)[0];
  const tint = fillC?.rgb ? colorName(fillC.rgb) : (strokeC?.rgb ? colorName(strokeC.rgb) : null);

  if (kind === 'letter') return `“${node.textContent}”`;
  if (kind === 'text') {
    const txt = (node.textContent || '').trim().replace(/\s+/g, ' ');
    return txt ? `“${txt.slice(0, 26)}${txt.length > 26 ? '…' : ''}”` : 'empty text';
  }
  if (given && !/^saf-/.test(given)) return given;
  if (cls && cls.length < 22) return cls;
  if (kind === 'group') return `Group ${idx}`;
  if (kind === 'image') return `Image ${idx}`;
  if (kind === 'stroke') return `${tint ? tint + ' ' : ''}stroke ${idx}`;

  const shapeWord = {
    path: 'shape', rect: 'rectangle', circle: 'circle', ellipse: 'ellipse',
    polygon: 'polygon', line: 'line', polyline: 'polyline', use: 'instance',
  }[tag] || tag;
  return `${tint ? tint + ' ' : ''}${shapeWord} ${idx}`;
}

export function reindex() {
  S.items = []; S.byUid.clear();
  if (!S.svg) return;
  const counters = {};
  const walk = (node, depth, parentUid) => {
    [...node.children].forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (SKIP_ANCESTOR.has(tag)) { return; }
      if (!RENDERABLE.has(tag)) { return; }
      if (tag === 'tspan' && child.parentNode.dataset?.safSplit) return;
      // position wrappers are invisible to the index — walk through them
      if (tag === 'g' && child.dataset.safMove) { walk(child, depth, parentUid); return; }

      const kind = classify(child);
      counters[kind] = (counters[kind] || 0) + 1;
      // reuse an existing id so clips keep pointing at the right element
      const uid = child.dataset.saf || ('e' + (++S.uid));
      if (!child.getAttribute('id')) child.setAttribute('id', 'saf-' + uid);
      child.dataset.saf = uid;

      const cs = getComputedStyle(child);
      const fRaw = child.getAttribute('fill') ?? cs.fill;
      const sRaw = child.getAttribute('stroke') ?? cs.stroke;
      const fillC = parseColor(fRaw), strokeC = parseColor(sRaw);
      const bbox = safeBBox(child);
      const d = child.getAttribute('d') || '';

      const rec = {
        uid, node: child, tag, kind, depth, parentUid,
        label: labelFor(child, kind, fillC, strokeC, counters[kind]),
        fill: fillC, stroke: strokeC,
        fillRaw: fillC?.hex || (fillC?.grad ? 'gradient' : 'none'),
        strokeRaw: strokeC?.hex || (strokeC?.grad ? 'gradient' : 'none'),
        strokeWidth: parseFloat(child.getAttribute('stroke-width') || cs.strokeWidth) || 0,
        opacity: parseFloat(child.getAttribute('opacity') ?? cs.opacity ?? 1),
        bbox, len: pathLen(child),
        subpaths: tag === 'path' ? subpathCount(d) : 1,
        chars: (kind === 'text') ? (child.textContent || '').replace(/\s/g, '').length : 0,
        open: true, hidden: false,
      };
      S.items.push(rec); S.byUid.set(uid, rec);
      if (tag === 'g' || tag === 'text') walk(child, depth + 1, uid);
    });
  };
  walk(S.svg, 0, null);
}

/* palette of every colour actually in use */
export function palette() {
  const map = new Map();
  S.items.forEach(it => {
    [['fill', it.fill], ['stroke', it.stroke]].forEach(([role, c]) => {
      if (!c) return;
      const key = c.grad ? ('grad:' + c.grad) : c.hex;
      if (!map.has(key)) map.set(key, { key, hex: c.hex, grad: c.grad, uids: new Set(), roles: new Set() });
      map.get(key).uids.add(it.uid); map.get(key).roles.add(role);
    });
  });
  return [...map.values()].sort((a, b) => b.uids.size - a.uids.size);
}
