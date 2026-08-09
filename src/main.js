/* =====================================================================
   SVG ANIMATION FACTORY — boot
   Every module is side-effect free on import; all wiring happens here.
   ===================================================================== */
import './styles/index.css';

import { gsap } from './gsap.js';
import { S } from './state.js';
import { bindStage, renderOverlay } from './selection.js';
import { bindLayers, bindSwatches } from './layers.js';
import { bindPaintShell } from './paint.js';
import { bindTransport } from './transport.js';
import { renderAll } from './render.js';
import { bindTop } from './shell.js';
import { bindIcons } from './icons.js';
import { bindMenu } from './menu.js';
import { bindTextShell } from './text.js';
import { bindViewport } from './viewport.js';
import { initPersistence, restoreSession } from './project.js';
import { initHistory, resetHistory } from './history.js';
import { loadWorkspace } from './workspace.js';
import { applyWorkspaceOpen } from './ui.js';

// Panel layout first: the inspector reads it the first time it renders.
loadWorkspace();
applyWorkspaceOpen();

bindStage();
bindLayers();
bindSwatches();
bindTransport();
bindTop();
bindPaintShell();
bindIcons();
bindMenu();
bindTextShell();
bindViewport();
initPersistence();
renderAll();

// Selection boxes are screen-space, so they have to be redrawn every frame
// that something is actually moving.
gsap.ticker.add(() => { if (S.tl && S.tl.isActive()) renderOverlay(); });

// Start on whatever was last open. With nothing stored the stage stays empty
// and the empty state points at File ▸ New / Open — pushing the sample in
// front of everyone on every visit was noise.
restoreSession();

// Baseline snapshot last, so the first undo returns to the loaded document
// rather than to an empty stage.
initHistory();
resetHistory();
