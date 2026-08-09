import { S, clamp } from '../state.js';
import { resetStage, buildTimeline } from '../timeline.js';

/* The stage SVG, cleaned of studio bookkeeping and given the #saf-root
   handle that every generated script hangs off.

   The playhead has to be cleared first. GSAP writes the current frame into
   inline styles and the transform attribute, so cloning mid-preview bakes
   that frame into the export — an element caught at the start of a fade
   ships with opacity:0. It is invisible in the GSAP exports, because the
   script immediately overwrites it, but fatal in the SMIL file, whose
   animations add to whatever base state they find. */
export function svgSource() {
  if (!S.svg) return '';

  const at = S.tl ? S.tl.progress() : 0;
  const wasPlaying = S.tl ? S.tl.isActive() : false;
  resetStage();

  const c = S.svg.cloneNode(true);
  c.querySelectorAll('[data-svg-origin]').forEach(n => n.removeAttribute('data-svg-origin'));
  c.querySelectorAll('[style]').forEach(n => {
    // clearProps leaves transform-origin behind. Inline, it outranks the rule
    // the CSS export writes, so the pivot would silently be wrong.
    const kept = n.getAttribute('style')
      .split(';').map(s => s.trim())
      .filter(s => s && !/^transform-origin\s*:/i.test(s))
      .join('; ');
    if (kept) n.setAttribute('style', kept); else n.removeAttribute('style');
  });
  c.setAttribute('id', 'saf-root');
  c.querySelectorAll('[data-saf]').forEach(n => n.removeAttribute('data-saf'));
  c.querySelectorAll('[data-saf-char]').forEach(n => n.removeAttribute('data-saf-char'));
  c.removeAttribute('style');
  c.querySelectorAll('.saf-move').forEach(g => {
    if (!(g.getAttribute('transform') || '').trim()) {          // unwrap untouched wrappers
      while (g.firstChild) g.parentNode.insertBefore(g.firstChild, g);
      g.remove();
    } else g.removeAttribute('class');
  });

  // put the live preview back exactly where the user left it
  if (S.tl) {
    buildTimeline();
    if (S.tl.duration() > 0) S.tl.progress(clamp(at, 0, 1));
    if (wasPlaying) S.tl.play();
  }

  return new XMLSerializer().serializeToString(c)
    .replace(/></g, '>\n<').replace(/\n<\/(tspan|text)/g, '</$1');
}
