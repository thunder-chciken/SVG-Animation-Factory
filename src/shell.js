/* =====================================================================
   APP SHELL — topbar, dropzone, stage toolbar, export sheet, shortcuts
   ===================================================================== */
import { S, $, $$, toast } from './state.js';
import { loadSVG } from './ingest.js';
import { select, nudge, resetPositions, deleteSelected } from './selection.js';
import { splitText, splitCompoundPath } from './separate.js';
import { openPaint } from './paint.js';
import { rebuild } from './timeline.js';
import { renderAll } from './render.js';
import { openExport, setActiveTab, currentTab } from './export/index.js';
import { openProjectText, flushSession } from './project.js';
import { saveProject } from './menu.js';
import { undo, redo, canUndo, canRedo, onHistoryChange, resetHistory } from './history.js';
import { openIcons } from './icons.js';
import { openText } from './text.js';
import { isPanning } from './viewport.js';
import { resetWorkspace } from './workspace.js';
import { applyWorkspaceOpen } from './ui.js';
import { SAMPLE } from './sample.js';

export function bindTop() {
  /* ---------- undo / redo ---------- */
  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;
  onHistoryChange(() => {
    $('#btnUndo').disabled = !canUndo();
    $('#btnRedo').disabled = !canRedo();
  });

  /* ---------- loading SVG ---------- */
  // Replacing the document starts a new history — undoing across a file
  // swap would restore clips that point at elements no longer present.
  const freshLoad = (src, name) => { loadSVG(src, name); resetHistory(); };

  $('#btnOpen').onclick = () => $('#file').click();
  $('#btnIcons').onclick = openIcons;
  $('#file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => freshLoad(r.result, f.name);
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
    if (!f) { const txt = e.dataTransfer.getData('text'); if (txt) freshLoad(txt, 'pasted.svg'); return; }
    if (/json$/i.test(f.name)) {
      const r = new FileReader();
      r.onload = () => { if (openProjectText(r.result)) resetHistory(); };
      r.readAsText(f); return;
    }
    if (!/svg/.test(f.type) && !/\.svg$/i.test(f.name)) { toast('That file is not an SVG.', 'err'); return; }
    const r = new FileReader(); r.onload = () => freshLoad(r.result, f.name); r.readAsText(f);
  });
  document.addEventListener('paste', e => {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const txt = e.clipboardData.getData('text');
    if (txt && txt.includes('<svg')) { freshLoad(txt, 'pasted.svg'); e.preventDefault(); }
  });
  $('#btnPaste').onclick = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt.includes('<svg')) freshLoad(txt, 'pasted.svg');
      else toast('Clipboard has no SVG markup.', 'err');
    } catch (err) { toast('Press Ctrl+V instead — clipboard access was blocked.', 'err'); }
  };
  $('#btnSample').onclick = () => freshLoad(SAMPLE, 'sample.svg');
  $('#btnReset').onclick = () => {
    if (!S.raw) return;
    if (!confirm('Discard all clips and reload the original file?')) return;
    freshLoad(S.raw, S.fileName);
  };

  $('#btnResetPanels').onclick = () => { resetWorkspace(); applyWorkspaceOpen(); renderAll(); };

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
  $('#btnDelete').onclick = deleteSelected;
  $('#btnText').onclick = openText;

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    // Undo works even from a focused field — nothing else in the app claims it.
    if (mod && key === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && key === 'y') { e.preventDefault(); redo(); return; }

    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); if (!isPanning()) $('#tPlay').click(); }
    if (e.key === 'Escape') {
      select([]);
      $('#modal').classList.remove('on');
      $('#iconModal').classList.remove('on');
      $('#textPop').classList.remove('on');
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (S.sel.size) deleteSelected();
      else if (S.activeClip) {
        S.clips = S.clips.filter(c => c.id !== S.activeClip); S.activeClip = null; rebuild(); renderAll();
      }
    }
    if (e.key.startsWith('Arrow') && S.sel.size) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0,
            e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
    }
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); openPaint(); }
    if (key === 'i' && !mod) { e.preventDefault(); openIcons(); }
    if (key === 't' && !mod) { e.preventDefault(); openText(); }
    if (mod && key === 'a') { e.preventDefault(); select(S.items.map(i => i.uid)); }
    if (mod && key === 'e') { e.preventDefault(); openExport(); }
    if (mod && key === 's') { e.preventDefault(); saveProject({ as: e.shiftKey }); }
  });
}
