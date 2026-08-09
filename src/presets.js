/* =====================================================================
   PRESET LIBRARY

   Each entry is a complete clip in one click: which properties turn on,
   their from/to values, the easing, and — for anything meant to spread
   across split letters — its own stagger.

   `cat` drives the filter chips. With this many presets a flat grid is
   unusable, and text effects in particular only make sense once you have
   run Split letters.
   ===================================================================== */
import { S, esc, toast } from './state.js';
import { sect } from './ui.js';
import { newClip } from './schema.js';
import { rebuild, playFrom } from './timeline.js';
import { renderAll } from './render.js';

const P = (k, f, t) => ({ k, f, t });

export const CATS = [
  ['all', 'All'],
  ['in', 'Entrance'],
  ['text', 'Text'],
  ['emph', 'Emphasis'],
  ['colour', 'Colour'],
  ['line', 'Line'],
  ['out', 'Exit'],
];

export const PRESETS = [
 /* ---------------- entrances ---------------- */
 { c: 'in', n: 'Fade in',          s: 'opacity 0 → 1',        set: [P('opacity', 0, 1)], e: 'power2.out', d: .8 },
 { c: 'in', n: 'Fade up',          s: 'rises as it fades in', set: [P('y', 34, 0), P('opacity', 0, 1)], e: 'power2.out', d: .8 },
 { c: 'in', n: 'Fade down',        s: 'settles downward',     set: [P('y', -34, 0), P('opacity', 0, 1)], e: 'power2.out', d: .8 },
 { c: 'in', n: 'Rise up',          s: 'up 60px + fade',       set: [P('y', 60, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { c: 'in', n: 'Drop down',        s: 'down 60px + fade',     set: [P('y', -60, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { c: 'in', n: 'Slide from left',  s: 'x −120 → 0',           set: [P('x', -120, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { c: 'in', n: 'Slide from right', s: 'x +120 → 0',           set: [P('x', 120, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { c: 'in', n: 'Diagonal ↘',       s: 'in from top-left',     set: [P('x', -90, 0), P('y', -90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { c: 'in', n: 'Diagonal ↙',       s: 'in from top-right',    set: [P('x', 90, 0), P('y', -90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { c: 'in', n: 'Diagonal ↗',       s: 'in from bottom-left',  set: [P('x', -90, 0), P('y', 90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { c: 'in', n: 'Diagonal ↖',       s: 'in from bottom-right', set: [P('x', 90, 0), P('y', 90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { c: 'in', n: 'Scale up',         s: 'grows from nothing',   set: [P('scale', 0, 1), P('opacity', 0, 1)], e: 'power3.out', d: .8 },
 { c: 'in', n: 'Pop in',           s: 'scale 0 → 1, springy', set: [P('scale', 0, 1), P('opacity', 0, 1)], e: 'back.out', cfg: '1.8', d: .7 },
 { c: 'in', n: 'Bounce in',        s: 'drop + settle',        set: [P('y', -140, 0), P('opacity', 0, 1)], e: 'bounce.out', d: 1.3 },
 { c: 'in', n: 'Zoom in',          s: 'scale 2.4 → 1',        set: [P('scale', 2.4, 1), P('opacity', 0, 1), P('blur', 14, 0)], e: 'expo.out', d: 1.1 },
 { c: 'in', n: 'Spin in',          s: 'rotate 180 + scale',   set: [P('rotation', -180, 0), P('scale', 0, 1), P('opacity', 0, 1)], e: 'back.out', cfg: '1.4', d: 1 },
 { c: 'in', n: '3D flip X',        s: 'flips on its side',    set: [P('rotationX', -92, 0), P('opacity', 0, 1), P('perspective', 700, 700)], e: 'power3.out', d: .9 },
 { c: 'in', n: '3D flip Y',        s: 'flips left to right',  set: [P('rotationY', 92, 0), P('opacity', 0, 1), P('perspective', 700, 700)], e: 'power3.out', d: .9 },
 { c: 'in', n: 'Blur to sharp',    s: 'blur 18 → 0',          set: [P('blur', 18, 0), P('opacity', 0, 1)], e: 'power2.out', d: 1 },
 { c: 'in', n: 'Elastic drop',     s: 'springy entrance',     set: [P('y', -90, 0), P('opacity', 0, 1)], e: 'elastic.out', cfg: '1,0.35', d: 1.6 },
 { c: 'in', n: 'Skew reveal',      s: 'sheared entrance',     set: [P('x', -140, 0), P('skewX', 22, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { c: 'in', n: 'Compression reveal', s: 'squeezed → full width', set: [P('scaleX', .22, 1), P('opacity', 0, 1)], e: 'expo.out', d: .9 },
 { c: 'in', n: 'Perspective fly-in', s: 'out of deep 3D space',  set: [P('scale', 3.2, 1), P('rotationX', 38, 0), P('perspective', 800, 800), P('opacity', 0, 1)], e: 'power3.out', d: 1.1 },
 { c: 'in', n: 'Fold open',        s: 'unfolds like paper',   set: [P('rotationX', -95, 0), P('perspective', 600, 600), P('opacity', 0, 1)], e: 'back.out', cfg: '1.3', d: .9 },
 { c: 'in', n: 'Impact land',      s: 'lands hard, rebounds', set: [P('scale', 1.9, 1), P('opacity', 0, 1)], e: 'bounce.out', d: 1 },

 /* ---------------- text · run Split letters or Split words first ------ */
 { c: 'text', n: 'Typewriter',        s: 'letters appear in turn',  set: [P('opacity', 0, 1)], e: 'none', d: .01, st: { amount: 1.1, from: 'start' } },
 { c: 'text', n: 'Character reveal',  s: 'each letter fades in',    set: [P('opacity', 0, 1)], e: 'power1.out', d: .35, st: { amount: .9, from: 'start' } },
 { c: 'text', n: 'Word reveal',       s: 'word by word',            set: [P('y', 22, 0), P('opacity', 0, 1)], e: 'power2.out', d: .5, st: { amount: .8, from: 'start' } },
 { c: 'text', n: 'Letter cascade',    s: 'letters drop in',         set: [P('y', 42, 0), P('opacity', 0, 1)], e: 'power3.out', d: .6, st: { amount: .8, from: 'start' } },
 { c: 'text', n: 'Letter drop',       s: 'falls into place',        set: [P('y', -70, 0), P('opacity', 0, 1)], e: 'bounce.out', d: .9, st: { amount: .9, from: 'start' } },
 { c: 'text', n: 'Letter pop',        s: 'letters spring up',       set: [P('scale', 0, 1), P('opacity', 0, 1)], e: 'back.out', cfg: '2', d: .55, st: { amount: .7, from: 'start' } },
 { c: 'text', n: 'Letter scatter',    s: 'assembles from chaos',    set: [P('x', -70, 0), P('y', 55, 0), P('rotation', -55, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9, st: { amount: 1, from: 'random' } },
 { c: 'text', n: 'Spring characters', s: 'overshoot and settle',    set: [P('y', 45, 0), P('opacity', 0, 1)], e: 'elastic.out', cfg: '1,0.4', d: 1.2, st: { amount: .8, from: 'start' } },
 { c: 'text', n: 'Letter flip',       s: '3D flip, one by one',     set: [P('rotationX', -90, 0), P('opacity', 0, 1), P('perspective', 600, 600)], e: 'power3.out', d: .6, st: { amount: .9, from: 'start' } },
 { c: 'text', n: 'Flipboard',         s: 'mechanical flip in',      set: [P('rotationX', 90, 0), P('opacity', 0, 1), P('perspective', 500, 500)], e: 'power4.out', d: .3, st: { amount: .8, from: 'start' } },
 { c: 'text', n: 'Slot machine',      s: 'spins into place',        set: [P('rotationX', -320, 0), P('y', -26, 0), P('perspective', 700, 700), P('opacity', 0, 1)], e: 'power3.out', d: .8, st: { amount: .8, from: 'start' } },
 { c: 'text', n: 'Vertical roller',   s: 'rolls up into place',     set: [P('y', -38, 0), P('opacity', 0, 1)], e: 'back.out', cfg: '1.6', d: .6, st: { amount: .7, from: 'start' } },
 { c: 'text', n: 'Letters from edges',s: 'in from both ends',       set: [P('y', 30, 0), P('opacity', 0, 1)], e: 'power2.out', d: .7, st: { amount: .9, from: 'edges' } },
 { c: 'text', n: 'Tracking expand',   s: 'letter-spacing opens up', set: [P('letterSpacing', 0, 18)], e: 'power2.out', d: 1 },
 { c: 'text', n: 'Tracking contract', s: 'spacing closes in',       set: [P('letterSpacing', 28, 0)], e: 'expo.out', d: 1.1 },
 { c: 'text', n: 'Tracking in + fade',s: 'spacing closes, fades in',set: [P('letterSpacing', 30, 0), P('opacity', 0, 1), P('blur', 6, 0)], e: 'expo.out', d: 1.2 },
 { c: 'text', n: 'Letter wave',       s: 'loops up and down',       set: [P('y', 0, -16)], e: 'sine.inOut', d: .9, rep: -1, yoyo: true, st: { amount: .7, from: 'start' } },
 { c: 'text', n: 'Wave cascade',      s: 'rolling wave, forever',   set: [P('y', 0, -22), P('rotation', 0, -5)], e: 'sine.inOut', d: 1.1, rep: -1, yoyo: true, st: { amount: 1.1, from: 'start' } },
 { c: 'text', n: 'Jelly letters',     s: 'soft elastic wobble',     set: [P('scaleX', 1, 1.22), P('scaleY', 1, .82)], e: 'elastic.inOut', cfg: '1,0.35', d: 1.1, rep: -1, yoyo: true, st: { amount: .6, from: 'start' } },
 { c: 'text', n: 'Elastic stretch',   s: 'stretches and snaps',     set: [P('scaleX', 1.7, 1)], e: 'elastic.out', cfg: '1,0.3', d: 1.2, st: { amount: .5, from: 'start' } },
 { c: 'text', n: 'Letter shimmer',    s: 'loops a bright sweep',    set: [P('brightness', 1, 2.1)], e: 'sine.inOut', d: .6, rep: -1, yoyo: true, st: { amount: 1.2, from: 'start' } },

 /* ---------------- emphasis and loops ---------------- */
 { c: 'emph', n: 'Pulse',            s: 'loop scale 1↔1.12',   set: [P('scale', 1, 1.12)], e: 'sine.inOut', d: .7, rep: -1, yoyo: true },
 { c: 'emph', n: 'Heartbeat',        s: 'loop double-thump',   set: [P('scale', 1, 1.22)], e: 'power2.inOut', d: .28, rep: -1, yoyo: true, rd: .55 },
 { c: 'emph', n: 'Float',            s: 'loop up/down 14px',   set: [P('y', 0, -14)], e: 'sine.inOut', d: 1.6, rep: -1, yoyo: true },
 { c: 'emph', n: 'Sway',             s: 'loop rotate ±6°',     set: [P('rotation', -6, 6)], e: 'sine.inOut', d: 1.8, rep: -1, yoyo: true },
 { c: 'emph', n: 'Spin forever',     s: 'continuous 360°',     set: [P('rotation', 0, 360)], e: 'none', d: 6, rep: -1 },
 { c: 'emph', n: 'Shimmer',          s: 'loop brightness',     set: [P('brightness', 1, 1.9)], e: 'sine.inOut', d: 1.1, rep: -1, yoyo: true },
 { c: 'emph', n: 'Glow pulse',       s: 'rhythmic glow',       set: [P('brightness', 1, 1.75), P('saturate', 1, 1.5)], e: 'sine.inOut', d: 1.2, rep: -1, yoyo: true },
 { c: 'emph', n: 'Flicker',          s: 'fast unstable blink', set: [P('opacity', 1, .18)], e: 'rough', d: .07, rep: 9, yoyo: true },
 { c: 'emph', n: 'Neon power-on',    s: 'stutters then holds', set: [P('opacity', .12, 1), P('brightness', .6, 1.8)], e: 'rough', d: .11, rep: 6, yoyo: true },
 { c: 'emph', n: 'Light sweep',      s: 'highlight travels',   set: [P('brightness', 1, 2.4)], e: 'sine.inOut', d: .5, rep: -1, yoyo: true, st: { amount: 1.4, from: 'start' } },
 { c: 'emph', n: 'Heat shimmer',     s: 'subtle warp, forever',set: [P('skewX', -1.6, 1.6)], e: 'sine.inOut', d: .5, rep: -1, yoyo: true },
 { c: 'emph', n: 'Hue cycle',        s: 'loop full spectrum',  set: [P('hueRotate', 0, 360)], e: 'none', d: 8, rep: -1 },
 { c: 'emph', n: 'Breathe opacity',  s: 'loop 1 ↔ .35',        set: [P('opacity', 1, .35)], e: 'sine.inOut', d: 1.4, rep: -1, yoyo: true },
 { c: 'emph', n: 'Rubber band',      s: 'squash and stretch',  set: [P('scaleX', 1, 1.3), P('scaleY', 1, .72)], e: 'elastic.out', cfg: '1,0.3', d: 1.1 },
 { c: 'emph', n: 'Wobble',           s: 'skew shake',          set: [P('skewX', -14, 14)], e: 'sine.inOut', d: .16, rep: 7, yoyo: true },
 { c: 'emph', n: 'Impact shake',     s: 'hard hit, vibrates',  set: [P('x', -9, 9), P('rotation', -2, 2)], e: 'rough', d: .06, rep: 11, yoyo: true },
 { c: 'emph', n: 'Infinite marquee', s: 'scrolls forever',     set: [P('xPercent', 0, -100)], e: 'none', d: 6, rep: -1 },

 /* ---------------- colour ---------------- */
 { c: 'colour', n: 'Fill colour',    s: 'animate fill',        set: [P('fill', '#ffb020', '#4da3ff')], e: 'power1.inOut', d: 1 },
 { c: 'colour', n: 'Stroke colour',  s: 'animate stroke',      set: [P('stroke', '#ffb020', '#4da3ff')], e: 'power1.inOut', d: 1 },
 { c: 'colour', n: 'Desaturate in',  s: 'grey → colour',       set: [P('grayscale', 1, 0), P('opacity', 0, 1)], e: 'power2.out', d: 1.2 },
 { c: 'colour', n: 'Fill + weight',  s: 'colour & thickness',  set: [P('stroke', '#ffb020', '#ff5f56'), P('strokeWidth', 1, 6)], e: 'power2.inOut', d: 1 },
 { c: 'colour', n: 'Outline to fill',s: 'outline thins, fills',set: [P('strokeWidth', 4, 0), P('opacity', .35, 1)], e: 'power2.inOut', d: 1.2 },

 /* ---------------- line work ---------------- */
 { c: 'line', n: 'Stroke draw',      s: 'stroke 0 → 100%',     set: [P('drawEnd', 0, 1)], e: 'power2.inOut', d: 1.6 },
 { c: 'line', n: 'Draw reverse',     s: 'stroke 100% → 0',     set: [P('drawEnd', 1, 0)], e: 'power2.inOut', d: 1.6 },
 { c: 'line', n: 'Wipe segment',     s: 'travelling dash',     set: [P('drawStart', 0, .85), P('drawEnd', .15, 1)], e: 'power1.inOut', d: 1.4 },
 { c: 'line', n: 'Draw then fill',   s: 'outline, then colour',set: [P('drawEnd', 0, 1), P('opacity', .25, 1)], e: 'power2.inOut', d: 1.8 },
 { c: 'line', n: 'Draw per letter',  s: 'outlines draw in turn',set: [P('drawEnd', 0, 1)], e: 'power2.inOut', d: .8, st: { amount: 1.1, from: 'start' } },

 /* ---------------- exits ---------------- */
 { c: 'out', n: 'Fade out',          s: 'opacity 1 → 0',       set: [P('opacity', 1, 0)], e: 'power2.in', d: .7 },
 { c: 'out', n: 'Fly out up',        s: 'up + fade',           set: [P('y', 0, -70), P('opacity', 1, 0)], e: 'power2.in', d: .7 },
 { c: 'out', n: 'Collapse out',      s: 'scale 1 → 0',         set: [P('scale', 1, 0), P('opacity', 1, 0), P('rotation', 0, 90)], e: 'back.in', cfg: '1.6', d: .8 },
 { c: 'out', n: 'Blur out',          s: 'defocuses away',      set: [P('blur', 0, 16), P('opacity', 1, 0), P('scale', 1, 1.15)], e: 'power2.in', d: .8 },
 { c: 'out', n: 'Letters fly out',   s: 'one by one, upward',  set: [P('y', 0, -50), P('opacity', 1, 0)], e: 'power2.in', d: .5, st: { amount: .7, from: 'start' } },
];

let cat = 'all';

export function presetsSection() {
  const list = PRESETS.map((p, i) => ({ p, i })).filter(({ p }) => cat === 'all' || p.c === cat);
  const chips = CATS.map(([id, label]) => {
    const n = id === 'all' ? PRESETS.length : PRESETS.filter(p => p.c === id).length;
    return `<button class="pchip ${cat === id ? 'on' : ''}" data-pcat="${id}">${esc(label)}<i>${n}</i></button>`;
  }).join('');

  return sect('presets', `Preset library · ${PRESETS.length}`,
    `<div class="pchips">${chips}</div>
     <div class="presets">${list.map(({ p, i }) =>
      `<button class="pre" data-pre="${i}">${esc(p.n)}<small>${esc(p.s)}</small></button>`).join('')}</div>
     <p class="hint" style="margin-top:7px">Applies to the current selection, creating a new lane
       for it. Anything in <b>Text</b> spreads across letters — run <b>Split letters</b> (or
       <b>Split words</b>) first, select them all, then click.</p>`);
}

export function setPresetCat(c) { cat = c; }

const drivesExactly = (clip, sel) =>
  !!clip && clip.targets.length === sel.size && clip.targets.every(u => sel.has(u));

export function applyPreset(i) {
  let clip = S.clips.find(c => c.id === S.activeClip);
  // If the selection has moved on from what the active clip drives, the user
  // means "apply this to what I have selected" — not "rewrite that other
  // clip". Without this, selecting new elements and picking a preset silently
  // retargets nothing and re-skins the previous lane instead.
  if (S.sel.size && !drivesExactly(clip, S.sel)) clip = null;
  if (!clip) {
    if (!S.sel.size) { toast('Select at least one element first.', 'err'); return; }
    clip = newClip([...S.sel]); S.clips.push(clip); S.activeClip = clip.id;
  }
  const p = PRESETS[i];
  Object.values(clip.props).forEach(v => { if (v && typeof v === 'object' && 'on' in v) v.on = false; });
  p.set.forEach(({ k, f, t }) => { clip.props[k] = { on: true, from: f, to: t }; });
  const [e, dir] = p.e.split('.');
  clip.timing.ease = e; clip.timing.dir = dir || 'out'; clip.timing.cfg = p.cfg || '';
  clip.timing.duration = p.d; clip.timing.repeat = p.rep || 0;
  clip.timing.yoyo = !!p.yoyo; clip.timing.repeatDelay = p.rd || 0;
  // A preset owns its stagger too, so the text effects spread across split
  // letters without having to go and set it by hand every time.
  clip.stagger.amount = p.st?.amount || 0;
  clip.stagger.from = p.st?.from || 'start';
  clip.stagger.ease = p.st?.ease || 'none';
  clip.name = p.n;
  rebuild(); renderAll(); playFrom(clip);
}
