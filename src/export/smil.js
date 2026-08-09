/* =====================================================================
   ANIMATED SVG (SMIL)
   One self-contained .svg file that animates itself with no JavaScript,
   so it works in <img src>, as a CSS background-image, and anywhere a
   script would be stripped.

   SMIL is a narrower target than GSAP, and the gap is reported rather
   than silently dropped — smilGaps() feeds the warning banner in the
   export sheet and a comment at the top of the file.
   ===================================================================== */
import { gsap } from '../gsap.js';
import { S, round, esc } from '../state.js';
import { FILTER_KEYS } from '../filters.js';
import { easeString } from '../timeline.js';
import { svgSource } from './svg.js';

const PIVOTAL = ['scale', 'scaleX', 'scaleY', 'rotation', 'skewX', 'skewY'];
const UNSUPPORTED_PROPS = ['xPercent', 'yPercent', 'rotationX', 'rotationY', 'perspective'];

/* What the studio can express that SMIL cannot. */
export function smilGaps() {
  const gaps = [];
  const on = k => S.clips.some(c => c.enabled && c.props[k]?.on);
  if (FILTER_KEYS.some(on)) gaps.push('CSS filters (blur, brightness, hue-rotate…) — SMIL has no filter animation');
  if (UNSUPPORTED_PROPS.some(on)) gaps.push('3D transforms and percentage offsets (rotationX/Y, perspective, xPercent/yPercent)');
  if (/scroll|scrub/.test(S.trigger.mode)) gaps.push(`the "${S.trigger.mode}" trigger — an SVG file cannot see the page scroll, so it plays on load instead`);
  if (S.trigger.mode === 'hover') gaps.push('the hover trigger — starts on click instead');
  if (S.loopCfg.on && S.loopCfg.yoyo) gaps.push('ping-pong looping — SMIL replays each cycle forwards');
  return gaps;
}

/* Where scale, rotate and skew pivot, in user units. */
function pivotOf(rec, clip) {
  const b = rec.bbox || { x: 0, y: 0, w: 0, h: 0 };
  const raw = (clip.props.__origin?.from || '50% 50%').trim().split(/\s+/);
  const axis = (token, origin, size) => {
    if (token == null) return origin + size / 2;
    if (token.endsWith('%')) return origin + (parseFloat(token) / 100) * size;
    const n = parseFloat(token);
    return isNaN(n) ? origin + size / 2 : (clip.svgOrigin ? n : origin + n);
  };
  return { cx: round(axis(raw[0], b.x, b.w), 3), cy: round(axis(raw[1], b.y, b.h), 3) };
}

function staggerOffset(clip, i, n) {
  const amt = clip.stagger?.amount || 0;
  if (!amt || n < 2) return 0;
  const t = i / (n - 1);
  switch (clip.stagger.from) {
    case 'end': return amt * (1 - t);
    case 'center': return amt * Math.abs(t - .5) * 2;
    case 'edges': return amt * (1 - Math.abs(t - .5) * 2);
    default: return amt * t;
  }
}

/* Shared timing attributes for one animation element. */
function timingAttrs(clip, begin, beginRef) {
  const t = clip.timing;
  const dur = Math.max(t.duration, .01) * (t.yoyo ? 2 : 1);
  const bits = [];
  // beginRef anchors every animation to the same event — the master clock
  // when looping, or the root's click — so lanes stay in sync with each other.
  bits.push(`begin="${beginRef ? `${beginRef}+${round(begin, 3)}s` : `${round(begin, 3)}s`}"`);
  bits.push(`dur="${round(dur, 3)}s"`);
  if (t.repeat < 0) bits.push('repeatCount="indefinite"');
  else if (t.repeat > 0) bits.push(`repeatCount="${t.repeat + 1}"`);
  bits.push('fill="freeze"');
  return bits.join(' ');
}

/* ---------------------------------------------------------------------
   Easing.

   SMIL keySplines require every control point to sit inside 0–1. CSS
   cubic-bezier does not, and the eases people actually reach for — back,
   elastic, bounce — all overshoot. Emitting those as keySplines produces an
   out-of-range value, which makes the animation element invalid and the
   whole effect silently vanishes.

   So the ease is not approximated at all: GSAP's own ease function is
   sampled into a value list and played back linearly. Bounce and elastic
   come out right, and so does anything else GSAP can parse.
   --------------------------------------------------------------------- */
const STEPS = 24;

function lerpValue(from, to, t) {
  const a = String(from).trim(), b = String(to).trim();
  if (a.startsWith('#') && b.startsWith('#')) {
    const rgb = h => {
      let s = h.slice(1);
      if (s.length === 3) s = s.split('').map(c => c + c).join('');
      return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
    };
    const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
    const mix = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
    return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
  }
  const av = a.split(/[\s,]+/).map(Number), bv = b.split(/[\s,]+/).map(Number);
  if (av.length !== bv.length || av.some(isNaN) || bv.some(isNaN)) return t < .5 ? a : b;
  return av.map((v, i) => round(v + (bv[i] - v) * t, 4)).join(' ');
}

