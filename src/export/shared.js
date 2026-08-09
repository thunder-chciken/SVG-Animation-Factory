/* Pieces every exporter needs: how to name a target in CSS, and how to
   turn a clip's props into a source-code literal. */
import { S, round } from '../state.js';
import { FILTER_KEYS, FILTER_FN } from '../filters.js';

export const selFor = id => /^[A-Za-z_][\w-]*$/.test(id) ? '#' + id : `[id="${id}"]`;

export function clipSelector(clip) {
  return clip.targets.map(u => S.byUid.get(u)).filter(Boolean)
    .map(r => selFor(r.node.getAttribute('id'))).join(', ');
}

export function exportVars(clip, side) {
  const o = {}; const P = clip.props;
  ['x', 'y', 'xPercent', 'yPercent', 'scale', 'scaleX', 'scaleY', 'rotation', 'rotationX', 'rotationY',
   'skewX', 'skewY', 'perspective', 'opacity', 'fill', 'stroke', 'strokeWidth'].forEach(k => {
    if (P[k]?.on) o[k] = P[k][side];
  });
  const uf = FILTER_KEYS.filter(k => P[k]?.on);
  if (uf.length) o.filter = uf.map(k => FILTER_FN[k](round(P[k][side], 3))).join(' ');
  if (P.__origin?.from) (clip.svgOrigin ? o.svgOrigin = P.__origin.from.replace(/%/g, '') : o.transformOrigin = P.__origin.from);
  if (P.drawStart?.on || P.drawEnd?.on || P.dashGap?.on) {
    const s = P.drawStart?.on ? P.drawStart[side] : 0;
    const e = P.drawEnd?.on ? P.drawEnd[side] : 1;
    const g = P.dashGap?.on ? P.dashGap.to : 0;
    o.strokeDasharray = `__RAW__dash(${round(s, 3)}, ${round(e, 3)}, ${g})`;
    o.strokeDashoffset = `__RAW__off(${round(s, 3)})`;
  }
  return o;
}

/* __RAW__ marks a value that must land in the output as an expression
   rather than a quoted string. */
export function srcVars(o) {
  const parts = [];
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.startsWith('__RAW__')) parts.push(`${k}: ${v.slice(7)}`);
    else if (typeof v === 'string') parts.push(`${k}: ${JSON.stringify(v)}`);
    else parts.push(`${k}: ${round(v, 4)}`);
  }
  return '{ ' + parts.join(', ') + ' }';
}
