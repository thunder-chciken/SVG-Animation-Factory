/* =====================================================================
   ICONIFY BROWSER
   Searches the public Iconify API (200k+ open-source icons) and drops the
   chosen icon straight into the document on stage.

   Two API calls per search, not one per icon: /search returns names and
   collection metadata, then one bulk /{prefix}.json per set returns every
   body at once. Previews are then built locally, so the grid renders
   without a request per tile and insertion needs no network at all.

   Icons arrive as untrusted third-party markup, so they go through the
   same sanitiser as a dropped file before touching the DOM.
   ===================================================================== */
import { S, $, NS, esc, round, toast, markDirty } from './state.js';
import { sanitize, reindex, loadSVG } from './ingest.js';
import { renderAll } from './render.js';
import { rebuild } from './timeline.js';
import { select } from './selection.js';

const API = 'https://api.iconify.design';
const LIMIT = 96;
/* Icon bodies are authored with currentColor. The studio indexes concrete
   fills, so resolve it on the way in — otherwise the icon lands with no
   colour of its own and never shows up in the palette. */
const INK = '#dfe4ec';

const SUGGESTIONS = ['arrow', 'check', 'user', 'search', 'heart', 'settings', 'play', 'cloud'];

let results = [];      // [{ id, prefix, name, svg, set }]
let collections = {};
let inFlight = null;
let lastQuery = '';

/* ---------------------------------------------------------------------
   API
   --------------------------------------------------------------------- */
