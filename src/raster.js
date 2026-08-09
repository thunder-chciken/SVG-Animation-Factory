/* =====================================================================
   PNG / JPEG EXPORT
   Rasterises the canvas exactly as it looks right now, including wherever
   the playhead happens to be sitting — a still is a still, so "what I can
   see" is the only frame that isn't a guess.

   The live SVG is serialised into a blob URL and drawn through an Image,
   which keeps the canvas untainted because nothing here loads from
   another origin.
   ===================================================================== */
import { S, $, toast } from './state.js';

function liveClone(scale) {
  const clone = S.svg.cloneNode(true);
  clone.removeAttribute('style');
  clone.querySelectorAll('[data-saf]').forEach(n => n.removeAttribute('data-saf'));

  const vb = (clone.getAttribute('viewBox') || '0 0 300 150').trim().split(/[\s,]+/).map(Number);
  const w = Math.max(1, Math.round(vb[2] * scale));
  const h = Math.max(1, Math.round(vb[3] * scale));
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { xml: new XMLSerializer().serializeToString(clone), w, h };
}

/* JPEG has no alpha, so it needs something behind the artwork. Use whatever
   the stage is currently showing rather than an arbitrary white. */
function stageBackground() {
  const wrap = $('#stagewrap');
  if (!wrap.classList.contains('plain')) return '#ffffff';
  return getComputedStyle(wrap).getPropertyValue('--stagebg').trim() || '#16181d';
}

export function exportRaster(type = 'png', scale = 2) {
  if (!S.svg) { toast('Load an SVG first.', 'err'); return; }

  let payload;
  try { payload = liveClone(scale); }
  catch (e) { toast('Could not read the canvas.', 'err'); return; }

  const { xml, w, h } = payload;
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (type === 'jpeg') {
        ctx.fillStyle = stageBackground();
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(out => {
        if (!out) { toast('The image could not be encoded.', 'err'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(out);
        a.download = (S.fileName.replace(/\.svg$/i, '') || 'animation') +
                     `@${scale}x.${type === 'jpeg' ? 'jpg' : 'png'}`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast(`Saved ${w}×${h} ${type.toUpperCase()}`, 'ok');
      }, type === 'jpeg' ? 'image/jpeg' : 'image/png', type === 'jpeg' ? 0.92 : undefined);
    } catch (e) {
      toast(`Export failed: ${e.message}`, 'err');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast('The SVG could not be rasterised.', 'err');
  };

  img.src = url;
}
