/* =====================================================================
   TIMELINE ENGINE — turn the clip list into a live GSAP timeline
   ===================================================================== */
import { gsap } from './gsap.js';
import { S, $, clamp, round, markDirty } from './state.js';
import { FILTER_KEYS, FILTER_FN } from './filters.js';
import { pathLen } from './ingest.js';
import { renderTracks, syncScrub } from './transport.js';

export function easeString(t) {
  if (t.ease === 'none') return 'none';
  const cfg = t.cfg.trim();
  const base = t.ease + '.' + t.dir;
  return cfg ? `${base}(${cfg})` : base;
}

export function clipDur(c) {
  const t = c.timing;
  const reps = t.repeat < 0 ? 0 : t.repeat;   // infinite draws as a single cycle on the bar
  return t.delay + t.duration * (reps + 1) + t.repeatDelay * reps;
}

function nodesOf(clip) {
  return clip.targets.map(u => S.byUid.get(u)).filter(r => r && r.node.isConnected).map(r => r.node);
}

export function resetStage() {
  if (!S.svg) return;
  (S.loopTweens || []).forEach(t => t.kill());
  S.loopTweens = [];
  const all = S.items.map(i => i.node).filter(n => n.isConnected);
  gsap.killTweensOf(all);
  gsap.set(all, { clearProps: 'all' });
  all.forEach(n => {
    n.style.strokeDasharray = ''; n.style.strokeDashoffset = ''; n.style.filter = '';
    const rec = S.byUid.get(n.dataset.saf);
    n.style.display = rec && rec.hidden ? 'none' : '';
  });
}

function buildVars(clip) {
  const from = {}, to = {};
  const P = clip.props;
  const add = (k, dst, src) => { if (P[k]?.on) { dst[k] = P[k][src]; } };
  ['x', 'y', 'xPercent', 'yPercent', 'scale', 'scaleX', 'scaleY', 'rotation', 'rotationX', 'rotationY',
   'skewX', 'skewY', 'perspective', 'opacity', 'fill', 'stroke', 'strokeWidth'].forEach(k => {
    add(k, from, 'from'); add(k, to, 'to');
  });
  // filters compose into one string so GSAP can interpolate them together
  const usedF = FILTER_KEYS.filter(k => P[k]?.on);
  if (usedF.length) {
    const mk = side => usedF.map(k => FILTER_FN[k](P[k][side])).join(' ');
    from.filter = mk('from'); to.filter = mk('to');
  }
  // transform origin
  const org = P.__origin;
  if (org && org.from) {
    if (clip.svgOrigin) { from.svgOrigin = org.from.replace(/%/g, ''); to.svgOrigin = org.from.replace(/%/g, ''); }
    else { from.transformOrigin = org.from; to.transformOrigin = org.from; }
  }
  return { from, to };
}

function applyDraw(clip, nodes, from, to) {
  const P = clip.props;
  if (!(P.drawStart?.on || P.drawEnd?.on || P.dashGap?.on)) return false;
  const gap = P.dashGap?.on ? P.dashGap.to : 0;
  nodes.forEach(n => { n.style.strokeDasharray = ''; });
  // Dash length depends on each node's own path length, so both sides are
  // supplied as GSAP function-based values rather than fixed strings.
  const seg = side => function (i, el) {
    const rec = S.byUid.get(el.dataset.saf);
    const L = (rec?.len || pathLen(el) || 100);
    const s = P.drawStart?.on ? P.drawStart[side] : 0;
    const e = P.drawEnd?.on ? P.drawEnd[side] : 1;
    const vis = Math.max(0, (e - s)) * L;
    return `${round(vis, 2)}px ${round(gap > 0 ? gap : L + 1, 2)}px`;
  };
  const off = side => function (i, el) {
    const rec = S.byUid.get(el.dataset.saf);
    const L = (rec?.len || pathLen(el) || 100);
    const s = P.drawStart?.on ? P.drawStart[side] : 0;
    return `${round(-s * L, 2)}px`;
  };
  from.strokeDasharray = seg('from'); to.strokeDasharray = seg('to');
  from.strokeDashoffset = off('from'); to.strokeDashoffset = off('to');
  return true;
}