function easeFn(clip) {
  try { return gsap.parseEase(easeString(clip.timing)) || (p => p); }
  catch (e) { return p => p; }
}

/* values + keyTimes for one property, with the ease baked into the samples. */
function sampled(clip, from, to) {
  const ease = easeFn(clip);
  const fwd = [];
  for (let i = 0; i <= STEPS; i++) fwd.push(lerpValue(from, to, ease(i / STEPS)));
  const values = clip.timing.yoyo ? fwd.concat(fwd.slice(0, -1).reverse()) : fwd;
  const n = values.length - 1;
  const keyTimes = values.map((_, i) => round(i / n, 5)).join(';');
  return `values="${values.join(';')}" keyTimes="${keyTimes}" calcMode="linear"`;
}

function animate(attr, clip, from, to, begin, ref, extra = '') {
  return `    <animate attributeName="${attr}" ${sampled(clip, from, to)} ` +
         `${timingAttrs(clip, begin, ref)}${extra ? ' ' + extra : ''}/>`;
}

function animateTransform(type, clip, from, to, begin, ref) {
  return `    <animateTransform attributeName="transform" type="${type}" additive="sum" ` +
         `${sampled(clip, from, to)} ${timingAttrs(clip, begin, ref)}/>`;
}

const staticTransform = (type, val) =>
  `    <animateTransform attributeName="transform" type="${type}" additive="sum" ` +
  `values="${val};${val}" begin="0s" dur="0.001s" fill="freeze"/>`;

/* Every animation element that belongs inside one target element. */
function animationsFor(clip, rec, index, count, ref) {
  const P = clip.props;
  const begin = (clip._start || 0) + (clip.timing.delay || 0) + staggerOffset(clip, index, count);
  const out = [];
  const val = (k, side) => P[k][side];

  // ---- translate ----
  if (P.x?.on || P.y?.on) {
    const f = `${P.x?.on ? val('x', 'from') : 0} ${P.y?.on ? val('y', 'from') : 0}`;
    const t = `${P.x?.on ? val('x', 'to') : 0} ${P.y?.on ? val('y', 'to') : 0}`;
    out.push(animateTransform('translate', clip, f, t, begin, ref));
  }

  // ---- pivoted transforms ----
  const usesPivot = PIVOTAL.some(k => P[k]?.on);
  if (usesPivot) {
    const { cx, cy } = pivotOf(rec, clip);
    out.push(staticTransform('translate', `${cx} ${cy}`));

    if (P.rotation?.on) out.push(animateTransform('rotate', clip, val('rotation', 'from'), val('rotation', 'to'), begin, ref));
    if (P.skewX?.on) out.push(animateTransform('skewX', clip, val('skewX', 'from'), val('skewX', 'to'), begin, ref));
    if (P.skewY?.on) out.push(animateTransform('skewY', clip, val('skewY', 'from'), val('skewY', 'to'), begin, ref));
    if (P.scale?.on || P.scaleX?.on || P.scaleY?.on) {
      const sx = k => P.scale?.on ? val('scale', k) : (P.scaleX?.on ? val('scaleX', k) : 1);
      const sy = k => P.scale?.on ? val('scale', k) : (P.scaleY?.on ? val('scaleY', k) : 1);
      out.push(animateTransform('scale', clip, `${sx('from')} ${sy('from')}`, `${sx('to')} ${sy('to')}`, begin, ref));
    }
    out.push(staticTransform('translate', `${-cx} ${-cy}`));
  }

  // ---- paint ----
  if (P.opacity?.on) out.push(animate('opacity', clip, val('opacity', 'from'), val('opacity', 'to'), begin, ref));
  if (P.fill?.on) out.push(animate('fill', clip, val('fill', 'from'), val('fill', 'to'), begin, ref));
  if (P.stroke?.on) out.push(animate('stroke', clip, val('stroke', 'from'), val('stroke', 'to'), begin, ref));
  if (P.strokeWidth?.on) out.push(animate('stroke-width', clip, val('strokeWidth', 'from'), val('strokeWidth', 'to'), begin, ref));

  // ---- line drawing ----
  if (P.drawStart?.on || P.drawEnd?.on || P.dashGap?.on) {
    const L = rec.len || 100;
    const gap = P.dashGap?.on ? P.dashGap.to : 0;
    const seg = side => {
      const s = P.drawStart?.on ? P.drawStart[side] : 0;
      const e = P.drawEnd?.on ? P.drawEnd[side] : 1;
      return `${round(Math.max(0, e - s) * L, 2)} ${round(gap > 0 ? gap : L + 1, 2)}`;
    };
    const off = side => round(-(P.drawStart?.on ? P.drawStart[side] : 0) * L, 2);
    out.push(animate('stroke-dasharray', clip, seg('from'), seg('to'), begin, ref));
    out.push(animate('stroke-dashoffset', clip, off('from'), off('to'), begin, ref));
  }

  // ---- motion path ----
  if (clip.motionPath) {
    const guide = S.byUid.get(clip.motionPath);
    const gid = guide?.node.getAttribute('id');
    if (gid) {
      // animateMotion eases via keyPoints (position along the path) rather
      // than a value list, but the sampling idea is the same.
      const ease = easeFn(clip);
      const pts = [];
      for (let i = 0; i <= STEPS; i++) pts.push(round(ease(i / STEPS), 4));
      const seq = clip.timing.yoyo ? pts.concat(pts.slice(0, -1).reverse()) : pts;
      const kt = seq.map((_, i) => round(i / (seq.length - 1), 5)).join(';');
      out.push(`    <animateMotion ${timingAttrs(clip, begin, ref)} ` +
        `keyPoints="${seq.join(';')}" keyTimes="${kt}" calcMode="linear"` +
        `${clip.mpRotate ? ' rotate="auto"' : ''}>\n` +
        `      <mpath href="#${gid}"/>\n` +
        `    </animateMotion>`);
    }
  }

  return out;
}

