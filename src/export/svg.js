import { S } from '../state.js';

/* The stage SVG, cleaned of studio bookkeeping and given the #saf-root
   handle that every generated script hangs off. */
export function svgSource() {
  if (!S.svg) return '';
  const c = S.svg.cloneNode(true);
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
  return new XMLSerializer().serializeToString(c)
    .replace(/></g, '>\n<').replace(/\n<\/(tspan|text)/g, '</$1');
}
