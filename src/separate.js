/* =====================================================================
   SEPARATION TOOLS — the part that makes logos animatable
   ===================================================================== */
import { S, $, round, toast, markDirty } from './state.js';
import { reindex, safeBBox } from './ingest.js';
import { selectedRecs } from './selection.js';
import { renderAll } from './render.js';
import { rebuild } from './timeline.js';

/* <text> → one element per character, positioned by glyph metrics */
export function splitText(mode = 'char') {
  const targets = selectedRecs().filter(r => r.kind === 'text' && r.tag === 'text');
  if (!targets.length) { toast('Select a live <text> element first.', 'err'); return; }
  let made = 0;
  targets.forEach(rec => {
    const el = rec.node;
    const full = el.textContent || '';
    if (!full.trim()) return;
    let ranges = [];
    if (mode === 'char') {
      for (let i = 0; i < full.length; i++) if (full[i].trim()) ranges.push([i, 1, full[i]]);
    } else {
      const re = /\S+/g; let m;
      while ((m = re.exec(full))) ranges.push([m.index, m[0].length, m[0]]);
    }
    const frag = document.createDocumentFragment();
    ranges.forEach(([start, len, txt]) => {
      let px = 0, py = 0, rot = 0;
      try {
        const p = el.getStartPositionOfChar(start);
        px = p.x; py = p.y;
        rot = el.getRotationOfChar(start) || 0;
      } catch (err) { /* fall back to element origin */
        const b = safeBBox(el); px = b.x; py = b.y + b.h;
      }
      const c = el.cloneNode(false);
      [...el.attributes].forEach(a => c.setAttribute(a.name, a.value));
      c.removeAttribute('id'); c.removeAttribute('data-saf');
      c.setAttribute('x', round(px, 3)); c.setAttribute('y', round(py, 3));
      c.removeAttribute('dx'); c.removeAttribute('dy');
      c.setAttribute('text-anchor', 'start');
      if (rot) c.setAttribute('transform', `rotate(${round(rot, 2)} ${round(px, 3)} ${round(py, 3)})`);
      c.dataset.safChar = txt;
      c.textContent = txt;
      frag.appendChild(c); made++;
    });
    el.parentNode.insertBefore(frag, el);
    el.remove();
  });
  reindex(); S.sel.clear(); renderAll(); rebuild(true); markDirty();
  toast(`Split into ${made} ${mode === 'char' ? 'letters' : 'words'}`, 'ok');
}

/* compound <path> → one element per LETTER.
   A glyph like "O" is one outline plus a counter (the hole). Splitting
   blindly turns that hole into a filled blob, so contained subpaths are
   welded back onto their parent unless "keep holes" is switched off. */
export function splitCompoundPath() {
  const targets = selectedRecs().filter(r => r.tag === 'path' && r.subpaths > 1);
  if (!targets.length) {
    toast('Select a path that contains more than one subpath.', 'err'); return;
  }
  const keepHoles = $('#keepHoles').checked;
  let made = 0;
  targets.forEach(rec => {
    const parts = explodeD(rec.node.getAttribute('d') || '');
    if (parts.length < 2) return;

    // measure each subpath by mounting a throwaway path in the same coord space
    const probe = rec.node.cloneNode(false);
    probe.removeAttribute('id'); probe.removeAttribute('data-saf');
    probe.setAttribute('fill', 'none'); probe.setAttribute('stroke', 'none');
    rec.node.parentNode.appendChild(probe);
    const boxes = parts.map(d => { probe.setAttribute('d', d); return safeBBox(probe); });
    probe.remove();

    // group: a subpath nests inside the smallest box that fully contains it
    const area = b => b.w * b.h;
    const inside = (a, b) => {
      const t = 0.6;   // tolerance in user units
      return b.x >= a.x - t && b.y >= a.y - t &&
             b.x + b.w <= a.x + a.w + t && b.y + b.h <= a.y + a.h + t && area(a) > area(b);
    };
    const parent = parts.map((_, i) => {
      if (!keepHoles) return -1;
      let best = -1;
      parts.forEach((__, j) => {
        if (i === j || !inside(boxes[j], boxes[i])) return;
        if (best === -1 || area(boxes[j]) < area(boxes[best])) best = j;
      });
      return best;
    });
    const roots = parts.map((_, i) => i).filter(i => parent[i] === -1);
    const kidsOf = i => parts.map((_, k) => k).filter(k => parent[k] === i);

    // left-to-right so the names read like the word does
    roots.sort((a, b) => boxes[a].x - boxes[b].x || boxes[a].y - boxes[b].y);

    const base = (rec.node.getAttribute('id') || 'part').replace(/^saf-/, 'shape');
    const frag = document.createDocumentFragment();
    roots.forEach((ri, n) => {
      const d = [parts[ri], ...kidsOf(ri).map(k => parts[k])].join(' ');
      const c = rec.node.cloneNode(false);
      c.removeAttribute('data-saf');
      c.setAttribute('id', `${base}-${n + 1}`);
      c.setAttribute('d', d);
      if (keepHoles && kidsOf(ri).length && !c.getAttribute('fill-rule'))
        c.setAttribute('fill-rule', 'evenodd');
      frag.appendChild(c); made++;
    });
    rec.node.parentNode.insertBefore(frag, rec.node);
    rec.node.remove();
  });
  reindex(); S.sel.clear(); renderAll(); rebuild(true); markDirty();
  toast(`Split into ${made} shape${made === 1 ? '' : 's'}${keepHoles ? ' — counters kept with their glyph' : ''}`, 'ok');
}

/* Tokenise a path "d" and cut it at every moveto, rewriting relative
   movetos to absolute so each fragment stands alone. */
export function explodeD(d) {
  const tokens = d.match(/[MmZzLlHhVvCcSsQqTtAa]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return [d];
  const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const out = []; let cur = null, cmd = null, x = 0, y = 0, sx = 0, sy = 0, i = 0;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) break;
    const lc = cmd.toLowerCase(), rel = cmd === lc, n = ARGS[lc];
    if (n === undefined) break;
    const a = []; for (let k = 0; k < n; k++) a.push(num());
    if (lc === 'm') {
      const nx = rel ? x + a[0] : a[0], ny = rel ? y + a[1] : a[1];
      cur = [`M${round(nx, 3)} ${round(ny, 3)}`]; out.push(cur);
      x = nx; y = ny; sx = x; sy = y;
      cmd = rel ? 'l' : 'L';           // implicit lineto after moveto
      continue;
    }
    if (!cur) { cur = [`M0 0`]; out.push(cur); }
    if (lc === 'z') { cur.push('Z'); x = sx; y = sy; continue; }
    cur.push(cmd + a.map(v => round(v, 3)).join(' '));
    if (lc === 'h') x = rel ? x + a[0] : a[0];
    else if (lc === 'v') y = rel ? y + a[0] : a[0];
    else if (lc === 'a') { x = rel ? x + a[5] : a[5]; y = rel ? y + a[6] : a[6]; }
    else { x = rel ? x + a[n - 2] : a[n - 2]; y = rel ? y + a[n - 1] : a[n - 1]; }
  }
  return out.map(p => p.join(' ')).filter(p => p.replace(/[^A-Za-z]/g, '').length > 1);
}
