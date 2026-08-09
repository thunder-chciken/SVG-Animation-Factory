/* =====================================================================
   PERSISTENCE — everything stays on the user's machine.
   Two layers: a debounced localStorage session so a reload never loses
   work, and an explicit .saf.json file for keeping or moving a project.
   ===================================================================== */
import { S, toast, onDirty } from './state.js';
import { mountSVG, maxUid } from './ingest.js';
import { buildTimeline } from './timeline.js';
import { renderAll } from './render.js';

const KEY = 'saf:session:v1';
const FORMAT = 'saf-project';
const VERSION = 1;

/* The stage markup as it stands, uids intact — reloading it lets every
   clip find its targets again. */
function liveMarkup() {
  return S.svg ? new XMLSerializer().serializeToString(S.svg) : '';
}

export function serialize() {
  if (!S.svg) return null;
  return {
    format: FORMAT,
    version: VERSION,
    savedAt: new Date().toISOString(),
    fileName: S.fileName,
    svg: liveMarkup(),
    clips: S.clips,
    trigger: S.trigger,
    loop: S.loop,
    hidden: S.items.filter(i => i.hidden).map(i => i.uid),
    uid: S.uid,
    clipId: S.clipId,
    gradId: S.gradId,
  };
}

export function applyProject(p) {
  if (!p || p.format !== FORMAT) throw new Error('That is not an SVG Animation Factory project file.');
  if (!p.svg) throw new Error('That project file has no SVG in it.');
  if (!mountSVG(p.svg, p.fileName || 'project.svg')) throw new Error('The project SVG could not be parsed.');

  S.clips = Array.isArray(p.clips) ? p.clips : [];
  if (p.trigger) Object.assign(S.trigger, p.trigger);
  S.loop = p.loop !== false;
  S.clipId = Math.max(p.clipId || 0, S.clips.length);
  S.uid = Math.max(p.uid || 0, maxUid());
  S.gradId = p.gradId || 0;

  (p.hidden || []).forEach(uid => {
    const rec = S.byUid.get(uid);
    if (rec) { rec.hidden = true; rec.node.style.display = 'none'; }
  });

  buildTimeline();
  renderAll();
  return S.clips.length;
}

/* ---------- session autosave ---------- */
let saveTimer = null;

function writeSession() {
  try {
    const p = serialize();
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch (e) {
    // A quota error on a very large file is not worth interrupting the user
    // over — the explicit Save button is still there.
    console.warn('Session autosave skipped:', e.message);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeSession, 1200);
}

export function flushSession() {
  clearTimeout(saveTimer);
  writeSession();
}

export function clearSession() {
  clearTimeout(saveTimer);
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clean up */ }
}

export function readSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

/* Restore the last session. Returns true when something was put on stage. */
export function restoreSession() {
  const p = readSession();
  if (!p) return false;
  try {
    const n = applyProject(p);
    toast(`Restored your last session — ${S.items.length} elements, ${n} clip${n === 1 ? '' : 's'}`, 'ok');
    return true;
  } catch (e) {
    console.warn('Could not restore session:', e.message);
    clearSession();
    return false;
  }
}

export function initPersistence() {
  onDirty(scheduleSave);
  window.addEventListener('beforeunload', flushSession);
  // Tab-switch on mobile often never fires beforeunload.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSession();
  });
}

/* ---------- explicit project files ---------- */
export function downloadProject() {
  const p = serialize();
  if (!p) { toast('Load an SVG first.', 'err'); return; }
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (S.fileName.replace(/\.svg$/i, '') || 'project') + '.saf.json';
  a.click();
  URL.revokeObjectURL(a.href);
  flushSession();
  toast('Project saved', 'ok');
}

export function openProjectText(text) {
  let p;
  try { p = JSON.parse(text); }
  catch (e) { toast('That file is not valid JSON.', 'err'); return false; }
  try {
    const n = applyProject(p);
    flushSession();
    toast(`Opened ${S.fileName} — ${n} clip${n === 1 ? '' : 's'}`, 'ok');
    return true;
  } catch (e) {
    toast(e.message, 'err');
    return false;
  }
}
