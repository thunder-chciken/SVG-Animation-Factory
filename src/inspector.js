/* =====================================================================
   INSPECTOR — the right-hand panel and everything wired inside it
   ===================================================================== */
import { S, $, esc, round, clamp, toast, markDirty } from './state.js';
import { OPEN_SECT, sect, ctlRow, propRow, syncOpenToWorkspace } from './ui.js';
import { WS, moveSection, resetWorkspace } from './workspace.js';
import { readXf, patchXf, resetXf, IDENTITY } from './transform.js';
import { alignNodes, distributeNodes } from './align.js';
import { resizeArtboard, niceGridSize } from './ingest.js';
import { renderOverlay } from './selection.js';
import { syncLoopUI } from './transport.js';
import { SCHEMA, EASES, EASE_DIR, newClip } from './schema.js';
import { presetsSection, applyPreset, setPresetCat } from './presets.js';
import { selectedRecs } from './selection.js';
import { rebuild, playFrom } from './timeline.js';
import { renderTracks } from './transport.js';
import { renderAll } from './render.js';

/* Looping the whole composition. Lives here rather than only behind the
   transport button — this is where every other setting is, so it is where
   people look for it. */
function loopSection() {
  const lc = S.loopCfg;
  const off = lc.on ? '' : 'disabled';
  return sect('loop', 'Looping (global)' + (lc.on ? '' : ' · off'), `
    <div class="ctl wide"><label>Loop</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" id="loopOn" ${lc.on ? 'checked' : ''}> repeat the whole animation</label></div>
    <div class="ctl"><label>Times</label>
      <select id="loopCount" ${off}>
        ${[[-1, 'forever'], [1, '2×'], [2, '3×'], [4, '5×'], [9, '10×'], [19, '20×']].map(([v, l]) =>
          `<option value="${v}" ${lc.count === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select><span class="hint">cycles</span></div>
    <div class="ctl"><label>Pause between</label>
      <input type="range" id="loopDelayR" min="0" max="5" step="0.05" value="${lc.delay}" ${off}>
      <input type="number" id="loopDelayN" min="0" max="5" step="0.05" value="${lc.delay}" ${off}></div>
    <div class="ctl wide"><label>Ping-pong</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" id="loopYoyo" ${lc.yoyo ? 'checked' : ''} ${off}> play backwards on alternate cycles</label></div>
    <p class="hint" style="margin-top:6px">Applies to the whole timeline. A single lane can still
      repeat on its own under <b>Timing &amp; easing</b>. Carried into the GSAP, Standalone HTML,
      WordPress and Animated SVG exports.</p>`);
}

/* Open the Looping section and scroll it into view. The transport button
   calls this so the settings are one click from the control people press. */
export function revealLoopSection() {
  OPEN_SECT.add('loop');
  syncOpenToWorkspace();
  renderInspector();
  const el = document.querySelector('#inspector .sect[data-sect="loop"]');
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  el?.classList.add('flash');
  setTimeout(() => el?.classList.remove('flash'), 900);
}

/* Static transform — the artwork's own placement, independent of any clip.
   Scale, rotate and skew are laid out here so they work on a plain shape
   with no animation on it at all; clips then animate on top. */
function transformSection() {
  const recs = selectedRecs();
  const t = recs.length ? readXf(recs[0].node) : { ...IDENTITY };
  const dis = recs.length ? '' : 'disabled';
  const row = (label, key, val, min, max, step, unit) => `
    <div class="ctl"><label>${label}</label>
      <input type="range" data-xf="${key}" min="${min}" max="${max}" step="${step}" value="${val}" ${dis}>
      <input type="number" data-xfn="${key}" value="${round(val, 3)}" step="${step}" title="${unit}" ${dis}>
    </div>`;
  return sect('xform', 'Transform' + (recs.length > 1 ? ` · ${recs.length}` : ''), `
    ${recs.length ? '' : '<p class="hint" style="margin-bottom:7px">Select something on the canvas first.</p>'}
    ${row('X', 'x', t.x, -1000, 1000, 1, 'px')}
    ${row('Y', 'y', t.y, -1000, 1000, 1, 'px')}
    ${row('Rotate', 'rot', t.rot, -360, 360, .5, '°')}
    ${row('Scale X', 'sx', t.sx, 0.05, 5, .01, '×')}
    ${row('Scale Y', 'sy', t.sy, 0.05, 5, .01, '×')}
    ${row('Skew X', 'kx', t.kx, -80, 80, .5, '°')}
    ${row('Skew Y', 'ky', t.ky, -80, 80, .5, '°')}
    <div class="row" style="margin:8px 0 0">
      <label class="hint" style="display:flex;gap:5px;align-items:center;flex:1">
        <input type="checkbox" id="xfLink" checked> link scale</label>
      <button class="btn xs" id="xfReset" ${dis}>Reset transform</button>
    </div>
    <p class="hint" style="margin-top:6px">Applies to the artwork itself, so it works with no
      animation on the element. Animation clips build on top of whatever you set here.</p>`);
}

/* The page itself: how big it is, and what sits behind the artwork. */
function docSection() {
  const vb = (S.svg?.getAttribute('viewBox') || '0 0 0 0').trim().split(/[\s,]+/).map(Number);
  const vw = Math.round(vb[2] || 0), vh = Math.round(vb[3] || 0);
  const a = S.artboard;
  const preset = (w, h) => `<button class="btn xs" data-docsize="${w}x${h}">${w}×${h}</button>`;
  return sect('doc', 'Document', `
    <div class="ctl"><label>Size</label>
      <input type="text" id="docSize" value="${vw} x ${vh}" placeholder="1920x1080"
        title="Type any size, e.g. 1920x1080">
      <button class="btn xs" id="docApply">Set</button></div>
    <div class="row" style="margin:2px 0 9px">
      ${preset(1920, 1080)}${preset(1080, 1080)}${preset(1080, 1920)}${preset(1200, 630)}${preset(512, 512)}
    </div>
    <div class="ctl wide"><label>Show page</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" id="abShow" ${a.show ? 'checked' : ''}> draw the artboard behind the artwork</label></div>
    <div class="ctl"><label>Page colour</label>
      <input type="color" id="abBg" value="${a.bg}">
      <input type="text" id="abBgHex" value="${a.bg}"></div>
    <p class="hint" style="margin-top:6px">The page is editor-only — it never reaches an export.
      Resizing changes the artboard without moving any artwork.</p>`);
}

/* How big a grid square actually is on screen. This is the number that
   explains why a step suited to a small logo looks like nothing on a
   1920px artboard. */
function gridStepNote() {
  if (!S.svg) return '';
  try {
    const m = S.svg.getScreenCTM();
    if (!m) return '';
    return `One square is ${round(S.grid.size * Math.hypot(m.a, m.b), 1)}px on screen right now.`;
  } catch (e) { return ''; }
}

/* Align, distribute and grid snapping. */
let alignTo = 'selection';

function alignSection() {
  const n = selectedRecs().length;
  const g = S.grid;
  const dis = n ? '' : 'disabled';
  const btn = (act, label, title) =>
    `<button class="btn xs alignbtn" data-align="${act}" title="${title}" ${dis}>${label}</button>`;
  return sect('align', 'Align & grid' + (n > 1 ? ` · ${n}` : ''), `
    <div class="ctl"><label>Align to</label>
      <div class="seg" style="flex:1">
        <button data-alignto="selection" class="${alignTo === 'selection' ? 'on' : ''}" style="flex:1">Selection</button>
        <button data-alignto="artboard" class="${alignTo === 'artboard' ? 'on' : ''}" style="flex:1">Artboard</button>
      </div><span class="hint"></span></div>
    <p class="hint" style="margin:-2px 0 7px">A single element always aligns to the artboard.</p>

    <div class="aligngrid">
      ${btn('left', '┣', 'Align left')}
      ${btn('hcenter', '║', 'Align horizontal centres')}
      ${btn('right', '┫', 'Align right')}
      ${btn('top', '┳', 'Align top')}
      ${btn('vcenter', '═', 'Align vertical centres')}
      ${btn('bottom', '┻', 'Align bottom')}
    </div>
    <div class="row" style="margin:6px 0 0">
      <button class="btn xs" data-align="center" style="flex:1" ${dis}>Centre both</button>
      <button class="btn xs" data-align="dist-h" ${dis} title="Even horizontal gaps (3+)">Dist H</button>
      <button class="btn xs" data-align="dist-v" ${dis} title="Even vertical gaps (3+)">Dist V</button>
    </div>

    <div class="ctl wide" style="margin-top:10px"><label>Snap</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" id="gridOn" ${g.on ? 'checked' : ''}> snap dragging to the grid</label></div>
    <div class="ctl wide"><label>Show grid</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" id="gridShow" ${g.show ? 'checked' : ''}> draw it on the canvas</label></div>
    <div class="ctl"><label>Grid size</label>
      <input type="number" id="gridSizeN" min="1" step="1" value="${g.size}" title="user units">
      <button class="btn xs" id="gridAuto" title="Pick a step that suits this artboard">Auto</button></div>
    <div class="ctl"><label>Grid colour</label>
      <input type="color" id="gridColor" value="${g.color}">
      <input type="number" id="gridOpacity" min="0.05" max="1" step="0.05" value="${g.opacity}" title="opacity"></div>
    <p class="hint" style="margin-top:6px">Grid units are SVG user units, not screen pixels, so
      snapping holds at any zoom. <b>${gridStepNote()}</b> With snapping on, the arrow keys step
      one grid square.</p>`);
}

export function renderInspector() {
  const box = $('#inspector');
  const recs = selectedRecs();
  $('#selInfo').textContent = recs.length
    ? (recs.length === 1 ? recs[0].label : recs.length + ' selected')
    : 'nothing selected';

  if (!S.svg) { box.innerHTML = '<div class="empty-note">Load an SVG, then pick an element to animate.</div>'; return; }

  const clip = S.clips.find(c => c.id === S.activeClip);
  let html = '';

  /* selection + clip header */
  html += `<div class="sect"><div class="sbody">
    <div class="row">
      <button class="btn sm pri" id="addClip" ${recs.length ? '' : 'disabled'}>+ Animate selection</button>
      ${clip ? `<button class="btn sm" id="dupClip">Duplicate</button>
              <button class="btn sm danger" id="delClip">Delete clip</button>` : ''}
    </div>
    ${recs.length ? `<p class="hint">${recs.length} element${recs.length > 1 ? 's' : ''}: ${
      esc(recs.slice(0, 4).map(r => r.label).join(', '))}${recs.length > 4 ? ` +${recs.length - 4} more` : ''}</p>`
      : `<p class="hint">Click an element on the canvas, a row in the list, or a colour swatch.</p>`}
    ${clip ? `<div class="row" style="margin-top:7px">
      <input type="text" id="clipName" value="${esc(clip.name)}" style="flex:1">
      <label class="hint" style="display:flex;gap:4px;align-items:center">
        <input type="checkbox" id="clipOn" ${clip.enabled ? 'checked' : ''}> on</label>
      <button class="btn xs" id="reassign" title="Point this clip at the current selection">Retarget</button>
    </div>
    <p class="hint">Targets ${clip.targets.length} element${clip.targets.length > 1 ? 's' : ''}.</p>` : ''}
  </div></div>`;

  /* Sections are built into a map and emitted in the workspace order, so
     they can be dragged into whatever arrangement suits the work. */
  const parts = {};
  parts.presets = presetsSection();
  parts.loop = loopSection();
  parts.xform = transformSection();
  parts.align = alignSection();
  parts.doc = docSection();

  const emit = ids => ids.map(id => parts[id] || '').join('');

  if (!clip) {
    html += `<div class="empty-note">No clip selected.<br>Select elements and press
      <b>+ Animate selection</b>, or pick a preset below.</div>`;
    html += emit(WS.order.filter(id => ['doc', 'xform', 'align', 'presets', 'loop'].includes(id)));
    box.innerHTML = html; bindInspector(); return;
  }

  /* slider target toggle */
  html += `<div class="sect"><div class="sbody">
    <div class="row" style="margin:0">
      <span class="hint" style="flex:1">Sliders drive</span>
      <div class="seg">
        <button data-st="from" class="${S.sliderTarget === 'from' ? 'on' : ''}">FROM</button>
        <button data-st="to" class="${S.sliderTarget === 'to' ? 'on' : ''}">TO</button>
      </div>
      <button class="btn xs" id="swapAll" title="Swap every from/to value">⇄ Swap</button>
    </div>
    <p class="hint" style="margin-top:6px">Number fields always edit both values directly.</p>
  </div></div>`;

  /* timing */
  const t = clip.timing;
  parts.timing = sect('timing', 'Timing & easing', `
    ${ctlRow('Duration', 'duration', t.duration, 0, 10, .01, 's')}
    ${ctlRow('Delay', 'delay', t.delay, 0, 10, .01, 's')}
    <div class="ctl"><label>Ease</label>
      <select data-t="ease">${EASES.map(e => `<option ${t.ease === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
      <select data-t="dir" ${t.ease === 'none' ? 'disabled' : ''}>${EASE_DIR.map(d =>
        `<option ${t.dir === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
    </div>
    <div class="ctl"><label title="back(1.7) · elastic(1,0.3) · steps(12)">Ease config</label>
      <input type="text" data-t="cfg" value="${esc(t.cfg)}" placeholder="e.g. 1.7 or 1,0.3 or 12">
      <span class="hint">args</span>
    </div>
    ${ctlRow('Repeat', 'repeat', t.repeat, -1, 20, 1, '× (-1=∞)')}
    ${ctlRow('Repeat delay', 'repeatDelay', t.repeatDelay, 0, 5, .01, 's')}
    <div class="ctl wide"><label>Yoyo</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" data-t="yoyo" ${t.yoyo ? 'checked' : ''}> reverse on each repeat</label></div>
    <div class="ctl"><label>Place at</label>
      <select data-t="posMode">
        <option value="after" ${clip.posMode === 'after' ? 'selected' : ''}>After previous</option>
        <option value="with" ${clip.posMode === 'with' ? 'selected' : ''}>With previous</option>
        <option value="offset" ${clip.posMode === 'offset' ? 'selected' : ''}>Overlap previous</option>
        <option value="abs" ${clip.posMode === 'abs' ? 'selected' : ''}>Absolute time</option>
      </select>
      <input type="number" data-t="posVal" value="${clip.posVal}" step=".05"
        ${clip.posMode === 'after' || clip.posMode === 'with' ? 'disabled' : ''}>
    </div>`);

  /* stagger */
  const st = clip.stagger;
  parts.stagger = sect('stagger', 'Stagger (multi-element)', `
    ${ctlRow('Total spread', 'stAmount', st.amount, 0, 5, .01, 's')}
    <div class="ctl"><label>Start from</label>
      <select data-s="from">${['start', 'center', 'end', 'edges', 'random'].map(v =>
        `<option ${st.from === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <span class="hint">order</span></div>
    <div class="ctl"><label>Axis</label>
      <select data-s="axis">
        <option value="" ${st.axis === '' ? 'selected' : ''}>document order</option>
        <option value="x" ${st.axis === 'x' ? 'selected' : ''}>left → right</option>
        <option value="y" ${st.axis === 'y' ? 'selected' : ''}>top → bottom</option>
      </select>
      <span class="hint">grid</span></div>
    <div class="ctl"><label>Stagger ease</label>
      <select data-s="ease">${['none', 'power1.in', 'power1.out', 'power2.inOut', 'sine.inOut'].map(v =>
        `<option ${st.ease === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <span class="hint"></span></div>
    <p class="hint">Spread only applies when the clip targets more than one element.</p>`);

  /* transform origin */
  const org = clip.props.__origin || (clip.props.__origin = { on: false, from: '50% 50%', to: '50% 50%' });
  parts.origin = sect('origin', 'Transform origin', `
    <div class="row">
      <div class="origin" id="originGrid">
        ${['0% 0%', '50% 0%', '100% 0%', '0% 50%', '50% 50%', '100% 50%', '0% 100%', '50% 100%', '100% 100%']
          .map(v => `<i data-o="${v}" class="${org.from === v ? 'on' : ''}"></i>`).join('')}
      </div>
      <div style="flex:1">
        <input type="text" id="originVal" value="${esc(org.from)}">
        <p class="hint" style="margin-top:4px">Pivot for scale, rotate and skew.</p>
      </div>
    </div>
    <div class="ctl wide"><label>SVG origin</label>
      <label class="hint" style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" id="svgOrigin" ${clip.svgOrigin ? 'checked' : ''}> use svgOrigin (user units)</label></div>`);

  /* all animatable property groups */
  SCHEMA.forEach(g => {
    const rows = g.props.map(p => propRow(clip, p)).join('');
    const active = g.props.filter(p => clip.props[p.k].on).length;
    parts[g.id] = sect(g.id, g.title + (active ? ` · ${active}` : ''), rows);
  });

  /* motion path */
  const pathOpts = S.items.filter(i => i.tag === 'path' || i.tag === 'line' || i.tag === 'polyline')
    .map(i => `<option value="${i.uid}" ${clip.motionPath === i.uid ? 'selected' : ''}>${esc(i.label)}</option>`).join('');
  parts.mp = sect('mp', 'Travel along a path', `
    <div class="ctl"><label>Path</label>
      <select id="mpSel"><option value="">— none —</option>${pathOpts}</select>
      <span class="hint">guide</span></div>
    <div class="ctl wide"><label>Options</label>
      <div class="row" style="margin:0">
        <label class="hint" style="display:flex;gap:5px;align-items:center">
          <input type="checkbox" id="mpAlign" ${clip.mpAlign ? 'checked' : ''}> align to path</label>
        <label class="hint" style="display:flex;gap:5px;align-items:center">
          <input type="checkbox" id="mpRotate" ${clip.mpRotate ? 'checked' : ''}> auto-rotate</label>
      </div></div>
    <p class="hint">Moves the target along another element's outline. Hide the guide path with its ● toggle.</p>`);

  /* trigger */
  const tg = S.trigger;
  parts.trig = sect('trig', 'Playback trigger (global)', `
    <div class="ctl"><label>Fires on</label>
      <select id="trMode">
        ${[['load', 'Page load'], ['scroll', 'Scroll into view'], ['scrub', 'Scroll scrub'],
           ['click', 'Click'], ['hover', 'Hover']].map(([v, l]) =>
          `<option value="${v}" ${tg.mode === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select><span class="hint">event</span></div>
    <div class="ctl"><label>Start</label>
      <input type="text" id="trStart" value="${esc(tg.start)}" ${/scroll|scrub/.test(tg.mode) ? '' : 'disabled'}>
      <span class="hint">trigger</span></div>
    <div class="ctl"><label>End</label>
      <input type="text" id="trEnd" value="${esc(tg.end)}" ${tg.mode === 'scrub' ? '' : 'disabled'}>
      <span class="hint">trigger</span></div>
    <div class="ctl wide"><label>Options</label>
      <div class="row" style="margin:0">
        <label class="hint" style="display:flex;gap:5px;align-items:center">
          <input type="checkbox" id="trOnce" ${tg.once ? 'checked' : ''}> play once</label>
        <label class="hint" style="display:flex;gap:5px;align-items:center">
          <input type="checkbox" id="trMarkers" ${tg.markers ? 'checked' : ''}> markers</label>
      </div></div>`);

  html += emit(WS.order);
  box.innerHTML = html;
  bindInspector();
}

/* ---------------------------------------------------------------------
   Drag a section header to move that panel up or down. The header also
   toggles the section open, so a gesture only counts as a reorder once it
   has travelled far enough to be unambiguous.
   --------------------------------------------------------------------- */
let SDRAG = null;
let SECT_DRAGGED = false;

function sectDropIndicator() {
  let el = $('#sectDrop');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sectDrop';
    $('#inspector').appendChild(el);
  }
  return el;
}

function sectionUnder(y) {
  const list = [...document.querySelectorAll('#inspector .sect[data-sect]')];
  for (const s of list) {
    const b = s.getBoundingClientRect();
    if (y >= b.top && y <= b.bottom) return { sect: s, before: y < b.top + b.height / 2 };
  }
  if (!list.length) return null;
  const first = list[0].getBoundingClientRect();
  if (y < first.top) return { sect: list[0], before: true };
  return { sect: list[list.length - 1], before: false };
}

function bindSectionDrag(box) {
  box.querySelectorAll('.sect[data-sect] > .shead').forEach(head => {
    head.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      SDRAG = { id: head.parentNode.dataset.sect, y0: e.clientY, moved: false, hit: null };
      SECT_DRAGGED = false;
    });
  });
}

function moveSectionDrag(e) {
  if (!SDRAG) return;
  if (!SDRAG.moved) {
    if (Math.abs(e.clientY - SDRAG.y0) < 6) return;
    SDRAG.moved = true;
    document.body.style.cursor = 'grabbing';
    document.querySelector(`#inspector .sect[data-sect="${SDRAG.id}"]`)?.classList.add('dragging');
  }
  const panel = $('#inspector');
  const pb = panel.getBoundingClientRect();
  if (e.clientY < pb.top + 26) panel.scrollTop -= 10;
  else if (e.clientY > pb.bottom - 26) panel.scrollTop += 10;

  const hit = sectionUnder(e.clientY);
  SDRAG.hit = hit && hit.sect.dataset.sect !== SDRAG.id ? hit : null;
  const ind = sectDropIndicator();
  if (!SDRAG.hit) { ind.style.display = 'none'; return; }
  const b = SDRAG.hit.sect.getBoundingClientRect();
  ind.style.display = 'block';
  ind.style.top = ((SDRAG.hit.before ? b.top : b.bottom) - pb.top + panel.scrollTop - 1) + 'px';
}

function endSectionDrag() {
  if (!SDRAG) return;
  const { id, moved, hit } = SDRAG;
  SDRAG = null;
  document.body.style.cursor = '';
  sectDropIndicator().style.display = 'none';
  document.querySelector('#inspector .sect.dragging')?.classList.remove('dragging');
  if (!moved || !hit) return;
  SECT_DRAGGED = true;                       // swallow the click that follows
  if (moveSection(id, hit.sect.dataset.sect, hit.before)) renderInspector();
  setTimeout(() => { SECT_DRAGGED = false; }, 0);
}

window.addEventListener('pointermove', moveSectionDrag);
window.addEventListener('pointerup', endSectionDrag);
window.addEventListener('pointercancel', endSectionDrag);

function bindInspector() {
  const box = $('#inspector');
  const clip = S.clips.find(c => c.id === S.activeClip);

  box.querySelectorAll('.shead').forEach(h => h.onclick = () => {
    if (SECT_DRAGGED) return;              // the gesture was a reorder, not a toggle
    const s = h.parentNode, id = s.dataset.sect;
    s.classList.toggle('closed');
    s.classList.contains('closed') ? OPEN_SECT.delete(id) : OPEN_SECT.add(id);
    syncOpenToWorkspace();
  });
  bindSectionDrag(box);

  /* static transform — global, binds whether or not a clip is active */
  const xfTargets = () => selectedRecs();
  const applyXf = (key, val) => {
    const link = $('#xfLink')?.checked;
    xfTargets().forEach(r => {
      const patch = { [key]: val };
      if (link && (key === 'sx' || key === 'sy')) { patch.sx = val; patch.sy = val; }
      patchXf(r.node, patch);
    });
    renderOverlay();
    markDirty();
  };
  const mirrorXf = (key, val) => {
    box.querySelectorAll(`[data-xf="${key}"]`).forEach(el => { el.value = val; });
    box.querySelectorAll(`[data-xfn="${key}"]`).forEach(el => { el.value = round(val, 3); });
    if ($('#xfLink')?.checked && (key === 'sx' || key === 'sy')) {
      ['sx', 'sy'].forEach(k => {
        box.querySelectorAll(`[data-xf="${k}"]`).forEach(el => { el.value = val; });
        box.querySelectorAll(`[data-xfn="${k}"]`).forEach(el => { el.value = round(val, 3); });
      });
    }
  };
  box.querySelectorAll('[data-xf]').forEach(el => el.oninput = () => {
    const v = parseFloat(el.value) || 0; mirrorXf(el.dataset.xf, v); applyXf(el.dataset.xf, v);
  });
  box.querySelectorAll('[data-xfn]').forEach(el => el.oninput = () => {
    const v = parseFloat(el.value) || 0; mirrorXf(el.dataset.xfn, v); applyXf(el.dataset.xfn, v);
  });
  const xfR = $('#xfReset'); if (xfR) xfR.onclick = () => {
    xfTargets().forEach(r => resetXf(r.node));
    renderOverlay(); markDirty(); renderInspector();
    toast('Transform reset', 'ok');
  };

  /* document — artboard size and page colour */
  const applySize = (w, h) => {
    if (!isFinite(w) || !isFinite(h) || w < 1 || h < 1) {
      toast('Enter a size like 1920x1080.', 'err'); return;
    }
    if (resizeArtboard(Math.round(w), Math.round(h))) {
      renderAll();
      toast(`Artboard ${Math.round(w)} × ${Math.round(h)}`, 'ok');
    }
  };
  const dApply = $('#docApply');
  const readSize = () => {
    // accept 1920x1080, 1920 × 1080, "1920, 1080", or plain spaces
    const m = /(-?[\d.]+)\s*[x×,\s]\s*(-?[\d.]+)/i.exec($('#docSize').value || '');
    if (!m) { toast('Enter a size like 1920x1080.', 'err'); return; }
    applySize(parseFloat(m[1]), parseFloat(m[2]));
  };
  if (dApply) dApply.onclick = readSize;
  const dSize = $('#docSize');
  if (dSize) dSize.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); readSize(); } };
  box.querySelectorAll('[data-docsize]').forEach(b => b.onclick = () => {
    const [w, h] = b.dataset.docsize.split('x').map(Number);
    applySize(w, h);
  });
  const abS = $('#abShow'); if (abS) abS.onchange = e => {
    S.artboard.show = e.target.checked; renderOverlay(); markDirty(); renderInspector();
  };
  const setBg = v => {
    S.artboard.bg = v;
    const c = $('#abBg'), h = $('#abBgHex');
    if (c) c.value = v; if (h) h.value = v;
    renderOverlay(); markDirty();
  };
  const abB = $('#abBg'); if (abB) abB.oninput = e => setBg(e.target.value);
  const abH = $('#abBgHex'); if (abH) abH.oninput = e => {
    const v = e.target.value.trim();
    if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(v)) setBg(v);
  };

  /* align + grid — global, binds whether or not a clip is active */
  box.querySelectorAll('[data-alignto]').forEach(el => el.onclick = () => {
    alignTo = el.dataset.alignto; renderInspector();
  });
  box.querySelectorAll('[data-align]').forEach(el => el.onclick = () => {
    const recs = selectedRecs();
    if (!recs.length) { toast('Select something first.', 'err'); return; }
    const act = el.dataset.align;
    let n;
    if (act === 'dist-h' || act === 'dist-v') {
      n = distributeNodes(recs, act === 'dist-h' ? 'h' : 'v');
      if (!n) { toast('Distributing needs three or more elements.', 'err'); return; }
      toast(`Distributed ${n}`, 'ok');
    } else {
      n = alignNodes(recs, act, alignTo);
      toast(`Aligned ${n}`, 'ok');
    }
    renderOverlay(); rebuild(true); renderAll(); markDirty();
  });
  const gOn = $('#gridOn'); if (gOn) gOn.onchange = e => {
    S.grid.on = e.target.checked; markDirty(); renderInspector();
  };
  const gShow = $('#gridShow'); if (gShow) gShow.onchange = e => {
    S.grid.show = e.target.checked; renderOverlay(); markDirty(); renderInspector();
  };
  const setGrid = v => {
    S.grid.size = clamp(parseFloat(v) || 1, 0.5, 5000);
    renderOverlay(); markDirty(); renderInspector();
  };
  const gN = $('#gridSizeN'); if (gN) gN.onchange = e => setGrid(e.target.value);
  const gAuto = $('#gridAuto'); if (gAuto) gAuto.onclick = () => {
    const vb = (S.svg?.getAttribute('viewBox') || '0 0 100 100').trim().split(/[\s,]+/).map(Number);
    setGrid(niceGridSize(vb[2], vb[3]));
  };
  const gC = $('#gridColor'); if (gC) gC.oninput = e => {
    S.grid.color = e.target.value; renderOverlay(); markDirty();
  };
  const gO = $('#gridOpacity'); if (gO) gO.oninput = e => {
    S.grid.opacity = clamp(parseFloat(e.target.value) || .05, .05, 1);
    renderOverlay(); markDirty();
  };

  /* loop settings — global, so they bind whether or not a clip is active */
  const lc = S.loopCfg;
  const loopChanged = () => { syncLoopUI(); rebuild(true); markDirty(); renderInspector(); };
  const lOn = $('#loopOn'); if (lOn) lOn.onchange = e => { lc.on = e.target.checked; loopChanged(); };
  const lCount = $('#loopCount'); if (lCount) lCount.onchange = e => { lc.count = parseInt(e.target.value, 10); loopChanged(); };
  const lYoyo = $('#loopYoyo'); if (lYoyo) lYoyo.onchange = e => { lc.yoyo = e.target.checked; loopChanged(); };
  const setDelay = v => {
    lc.delay = clamp(parseFloat(v) || 0, 0, 5);
    $('#loopDelayR').value = lc.delay; $('#loopDelayN').value = lc.delay;
    syncLoopUI(); rebuild(true); markDirty();
  };
  const lDr = $('#loopDelayR'); if (lDr) lDr.oninput = e => setDelay(e.target.value);
  const lDn = $('#loopDelayN'); if (lDn) lDn.oninput = e => setDelay(e.target.value);
  const add = $('#addClip'); if (add) add.onclick = () => {
    const c = newClip([...S.sel]); S.clips.push(c); S.activeClip = c.id;
    rebuild(); renderAll();
  };
  box.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => applyPreset(+b.dataset.pre));
  box.querySelectorAll('[data-pcat]').forEach(b => b.onclick = () => {
    setPresetCat(b.dataset.pcat); renderInspector();
  });
  box.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
    S.sliderTarget = b.dataset.st; renderInspector();
  });
  if (!clip) return;

  const dup = $('#dupClip'); if (dup) dup.onclick = () => {
    const c = JSON.parse(JSON.stringify(clip));
    c.id = 'c' + (++S.clipId); c.name = clip.name + ' copy';
    S.clips.splice(S.clips.indexOf(clip) + 1, 0, c); S.activeClip = c.id;
    rebuild(); renderAll();
  };
  const del = $('#delClip'); if (del) del.onclick = () => {
    S.clips = S.clips.filter(c => c !== clip); S.activeClip = null; rebuild(); renderAll();
  };
  const re = $('#reassign'); if (re) re.onclick = () => {
    if (!S.sel.size) { toast('Select elements first.', 'err'); return; }
    clip.targets = [...S.sel]; rebuild(); renderAll(); toast('Clip retargeted', 'ok');
  };
  const nm = $('#clipName'); if (nm) nm.oninput = e => { clip.name = e.target.value; renderTracks(); markDirty(); };
  const on = $('#clipOn'); if (on) on.onchange = e => { clip.enabled = e.target.checked; rebuild(); renderTracks(); };
  const swap = $('#swapAll'); if (swap) swap.onclick = () => {
    Object.values(clip.props).forEach(v => { if (v && 'from' in v) { const t = v.from; v.from = v.to; v.to = t; } });
    rebuild(); renderInspector(); playFrom(clip);
  };

  // timing / stagger fields
  box.querySelectorAll('[data-t]').forEach(el => {
    const k = el.dataset.t;
    const handler = () => {
      const v = el.type === 'checkbox' ? el.checked
              : el.type === 'range' || el.type === 'number' ? parseFloat(el.value) || 0
              : el.value;
      if (k === 'posMode') { clip.posMode = v; renderInspector(); }
      else if (k === 'posVal') clip.posVal = v;
      else if (k === 'stAmount') clip.stagger.amount = v;
      else clip.timing[k] = v;
      if (k === 'ease') renderInspector();
      // mirror range↔number
      box.querySelectorAll(`[data-t="${k}"]`).forEach(o => { if (o !== el && o.type !== 'checkbox') o.value = el.value; });
      rebuild(); renderTracks();
    };
    el.oninput = handler; el.onchange = handler;
  });
  box.querySelectorAll('[data-s]').forEach(el => {
    el.onchange = () => { clip.stagger[el.dataset.s] = el.value; rebuild(); };
  });
  // property rows
  box.querySelectorAll('[data-on]').forEach(cb => cb.onchange = () => {
    clip.props[cb.dataset.on].on = cb.checked;
    cb.closest('.prop').classList.toggle('act', cb.checked);
    rebuild(); if (cb.checked) playFrom(clip);
  });
  const setVal = (k, side, val) => {
    clip.props[k][side] = val;
    const row = box.querySelector(`.prop[data-p="${k}"]`);
    if (!row) return;
    const num = row.querySelector(side === 'from' ? '[data-f]' : '[data-to]');
    const sl = row.querySelector('[data-sl]');
    if (num) num.value = val;
    if (sl && S.sliderTarget === side) sl.value = val;
    rebuild();
  };
  box.querySelectorAll('[data-f]').forEach(el => el.oninput = () => {
    const v = el.type === 'color' ? el.value : (parseFloat(el.value) || 0);
    setVal(el.dataset.f, 'from', v);
  });
  box.querySelectorAll('[data-to]').forEach(el => el.oninput = () => {
    const v = el.type === 'color' ? el.value : (parseFloat(el.value) || 0);
    setVal(el.dataset.to, 'to', v);
  });
  box.querySelectorAll('[data-sl]').forEach(el => {
    el.oninput = () => setVal(el.dataset.sl, S.sliderTarget, parseFloat(el.value));
    el.onchange = () => playFrom(clip);
  });

  // origin
  const og = $('#originGrid');
  if (og) og.querySelectorAll('i').forEach(i => i.onclick = () => {
    clip.props.__origin.from = clip.props.__origin.to = i.dataset.o;
    og.querySelectorAll('i').forEach(x => x.classList.toggle('on', x === i));
    $('#originVal').value = i.dataset.o; rebuild();
  });
  const ov = $('#originVal'); if (ov) ov.oninput = () => {
    clip.props.__origin.from = clip.props.__origin.to = ov.value; rebuild();
  };
  const so = $('#svgOrigin'); if (so) so.onchange = () => { clip.svgOrigin = so.checked; rebuild(); };

  // motion path
  const mp = $('#mpSel'); if (mp) mp.onchange = () => { clip.motionPath = mp.value; rebuild(); };
  const ma = $('#mpAlign'); if (ma) ma.onchange = () => { clip.mpAlign = ma.checked; rebuild(); };
  const mr = $('#mpRotate'); if (mr) mr.onchange = () => { clip.mpRotate = mr.checked; rebuild(); };

  // trigger
  const bindTr = (id, key, prop = 'value') => {
    const el = $(id); if (el) el.onchange = () => {
      S.trigger[key] = el[prop]; markDirty(); if (key === 'mode') renderInspector();
    };
  };
  bindTr('#trMode', 'mode'); bindTr('#trStart', 'start'); bindTr('#trEnd', 'end');
  bindTr('#trOnce', 'once', 'checked'); bindTr('#trMarkers', 'markers', 'checked');
}
