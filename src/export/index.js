/* =====================================================================
   CODE EXPORT — the tabbed sheet and its syntax highlighting
   ===================================================================== */
import { S, $, esc, round, toast } from '../state.js';
import { rebuild } from '../timeline.js';
import { genGSAP } from './gsap-export.js';
import { genHTML } from './html.js';
import { genWP } from './wp.js';
import { genCSS } from './css.js';
import { svgSource } from './svg.js';
import { animatedBounds } from '../bounds.js';
import { genSMIL, smilGaps } from './smil.js';
import { DOCS } from './docs.js';

export const TABS = [
  { id: 'gsap', label: 'GSAP JS',            ext: 'js',   gen: () => genGSAP() },
  { id: 'smil', label: 'Animated SVG',       ext: 'svg',  gen: genSMIL },
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

const li = arr => arr.map(s => `<li>${esc(s)}</li>`).join('');

function renderDoc(id) {
  const d = DOCS[id];
  const box = $('#expDoc');
  if (!d) { box.innerHTML = ''; return; }
  // The SMIL export is the one whose losses depend on what you built, so it
  // reports them against the actual timeline rather than in the abstract.
  const gaps = id === 'smil' ? smilGaps() : [];
  box.innerHTML = `
    <div class="doc-head"><span class="tag">${esc(d.tag)}</span></div>
    <p class="doc-what">${d.what}</p>
    ${gaps.length ? `<div class="doc-warn"><b>Dropped from this animation:</b><ul>${li(gaps)}</ul></div>` : ''}
    <div class="doc-cols">
      <div><h5>Can</h5><ul class="doc-can">${li(d.can)}</ul></div>
      <div><h5>Can't</h5><ul class="doc-cant">${li(d.cant)}</ul></div>
    </div>
    <details class="doc-embed"><summary>How to put this on a page</summary><pre>${esc(d.embed)}</pre></details>`;
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
  renderDoc(activeTab);
  renderTrimInfo();
  $('#modal').classList.add('on');
}

/* Show what the trim actually did, so the framing is never a mystery. */
function renderTrimInfo() {
  const o = S.exportOpts;
  $('#trimOn').checked = o.trim;
  $('#trimPad').value = o.pad;
  $('#trimPad').disabled = !o.trim;
  const doc = (S.svg?.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (!o.trim) {
    $('#trimInfo').textContent = doc.length === 4 ? `artboard ${round(doc[2], 1)} × ${round(doc[3], 1)}` : '';
    return;
  }
  const b = animatedBounds({ pad: o.pad || 0 });
  $('#trimInfo').textContent = b
    ? `cropped to ${round(b.w, 1)} × ${round(b.h, 1)} — covers every frame of the animation`
    : 'nothing to trim to';
}

export function bindExportOptions() {
  $('#trimOn').onchange = e => { S.exportOpts.trim = e.target.checked; openExport(); };
  $('#trimPad').oninput = e => {
    S.exportOpts.pad = Math.max(0, parseInt(e.target.value, 10) || 0);
    openExport();
  };
}

export function setActiveTab(id) { activeTab = id; }
export function currentTab() { return TABS.find(x => x.id === activeTab); }
