/* =====================================================================
   TRANSPORT + TIMELINE UI
   ===================================================================== */
import { S, $, esc, round, toast } from './state.js';
import { clipDur, rebuild, hasMotion } from './timeline.js';
import { select } from './selection.js';
import { renderInspector } from './inspector.js';
import { renderAll } from './render.js';

function fmt(s) { return (s < 0 ? 0 : s).toFixed(2); }

export function syncScrub() {
  if (!S.tl) return;
  const d = S.tl.duration() || 0;
  $('#scrub').value = d ? (S.tl.progress() * 1000) : 0;
  $('#tcode').textContent = `${fmt(d ? S.tl.time() : 0)} / ${fmt(d)}s`;
  const lane = $('#tlbody').clientWidth - 132;
  $('#playhead').style.left = (132 + (d ? S.tl.progress() * lane : 0)) + 'px';
}

export function renderTracks() {
  const box = $('#tracks');
  $('#clipCount').textContent = S.clips.length;
  if (!S.clips.length) {
    box.innerHTML = '<div class="empty-note">No clips yet. Select elements and add an animation.</div>';
    $('#ruler').innerHTML = ''; return;
  }
  const total = Math.max(S.tl ? S.tl.duration() : 1, .001);
  box.innerHTML = S.clips.map(c => {
    const start = c._start || 0, dur = Math.max(clipDur(c) + (c.stagger.amount || 0), .02);
    const L = (start / total) * 100, W = (dur / total) * 100;
    const dL = (start / total) * 100, dW = ((c.timing.delay || 0) / total) * 100;
    const inf = c.timing.repeat < 0 ? ' ∞' : '';
    return `<div class="track ${S.activeClip === c.id ? 'on' : ''}" data-clip="${c.id}">
      <div class="tname" title="${esc(c.name)} · ${c.targets.length} target(s)">
        <input type="checkbox" data-cen="${c.id}" ${c.enabled ? 'checked' : ''}>
        <span style="overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</span>
        <span class="x" data-cdel="${c.id}">✕</span></div>
      <div class="tlane">
        ${dW > 0.3 ? `<div class="bar delay" style="left:${dL}%;width:${dW}%"></div>` : ''}
        <div class="bar ${S.activeClip === c.id ? 'on' : ''}" data-bar="${c.id}"
             style="left:${L}%;width:${Math.max(W, 1.2)}%">${esc(c.name)}${inf}</div>
      </div></div>`;
  }).join('');
  // ruler
  const step = total <= 2 ? .25 : total <= 6 ? .5 : total <= 15 ? 1 : 2;
  let r = '';
  for (let t = 0; t <= total + .0001; t += step) r += `<div class="tick" style="left:${(t / total) * 100}%">${round(t, 2)}s</div>`;
  $('#ruler').innerHTML = r;
  syncScrub();
}

export function bindTransport() {
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
  $('#tLoop').onclick = e => { S.loop = !S.loop; e.currentTarget.classList.toggle('on', S.loop); rebuild(); };
  $('#tLoop').classList.toggle('on', S.loop);
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
