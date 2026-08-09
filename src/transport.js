/* =====================================================================
   TRANSPORT + TIMELINE UI
   ===================================================================== */
import { S, $, esc, round, clamp, toast, markDirty } from './state.js';
import { clipDur, rebuild, hasMotion } from './timeline.js';
import { select } from './selection.js';
import { renderInspector } from './inspector.js';
import { renderAll } from './render.js';

/* The seconds the timeline currently spans. Every bar position, ruler tick
   and drag calculation is expressed against this one number.

   The span grows to fit the content but never shrinks on its own — that is
   what lets you drag the longest clip shorter and actually see it happen.
   Use Fit to pull it back in. */
const contentDur = () => (S.tl ? S.tl.duration() : 0);

function viewTotal() {
  const content = contentDur();
  if (S.view.span < content || S.view.span <= 0) S.view.span = Math.max(content, 1);
  return Math.max(S.view.span, .001);
}

export function fitView() {
  S.view.span = Math.max(contentDur(), .25);
  renderTracks();
}

export function zoomView(factor) {
  // There is no horizontal scroll, so zooming in stops where the content
  // exactly fills the ruler — everything stays on screen at all times.
  const floor = Math.max(contentDur(), .25);
  S.view.span = clamp(S.view.span * factor, floor, 600);
  renderTracks();
}

function fmt(s) { return (s < 0 ? 0 : s).toFixed(2); }

export function syncScrub() {
  if (!S.tl) return;
  const d = S.tl.duration() || 0;
  $('#scrub').value = d ? (S.tl.progress() * 1000) : 0;
  $('#tcode').textContent = `${fmt(d ? S.tl.time() : 0)} / ${fmt(d)}s`;
  // Positioned against the view span, not the content length — otherwise the
  // playhead drifts away from the bars whenever the two differ.
  const lane = $('#tlbody').clientWidth - 132;
  const span = viewTotal();
  $('#playhead').style.left = (132 + (d ? (S.tl.time() / span) * lane : 0)) + 'px';
}

export function renderTracks() {
  const box = $('#tracks');
  $('#clipCount').textContent = S.clips.length;
  if (!S.clips.length) {
    box.innerHTML = '<div class="empty-note">No clips yet. Select elements and add an animation.</div>';
    $('#ruler').innerHTML = ''; return;
  }
  const total = viewTotal();
  box.innerHTML = S.clips.map(c => {
    const start = c._start || 0, dur = Math.max(clipDur(c) + (c.stagger.amount || 0), .02);
    const L = (start / total) * 100, W = (dur / total) * 100;
    const dL = (start / total) * 100, dW = ((c.timing.delay || 0) / total) * 100;
    const inf = c.timing.repeat < 0 ? ' ∞' : '';
    return `<div class="track ${S.activeClip === c.id ? 'on' : ''} ${c.enabled ? '' : 'off'}" data-clip="${c.id}">
      <div class="tname" title="${esc(c.name)} · ${c.targets.length} target(s)">
        <input type="checkbox" data-cen="${c.id}" ${c.enabled ? 'checked' : ''}>
        <span style="overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</span>
        <span class="x" data-cdel="${c.id}">✕</span></div>
      <div class="tlane">
        ${dW > 0.3 ? `<div class="bar delay" style="left:${dL}%;width:${dW}%"></div>` : ''}
        <div class="bar ${S.activeClip === c.id ? 'on' : ''}" data-bar="${c.id}"
             title="${esc(c.name)} — drag to move, drag an edge to retime"
             style="left:${L}%;width:${Math.max(W, 1.2)}%"><i class="grip l" data-grip="l"></i><span
             class="lbl">${esc(c.name)}${inf}</span><i class="grip r" data-grip="r"></i></div>
      </div></div>`;
  }).join('');
  // ruler
  const step = total <= 2 ? .25 : total <= 6 ? .5 : total <= 15 ? 1 : 2;
  let r = '';
  for (let t = 0; t <= total + .0001; t += step) r += `<div class="tick" style="left:${(t / total) * 100}%">${round(t, 2)}s</div>`;
  $('#ruler').innerHTML = r;
  syncScrub();
}

/* ---------------------------------------------------------------------
   Dragging a clip bar. The time→pixel mapping is frozen when the drag
   starts and the timeline is not rebuilt until release: rebuilding live
   would rescale the ruler under the pointer, so dragging a clip past the
   current end of the timeline would be impossible.
   --------------------------------------------------------------------- */
const MIN_DUR = .05;
let BAR = null;

