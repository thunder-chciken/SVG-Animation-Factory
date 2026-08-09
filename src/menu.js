/* =====================================================================
   FILE MENU
   The usual New / Open / Save / Save As / Save a Copy set, plus Export as
   and Open Recent.

   Save and Save As mean what they mean in a desktop app: where the File
   System Access API exists, the studio holds the file handle, so Save
   writes straight back to the file you opened instead of dropping another
   numbered copy in Downloads. Everywhere else it falls back to a download
   and Save behaves like Save As.
   ===================================================================== */
import { S, $, esc, toast } from './state.js';
import { serialize, openProjectText, clearSession, flushSession } from './project.js';
import { loadSVG, clearStage } from './ingest.js';
import { resetHistory } from './history.js';
import { exportRaster } from './raster.js';
import { openExport } from './export/index.js';
import { SAMPLE } from './sample.js';

const RECENT_KEY = 'saf:recent:v1';
const RECENT_MAX = 8;
const RECENT_BUDGET = 4e6;      // keep the whole list well inside quota

let fileHandle = null;          // File System Access handle for the open project
const canPickFiles = typeof window.showSaveFilePicker === 'function';

/* ---------------------------------------------------------------------
   Recent projects
   --------------------------------------------------------------------- */
function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch (e) { return []; }
}

function writeRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); }
  catch (e) {
    // Trim hardest-first until it fits, rather than losing the list entirely.
    while (list.length > 1) {
      list.pop();
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); return; }
      catch (err) { /* keep trimming */ }
    }
  }
}

function rememberRecent(name, json) {
  if (!json) return;
  let list = readRecent().filter(r => r.name !== name);
  list.unshift({ name, at: new Date().toISOString(), json });
  list = list.slice(0, RECENT_MAX);
  let total = 0;
  list = list.filter(r => { total += r.json.length; return total < RECENT_BUDGET; });
  writeRecent(list);
}

export function clearRecent() { writeRecent([]); }

/* ---------------------------------------------------------------------
   Saving
   --------------------------------------------------------------------- */
function projectJSON() {
  const p = serialize();
  return p ? JSON.stringify(p, null, 2) : null;
}

const suggestedName = () =>
  (S.fileName.replace(/\.(svg|saf\.json|json)$/i, '') || 'project') + '.saf.json';