export function buildTimeline() {
  if (S.tl) { S.tl.kill(); S.tl = null; }
  resetStage();
  const tl = gsap.timeline({
    paused: true, repeat: S.loop ? -1 : 0,
    onUpdate() { syncScrub(); },
  });
  let cursor = 0, prevStart = 0, prevEnd = 0;

  S.clips.forEach(clip => {
    if (!clip.enabled) return;
    const nodes = nodesOf(clip);
    if (!nodes.length) { clip._start = clip._end = 0; return; }

    let at = 0;
    if (clip.posMode === 'after') at = prevEnd;
    else if (clip.posMode === 'with') at = prevStart;
    else if (clip.posMode === 'offset') at = Math.max(0, prevEnd + (+clip.posVal || 0));
    else at = Math.max(0, +clip.posVal || 0);

    const { from, to } = buildVars(clip);
    applyDraw(clip, nodes, from, to);

    const t = clip.timing;
    const vars = {
      duration: t.duration, ease: easeString(t), delay: t.delay,
      repeat: t.repeat, yoyo: t.yoyo, repeatDelay: t.repeatDelay,
    };
    if (nodes.length > 1 && clip.stagger.amount > 0) {
      vars.stagger = {
        amount: clip.stagger.amount, from: clip.stagger.from,
        ease: clip.stagger.ease,
      };
      if (clip.stagger.axis) vars.stagger.axis = clip.stagger.axis;
    }
    if (clip.motionPath) {
      const guide = S.byUid.get(clip.motionPath);
      if (guide && guide.node.isConnected) {
        to.motionPath = {
          path: guide.node, align: clip.mpAlign ? guide.node : undefined,
          autoRotate: clip.mpRotate, alignOrigin: clip.mpAlign ? [0.5, 0.5] : undefined,
        };
      }
    }
    const hasFrom = Object.keys(from).length > 0;
    const toVars = Object.assign({}, to, vars);
    if (t.repeat < 0) {
      // An endless clip would make the master timeline infinitely long, which
      // breaks the scrubber. Run it beside the timeline instead.
      const tw = hasFrom ? gsap.fromTo(nodes, from, toVars) : gsap.to(nodes, toVars);
      S.loopTweens.push(tw);
    } else if (hasFrom) tl.fromTo(nodes, from, toVars, at);
    else tl.to(nodes, toVars, at);

    const total = clipDur(clip) + (clip.stagger.amount || 0);
    clip._start = at; clip._end = at + total;
    prevStart = at; prevEnd = at + total; cursor = Math.max(cursor, prevEnd);
  });

  S.tl = tl;
  tl.progress(0).pause();
  return tl;
}

let rebuildTimer = null;

export function rebuildNow() {
  const wasPlaying = S.tl && S.tl.isActive();
  const p = S.tl ? S.tl.progress() : 0;
  buildTimeline();
  renderTracks();
  if (S.tl.duration() > 0) { S.tl.progress(clamp(p, 0, 1)); if (wasPlaying) S.tl.play(); }
  syncScrub();
  markDirty();
}

export function rebuild(now) {
  clearTimeout(rebuildTimer);
  if (now) return rebuildNow();
  rebuildTimer = setTimeout(rebuildNow, 90);
}

export function hasMotion() { return (S.tl && S.tl.duration() > 0) || (S.loopTweens && S.loopTweens.length); }

export function playFrom(clip) {
  rebuild(true);
  const d = S.tl.duration();
  const t = clip && d > 0 ? (clip._start || 0) / d : 0;
  if (d > 0) S.tl.progress(clamp(t, 0, .999)).play();
  (S.loopTweens || []).forEach(tw => tw.play(0));
  $('#tPlay').textContent = '❚❚';
}
