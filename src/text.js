/* =====================================================================
   TEXT
   Type text straight onto the canvas, then break it apart so every letter
   is its own animatable element.

   Each line becomes a separate <text> element rather than one element with
   tspans. Tspans cannot be positioned or animated independently in any
   useful way, and the splitter walks real <text> nodes — one element per
   line means a line can be animated on its own, and Split letters works
   line by line.

   Fonts are web-safe stacks on purpose. An SVG carries no font with it, so
   anything exotic silently falls back to something else on a machine that
   does not have it. Split the text into letters if you need the shapes to
   be guaranteed identical everywhere.
   ===================================================================== */
import { S, $, NS, esc, round, clamp, toast, markDirty } from './state.js';
import { reindex, newDocument } from './ingest.js';
import { selectedRecs, select } from './selection.js';
import { renderAll } from './render.js';
import { rebuild } from './timeline.js';
import { splitText } from './separate.js';

const FONTS = [
  ['Helvetica, Arial, sans-serif', 'Helvetica / Arial'],
  ['Georgia, "Times New Roman", serif', 'Georgia / Times'],
  ['"Segoe UI", Roboto, system-ui, sans-serif', 'System UI'],
  ['Impact, "Haettenschweiler", sans-serif', 'Impact'],
  ['"Courier New", ui-monospace, monospace', 'Courier'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['"Palatino Linotype", "Book Antiqua", serif', 'Palatino'],
  ['"Comic Sans MS", cursive', 'Comic Sans'],
];

const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

const draft = {
  content: 'Your text',
  font: FONTS[0][0],
  size: 0,            // 0 = derive from the artboard the first time
  weight: 700,
  spacing: 0,
  anchor: 'middle',
  fill: '#dfe4ec',
  lineGap: 1.2,
};

const viewBox = () =>
  (S.svg?.getAttribute('viewBox') || '0 0 400 300').trim().split(/[\s,]+/).map(Number);

/* The <text> elements that make up one selected block, in document order. */
function selectedTexts() {
  return selectedRecs().filter(r => r.tag === 'text');
}

function defaultSize() {
  const [, , w, h] = viewBox();
  return Math.max(8, round(Math.min(w, h) / 7, 1));
}

/* ---------------------------------------------------------------------
   Writing to the document
   --------------------------------------------------------------------- */
function styleText(el, d, x, y) {
  el.setAttribute('x', round(x, 2));
  el.setAttribute('y', round(y, 2));
  el.setAttribute('font-family', d.font);
  el.setAttribute('font-size', d.size);
  el.setAttribute('font-weight', d.weight);
  el.setAttribute('text-anchor', d.anchor);
  if (d.spacing) el.setAttribute('letter-spacing', d.spacing);
  else el.removeAttribute('letter-spacing');
  el.setAttribute('fill', d.fill);
  el.style.setProperty('fill', d.fill);      // beat any <style> class rule
}

function addText() {
  // No artboard yet? Make one rather than refusing — wanting to type is a
  // perfectly clear signal that a document is wanted too.
  if (!S.svg && !newDocument({ w: 1200, h: 800, name: 'untitled.svg' })) {
    toast('Could not create a document.', 'err'); return;
  }
  const d = draft;
  if (!d.size) d.size = defaultSize();
  const lines = d.content.split('\n').filter(l => l.trim().length);
  if (!lines.length) { toast('Type something first.', 'err'); return; }

  const [vx, vy, vw, vh] = viewBox();
  const anchorX = d.anchor === 'start' ? vx + vw * 0.1
                : d.anchor === 'end' ? vx + vw * 0.9
                : vx + vw / 2;
  const step = d.size * d.lineGap;
  const top = vy + vh / 2 - (step * (lines.length - 1)) / 2;

  const made = [];
  lines.forEach((line, i) => {
    const el = document.createElementNS(NS, 'text');
    styleText(el, d, anchorX, top + i * step);
    el.textContent = line;
    S.svg.appendChild(el);
    made.push(el);
  });

  reindex();
  const uids = made.map(el => el.dataset.saf).filter(Boolean);
  renderAll();
  select(uids);
  rebuild(true);
  markDirty();
  renderText();
  toast(`Added ${lines.length} text line${lines.length > 1 ? 's' : ''}`, 'ok');
}

function updateSelectedText() {
  const texts = selectedTexts();
  if (!texts.length) { addText(); return; }
  const d = draft;
  const lines = d.content.split('\n').filter(l => l.trim().length);

  texts.forEach((rec, i) => {
    const el = rec.node;
    styleText(el, d, parseFloat(el.getAttribute('x')) || 0, parseFloat(el.getAttribute('y')) || 0);
    if (lines[i] !== undefined) el.textContent = lines[i];
  });

  reindex(); renderAll(); rebuild(true); markDirty();
  toast(`Updated ${texts.length} text element${texts.length > 1 ? 's' : ''}`, 'ok');
}

/* Pull the selected text back into the editor so it can be edited. */
function readSelection() {
  const texts = selectedTexts();
  if (!texts.length) return false;
  const el = texts[0].node;
  draft.content = texts.map(t => t.node.textContent).join('\n');
  draft.font = el.getAttribute('font-family') || draft.font;
  draft.size = parseFloat(el.getAttribute('font-size') || getComputedStyle(el).fontSize) || draft.size;
  draft.weight = parseInt(el.getAttribute('font-weight') || getComputedStyle(el).fontWeight, 10) || draft.weight;
  draft.spacing = parseFloat(el.getAttribute('letter-spacing')) || 0;
  draft.anchor = el.getAttribute('text-anchor') || 'middle';
  const f = el.style.fill || el.getAttribute('fill');
  if (f && f.startsWith('#')) draft.fill = f;
  return true;
}

/* ---------------------------------------------------------------------
   UI
   --------------------------------------------------------------------- */
function renderText() {
  const d = draft;
  const editing = selectedTexts().length;
  $('#textMode').textContent = editing ? `editing ${editing}` : 'new';
  if (!d.size) d.size = S.svg ? defaultSize() : 48;

  $('#textBody').innerHTML = `
    <textarea id="txContent" rows="3" style="width:100%;font-size:11.5px;resize:vertical"
      placeholder="Type your text — one line per row">${esc(d.content)}</textarea>
    <p class="hint" style="margin:5px 0 8px">Each line becomes its own element, so lines
      can animate separately.</p>

    <div class="ctl"><label>Font</label>
      <select id="txFont">${FONTS.map(([v, l]) =>
        `<option value="${esc(v)}" ${d.font === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <span class="hint">family</span></div>

    <div class="ctl"><label>Size</label>
      <input type="range" id="txSizeR" min="4" max="400" step="1" value="${d.size}">
      <input type="number" id="txSizeN" min="1" step="1" value="${d.size}" title="px"></div>

    <div class="ctl"><label>Weight</label>
      <select id="txWeight">${WEIGHTS.map(w =>
        `<option value="${w}" ${+d.weight === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
      <span class="hint">bold</span></div>

    <div class="ctl"><label>Letter space</label>
      <input type="range" id="txSpaceR" min="-20" max="60" step="0.5" value="${d.spacing}">
      <input type="number" id="txSpaceN" step="0.5" value="${d.spacing}" title="px"></div>

    <div class="ctl"><label>Align</label>
      <div class="seg" id="txAnchor" style="flex:1">
        ${[['start', 'Left'], ['middle', 'Centre'], ['end', 'Right']].map(([v, l]) =>
          `<button data-anchor="${v}" class="${d.anchor === v ? 'on' : ''}" style="flex:1">${l}</button>`).join('')}
      </div><span class="hint"></span></div>

    <div class="ctl"><label>Colour</label>
      <input type="color" id="txFill" value="${d.fill}">
      <input type="text" id="txFillHex" value="${d.fill}"></div>

    <div class="row" style="margin:10px 0 0">
      <button class="btn sm pri" id="txApply" style="flex:1">${editing ? 'Update text' : 'Add to canvas'}</button>
      ${editing ? `<button class="btn sm" id="txAddNew">Add new</button>` : ''}
    </div>
    <div class="row" style="margin:6px 0 0">
      <button class="btn sm" id="txSplitChars" style="flex:1" ${editing ? '' : 'disabled'}>Split into letters</button>
      <button class="btn sm" id="txSplitWords" ${editing ? '' : 'disabled'}>Words</button>
    </div>
    <p class="hint" style="margin-top:7px">Splitting turns every letter into its own element, so
      each one can be selected and animated on its own. The <b>Stagger</b> section then spreads a
      single effect across them.</p>`;

  bindText();
}

function bindText() {
  const b = $('#textBody');
  const on = (sel, ev, fn) => { const el = b.querySelector(sel); if (el) el.addEventListener(ev, fn); };

  on('#txContent', 'input', e => { draft.content = e.target.value; });
  on('#txFont', 'change', e => { draft.font = e.target.value; });
  on('#txWeight', 'change', e => { draft.weight = +e.target.value; });

  const size = v => {
    draft.size = clamp(parseFloat(v) || 1, 1, 2000);
    b.querySelector('#txSizeR').value = Math.min(draft.size, 400);
    b.querySelector('#txSizeN').value = draft.size;
  };
  on('#txSizeR', 'input', e => size(e.target.value));
  on('#txSizeN', 'input', e => size(e.target.value));

  const space = v => {
    draft.spacing = parseFloat(v) || 0;
    b.querySelector('#txSpaceR').value = draft.spacing;
    b.querySelector('#txSpaceN').value = draft.spacing;
  };
  on('#txSpaceR', 'input', e => space(e.target.value));
  on('#txSpaceN', 'input', e => space(e.target.value));

  b.querySelectorAll('[data-anchor]').forEach(el => el.onclick = () => {
    draft.anchor = el.dataset.anchor;
    b.querySelectorAll('[data-anchor]').forEach(x => x.classList.toggle('on', x === el));
  });

  on('#txFill', 'input', e => { draft.fill = e.target.value; b.querySelector('#txFillHex').value = e.target.value; });
  on('#txFillHex', 'input', e => {
    const v = e.target.value.trim();
    if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(v)) { draft.fill = v; b.querySelector('#txFill').value = v; }
  });

  on('#txApply', 'click', () => updateSelectedText());
  on('#txAddNew', 'click', () => { select([]); renderText(); addText(); });
  on('#txSplitChars', 'click', () => { splitText('char'); renderText(); });
  on('#txSplitWords', 'click', () => { splitText('word'); renderText(); });
}

export function openText() {
  const pop = $('#textPop');
  readSelection();
  renderText();
  pop.classList.add('on');
  const w = pop.offsetWidth || 286, h = pop.offsetHeight || 420;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, innerWidth - w - 352)) + 'px';
  pop.style.top = Math.max(8, Math.min(96, innerHeight - h - 8)) + 'px';
  $('#txContent')?.focus();
  $('#txContent')?.select();
}

/* Keep the panel in step with the canvas selection while it is open. */
export function refreshTextPanel() {
  if (!$('#textPop').classList.contains('on')) return;
  // Never redraw out from under someone mid-sentence — a repaint would swap
  // the textarea and take the caret with it.
  if (document.activeElement && $('#textBody').contains(document.activeElement)) return;
  readSelection();
  renderText();
}

export function bindTextShell() {
  $('#textClose').onclick = () => $('#textPop').classList.remove('on');
  const head = $('#textDrag'); let d = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.id === 'textClose') return;
    const r = $('#textPop').getBoundingClientRect();
    d = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.classList.add('grabbing');
    try { head.setPointerCapture(e.pointerId); } catch (err) { /* nicety */ }
  });
  head.addEventListener('pointermove', e => {
    if (!d) return;
    const pop = $('#textPop');
    pop.style.left = clamp(e.clientX - d.dx, 4, innerWidth - pop.offsetWidth - 4) + 'px';
    pop.style.top = clamp(e.clientY - d.dy, 4, innerHeight - pop.offsetHeight - 4) + 'px';
  });
  ['pointerup', 'pointercancel'].forEach(ev =>
    head.addEventListener(ev, () => { d = null; head.classList.remove('grabbing'); }));
}
