/* =====================================================================
   HSV COLOUR WHEEL
   A hue ring around a saturation/value square — the picker people expect
   when they double-click a shape. Built from CSS gradients rather than a
   canvas so it stays crisp on any display and costs nothing to redraw.
   ===================================================================== */

export function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map(Math.round);
}

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const rgbHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export function hexRgb(hex) {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* Mounts a wheel into `host` and calls onChange(hex) as the user drags.
   Returns a handle whose set(hex) moves the markers without re-notifying,
   so external edits (hex field, eyedropper) stay in sync. */
export function createWheel(host, onChange) {
  host.innerHTML = `
    <div class="cw">
      <div class="cw-ring" data-cw="ring"><i class="cw-dot cw-hue"></i></div>
      <div class="cw-sv" data-cw="sv"><i class="cw-dot cw-svdot"></i></div>
    </div>`;

  const ring = host.querySelector('[data-cw="ring"]');
  const sv = host.querySelector('[data-cw="sv"]');
  const hueDot = host.querySelector('.cw-hue');
  const svDot = host.querySelector('.cw-svdot');

  let h = 40, s = 1, v = 1;
  let notify = true;

  function paint() {
    sv.style.background =
      `linear-gradient(to top, #000, rgba(0,0,0,0)),
       linear-gradient(to right, #fff, hsl(${h} 100% 50%))`;

    const rect = ring.getBoundingClientRect();
    const R = (rect.width || 150) / 2;
    const track = R - 11;                    // centre of the ring band
    const a = (h - 90) * Math.PI / 180;      // 0deg sits at 12 o'clock
    hueDot.style.left = `${R + track * Math.cos(a)}px`;
    hueDot.style.top = `${R + track * Math.sin(a)}px`;
    hueDot.style.background = `hsl(${h} 100% 50%)`;

    svDot.style.left = `${s * 100}%`;
    svDot.style.top = `${(1 - v) * 100}%`;
    svDot.style.background = rgbHex(hsvToRgb(h, s, v));
  }

  function emit() {
    paint();
    if (notify) onChange(rgbHex(hsvToRgb(h, s, v)));
  }

  function fromRing(e) {
    const b = ring.getBoundingClientRect();
    const dx = e.clientX - (b.left + b.width / 2);
    const dy = e.clientY - (b.top + b.height / 2);
    let a = Math.atan2(dx, -dy) * 180 / Math.PI;   // clockwise from top
    if (a < 0) a += 360;
    h = a;
    emit();
  }

  function fromSquare(e) {
    const b = sv.getBoundingClientRect();
    s = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
    v = 1 - Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
    emit();
  }

  // One capture per surface; dragging keeps working outside the element.
  const drag = (el, handler) => {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* nicety */ }
      el._on = true; handler(e); e.preventDefault();
    });
    el.addEventListener('pointermove', e => { if (el._on) handler(e); });
    const off = () => { el._on = false; };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
  };
  drag(ring, fromRing);
  drag(sv, fromSquare);

  paint();

  return {
    set(hex) {
      const rgb = hexRgb(hex);
      if (!rgb) return;
      const [nh, ns, nv] = rgbToHsv(...rgb);
      // A pure grey carries no hue; keep the ring where the user left it
      // instead of snapping it to red every time value hits zero.
      if (ns > 0.001) h = nh;
      s = ns; v = nv;
      notify = false; paint(); notify = true;
    },
  };
}
