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
  loop: true,                 // kept in sync with loopCfg.on for older projects
  // How the whole composition repeats, as opposed to a single clip's repeat.
  loopCfg: { on: true, count: -1, delay: 0, yoyo: false },   // count -1 = forever
  tool: 'pick',
  sliderTarget: 'to',   // sliders drive FROM or TO
  trigger: { mode: 'load', start: 'top 80%', end: 'bottom 20%', scrub: false, once: true, markers: false },
  stagger: { amount: 0, from: 'start', grid: false, axis: '', ease: 'none' },
  loopTweens: [],

  // Seconds the timeline ruler spans. Deliberately NOT derived from the
  // content on every paint: if the view always shrank to fit, dragging the
  // longest clip shorter would shrink the ruler with it and the bar would
  // redraw at exactly the same width, looking like the edit never took.
  view: { span: 0 },

  // Canvas zoom / pan. A CSS transform on the stage container, so the SVG's
  // own coordinates never change and exports stay exactly as authored.
  viewport: { zoom: 1, x: 0, y: 0 },

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
   call markDirty(); persistence and undo history listen. Routing it
   through here keeps those modules out of everyone else's imports.
   --------------------------------------------------------------------- */
const dirtyFns = [];
export function onDirty(fn) { dirtyFns.push(fn); }
export function markDirty() { dirtyFns.forEach(fn => fn()); }
