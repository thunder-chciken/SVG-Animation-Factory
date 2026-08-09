/* =====================================================================
   WORKSPACE
   How the studio is arranged, as opposed to what is in the document:
   the order of the inspector sections and which of them are open.

   Kept separate from the project session on purpose. Panel layout is a
   property of the person, not of the artwork — it should survive opening
   a different file, and it should not travel inside a .saf.json handed to
   someone else.
   ===================================================================== */
import { toast } from './state.js';

const KEY = 'saf:workspace:v1';

/* Every section the inspector can show, in the order it ships with.
   Anything missing from a saved order is appended, so adding a section in
   a later version does not vanish for people with a stored layout. */
export const DEFAULT_ORDER = [
  'presets', 'timing', 'loop', 'stagger', 'origin',
  'pos', 'scale', 'look', 'fx', 'draw', 'mp', 'trig',
];

export const DEFAULT_OPEN = ['presets', 'timing', 'loop', 'pos', 'look'];

export const WS = {
  order: [...DEFAULT_ORDER],
  open: [...DEFAULT_OPEN],
};

export function loadWorkspace() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const w = JSON.parse(raw);
    if (Array.isArray(w.order)) {
      const known = w.order.filter(id => DEFAULT_ORDER.includes(id));
      const missing = DEFAULT_ORDER.filter(id => !known.includes(id));
      WS.order = [...known, ...missing];
    }
    if (Array.isArray(w.open)) WS.open = w.open.slice();
  } catch (e) {
    console.warn('Workspace could not be read:', e.message);
  }
}

export function saveWorkspace() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ order: WS.order, open: WS.open }));
  } catch (e) { /* a full quota should never break the editor */ }
}

export function resetWorkspace() {
  WS.order = [...DEFAULT_ORDER];
  WS.open = [...DEFAULT_OPEN];
  saveWorkspace();
  toast('Panel layout reset', 'ok');
}

/* Move a section so it lands immediately before or after another. */
export function moveSection(id, targetId, before) {
  if (id === targetId) return false;
  const from = WS.order.indexOf(id);
  if (from < 0) return false;
  WS.order.splice(from, 1);
  let at = WS.order.indexOf(targetId);
  if (at < 0) { WS.order.splice(from, 0, id); return false; }
  WS.order.splice(before ? at : at + 1, 0, id);
  saveWorkspace();
  return true;
}
