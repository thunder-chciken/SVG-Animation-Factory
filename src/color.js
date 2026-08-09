/* =====================================================================
   COLOR NAMING — so a swatch reads "crimson", not "#dc143c"
   ===================================================================== */
import { clamp } from './state.js';

const NAMED = [
  ['black', 0, 0, 0], ['white', 255, 255, 255], ['gray', 128, 128, 128],
  ['silver', 192, 192, 192], ['charcoal', 54, 58, 64], ['cream', 250, 245, 230],
  ['red', 220, 20, 30], ['crimson', 160, 20, 45], ['maroon', 110, 25, 35],
  ['orange', 255, 140, 0], ['amber', 255, 176, 32], ['gold', 212, 175, 55],
  ['yellow', 245, 225, 60], ['lime', 150, 220, 60], ['green', 40, 160, 70],
  ['forest', 25, 90, 50], ['mint', 130, 220, 190], ['teal', 30, 150, 150],
  ['cyan', 60, 200, 230], ['sky', 110, 180, 240], ['blue', 35, 95, 220],
  ['navy', 20, 40, 100], ['indigo', 75, 60, 170], ['purple', 140, 70, 200],
  ['violet', 180, 120, 230], ['magenta', 225, 60, 180], ['pink', 245, 150, 190],
  ['rose', 225, 90, 120], ['brown', 130, 85, 50], ['tan', 205, 175, 140],
  ['beige', 230, 215, 190], ['olive', 120, 120, 50], ['slate', 100, 115, 135],
];

export const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

export function parseColor(c) {
  if (!c) return null;
  c = String(c).trim().toLowerCase();
  if (c === 'none' || c === 'transparent' || c === 'currentcolor') return null;
  if (c.startsWith('url(')) return { grad: c.slice(4, -1).replace(/["']/g, '') };
  const p = document.createElement('canvas').getContext('2d');
  p.fillStyle = '#000'; p.fillStyle = c;
  const hx = p.fillStyle;
  if (typeof hx === 'string' && hx.startsWith('#')) {
    return { hex: hx, rgb: [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)] };
  }
  const m = String(hx).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (m) { const rgb = [+m[1], +m[2], +m[3]]; return { hex: rgbToHex(rgb), rgb }; }
  return null;
}

export function colorName(rgb) {
  let best = 'color', d = 1e9;
  for (const [n, r, g, b] of NAMED) {
    const dist = (rgb[0] - r) ** 2 * .3 + (rgb[1] - g) ** 2 * .59 + (rgb[2] - b) ** 2 * .11;
    if (dist < d) { d = dist; best = n; }
  }
  return best;
}
