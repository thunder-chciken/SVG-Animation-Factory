/* Small pure template helpers shared by the inspector and the preset
   library. Kept apart from inspector.js so presets.js can use sect()
   without the two importing each other. */
import { S, esc } from './state.js';

export const OPEN_SECT = new Set(['presets', 'timing', 'pos', 'look']);

export function sect(id, title, inner) {
  const open = OPEN_SECT.has(id);
  return `<div class="sect ${open ? '' : 'closed'}" data-sect="${id}">
    <div class="shead"><span class="ar">▼</span>${esc(title)}</div>
    <div class="sbody">${inner}</div></div>`;
}

export function ctlRow(label, key, val, min, max, step, unit) {
  return `<div class="ctl"><label>${label}</label>
    <input type="range" data-t="${key}" min="${min}" max="${max}" step="${step}" value="${val}">
    <input type="number" data-t="${key}" value="${val}" step="${step}" title="${unit}">
  </div>`;
}

export function propRow(clip, p) {
  const v = clip.props[p.k];
  if (p.t === 'col') {
    return `<div class="prop ${v.on ? 'act' : ''}" data-p="${p.k}">
      <input type="checkbox" data-on="${p.k}" ${v.on ? 'checked' : ''}>
      <label>${p.l}</label>
      <div class="fields">
        <input type="color" data-f="${p.k}" value="${v.from}">
        <span class="ar">→</span>
        <input type="color" data-to="${p.k}" value="${v.to}">
      </div></div>`;
  }
  const sv = S.sliderTarget === 'from' ? v.from : v.to;
  return `<div class="prop ${v.on ? 'act' : ''}" data-p="${p.k}">
    <input type="checkbox" data-on="${p.k}" ${v.on ? 'checked' : ''}>
    <label title="${p.l} (${p.u || ''})">${p.l}</label>
    <div class="fields">
      <input type="number" data-f="${p.k}" value="${v.from}" step="${p.step}">
      <span class="ar">→</span>
      <input type="number" data-to="${p.k}" value="${v.to}" step="${p.step}">
    </div>
    <input class="sl ${S.sliderTarget === 'from' ? 'blue' : ''}" type="range" data-sl="${p.k}"
      min="${p.min}" max="${p.max}" step="${p.step}" value="${sv}">
  </div>`;
}
