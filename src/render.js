/* The one full-UI repaint. Lives on its own so the panels can call it
   without importing each other. */
import { renderLayers, renderSwatches } from './layers.js';
import { renderOverlay } from './selection.js';
import { renderInspector } from './inspector.js';
import { renderTracks } from './transport.js';
import { refreshTextPanel } from './text.js';

export function renderAll() {
  renderLayers();
  renderSwatches();
  renderOverlay();
  renderInspector();
  renderTracks();
  refreshTextPanel();
}
