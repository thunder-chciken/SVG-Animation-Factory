/* =====================================================================
   STATE — one mutable object the whole studio reads and writes.
   Nothing here imports anything, so it can never take part in a cycle.
   ===================================================================== */
export const S = {
  svg: null,            // live <svg> node on stage
  raw: '',              // original source
  fileName: '',
  items: [],            // indexed element records
  byUid: new Map(),
  sel: new Set(),       // selected uids
  hot: null,            // hovered uid
  clips: [],            // animation clips
  activeClip: null,
  tl: null,
  uid: 0,
  clipId: 0,
  loop: true,
  tool: 'pick',
  sliderTarget: 'to',   // sliders drive FROM or TO
  trigger: { mode: 'load', start: 'top 80%', end: 'bottom 20%', scrub: false, once: true, markers: false },
  stagger: { amount: 0, from: 'start', grid: false, axis: '', ease: 'none' },
  loopTweens: [],

  // paint editor
  gradId: 0,
  paint: {
    role: 'fill', type: 'solid', solid: '#ffb020', alpha: 1, angle: 90,
    cx: .5, cy: .5, r: .5, gradId: null,
    stops: [{ c: '#ffb020', o: 0, a: 1 }, { c: '#4da3ff', o: 1, a: 1 }],
  },
};

export const NS = 'http://www.w3.org/2000/svg';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round = (v, p = 2) => { const m = 10 ** p; return Math.round(v * m) / m; };
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function toast(msg, kind = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'on ' + kind;
  clearTimeout(t._t); t._t = setTimeout(() => t.className = '', 2400);
}

/* ---------------------------------------------------------------------
   Dirty signalling. Modules that mutate the document or the clip list
   call markDirty(); the persistence layer registers the only listener.
   Routing it through here keeps project.js out of everyone's imports.
   --------------------------------------------------------------------- */
let dirtyFn = null;
export function onDirty(fn) { dirtyFn = fn; }
export function markDirty() { if (dirtyFn) dirtyFn(); }