function iconMarkup(set, name) {
  let ic = set.icons?.[name];
  let extra = null;
  if (!ic && set.aliases?.[name]) {
    extra = set.aliases[name];
    ic = set.icons?.[extra.parent];
  }
  if (!ic) return null;
  const w = ic.width || set.width || 16;
  const h = ic.height || set.height || 16;
  const l = ic.left || 0, t = ic.top || 0;
  let body = ic.body;
  // Aliases can carry a rotation or flip; express it as a wrapper transform.
  if (extra && (extra.rotate || extra.hFlip || extra.vFlip)) {
    const parts = [];
    if (extra.hFlip) parts.push(`translate(${w} 0) scale(-1 1)`);
    if (extra.vFlip) parts.push(`translate(0 ${h}) scale(1 -1)`);
    if (extra.rotate) parts.push(`rotate(${extra.rotate * 90} ${w / 2} ${h / 2})`);
    body = `<g transform="${parts.join(' ')}">${body}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${l} ${t} ${w} ${h}">${body}</svg>`;
}

async function search(query, signal) {
  const r = await fetch(`${API}/search?query=${encodeURIComponent(query)}&limit=${LIMIT}`, { signal });
  if (!r.ok) throw new Error(`Iconify search failed (${r.status})`);
  const data = await r.json();
  const names = data.icons || [];
  collections = data.collections || {};
  if (!names.length) return [];

  // group by set so each set costs exactly one bulk request
  const byPrefix = new Map();
  names.forEach(id => {
    const [prefix, name] = id.split(':');
    if (!prefix || !name) return;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(name);
  });

  const sets = await Promise.all([...byPrefix.entries()].map(async ([prefix, list]) => {
    try {
      const res = await fetch(`${API}/${prefix}.json?icons=${list.join(',')}`, { signal });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return null;
    }
  }));

  const bodies = new Map();
  sets.filter(Boolean).forEach(set => bodies.set(set.prefix, set));

  // keep the API's relevance order
  return names.map(id => {
    const [prefix, name] = id.split(':');
    const set = bodies.get(prefix);
    if (!set) return null;
    const svg = iconMarkup(set, name);
    return svg ? { id, prefix, name, svg, set: collections[prefix] || null } : null;
  }).filter(Boolean);
}

/* ---------------------------------------------------------------------
   Insertion
   --------------------------------------------------------------------- */
const slug = s => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

function uniqueId(base) {
  let id = base, n = 1;
  while (S.svg.querySelector(`[id="${id}"]`)) id = `${base}-${++n}`;
  return id;
}

/* An icon body can carry its own gradient / clipPath ids. Two icons using
   the same internal id would collide once both are in one document, so
   every id in the fragment is renamed and its url(#…) users repointed. */
function namespaceIds(root, prefix) {
  const map = new Map();
  root.querySelectorAll('[id]').forEach(n => {
    const old = n.getAttribute('id');
    const next = `${prefix}-${old}`;
    map.set(old, next);
    n.setAttribute('id', next);
  });
  if (!map.size) return;
  const patch = v => v.replace(/url\(\s*["']?#([^)"']+)["']?\s*\)/g,
    (m, id) => map.has(id) ? `url(#${map.get(id)})` : m);
  root.querySelectorAll('*').forEach(n => {
    [...n.attributes].forEach(a => {
      if (a.value.includes('url(')) n.setAttribute(a.name, patch(a.value));
      else if ((a.name === 'href' || a.name === 'xlink:href') && a.value.startsWith('#')) {
        const id = a.value.slice(1);
        if (map.has(id)) n.setAttribute(a.name, '#' + map.get(id));
      }
    });
  });
}

export function insertIcon(entry) {
  const markup = entry.svg.replace(/currentColor/g, INK);

  // Nothing on stage yet — the icon becomes the document.
  if (!S.svg) {
    loadSVG(markup, `${slug(entry.id)}.svg`);
    return;
  }

  let clean;
  try { clean = sanitize(markup); }
  catch (e) { toast('That icon could not be parsed.', 'err'); return; }

  const vb = (clean.getAttribute('viewBox') || '0 0 24 24').trim().split(/[\s,]+/).map(Number);
  const [ix, iy, iw, ih] = vb;
  const host = (S.svg.getAttribute('viewBox') || '0 0 100 100').trim().split(/[\s,]+/).map(Number);
  const [hx, hy, hw, hh] = host;

  // land it centred, at about a third of the shorter side
  const k = (Math.min(hw, hh) * 0.34) / Math.max(iw || 1, ih || 1);
  const tx = hx + hw / 2 - (iw * k) / 2 - ix * k;
  const ty = hy + hh / 2 - (ih * k) / 2 - iy * k;

  const id = uniqueId(slug(entry.id));
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('id', id);
  g.setAttribute('transform', `translate(${round(tx, 2)} ${round(ty, 2)}) scale(${round(k, 4)})`);
  while (clean.firstChild) g.appendChild(clean.firstChild);
  namespaceIds(g, id);
  S.svg.appendChild(g);

  reindex();
  const rec = S.items.find(i => i.node === g);
  renderAll();
  if (rec) select([rec.uid]);
  rebuild(true);
  markDirty();
  toast(`Inserted ${entry.id}`, 'ok');
}

/* ---------------------------------------------------------------------
   UI
   --------------------------------------------------------------------- */
function setLine(entry) {
  const c = entry.set;
  if (!c) return entry.prefix;
  const lic = c.license?.title || c.license?.spdx || '';
  return `${c.name}${lic ? ' · ' + lic : ''}`;
}

function renderGrid(state, message) {
  const box = $('#iconGrid');
  if (state === 'idle') {
    box.innerHTML = `<div class="empty-note">Search ${'200,000+'} open-source icons.<br>
      <span class="icon-sugg">${SUGGESTIONS.map(s =>
        `<button class="btn xs" data-sugg="${s}">${s}</button>`).join('')}</span></div>`;
    return;
  }
  if (state === 'loading') { box.innerHTML = `<div class="empty-note">Searching…</div>`; return; }
  if (state === 'error') { box.innerHTML = `<div class="empty-note">${esc(message)}</div>`; return; }
  if (!results.length) {
    box.innerHTML = `<div class="empty-note">No icons match “${esc(lastQuery)}”.</div>`; return;
  }
  box.innerHTML = results.map((r, i) =>
    `<button class="icon-tile" data-icon="${i}" title="${esc(r.id)} — ${esc(setLine(r))}">
      <span class="icon-art">${r.svg}</span>
      <span class="icon-nm">${esc(r.name)}</span>
    </button>`).join('');
}

function renderCount() {
  const n = results.length;
  $('#iconNote').textContent = n ? `${n} shown${n >= LIMIT ? ` (first ${LIMIT})` : ''}` : '';
}

async function runSearch(q) {
  lastQuery = q.trim();
  if (!lastQuery) { results = []; renderGrid('idle'); renderCount(); return; }
  if (inFlight) inFlight.abort();
  const ctrl = new AbortController();
  inFlight = ctrl;
  renderGrid('loading');
  try {
    results = await search(lastQuery, ctrl.signal);
    if (ctrl.signal.aborted) return;
    renderGrid('ready');
    renderCount();
  } catch (e) {
    if (e.name === 'AbortError') return;
    results = [];
    renderGrid('error', navigator.onLine
      ? `Could not reach the Iconify API. ${e.message}`
      : 'You appear to be offline — icon search needs a connection.');
    renderCount();
  } finally {
    if (inFlight === ctrl) inFlight = null;
  }
}

export function openIcons() {
  $('#iconModal').classList.add('on');
  const input = $('#iconSearch');
  input.focus(); input.select();
  if (!results.length && !lastQuery) renderGrid('idle');
}

export function bindIcons() {
  const input = $('#iconSearch');
  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => runSearch(input.value), 320);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { clearTimeout(debounce); runSearch(input.value); }
    if (e.key === 'Escape') $('#iconModal').classList.remove('on');
  });

  $('#iconGrid').addEventListener('click', e => {
    const sugg = e.target.closest('[data-sugg]');
    if (sugg) { input.value = sugg.dataset.sugg; runSearch(input.value); return; }
    const tile = e.target.closest('[data-icon]');
    if (!tile) return;
    const entry = results[+tile.dataset.icon];
    if (!entry) return;
    insertIcon(entry);
    if (!e.shiftKey) $('#iconModal').classList.remove('on');
  });

  $('#iconClose').onclick = () => $('#iconModal').classList.remove('on');
  $('#iconModal').onclick = e => { if (e.target.id === 'iconModal') $('#iconModal').classList.remove('on'); };
}