function download(json, name) {
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function writeHandle(handle, json) {
  const w = await handle.createWritable();
  await w.write(json);
  await w.close();
}

export async function saveProject({ as = false, copy = false } = {}) {
  const json = projectJSON();
  if (!json) { toast('Nothing to save yet.', 'err'); return; }

  if (!copy) rememberRecent(S.fileName || 'project', json);
  flushSession();

  if (!canPickFiles) {
    download(json, suggestedName());
    toast(copy ? 'Copy downloaded' : 'Project downloaded', 'ok');
    return;
  }

  try {
    if (copy || as || !fileHandle) {
      const handle = await window.showSaveFilePicker({
        suggestedName: copy ? suggestedName().replace(/\.saf\.json$/, ' copy.saf.json') : suggestedName(),
        types: [{ description: 'SVG Animation Factory project', accept: { 'application/json': ['.json'] } }],
      });
      await writeHandle(handle, json);
      // A copy is a detour — it must not steal the handle Save writes to.
      if (!copy) { fileHandle = handle; S.fileName = handle.name; $('#stat').textContent = handle.name; }
      toast(copy ? 'Copy saved' : `Saved ${handle.name}`, 'ok');
    } else {
      await writeHandle(fileHandle, json);
      toast(`Saved ${fileHandle.name}`, 'ok');
    }
  } catch (e) {
    if (e.name === 'AbortError') return;       // the picker was dismissed
    download(json, suggestedName());
    toast('Saved to Downloads instead', 'ok');
  }
}

/* ---------------------------------------------------------------------
   Opening
   --------------------------------------------------------------------- */
function readAs(file, done) {
  const r = new FileReader();
  r.onload = () => done(r.result);
  r.readAsText(file);
}

export function openFromFile(file) {
  if (!file) return;
  if (/\.json$/i.test(file.name)) {
    readAs(file, txt => { if (openProjectText(txt)) { resetHistory(); rememberRecent(S.fileName, txt); } });
  } else if (/svg/i.test(file.type) || /\.svg$/i.test(file.name)) {
    readAs(file, txt => { loadSVG(txt, file.name); resetHistory(); fileHandle = null; });
  } else {
    toast('That is not an SVG or a .saf.json project.', 'err');
  }
}

function openRecentAt(i) {
  const r = readRecent()[i];
  if (!r) return;
  if (openProjectText(r.json)) { resetHistory(); fileHandle = null; }
}

/* ---------------------------------------------------------------------
   The menu itself
   --------------------------------------------------------------------- */
const ITEM = (act, label, extra = '') =>
  `<button class="mi" data-act="${act}" ${extra}>${esc(label)}</button>`;

function submenuRecent() {
  const list = readRecent();
  if (!list.length) return `<div class="mi disabled">No recent projects</div>`;
  return list.map((r, i) =>
    `<button class="mi" data-act="recent" data-i="${i}">${esc(r.name)}
       <span class="mi-note">${esc(r.at.slice(0, 10))}</span></button>`).join('')
    + `<div class="msep"></div>` + ITEM('clearRecent', 'Clear list');
}

function render() {
  $('#fileMenu').innerHTML = `
    ${ITEM('new', 'New…')}
    ${ITEM('open', 'Open…')}
    <div class="mgap"></div>
    <div class="mi has-sub" data-sub="export">Export as<span class="mi-arrow">›</span>
      <div class="msub">
        ${ITEM('png2', 'PNG  ·  2×')}
        ${ITEM('png4', 'PNG  ·  4×')}
        ${ITEM('jpg2', 'JPEG  ·  2×')}
        <div class="msep"></div>
        ${ITEM('code', 'Code / Animated SVG…')}
      </div>
    </div>
    <div class="mi has-sub" data-sub="recent">Open Recent<span class="mi-arrow">›</span>
      <div class="msub">${submenuRecent()}</div>
    </div>
    <div class="msep"></div>
    ${ITEM('close', 'Close')}
    ${ITEM('closeAll', 'Close All')}
    <div class="mgap"></div>
    ${ITEM('save', 'Save')}
    ${ITEM('saveAs', 'Save As…')}
    ${ITEM('saveCopy', 'Save a Copy…')}
    <div class="msep"></div>
    ${ITEM('sample', 'Load sample artwork')}`;
}

function close() { $('#fileMenu').classList.remove('on'); $('#btnFile').classList.remove('on'); }

function open() {
  render();
  $('#fileMenu').classList.add('on');
  $('#btnFile').classList.add('on');
}

function blankDocument(msg) {
  clearStage();
  clearSession();
  resetHistory();
  fileHandle = null;
  toast(msg);
}

const ACTIONS = {
  new: () => {
    if (S.svg && !confirm('Start a new project? Anything unsaved will be lost.')) return;
    blankDocument('New project');
  },
  open: () => $('#menuFile').click(),
  png2: () => exportRaster('png', 2),
  png4: () => exportRaster('png', 4),
  jpg2: () => exportRaster('jpeg', 2),
  code: () => openExport(),
  close: () => {
    if (S.svg && !confirm('Close this project? Anything unsaved will be lost.')) return;
    blankDocument('Closed');
  },
  closeAll: () => {
    if (!confirm('Close the project and clear the recent list?')) return;
    clearRecent();
    blankDocument('Closed everything');
  },
  save: () => saveProject(),
  saveAs: () => saveProject({ as: true }),
  saveCopy: () => saveProject({ copy: true }),
  sample: () => { loadSVG(SAMPLE, 'sample.svg'); resetHistory(); fileHandle = null; },
  clearRecent: () => { clearRecent(); toast('Recent list cleared'); },
};

export function bindMenu() {
  $('#btnFile').onclick = e => {
    e.stopPropagation();
    $('#fileMenu').classList.contains('on') ? close() : open();
  };

  $('#fileMenu').addEventListener('click', e => {
    const rec = e.target.closest('[data-act="recent"]');
    if (rec) { close(); openRecentAt(+rec.dataset.i); return; }
    const item = e.target.closest('[data-act]');
    if (!item) return;
    const fn = ACTIONS[item.dataset.act];
    if (!fn) return;
    close();
    fn();
  });

  $('#menuFile').onchange = e => { openFromFile(e.target.files[0]); e.target.value = ''; };

  document.addEventListener('click', e => {
    if (!e.target.closest('#fileMenu') && !e.target.closest('#btnFile')) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}