function beginBarDrag(e) {
  const bar = e.target.closest('[data-bar]');
  if (!bar || e.button !== 0) return;
  const clip = S.clips.find(c => c.id === bar.dataset.bar);
  if (!clip) return;

  const lane = bar.parentNode;
  const laneW = lane.clientWidth;
  if (!laneW) return;

  const grip = e.target.closest('[data-grip]');
  BAR = {
    clip, bar,
    mode: grip ? grip.dataset.grip : 'move',
    x0: e.clientX,
    laneW,
    total: viewTotal(),
    start0: clip._start || 0,
    span0: Math.max(clipDur(clip) + (clip.stagger.amount || 0), .02),
    moved: false,
  };
  // Selection is left to the click handler that fires after this gesture —
  // re-rendering here would swap out the very node being dragged.
  try { bar.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
  e.preventDefault();
}

function moveBarDrag(e) {
  if (!BAR) return;
  const dxPx = e.clientX - BAR.x0;
  if (!BAR.moved) {
    if (Math.abs(dxPx) < 3) return;
    BAR.moved = true;
    document.body.style.cursor = BAR.mode === 'move' ? 'grabbing' : 'col-resize';
  }
  const dt = (dxPx / BAR.laneW) * BAR.total;
  let start = BAR.start0, span = BAR.span0;

  if (BAR.mode === 'move') start = Math.max(0, BAR.start0 + dt);
  else if (BAR.mode === 'r') span = Math.max(MIN_DUR, BAR.span0 + dt);
  else {
    start = clamp(BAR.start0 + dt, 0, BAR.start0 + BAR.span0 - MIN_DUR);
    span = BAR.span0 - (start - BAR.start0);
  }

  BAR.pending = { start, span };
  BAR.bar.style.left = (start / BAR.total) * 100 + '%';
  BAR.bar.style.width = Math.max((span / BAR.total) * 100, 1.2) + '%';
  $('#stat').textContent = BAR.mode === 'move'
    ? `start ${round(start, 2)}s`
    : `${round(start, 2)}s → ${round(start + span, 2)}s`;
}

function endBarDrag() {
  if (!BAR) return;
  const { clip, mode, moved, pending } = BAR;
  BAR = null;
  document.body.style.cursor = '';
  if (!moved || !pending) return;   // a plain click — let the click handler select

  clip.posMode = 'abs';
  clip.posVal = round(Math.max(0, pending.start), 3);
  if (mode !== 'move') {
    // The bar spans delay and every repeat, so back the per-cycle duration
    // out of the span the user actually dragged to.
    const t = clip.timing;
    const reps = t.repeat < 0 ? 0 : t.repeat;
    const overhead = (t.delay || 0) + (t.repeatDelay || 0) * reps + (clip.stagger.amount || 0);
    t.duration = round(Math.max(MIN_DUR, (pending.span - overhead) / (reps + 1)), 3);
  }
  $('#stat').textContent = S.fileName;
  rebuild(true); renderAll(); markDirty();
}

/* ---------------------------------------------------------------------
   Loop settings — how the whole composition repeats, not one lane.
   --------------------------------------------------------------------- */
export function syncLoopUI() {
  const lc = S.loopCfg;
  S.loop = lc.on;                       // older projects and exports read this
  $('#tLoop').classList.toggle('on', lc.on);
  $('#loopSummary').textContent = !lc.on ? 'no loop'
    : (lc.count < 0 ? '∞' : `${lc.count + 1}×`) +
      (lc.delay ? ` · ${round(lc.delay, 2)}s gap` : '') +
      (lc.yoyo ? ' · ping-pong' : '');
  const on = $('#loopOn'); if (on) on.checked = lc.on;
  const c = $('#loopCount'); if (c) c.value = String(lc.count);
  const dr = $('#loopDelayR'); if (dr) dr.value = lc.delay;
  const dn = $('#loopDelayN'); if (dn) dn.value = lc.delay;
  const yy = $('#loopYoyo'); if (yy) yy.checked = !!lc.yoyo;
  ['#loopCount', '#loopDelayR', '#loopDelayN', '#loopYoyo'].forEach(sel => {
    const el = $(sel); if (el) el.disabled = !lc.on;
  });
}

function bindLoopPanel() {
  const lc = S.loopCfg;
  const pop = $('#loopPop');
  const apply = () => { syncLoopUI(); rebuild(true); markDirty(); };

  $('#tLoop').onclick = () => {
    if (pop.classList.contains('on')) { pop.classList.remove('on'); return; }
    const b = $('#tLoop').getBoundingClientRect();
    pop.classList.add('on');
    const h = pop.offsetHeight || 300;
    pop.style.left = clamp(b.left - 8, 8, innerWidth - (pop.offsetWidth || 286) - 8) + 'px';
    pop.style.top = clamp(b.top - h - 10, 8, innerHeight - h - 8) + 'px';
    syncLoopUI();
  };
  $('#loopClose').onclick = () => pop.classList.remove('on');
  $('#loopOn').onchange = e => { lc.on = e.target.checked; apply(); };
  $('#loopCount').onchange = e => { lc.count = parseInt(e.target.value, 10); apply(); };
  $('#loopYoyo').onchange = e => { lc.yoyo = e.target.checked; apply(); };
  const setDelay = v => { lc.delay = Math.max(0, parseFloat(v) || 0); apply(); };
  $('#loopDelayR').oninput = e => setDelay(e.target.value);
  $('#loopDelayN').oninput = e => setDelay(e.target.value);

  // drag the panel by its header, same as the paint popover
  const head = $('#loopDrag'); let d = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.id === 'loopClose') return;
    const r = pop.getBoundingClientRect();
    d = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.classList.add('grabbing');
    try { head.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
  });
  head.addEventListener('pointermove', e => {
    if (!d) return;
    pop.style.left = clamp(e.clientX - d.dx, 4, innerWidth - pop.offsetWidth - 4) + 'px';
    pop.style.top = clamp(e.clientY - d.dy, 4, innerHeight - pop.offsetHeight - 4) + 'px';
  });
  ['pointerup', 'pointercancel'].forEach(ev =>
    head.addEventListener(ev, () => { d = null; head.classList.remove('grabbing'); }));

  syncLoopUI();
}

