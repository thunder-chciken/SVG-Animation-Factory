/* =====================================================================
   STATIC TRANSFORMS
   Move, scale, rotate and skew that belong to the artwork itself, not to
   an animation clip. These are what you reach for to lay a composition
   out; clips then animate on top of whatever you set here.

   Everything is written to the same dedicated <g data-saf-move> wrapper
   the canvas drag already used. Two reasons it cannot go on the element:
   GSAP owns the element's own transform attribute and overwrites it on
   every tween, and an authored transform in the source file has to keep
   working untouched.

   The full model lives in a data attribute rather than being parsed back
   out of the transform string — round-tripping a matrix loses which of
   the infinitely many rotate/skew/scale combinations produced it.
   ===================================================================== */
import { NS, round } from './state.js';

export const IDENTITY = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, kx: 0, ky: 0 };

export const isIdentity = t =>
  !t || (!t.x && !t.y && !t.rot && !t.kx && !t.ky && t.sx === 1 && t.sy === 1);

/* The wrapper that carries the transform, created on demand. */
export function wrapFor(node) {
  const p = node.parentNode;
  if (p && p.dataset && p.dataset.safMove) return p;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'saf-move');
  g.dataset.safMove = '1';
  p.insertBefore(g, node);
  g.appendChild(node);
  return g;
}

export function readXf(node) {
  const p = node.parentNode;
  if (!p || !p.dataset || !p.dataset.safMove) return { ...IDENTITY };
  try {
    return { ...IDENTITY, ...JSON.parse(p.dataset.safXf || '{}') };
  } catch (e) {
    return { ...IDENTITY };
  }
}

/* Pivot for rotate / scale / skew, in the wrapper's own coordinate space.

   Measured on the child, not on the wrapper. getBBox() on a <g> folds in its
   children's own transforms — and the child's transform is precisely where
   GSAP writes the animation. Taking the wrapper's box made the pivot drift
   frame by frame while the timeline played. The child's own getBBox() is
   pre-transform geometry, so it holds still whatever is animating. */
function pivot(g) {
  const src = g.firstElementChild || g;
  try {
    const b = src.getBBox();
    if (!b.width && !b.height) return { cx: 0, cy: 0 };
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  } catch (e) {
    return { cx: 0, cy: 0 };
  }
}

function compose(g, t) {
  const n = v => round(v, 3);
  if (isIdentity(t)) return '';
  // Translation is pivot-independent, so it stays outside the pivot pair.
  const parts = [];
  if (t.x || t.y) parts.push(`translate(${n(t.x)} ${n(t.y)})`);
  const shaped = t.rot || t.kx || t.ky || t.sx !== 1 || t.sy !== 1;
  if (shaped) {
    const { cx, cy } = pivot(g);
    parts.push(`translate(${n(cx)} ${n(cy)})`);
    if (t.rot) parts.push(`rotate(${n(t.rot)})`);
    if (t.kx) parts.push(`skewX(${n(t.kx)})`);
    if (t.ky) parts.push(`skewY(${n(t.ky)})`);
    if (t.sx !== 1 || t.sy !== 1) parts.push(`scale(${n(t.sx)} ${n(t.sy)})`);
    parts.push(`translate(${n(-cx)} ${n(-cy)})`);
  }
  return parts.join(' ');
}

export function writeXf(node, t) {
  const g = wrapFor(node);
  const merged = { ...IDENTITY, ...t };
  g.dataset.safXf = JSON.stringify(merged);
  const str = compose(g, merged);
  if (str) g.setAttribute('transform', str);
  else g.removeAttribute('transform');
  return merged;
}

/* Shift one or more values without disturbing the rest. */
export function patchXf(node, patch) {
  return writeXf(node, { ...readXf(node), ...patch });
}

export function resetXf(node) {
  const p = node.parentNode;
  if (!p || !p.dataset || !p.dataset.safMove) return;
  delete p.dataset.safXf;
  p.removeAttribute('transform');
}
