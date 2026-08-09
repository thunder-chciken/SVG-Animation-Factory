/* =====================================================================
   APP SHELL — topbar, dropzone, stage toolbar, export sheet, shortcuts
   ===================================================================== */
import { S, $, $$, toast } from './state.js';
import { loadSVG, clearStage } from './ingest.js';
import { select, nudge, resetPositions } from './selection.js';
import { splitText, splitCompoundPath } from './separate.js';
import { openPaint } from './paint.js';
import { rebuild } from './timeline.js';
import { renderAll } from './render.js';
import { openExport, setActiveTab, currentTab } from './export/index.js';
import { downloadProject, openProjectText, clearSession, flushSession } from './project.js';
import { SAMPLE } from './sample.js';

export function bindTop() {
  /* ---------- loading SVG ---------- */
  $('#btnOpen').onclick = () => $('#file').click();
  $('#file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => loadSVG(r.result, f.name);
    r.readAsText(f);
    e.target.value = '';
  };
  const drop = $('#drop');
  drop.onclick = () => $('#file').click();
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('over');
  }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (!f) { const txt = e.dataTransfer.getData('text'); if (txt) loadSVG(txt, 'pasted.svg'); return; }
    if (/json$/i.test(f.name)) {
      const r = new FileReader(); r.onload = () => openProjectText(r.result); r.readAsText(f); return;
    }
    if (!/svg/.test(f.type) && !/\.svg$/i.test(f.name)) { toast('That file is not an SVG.', 'err'); return; }
    const r = new FileReader(); r.onload = () => loadSVG(r.result, f.name); r.readAsText(f);
  });
  document.addEventListener('paste', e => {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const txt = e.clipboardData.getData('text');
    if (txt && txt.includes('<svg')) { loadSVG(txt, 'pasted.svg'); e.preventDefault(); }
  });
  $('#btnPaste').onclick = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt.includes('<svg')) loadSVG(txt, 'pasted.svg');
      else toast('Clipboard has no SVG markup.', 'err');
    } catch (err) { toast('Press Ctrl+V instead — clipboard access was blocked.', 'err'); }
  };
  $('#btnSample').onclick = () => loadSVG(SAMPLE, 'sample.svg');
  $('#btnReset').onclick = () => {
    if (!S.raw) return;
    if (!confirm('Discard all clips and reload the original file?')) return;
    loadSVG(S.raw, S.fileName);
  };

  /* ---------- projects ---------- */
  $('#btnNew').onclick = () => {
    if (S.svg && !confirm('Clear the stage and discard this project?')) return;
    clearStage(); clearSession();
    toast('Cleared');
  };
  $('#btnSaveProj').onclick = downloadProject;
  $('#btnOpenProj').onclick = () => $('#projFile').click();
  $('#projFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => openProjectText(r.result);
    r.readAsText(f);
    e.target.value = '';
  };

  /* ---------- export sheet ---------- */
  $('#btnExport').onclick = openExport;
  $('#btnCloseModal').onclick = () => $('#modal').classList.remove('on');
  $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.remove('on'); };
  $('#expTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    setActiveTab(b.dataset.tab); openExport();
  });
  $('#btnCopy').onclick = async () => {
    const code = $('#expCode').dataset.raw;
    try { await navigator.clipboard.writeText(code); toast('Copied to clipboard', 'ok'); }
    catch (err) {
      const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied to clipboard', 'ok');
    }
  };
  $('#btnDownload').onclick = () => {
    const t = currentTab();
    const blob = new Blob([$('#expCode').dataset.raw], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (S.fileName.replace(/\.svg$/i, '') || 'animation') + '.' + t.ext;
    a.click(); URL.revokeObjectURL(a.href);
  };

  /* ---------- stage toolbar ---------- */
  $('#segTool').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    S.tool = b.dataset.tool;
    $$('#segTool button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#btnSelAll').onclick = () => select(S.items.map(i => i.uid));
  $('#btnSelNone').onclick = () => select([]);
  $('#btnSelInv').onclick = () => select(S.items.map(i => i.uid).filter(u => !S.sel.has(u)));
  $('#btnSplitText').onclick = () => splitText('char');
  $('#btnSplitWords').onclick = () => splitText('word');
  $('#btnSplitPath').onclick = splitCompoundPath;
  $('#bgColor').oninput = e => {
    const w = $('#stagewrap'); w.classList.add('plain'); w.style.setProperty('--stagebg', e.target.value);
  };
  $('#btnGrid').onclick = () => $('#stagewrap').classList.toggle('plain');
  $('#btnPaint').onclick = () => openPaint();
  $('#btnResetPos').onclick = resetPositions;

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); $('#tPlay').click(); }
    if (e.key === 'Escape') { select([]); $('#modal').classList.remove('on'); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.activeClip) {
      e.preventDefault();
      S.clips = S.clips.filter(c => c.id !== S.activeClip); S.activeClip = null; rebuild(); renderAll();
    }
    if (e.key.startsWith('Arrow') && S.sel.size) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0,
            e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
    }
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); openPaint(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); select(S.items.map(i => i.uid)); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'e') { e.preventDefault(); openExport(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); flushSession(); downloadProject(); }
  });
}
