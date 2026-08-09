/* =====================================================================
   LEFT PANEL — layer tree + colour swatches
   ===================================================================== */
import { S, $, $$, esc, toast, markDirty } from './state.js';
import { palette } from './ingest.js';
import { parseColor, colorName } from './color.js';
import { select, renderOverlay } from './selection.js';
import { openPaint } from './paint.js';

export function highlightLayer(uid) {
  $$('#layers .layer').forEach(el => el.classList.toggle('hot', el.dataset.uid === uid));
}

export function renderLayers() {
  const box = $('#layers');
  const q = $('#search').value.trim().toLowerCase();
  if (!S.items.length) {
    box.innerHTML = '<div class="empty-note">Load an SVG to index its elements.</div>';
    $('#layerCount').textContent = '0'; return;
  }
  const list = q ? S.items.filter(it =>
      it.label.toLowerCase().includes(q) || it.tag.includes(q) ||
      it.kind.includes(q) || (it.fillRaw || '').includes(q) || (it.strokeRaw || '').includes(q))
    : S.items;
  $('#layerCount').textContent = `${list.length}${q ? ' / ' + S.items.length : ''}`;
  box.innerHTML = list.map(it => {
    const c = it.fill?.hex || it.stroke?.hex;
    const sw = it.fill?.grad || it.stroke?.grad
      ? `<span class="sw" style="background:linear-gradient(135deg,#888,#333)"></span>`
      : c ? `<span class="sw" style="background:${c}"></span>`
          : `<span class="sw" style="background:repeating-conic-gradient(#555 0 25%,#2a2a2a 0 50%) 0/7px 7px"></span>`;
    const anim = S.clips.some(cl => cl.targets.includes(it.uid)) ? '<span class="dot"></span>' : '';
    const meta = it.kind === 'text' ? `${it.chars}ch`
              : it.subpaths > 1 ? `${it.subpaths}sub`
              : it.kind === 'stroke' ? `${Math.round(it.len)}u` : it.kind;
    return `<div class="layer ${S.sel.has(it.uid) ? 'on' : ''} ${it.hidden ? 'hidden' : ''}" data-uid="${it.uid}">
      <span class="tw" style="padding-left:${it.depth * 9}px">${it.kind === 'group' ? '▾' : '·'}</span>
      ${sw}
      <span class="nm" title="${esc(it.label)} — <${it.tag}>">${esc(it.label)}</span>
      ${anim}
      <span class="kind">${esc(meta)}</span>
      <span class="eye" data-eye="${it.uid}" title="Show / hide">${it.hidden ? '○' : '●'}</span>
    </div>`;
  }).join('');
}

export function bindLayers() {
  $('#layers').addEventListener('click', e => {
    const eye = e.target.closest('[data-eye]');
    if (eye) {
      const rec = S.byUid.get(eye.dataset.eye);
      rec.hidden = !rec.hidden;
      rec.node.style.display = rec.hidden ? 'none' : '';
      renderLayers(); markDirty(); return;
    }
    const row = e.target.closest('.layer'); if (!row) return;
    const uid = row.dataset.uid;
    if (e.shiftKey && S.sel.size) {
      const all = S.items.map(i => i.uid);
      const last = [...S.sel].pop();
      const a = all.indexOf(last), b = all.indexOf(uid);
      select(all.slice(Math.min(a, b), Math.max(a, b) + 1), { add: true });
    } else select([uid], { toggle: e.metaKey || e.ctrlKey, add: e.metaKey || e.ctrlKey });
  });
  $('#layers').addEventListener('dblclick', e => {
    const row = e.target.closest('.layer'); if (!row) return;
    if (!S.sel.has(row.dataset.uid)) select([row.dataset.uid]);
    const r = row.getBoundingClientRect();
    openPaint(r.right, r.top);
  });
  $('#layers').addEventListener('mousemove', e => {
    const row = e.target.closest('.layer');
    const u = row ? row.dataset.uid : null;
    if (u !== S.hot) { S.hot = u; renderOverlay(); }
  });
  $('#search').addEventListener('input', renderLayers);
}

export function renderSwatches() {
  const p = palette();
  $('#swCount').textContent = p.length;
  $('#swatches').innerHTML = p.map(c => {
    const bg = c.grad ? 'linear-gradient(135deg,#9aa,#334)' : c.hex;
    const nm = c.grad ? 'gradient' : `${colorName(parseColor(c.hex).rgb)} ${c.hex}`;
    return `<div class="chip" data-key="${esc(c.key)}" style="background:${bg}"
      title="${esc(nm)} · ${c.uids.size} element(s)"><b>${c.uids.size}</b></div>`;
  }).join('') || '<span class="hint">No colours found.</span>';
}

export function bindSwatches() {
  $('#swatches').addEventListener('dblclick', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    const entry = palette().find(c => c.key === chip.dataset.key); if (!entry) return;
    select([...entry.uids]);
    const r = chip.getBoundingClientRect();
    openPaint(r.right, r.top);
  });
  $('#swatches').addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    const entry = palette().find(c => c.key === chip.dataset.key); if (!entry) return;
    select([...entry.uids], { add: e.shiftKey });
    toast(`Selected ${entry.uids.size} element(s) using this colour`);
  });
}
