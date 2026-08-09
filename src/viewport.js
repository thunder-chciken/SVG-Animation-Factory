/* =====================================================================
   CANVAS ZOOM + PAN
   Photoshop's navigation, on the stage container rather than the SVG's
   own viewBox — a CSS transform leaves the document's coordinate space
   untouched, so every exported number stays exactly what you authored.

   · Alt + middle-drag   scrubby zoom (right/up in, left/down out)
   · middle-drag         pan
   · Alt or Ctrl + wheel zoom toward the pointer
   · Space + drag        pan
   · wheel / shift-wheel scroll the canvas
   ===================================================================== */
import { S, $, clamp, round, toast } from './state.js';
import { renderOverlay } from './selection.js';

const MIN = 0.05, MAX = 64;

export function applyViewport() {
  const v = S.viewport;
  const st = $('#stage');
  st.style.transformOrigin = '50% 50%';
  st.style.transform = `translate(${round(v.x, 2)}px, ${round(v.y, 2)}px) scale(${round(v.zoom, 4)})`;
  const pct = $('#zoomPct');
  if (pct) pct.textContent = Math.round(v.zoom * 100) + '%';
  renderOverlay();
}

/* Zoom while holding one screen point still.

   With transform-origin at the element's centre, a screen point m maps back
   to local space as  local = origin + (m - origin - t) / z. Keeping that
   local point under m after the zoom rearranges to the line below. */
export function zoomAt(nextZoom, mx, my) {
  const v = S.viewport;
  const z2 = clamp(nextZoom, MIN, MAX);
  if (z2 === v.zoom) return;
  // #stage's own rect is already transformed, so take the fixed centre from
  // the wrapper instead.
  const wb = $('#stagewrap').getBoundingClientRect();
  const ox = wb.left + wb.width / 2, oy = wb.top + wb.height / 2;
  const dx = (mx ?? ox) - ox, dy = (my ?? oy) - oy;
  const k = z2 / v.zoom;
  v.x = dx - k * (dx - v.x);
  v.y = dy - k * (dy - v.y);
  v.zoom = z2;
  applyViewport();
}

export const zoomBy = (factor, mx, my) => zoomAt(S.viewport.zoom * factor, mx, my);

export function zoomReset() {
  S.viewport.zoom = 1; S.viewport.x = 0; S.viewport.y = 0;
  applyViewport();
}

/* "Fit" is the untransformed layout, which already letterboxes the artwork
   inside the stage — so fitting is just going back to 1:1 with no pan. */
export const zoomFit = zoomReset;

let NAV = null;      // middle-drag pan / scrubby zoom
let spaceHeld = false;

function beginNav(e, mode) {
  NAV = {
    mode,
    x0: e.clientX, y0: e.clientY,
    panX: S.viewport.x, panY: S.viewport.y,
    zoom0: S.viewport.zoom,
  };
  $('#stagewrap').style.cursor = mode === 'zoom' ? 'zoom-in' : 'grabbing';
}

function moveNav(e) {
  if (!NAV) return;
  const dx = e.clientX - NAV.x0, dy = e.clientY - NAV.y0;
  if (NAV.mode === 'pan') {
    S.viewport.x = NAV.panX + dx;
    S.viewport.y = NAV.panY + dy;
    applyViewport();
  } else {
    // Scrubby zoom: horizontal travel dominates, vertical assists, and the
    // exponential keeps each pixel worth the same proportional change
    // whether you are at 10% or 1000%.
    const t = (dx - dy) / 220;
    zoomAt(NAV.zoom0 * Math.pow(2, t), NAV.x0, NAV.y0);
  }
}

function endNav() {
  if (!NAV) return;
  NAV = null;
  $('#stagewrap').style.cursor = spaceHeld ? 'grab' : '';
}

export function bindViewport() {
  const wrap = $('#stagewrap');

  wrap.addEventListener('pointerdown', e => {
    // middle button, or space held with the left button — both pan; Alt makes
    // the middle button zoom instead, which is the Photoshop reflex.
    if (e.button === 1) {
      e.preventDefault();
      beginNav(e, e.altKey ? 'zoom' : 'pan');
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* nicety */ }
    } else if (e.button === 0 && spaceHeld) {
      e.preventDefault();
      beginNav(e, 'pan');
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* nicety */ }
    }
  }, true);

  wrap.addEventListener('pointermove', e => { if (NAV) { e.preventDefault(); moveNav(e); } }, true);
  wrap.addEventListener('pointerup', endNav, true);
  wrap.addEventListener('pointercancel', endNav, true);
  // Windows middle-click otherwise starts autoscroll and hijacks the drag.
  wrap.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  wrap.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });

  wrap.addEventListener('wheel', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomBy(Math.pow(0.999, e.deltaY), e.clientX, e.clientY);
    } else {
      e.preventDefault();
      S.viewport.x -= e.shiftKey ? e.deltaY : e.deltaX;
      S.viewport.y -= e.shiftKey ? 0 : e.deltaY;
      applyViewport();
    }
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !spaceHeld &&
        !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      spaceHeld = true;
      if (!NAV) wrap.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') { spaceHeld = false; if (!NAV) wrap.style.cursor = ''; }
  });
  window.addEventListener('blur', () => { spaceHeld = false; endNav(); });

  $('#zoomIn').onclick = () => zoomBy(1.25);
  $('#zoomOut').onclick = () => zoomBy(1 / 1.25);
  $('#zoomFit').onclick = () => { zoomFit(); toast('Zoom 100%'); };
  $('#zoomPct').onclick = () => { zoomReset(); toast('Zoom 100%'); };

  applyViewport();
}

/* Space is a play/pause shortcut elsewhere; while it is being used to pan we
   do not want the transport reacting to it as well. */
export const isPanning = () => !!NAV || spaceHeld;
