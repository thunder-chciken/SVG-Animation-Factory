/* =====================================================================
   PROPERTY SCHEMA — one source of truth for every animatable option
   ===================================================================== */
import { S } from './state.js';

export const SCHEMA = [
 { id: 'pos', title: 'Position & movement', props: [
  { k: 'x',        l: 'X shift',     t: 'num', min: -1200, max: 1200, step: 1,   u: 'px', from: 0, to: 0 },
  { k: 'y',        l: 'Y shift',     t: 'num', min: -1200, max: 1200, step: 1,   u: 'px', from: 0, to: 0 },
  { k: 'xPercent', l: 'X percent',   t: 'num', min: -400,  max: 400,  step: 1,   u: '%',  from: 0, to: 0 },
  { k: 'yPercent', l: 'Y percent',   t: 'num', min: -400,  max: 400,  step: 1,   u: '%',  from: 0, to: 0 },
 ] },
 { id: 'scale', title: 'Scale, rotate, skew', props: [
  { k: 'scale',       l: 'Scale',        t: 'num', min: 0,     max: 5,    step: .01, u: '×',  from: 1, to: 1 },
  { k: 'scaleX',      l: 'Scale X',      t: 'num', min: -3,    max: 5,    step: .01, u: '×',  from: 1, to: 1 },
  { k: 'scaleY',      l: 'Scale Y',      t: 'num', min: -3,    max: 5,    step: .01, u: '×',  from: 1, to: 1 },
  { k: 'rotation',    l: 'Rotate',       t: 'num', min: -1080, max: 1080, step: 1,   u: '°',  from: 0, to: 0 },
  { k: 'rotationX',   l: 'Flip X (3D)',  t: 'num', min: -360,  max: 360,  step: 1,   u: '°',  from: 0, to: 0 },
  { k: 'rotationY',   l: 'Flip Y (3D)',  t: 'num', min: -360,  max: 360,  step: 1,   u: '°',  from: 0, to: 0 },
  { k: 'skewX',       l: 'Skew X',       t: 'num', min: -90,   max: 90,   step: .5,  u: '°',  from: 0, to: 0 },
  { k: 'skewY',       l: 'Skew Y',       t: 'num', min: -90,   max: 90,   step: .5,  u: '°',  from: 0, to: 0 },
  { k: 'perspective', l: 'Perspective',  t: 'num', min: 0,     max: 2000, step: 10,  u: 'px', from: 0, to: 0 },
 ] },
 { id: 'look', title: 'Opacity & colour', props: [
  { k: 'opacity',     l: 'Opacity',      t: 'num', min: 0, max: 1,  step: .01, u: '',   from: 0, to: 1 },
  { k: 'fill',        l: 'Fill',         t: 'col', from: '#ffb020', to: '#4da3ff' },
  { k: 'stroke',      l: 'Stroke',       t: 'col', from: '#ffb020', to: '#4da3ff' },
  { k: 'strokeWidth', l: 'Stroke width', t: 'num', min: 0, max: 60, step: .1,  u: 'px', from: 1, to: 4 },
 ] },
 { id: 'fx', title: 'Filters & effects', props: [
  { k: 'blur',       l: 'Blur',       t: 'num', min: 0,    max: 40,  step: .5,  u: 'px', from: 12, to: 0 },
  { k: 'brightness', l: 'Brightness', t: 'num', min: 0,    max: 4,   step: .05, u: '×',  from: 1,  to: 1 },
  { k: 'contrast',   l: 'Contrast',   t: 'num', min: 0,    max: 4,   step: .05, u: '×',  from: 1,  to: 1 },
  { k: 'saturate',   l: 'Saturation', t: 'num', min: 0,    max: 5,   step: .05, u: '×',  from: 0,  to: 1 },
  { k: 'hueRotate',  l: 'Hue rotate', t: 'num', min: -360, max: 360, step: 1,   u: '°',  from: 0,  to: 0 },
  { k: 'grayscale',  l: 'Grayscale',  t: 'num', min: 0,    max: 1,   step: .01, u: '',   from: 1,  to: 0 },
  { k: 'sepia',      l: 'Sepia',      t: 'num', min: 0,    max: 1,   step: .01, u: '',   from: 0,  to: 0 },
  { k: 'invert',     l: 'Invert',     t: 'num', min: 0,    max: 1,   step: .01, u: '',   from: 0,  to: 0 },
 ] },
 { id: 'draw', title: 'Line drawing', props: [
  { k: 'drawStart', l: 'Start at', t: 'num', min: 0, max: 1,  step: .01, u: '',   from: 0, to: 0 },
  { k: 'drawEnd',   l: 'Draw to',  t: 'num', min: 0, max: 1,  step: .01, u: '',   from: 0, to: 1 },
  { k: 'dashGap',   l: 'Dash gap', t: 'num', min: 0, max: 60, step: .5,  u: 'px', from: 0, to: 0 },
 ] },
];

export const EASES = ['none', 'power1', 'power2', 'power3', 'power4', 'back', 'elastic', 'bounce',
                      'circ', 'expo', 'sine', 'steps', 'slow', 'rough'];
export const EASE_DIR = ['out', 'in', 'inOut'];

export function newClip(targets) {
  const props = {};
  SCHEMA.forEach(g => g.props.forEach(p => {
    props[p.k] = { on: false, from: p.from, to: p.to };
  }));
  props.__origin = { on: true, from: '50% 50%', to: '50% 50%' };
  return {
    id: 'c' + (++S.clipId),
    name: 'Clip ' + (S.clipId),
    targets: [...targets],
    enabled: true,
    props,
    timing: {
      duration: .9, delay: 0, ease: 'power2', dir: 'out', cfg: '',
      repeat: 0, yoyo: false, repeatDelay: 0,
    },
    stagger: { amount: 0, from: 'start', axis: '', ease: 'none' },
    posMode: 'after', posVal: 0,
    motionPath: '', mpAlign: false, mpRotate: false,
  };
}