export function genSMIL() {
  if (!S.svg) return '';

  const clips = S.clips.filter(c => c.enabled && c.targets.length);
  const total = S.tl ? S.tl.duration() : 0;
  const onClick = S.trigger.mode === 'click' || S.trigger.mode === 'hover';
  const lc = S.loopCfg;
  const loopId = (lc.on && !onClick && total > 0) ? 'safLoop' : null;
  const cycle = total + (lc.delay || 0);
  // Anchor: the master clock when looping, the root's click when triggered,
  // otherwise plain document time.
  const ref = loopId ? `${loopId}.begin` : (onClick ? 'saf-root.click' : null);

  // Collect the animation elements each target needs, keyed by element id.
  const byId = new Map();
  clips.forEach(clip => {
    const recs = clip.targets.map(u => S.byUid.get(u)).filter(Boolean);
    recs.forEach((rec, i) => {
      const id = rec.node.getAttribute('id');
      if (!id) return;
      const lines = animationsFor(clip, rec, i, recs.length, ref);
      if (!lines.length) return;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(`    <!-- ${esc(clip.name)} -->`, ...lines);
    });
  });

  // Inject into a clean copy of the markup. The animation snippets are
  // parsed into real nodes rather than spliced into the serialised string —
  // string surgery on markup breaks the moment an attribute contains a "<".
  const doc = new DOMParser().parseFromString(svgSource(), 'image/svg+xml');
  const root = doc.querySelector('svg');
  if (!root || doc.querySelector('parsererror')) return '';

  const parseKids = xml => {
    const frag = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${xml}</svg>`, 'image/svg+xml');
    if (frag.querySelector('parsererror')) return [];
    return [...frag.documentElement.childNodes];
  };

  byId.forEach((lines, id) => {
    const node = root.querySelector(`[id="${id}"]`);
    if (!node) return;
    parseKids(lines.join('\n')).forEach(n => node.appendChild(doc.importNode(n, true)));
  });

  if (loopId) {
    const clock = doc.createElementNS('http://www.w3.org/2000/svg', 'animate');
    clock.setAttribute('id', loopId);
    clock.setAttribute('attributeName', 'opacity');
    clock.setAttribute('values', '1;1');
    // one cycle = the timeline plus whatever pause was asked for between loops
    clock.setAttribute('dur', `${round(cycle, 3)}s`);
    clock.setAttribute('repeatCount', lc.count < 0 ? 'indefinite' : String(lc.count + 1));
    root.insertBefore(clock, root.firstChild);
  }
  if (S.trigger.mode === 'click' || S.trigger.mode === 'hover') {
    root.setAttribute('style', ((root.getAttribute('style') || '') + ';cursor:pointer').replace(/^;/, ''));
  }

  const out = new XMLSerializer().serializeToString(root)
    .replace(/></g, '>\n<')
    .replace(/\n<\/(tspan|text)/g, '</$1');

  const gaps = smilGaps();
  const header = [
    '<!-- Animated SVG generated by SVG Animation Factory.',
    '     Self-contained: no JavaScript, no external files.',
    '     Works inline, in <img src>, and as a CSS background-image.',
    ...(gaps.length ? ['', '     Not carried over from the studio timeline:',
      ...gaps.map(g => `       · ${g}`)] : []),
    '-->',
  ].join('\n');

  return `${header}\n${out}\n`;
}
