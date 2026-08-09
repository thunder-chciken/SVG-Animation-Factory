import { S } from '../state.js';
import { FILTER_KEYS, FILTER_FN } from '../filters.js';
import { clipSelector } from './shared.js';

const SUPPORTED = new Set(['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation', 'skewX', 'skewY', 'opacity']);

export function genCSS() {
  let css = '/* CSS keyframes — transform, opacity and filter clips only.\n';
  css += '   Draw-on, motion paths, colour tweens and stagger need the GSAP export. */\n\n';
  let n = 0, any = false;
  S.clips.filter(c => c.enabled).forEach(c => {
    const keys = Object.keys(c.props).filter(k => c.props[k]?.on);
    const usable = keys.filter(k => SUPPORTED.has(k) || FILTER_KEYS.includes(k));
    if (!usable.length) return;
    any = true; n++;
    const name = 'saf-' + (c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clip' + n);
    const frame = side => {
      const tf = [];
      if (c.props.x?.on || c.props.y?.on)
        tf.push(`translate(${c.props.x?.on ? c.props.x[side] : 0}px, ${c.props.y?.on ? c.props.y[side] : 0}px)`);
      if (c.props.scale?.on) tf.push(`scale(${c.props.scale[side]})`);
      if (c.props.scaleX?.on) tf.push(`scaleX(${c.props.scaleX[side]})`);
      if (c.props.scaleY?.on) tf.push(`scaleY(${c.props.scaleY[side]})`);
      if (c.props.rotation?.on) tf.push(`rotate(${c.props.rotation[side]}deg)`);
      if (c.props.skewX?.on) tf.push(`skewX(${c.props.skewX[side]}deg)`);
      if (c.props.skewY?.on) tf.push(`skewY(${c.props.skewY[side]}deg)`);
      const fl = FILTER_KEYS.filter(k => c.props[k]?.on).map(k => FILTER_FN[k](c.props[k][side]));
      const lines = [];
      if (tf.length) lines.push(`    transform: ${tf.join(' ')};`);
      if (c.props.opacity?.on) lines.push(`    opacity: ${c.props.opacity[side]};`);
      if (fl.length) lines.push(`    filter: ${fl.join(' ')};`);
      return lines.join('\n');
    };
    css += `@keyframes ${name} {\n  from {\n${frame('from')}\n  }\n  to {\n${frame('to')}\n  }\n}\n\n`;
    const sel = clipSelector(c);
    const dir = c.timing.yoyo ? 'alternate' : 'normal';
    const rep = c.timing.repeat < 0 ? 'infinite' : (c.timing.repeat + 1);
    css += `${sel} {\n  animation: ${name} ${c.timing.duration}s ${cssEase(c.timing)} ${c.timing.delay}s ${rep} ${dir} both;\n`;
    if (c.props.__origin?.from) css += `  transform-origin: ${c.props.__origin.from};\n`;
    css += `  transform-box: fill-box;\n}\n\n`;
  });
  if (!any) css += '/* Nothing here yet — add a clip that uses transform, opacity or a filter. */\n';
  css += `@media (prefers-reduced-motion: reduce) {\n  #saf-root * { animation: none !important; }\n}\n`;
  return css;
}

function cssEase(t) {
  const map = {
    none: 'linear', power1: 'cubic-bezier(.25,.46,.45,.94)', power2: 'cubic-bezier(.22,.61,.36,1)',
    power3: 'cubic-bezier(.16,.84,.44,1)', power4: 'cubic-bezier(.12,.9,.4,1)',
    sine: 'cubic-bezier(.39,.58,.57,1)', expo: 'cubic-bezier(.19,1,.22,1)',
    circ: 'cubic-bezier(.08,.82,.17,1)', back: 'cubic-bezier(.34,1.56,.64,1)',
    elastic: 'cubic-bezier(.34,1.56,.64,1)', bounce: 'cubic-bezier(.34,1.56,.64,1)',
    steps: 'steps(12)', slow: 'ease-in-out', rough: 'linear',
  };
  let e = map[t.ease] || 'ease-out';
  if (t.dir === 'in' && t.ease.startsWith('power')) e = 'cubic-bezier(.55,.06,.68,.19)';
  if (t.dir === 'inOut' && t.ease.startsWith('power')) e = 'cubic-bezier(.65,.05,.36,1)';
  return e;
}
