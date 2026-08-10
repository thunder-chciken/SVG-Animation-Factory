/* =====================================================================
   ARTWORK BOUNDS — Photoshop's Image ▸ Trim, for an animation

   The exported viewBox is the crop. On the stage the SVG is drawn with
   overflow:visible, so anything hanging outside the artboard still shows
   while you work — then the export clips it and part of the graphic
   disappears.

   A static bounding box is not enough either. A clip that slides an
   element 200px to the left puts it outside the box for most of its
   playback, so the frame has to cover every position the artwork ever
   occupies. The timeline is sampled across its whole length and the boxes
   are unioned, which also picks up static transforms for free.
   ===================================================================== */
import { S, round } from './state.js';

const SAMPLES = 24;

/* Screen rect → root user space. getBoundingClientRect is used rather than
   getBBox because it already includes every transform GSAP has applied,
   whichever way GSAP chose to apply it. */
function toUser(rect, inv) {
  const p = (x, y) => ({ x: inv.a * x + inv.c * y + inv.e, y: inv.b * x + inv.d * y + inv.f });
  const cs = [p(rect.left, rect.top), p(rect.right, rect.top),
              p(rect.left, rect.bottom), p(rect.right, rect.bottom)];
  const xs = cs.map(c => c.x), ys = cs.map(c => c.y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

function measure(acc) {
  let inv;
  try { inv = S.svg.getScreenCTM().inverse(); } catch (e) { return; }
  S.items.forEach(rec => {
    if (rec.hidden || !rec.node.isConnected) return;
    // Groups are covered by their children; measuring both just doubles work.
    if (rec.kind === 'group') return;
    let r;
    try { r = rec.node.getBoundingClientRect(); } catch (e) { return; }
    if (!r.width && !r.height) return;
    const b = toUser(r, inv);
    if (!isFinite(b.x1) || !isFinite(b.y1)) return;
    acc.x1 = Math.min(acc.x1, b.x1); acc.y1 = Math.min(acc.y1, b.y1);
    acc.x2 = Math.max(acc.x2, b.x2); acc.y2 = Math.max(acc.y2, b.y2);
  });
}

/* Union of the artwork's bounds across the entire animation.
   Returns null when there is nothing measurable. */
export function animatedBounds({ samples = SAMPLES, pad = 0 } = {}) {
  if (!S.svg || !S.items.length) return null;

  const acc = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  const tl = S.tl;
  const loops = S.loopTweens || [];

  // remember exactly where the user left the playhead
  const wasTime = tl ? tl.time() : 0;
  const wasPaused = tl ? tl.paused() : true;
  const loopTimes = loops.map(t => t.time());

  const dur = tl ? tl.duration() : 0;
  if (dur > 0 || loops.length) {
    for (let i = 0; i <= samples; i++) {
      const f = i / samples;
      if (tl && dur > 0) tl.pause(f * dur);
      loops.forEach(t => t.pause(f * (t.duration() || 0)));
      measure(acc);
    }
  } else {
    measure(acc);
  }

  // put the playhead back
  if (tl) { tl.pause(wasTime); if (!wasPaused) tl.play(); }
  loops.forEach((t, i) => { t.pause(loopTimes[i]); if (!wasPaused) t.play(); });

  if (!isFinite(acc.x1) || acc.x2 <= acc.x1 || acc.y2 <= acc.y1) return null;

  return {
    x: round(acc.x1 - pad, 3),
    y: round(acc.y1 - pad, 3),
    w: round((acc.x2 - acc.x1) + pad * 2, 3),
    h: round((acc.y2 - acc.y1) + pad * 2, 3),
  };
}

/* The viewBox an export should use: the trimmed box when trimming is on and
   there is something to trim to, otherwise the document's own artboard. */
export function exportViewBox() {
  const o = S.exportOpts;
  if (o.trim) {
    const b = animatedBounds({ pad: o.pad || 0 });
    if (b) return b;
  }
  const [x, y, w, h] = (S.svg?.getAttribute('viewBox') || '0 0 300 150')
    .trim().split(/[\s,]+/).map(Number);
  return { x, y, w, h };
}

export const vbString = b => `${b.x} ${b.y} ${b.w} ${b.h}`;
