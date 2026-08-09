import { S, esc } from '../state.js';
import { svgSource } from './svg.js';
import { genGSAP } from './gsap-export.js';

export function genHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(S.fileName || 'animation')}</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#14161a; }
  #saf-root { width:min(90vw,760px); height:auto; overflow:visible; }
  @media (prefers-reduced-motion: reduce) { #saf-root * { animation:none !important; } }
</style>
</head>
<body>

${svgSource()}

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"><\/script>
<script>
${genGSAP()}
<\/script>
</body>
</html>`;
}
