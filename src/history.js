/* =====================================================================
   UNDO / REDO
   Snapshot-based rather than command-based: the studio mutates a live
   SVG DOM from a dozen places, so recording inverse operations for each
   one would be a standing invitation to miss one. A snapshot is whatever
   serialize() already produces for project files.

   Two things keep that affordable:
   · Markup and clip state are stored separately. Most edits only touch
     clips, so the (large) markup string is shared by reference between
     neighbouring snapshots and restoring skips the reparse entirely.
   · Commits are debounced, so dragging a slider produces one undo step
     per gesture instead of one per frame.
   ===================================================================== */
import { S, toast, onDirty } from './state.js';
import { serialize, applyProject, applyClipState, flushSession } from './project.js';
import { renderAll } from './render.js';

const LIMIT = 60;            // steps kept
const BYTE_BUDGET = 32e6;    // rough ceiling on retained snapshot text

let past = [];
let future = [];
let present = null;
let applying = false;        // guards against our own restore re-committing
let timer = null;
let listener = null;

function take() {
  const p = serialize();
  if (!p) return null;
  const svg = p.svg;
  delete p.svg;
  // serialize() stamps the save time. Left in, it would make every snapshot
  // differ from the last and turn no-op edits into undo steps.
  delete p.savedAt;
  return {
    svg,
    rest: JSON.stringify(p),
    sel: [...S.sel],
    activeClip: S.activeClip,
  };
}

const sameState = (a, b) => !!a && !!b && a.svg === b.svg && a.rest === b.rest;

function bytes(s) { return s.svg.length + s.rest.length; }

function trim() {
  while (past.length > LIMIT) past.shift();
  let total = past.reduce((n, s) => n + bytes(s), present ? bytes(present) : 0);
  while (past.length > 1 && total > BYTE_BUDGET) total -= bytes(past.shift());
}

function commit() {
  if (applying) return;
  const snap = take();
  if (!snap) return;
  if (sameState(snap, present)) {
    // Selection moved but nothing was actually edited — keep the pointer
    // fresh so an undo later returns to where the user is looking.
    present = snap;
    return;
  }
  // Neighbouring snapshots almost always share their markup. Pointing at the
  // same string instead of an equal copy keeps long sessions cheap.
  if (present && present.svg === snap.svg) snap.svg = present.svg;
  if (present) past.push(present);
  present = snap;
  future = [];
  trim();
  notify();
}

function restore(snap) {
  applying = true;
  try {
    const p = JSON.parse(snap.rest);
    if (S.svg && present && present.svg === snap.svg) {
      applyClipState(p);            // markup unchanged — no reparse needed
    } else {
      applyProject({ ...p, svg: snap.svg });
    }
    S.sel = new Set((snap.sel || []).filter(u => S.byUid.has(u)));
    S.activeClip = snap.activeClip && S.clips.some(c => c.id === snap.activeClip)
      ? snap.activeClip : null;
    renderAll();
  } finally {
    applying = false;
  }
  flushSession();
}

/* restore() compares the target against `present` to decide whether the
   markup needs reparsing, so `present` is only moved after it returns. */
export function undo() {
  if (!past.length) { toast('Nothing to undo'); return; }
  const target = past.pop();
  if (present) future.push(present);
  restore(target);
  present = target;
  notify();
  toast('Undo');
}

export function redo() {
  if (!future.length) { toast('Nothing to redo'); return; }
  const target = future.pop();
  if (present) past.push(present);
  restore(target);
  present = target;
  notify();
  toast('Redo');
}

export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;
export const depth = () => ({ past: past.length, future: future.length });

function notify() { if (listener) listener(); }
export function onHistoryChange(fn) { listener = fn; notify(); }

/* Start a fresh history — used when a whole new document is loaded. */
export function resetHistory() {
  past = []; future = []; present = take();
  notify();
}

export function initHistory() {
  present = take();
  onDirty(() => {
    if (applying) return;
    clearTimeout(timer);
    timer = setTimeout(commit, 450);
  });
  notify();
}
