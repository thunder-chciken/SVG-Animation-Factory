/* =====================================================================
   INSPECTOR — the right-hand panel and everything wired inside it
   ===================================================================== */
import { S, $, esc, toast, markDirty } from './state.js';
import { OPEN_SECT, sect, ctlRow, propRow } from './ui.js';
import { SCHEMA, EASES, EASE_DIR, newClip } from './schema.js';
import { presetsSection, applyPreset } from './presets.js';
import { selectedRecs } from './selection.js';
import { rebuild, playFrom } from './timeline.js';
import { renderTracks } from './transport.js';
import { renderAll } from './render.js';

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

  if (!clip) {
    html += `<div class="empty-note">No clip selected.<br>Select elements and press
      <b>+ Animate selection</b>, or pick a preset below.</div>`;
    html += presetsSection();
    box.innerHTML = html; bindInspector(); return;
  }

  html += presetsSection();

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
  html += sect('timing', 'Timing & easing', `
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
  html += sect('stagger', 'Stagger (multi-element)', `
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
  html += sect('origin', 'Transform origin', `
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
    html += sect(g.id, g.title + (active ? ` · ${active}` : ''), rows);
  });

  /* motion path */
  const pathOpts = S.items.filter(i => i.tag === 'path' || i.tag === 'line' || i.tag === 'polyline')
    .map(i => `<option value="${i.uid}" ${clip.motionPath === i.uid ? 'selected' : ''}>${esc(i.label)}</option>`).join('');
  html += sect('mp', 'Travel along a path', `
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
  html += sect('trig', 'Playback trigger (global)', `
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

  box.innerHTML = html;
  bindInspector();
}

function bindInspector() {
  const box = $('#inspector');
  const clip = S.clips.find(c => c.id === S.activeClip);

  box.querySelectorAll('.shead').forEach(h => h.onclick = () => {
    const s = h.parentNode, id = s.dataset.sect;
    s.classList.toggle('closed');
    s.classList.contains('closed') ? OPEN_SECT.delete(id) : OPEN_SECT.add(id);
  });
  const add = $('#addClip'); if (add) add.onclick = () => {
    const c = newClip([...S.sel]); S.clips.push(c); S.activeClip = c.id;
    rebuild(); renderAll();
  };
  box.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => applyPreset(+b.dataset.pre));
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
