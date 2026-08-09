/* =====================================================================
   SVG ANIMATION FACTORY — boot
   Every module is side-effect free on import; all wiring happens here.
   ===================================================================== */
import './styles/index.css';

import { gsap } from './gsap.js';
import { S } from './state.js';
import { loadSVG } from './ingest.js';
import { bindStage, renderOverlay } from './selection.js';
import { bindLayers, bindSwatches } from './layers.js';
import { bindPaintShell } from './paint.js';
import { bindTransport } from './transport.js';
import { renderAll } from './render.js';
import { bindTop } from './shell.js';
import { initPersistence, restoreSession } from './project.js';
import { SAMPLE } from './sample.js';

bindStage();
bindLayers();
bindSwatches();
bindTransport();
bindTop();
bindPaintShell();
initPersistence();
renderAll();

// Selection boxes are screen-space, so they have to be redrawn every frame
// that something is actually moving.
gsap.ticker.add(() => { if (S.tl && S.tl.isActive()) renderOverlay(); });

if (!restoreSession()) loadSVG(SAMPLE, 'sample.svg');
