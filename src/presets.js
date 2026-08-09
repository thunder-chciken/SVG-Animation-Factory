/* =====================================================================
   PRESETS
   ===================================================================== */
import { S, esc, toast } from './state.js';
import { sect } from './ui.js';
import { newClip } from './schema.js';
import { rebuild, playFrom } from './timeline.js';
import { renderAll } from './render.js';

const P = (k, f, t) => ({ k, f, t });

export const PRESETS = [
 // entrances
 { n: 'Fade in',         s: 'opacity 0 → 1',        set: [P('opacity', 0, 1)], e: 'power2.out', d: .8 },
 { n: 'Rise up',         s: 'up 60px + fade',       set: [P('y', 60, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { n: 'Drop down',       s: 'down 60px + fade',     set: [P('y', -60, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { n: 'Slide from left', s: 'x −120 → 0',           set: [P('x', -120, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { n: 'Slide from right',s: 'x +120 → 0',           set: [P('x', 120, 0), P('opacity', 0, 1)], e: 'power3.out', d: .9 },
 { n: 'Diagonal ↘',      s: 'in from top-left',     set: [P('x', -90, 0), P('y', -90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { n: 'Diagonal ↙',      s: 'in from top-right',    set: [P('x', 90, 0), P('y', -90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { n: 'Diagonal ↗',      s: 'in from bottom-left',  set: [P('x', -90, 0), P('y', 90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { n: 'Diagonal ↖',      s: 'in from bottom-right', set: [P('x', 90, 0), P('y', 90, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 { n: 'Pop in',          s: 'scale 0 → 1',          set: [P('scale', 0, 1), P('opacity', 0, 1)], e: 'back.out', cfg: '1.8', d: .7 },
 { n: 'Bounce in',       s: 'drop + settle',        set: [P('y', -140, 0), P('opacity', 0, 1)], e: 'bounce.out', d: 1.3 },
 { n: 'Zoom out in',     s: 'scale 2.4 → 1',        set: [P('scale', 2.4, 1), P('opacity', 0, 1), P('blur', 14, 0)], e: 'expo.out', d: 1.1 },
 { n: 'Spin in',         s: 'rotate 180 + scale',   set: [P('rotation', -180, 0), P('scale', 0, 1), P('opacity', 0, 1)], e: 'back.out', cfg: '1.4', d: 1 },
 { n: 'Flip X',          s: '3D flip vertical',     set: [P('rotationX', -92, 0), P('opacity', 0, 1), P('perspective', 700, 700)], e: 'power3.out', d: .9 },
 { n: 'Flip Y',          s: '3D flip horizontal',   set: [P('rotationY', 92, 0), P('opacity', 0, 1), P('perspective', 700, 700)], e: 'power3.out', d: .9 },
 { n: 'Unblur',          s: 'blur 18 → 0',          set: [P('blur', 18, 0), P('opacity', 0, 1)], e: 'power2.out', d: 1 },
 { n: 'Elastic drop',    s: 'springy entrance',     set: [P('y', -90, 0), P('opacity', 0, 1)], e: 'elastic.out', cfg: '1,0.35', d: 1.6 },
 { n: 'Skew slide',      s: 'sheared entrance',     set: [P('x', -140, 0), P('skewX', 22, 0), P('opacity', 0, 1)], e: 'expo.out', d: 1 },
 // emphasis / loops
 { n: 'Pulse',           s: 'loop scale 1↔1.12',    set: [P('scale', 1, 1.12)], e: 'sine.inOut', d: .7, rep: -1, yoyo: true },
 { n: 'Heartbeat',       s: 'loop double-thump',    set: [P('scale', 1, 1.22)], e: 'power2.inOut', d: .28, rep: -1, yoyo: true, rd: .55 },
 { n: 'Float',           s: 'loop up/down 14px',    set: [P('y', 0, -14)], e: 'sine.inOut', d: 1.6, rep: -1, yoyo: true },
 { n: 'Sway',            s: 'loop rotate ±6°',      set: [P('rotation', -6, 6)], e: 'sine.inOut', d: 1.8, rep: -1, yoyo: true },
 { n: 'Spin forever',    s: 'continuous 360°',      set: [P('rotation', 0, 360)], e: 'none', d: 6, rep: -1 },
 { n: 'Shimmer',         s: 'loop brightness',      set: [P('brightness', 1, 1.9)], e: 'sine.inOut', d: 1.1, rep: -1, yoyo: true },
 { n: 'Hue cycle',       s: 'loop full spectrum',   set: [P('hueRotate', 0, 360)], e: 'none', d: 8, rep: -1 },
 { n: 'Breathe opacity', s: 'loop 1 ↔ .35',         set: [P('opacity', 1, .35)], e: 'sine.inOut', d: 1.4, rep: -1, yoyo: true },
 { n: 'Rubber band',     s: 'squash and stretch',   set: [P('scaleX', 1, 1.3), P('scaleY', 1, .72)], e: 'elastic.out', cfg: '1,0.3', d: 1.1 },
 { n: 'Wobble',          s: 'skew shake',           set: [P('skewX', -14, 14)], e: 'sine.inOut', d: .16, rep: 7, yoyo: true },
 // colour
 { n: 'Fill colour',     s: 'animate fill',         set: [P('fill', '#ffb020', '#4da3ff')], e: 'power1.inOut', d: 1 },
 { n: 'Stroke colour',   s: 'animate stroke',       set: [P('stroke', '#ffb020', '#4da3ff')], e: 'power1.inOut', d: 1 },
 { n: 'Desaturate in',   s: 'grey → colour',        set: [P('grayscale', 1, 0), P('opacity', 0, 1)], e: 'power2.out', d: 1.2 },
 { n: 'Fill + weight',   s: 'colour & thickness',   set: [P('stroke', '#ffb020', '#ff5f56'), P('strokeWidth', 1, 6)], e: 'power2.inOut', d: 1 },
 // line work
 { n: 'Draw on',         s: 'stroke 0 → 100%',      set: [P('drawEnd', 0, 1)], e: 'power2.inOut', d: 1.6 },
 { n: 'Draw reverse',    s: 'stroke 100% → 0',      set: [P('drawEnd', 1, 0)], e: 'power2.inOut', d: 1.6 },
 { n: 'Wipe segment',    s: 'travelling dash',      set: [P('drawStart', 0, .85), P('drawEnd', .15, 1)], e: 'power1.inOut', d: 1.4 },
 { n: 'Draw then fill',  s: 'outline, then colour', set: [P('drawEnd', 0, 1), P('opacity', .25, 1)], e: 'power2.inOut', d: 1.8 },
 // text — these carry their own stagger, so they spread across split letters
 { n: 'Typewriter',      s: 'letters appear in turn',  set: [P('opacity', 0, 1)], e: 'none', d: .01,
   st: { amount: 1.1, from: 'start' } },
 { n: 'Letter cascade',  s: 'letters drop in',         set: [P('y', 42, 0), P('opacity', 0, 1)], e: 'power3.out', d: .6,
   st: { amount: .8, from: 'start' } },
 { n: 'Letter pop',      s: 'letters spring up',       set: [P('scale', 0, 1), P('opacity', 0, 1)], e: 'back.out', cfg: '2', d: .55,
   st: { amount: .7, from: 'start' } },
 { n: 'Letter flip',     s: '3D flip, one by one',     set: [P('rotationX', -90, 0), P('opacity', 0, 1), P('perspective', 600, 600)], e: 'power3.out', d: .6,
   st: { amount: .9, from: 'start' } },
 { n: 'Letter wave',     s: 'loops up and down',       set: [P('y', 0, -16)], e: 'sine.inOut', d: .9, rep: -1, yoyo: true,
   st: { amount: .7, from: 'start' } },
 { n: 'Letters from edges', s: 'in from both ends',    set: [P('y', 30, 0), P('opacity', 0, 1)], e: 'power2.out', d: .7,
   st: { amount: .9, from: 'edges' } },
 { n: 'Letter shimmer',  s: 'loops a bright sweep',    set: [P('brightness', 1, 2.1)], e: 'sine.inOut', d: .6, rep: -1, yoyo: true,
   st: { amount: 1.2, from: 'start' } },
 // exits
 { n: 'Fade out',        s: 'opacity 1 → 0',        set: [P('opacity', 1, 0)], e: 'power2.in', d: .7 },
 { n: 'Fly out up',      s: 'up + fade',            set: [P('y', 0, -70), P('opacity', 1, 0)], e: 'power2.in', d: .7 },
 { n: 'Collapse out',    s: 'scale 1 → 0',          set: [P('scale', 1, 0), P('opacity', 1, 0), P('rotation', 0, 90)], e: 'back.in', cfg: '1.6', d: .8 },
];

export function presetsSection() {
  return sect('presets', 'Preset library',
    `<div class="presets">${PRESETS.map((p, i) =>
      `<button class="pre" data-pre="${i}">${esc(p.n)}<small>${esc(p.s)}</small></button>`).join('')}</div>
     <p class="hint" style="margin-top:7px">Applies to the active clip, or creates one from the current selection.</p>`);
}

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
