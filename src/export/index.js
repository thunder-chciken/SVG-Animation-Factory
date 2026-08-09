/* =====================================================================
   CODE EXPORT — the tabbed sheet and its syntax highlighting
   ===================================================================== */
import { S, $, esc, toast } from '../state.js';
import { rebuild } from '../timeline.js';
import { genGSAP } from './gsap-export.js';
import { genHTML } from './html.js';
import { genWP } from './wp.js';
import { genCSS } from './css.js';
import { svgSource } from './svg.js';

export const TABS = [
  { id: 'gsap', label: 'GSAP JS',            ext: 'js',   gen: () => genGSAP() },
  { id: 'html', label: 'Standalone HTML',    ext: 'html', gen: genHTML },
  { id: 'wp',   label: 'WordPress / Bricks', ext: 'php',  gen: genWP },
  { id: 'css',  label: 'CSS keyframes',      ext: 'css',  gen: genCSS },
  { id: 'svg',  label: 'Indexed SVG',        ext: 'svg',  gen: svgSource },
];

let activeTab = 'gsap';

function highlight(code) {
  return esc(code)
    .replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tok-c">$1</span>')
    .replace(/(&quot;|&#039;|')([^'\n]*?)\1/g, '<span class="tok-s">$1$2$1</span>')
    .replace(/\b(const|let|var|function|return|if|else|new|=&gt;|true|false|null|document|window)\b/g, '<span class="tok-k">$1</span>')
    .replace(/\b(gsap|tl|ScrollTrigger|MotionPathPlugin)\b/g, '<span class="tok-f">$1</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="tok-n">$1</span>');
}

export function openExport() {
  if (!S.svg) { toast('Load an SVG first.', 'err'); return; }
  if (S.clips.some(c => c._start === undefined)) rebuild(true);
  $('#expTabs').innerHTML = TABS.map(t =>
    `<button class="tab ${t.id === activeTab ? 'on' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
  const t = TABS.find(x => x.id === activeTab);
  const code = t.gen();
  $('#expCode').innerHTML = highlight(code);
  $('#expCode').dataset.raw = code;
  $('#expNote').textContent = `${S.clips.filter(c => c.enabled).length} clip(s) · ${code.split('\n').length} lines`;
  $('#modal').classList.add('on');
}

export function setActiveTab(id) { activeTab = id; }
export function currentTab() { return TABS.find(x => x.id === activeTab); }