export function bindTransport() {
  $('#tlZoomOut').onclick = () => zoomView(1.5);
  $('#tlZoomIn').onclick = () => zoomView(1 / 1.5);
  $('#tlFit').onclick = fitView;

  const tracks = $('#tracks');
  tracks.addEventListener('pointerdown', beginBarDrag);
  tracks.addEventListener('pointermove', moveBarDrag);
  tracks.addEventListener('pointerup', endBarDrag);
  tracks.addEventListener('pointercancel', endBarDrag);

  const loops = fn => (S.loopTweens || []).forEach(fn);
  $('#tPlay').onclick = () => {
    if (!hasMotion()) { toast('Nothing to play yet.'); return; }
    const running = (S.tl && S.tl.isActive()) || (S.loopTweens[0] && !S.loopTweens[0].paused());
    if (running) { S.tl && S.tl.pause(); loops(t => t.pause()); $('#tPlay').textContent = '▶'; }
    else {
      if (S.tl && S.tl.progress() >= 1) S.tl.progress(0);
      S.tl && S.tl.play(); loops(t => t.play());
      $('#tPlay').textContent = '❚❚';
    }
  };
  $('#tRew').onclick = () => { S.tl && S.tl.pause(0); loops(t => t.pause(0)); $('#tPlay').textContent = '▶'; syncScrub(); };
  $('#tEnd').onclick = () => { S.tl && S.tl.pause(S.tl.duration()); loops(t => t.pause()); $('#tPlay').textContent = '▶'; syncScrub(); };
  bindLoopPanel();
  $('#scrub').oninput = e => {
    if (!S.tl) return;
    S.tl.pause(); $('#tPlay').textContent = '▶';
    S.tl.progress(e.target.value / 1000); syncScrub();
  };
  $('#speed').onchange = e => {
    const v = +e.target.value;
    S.tl && S.tl.timeScale(v); (S.loopTweens || []).forEach(t => t.timeScale(v));
  };
  $('#tracks').addEventListener('click', e => {
    const del = e.target.closest('[data-cdel]');
    if (del) {
      S.clips = S.clips.filter(c => c.id !== del.dataset.cdel);
      if (S.activeClip === del.dataset.cdel) S.activeClip = null;
      rebuild(); renderAll(); return;
    }
    const en = e.target.closest('[data-cen]');
    if (en) { const c = S.clips.find(x => x.id === en.dataset.cen); c.enabled = en.checked; rebuild(); return; }
    const tr = e.target.closest('[data-clip]');
    if (tr) {
      const c = S.clips.find(x => x.id === tr.dataset.clip);
      S.activeClip = c.id; select(c.targets); renderTracks(); renderInspector();
    }
  });
}
