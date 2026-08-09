import { svgSource } from './svg.js';
import { genGSAP } from './gsap-export.js';

export function genWP() {
  const markup = svgSource();
  return `/* ============================================================
   WordPress delivery — enqueue, never inline.
   LiteSpeed / SiteGround JS optimisation strips inline <script>,
   so this ships as a child-theme file instead.

   1. Save the JS below as:  /wp-content/themes/YOUR-CHILD/js/saf-animation.js
   2. Paste the PHP into your child theme functions.php
   3. Paste the SVG into a Bricks Code element / Divi Code module
      (keep the id="saf-root" wrapper intact)
   ============================================================ */

/* ---------- functions.php ---------- */
add_action( 'wp_enqueue_scripts', function () {
    if ( ! is_page( 'your-page-slug' ) ) { return; }   // scope it

    wp_enqueue_script(
        'gsap',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
        array(), '3.12.5', true
    );
    wp_enqueue_script(
        'gsap-scrolltrigger',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
        array( 'gsap' ), '3.12.5', true
    );
    wp_enqueue_script(
        'saf-animation',
        get_stylesheet_directory_uri() . '/js/saf-animation.js',
        array( 'gsap', 'gsap-scrolltrigger' ),
        filemtime( get_stylesheet_directory() . '/js/saf-animation.js' ),
        true
    );
} );

/* ---------- js/saf-animation.js ---------- */
document.addEventListener( 'DOMContentLoaded', function () {

${genGSAP().split('\n').map(l => l ? '  ' + l : l).join('\n')}

} );

/* ---------- markup (Bricks Code element / Divi Code module) ---------- */
/*
${markup.slice(0, 900)}${markup.length > 900 ? '\n… (full markup on the SVG tab)' : ''}
*/`;
}
