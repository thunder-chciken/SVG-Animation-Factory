/* =====================================================================
   LEFT PANEL — layer tree + colour swatches
   ===================================================================== */
import { S, $, $$, esc, toast, markDirty } from './state.js';
import { palette, reindex } from './ingest.js';
import { parseColor, colorName } from './color.js';
import { select, renderOverlay } from './selection.js';
import { openPaint } from './paint.js';
import { rebuild } from './timeline.js';

export function highlightLayer(uid) {
  $$('#layers .layer').forEach(el => el.classList.toggle('hot', el.dataset.uid === uid));
}

/* SVG paints in document order — the last element wins. Photoshop and
   Illustrator both put the front-most layer at the TOP of the panel, so the
   tree is shown reversed: siblings back-to-front become front-to-back, with
   each subtree still sitting under its parent. Everything below this line
   works in display order; the DOM stays in paint order. */
export function displayOrder() {
  const kids = new Map();
  S.items.forEach(it => {
    if (!kids.has(it.parentUid)) kids.set(it.parentUid, []);
    kids.get(it.parentUid).push(it);
  });
  const out = [];
  const walk = parentUid => {
    const list = kids.get(parentUid) || [];
    for (let i = list.length - 1; i >= 0; i--) { out.push(list[i]); walk(list[i].uid); }
  };
  walk(null);
  return out;
}

export function renderLayers() {
  const box = $('#layers');
  const q = $('#search').value.trim().toLowerCase();
  if (!S.items.length) {
    box.innerHTML = '<div class="empty-note">Load an SVG to index its elements.</div>';
    $('#layerCount').textContent = '0'; return;
  }
  const ordered = displayOrder();
  const list = q ? ordered.filter(it =>
      it.label.toLowerCase().includes(q) || it.tag.includes(q) ||
      it.kind.includes(q) || (it.fillRaw || '').includes(q) || (it.strokeRaw || '').includes(q))
    : ordered;
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
    return `<div class="layer ${S.sel.has(it.uid) ? 'on' : ''} ${it.hidden ? 'hidden' : ''}"
      data-uid="${it.uid}" title="Drag to restack">
      <span class="tw" style="padding-left:${it.depth * 9}px">${it.kind === 'group' ? '▾' : '·'}</span>
      ${sw}
      <span class="nm" title="${esc(it.label)} — <${it.tag}>">${esc(it.label)}</span>
      ${anim}
      <span class="kind">${esc(meta)}</span>
      <span class="eye" data-eye="${it.uid}" title="Show / hide">${it.hidden ? '○' : '●'}</span>
    </div>`;
  }).join('');
}

/* ---------------------------------------------------------------------
   Drag to restack. Rows are shown front-to-back, so dropping A above B
   means A must end up AFTER B in the document — the insertion is the
   mirror image of what the indicator shows.

   An element that has been nudged around the canvas lives inside a
   position wrapper; that wrapper is what moves, or the offset is lost.
   --------------------------------------------------------------------- */
const outerNode = rec => {
  const p = rec.node.parentNode;
  return (p && p.dataset && p.dataset.safMove) ? p : rec.node;
};

let LDRAG = null;

function dropIndicator() {
  let el = $('#layerDrop');
  if (!el) {
    el = document.createElement('div');
    el.id = 'layerDrop';
    $('#layers').appendChild(el);
  }
  return el;
}

function rowUnder(clientY) {
  const rows = [...document.querySelectorAll('#layers .layer')];
  for (const r of rows) {
    const b = r.getBoundingClientRect();
    if (clientY >= b.top && clientY <= b.bottom) return { row: r, before: clientY < b.top + b.height / 2 };
  }
  if (!rows.length) return null;
  const first = rows[0].getBoundingClientRect();
  if (clientY < first.top) return { row: rows[0], before: true };
  return { row: rows[rows.length - 1], before: false };
}

function showIndicator(hit) {
  const ind = dropIndicator();
  if (!hit) { ind.style.display = 'none'; return; }
  const box = $('#layers').getBoundingClientRect();
  const b = hit.row.getBoundingClientRect();
  ind.style.display = 'block';
  ind.style.top = ((hit.before ? b.top : b.bottom) - box.top + $('#layers').scrollTop - 1) + 'px';
}

function beginLayerDrag(e) {
  if (e.button !== 0) return;
  const row = e.target.closest('.layer');
  if (!row || e.target.closest('[data-eye]')) return;
  LDRAG = { uid: row.dataset.uid, row, y0: e.clientY, moved: false, hit: null };
}

function moveLayerDrag(e) {
  if (!LDRAG) return;
  if (!LDRAG.moved) {
    if (Math.abs(e.clientY - LDRAG.y0) < 4) return;
    LDRAG.moved = true;
    LDRAG.row.classList.add('dragging');
    document.body.style.cursor = 'grabbing';
  }
  // keep the list moving when the pointer reaches an edge
  const box = $('#layers');
  const b = box.getBoundingClientRect();
  if (e.clientY < b.top + 24) box.scrollTop -= 8;
  else if (e.clientY > b.bottom - 24) box.scrollTop += 8;

  const hit = rowUnder(e.clientY);
  LDRAG.hit = hit && hit.row.dataset.uid !== LDRAG.uid ? hit : null;
  showIndicator(LDRAG.hit);
  e.preventDefault();
}

function endLayerDrag() {
  if (!LDRAG) return;
  const { uid, row, moved, hit } = LDRAG;
  LDRAG = null;
  document.body.style.cursor = '';
  row.classList.remove('dragging');
  dropIndicator().style.display = 'none';
  if (!moved || !hit) return;

  const src = S.byUid.get(uid);
  const dst = S.byUid.get(hit.row.dataset.uid);
  if (!src || !dst) return;

  const moving = outerNode(src);
  const target = outerNode(dst);
  if (moving === target || moving.contains(target)) {
    toast('A group cannot be dropped inside itself.', 'err');
    return;
  }

  // display "above" = nearer the front = later in the document
  if (hit.before) target.parentNode.insertBefore(moving, target.nextSibling);
  else target.parentNode.insertBefore(moving, target);

  reindex();
  renderLayers(); renderSwatches(); renderOverlay();
  rebuild(true);
  markDirty();
  toast(`Restacked ${src.label}`, 'ok');
}

export function bindLayers() {
  $('#layers').addEventListener('pointerdown', beginLayerDrag);
  window.addEventListener('pointermove', moveLayerDrag);
  window.addEventListener('pointerup', endLayerDrag);
  window.addEventListener('pointercancel', endLayerDrag);

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
      const all = displayOrder().map(i => i.uid);   // range follows what's on screen
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
