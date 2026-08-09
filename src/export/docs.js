/* =====================================================================
   What each export actually is, how to put it on a page, and where it
   stops. Shown above the code in the export sheet so the choice can be
   made without leaving the app.
   ===================================================================== */

export const DOCS = {
  gsap: {
    tag: 'JavaScript · GSAP 3',
    what: `The timeline as a GSAP script, scoped to #saf-root and wrapped in
      gsap.matchMedia() so it does nothing for visitors who ask for reduced motion.
      This is the reference export — everything you built in the studio survives it.`,
    embed: `<!-- 1 · the markup, from the Indexed SVG tab -->
<svg id="saf-root" viewBox="…"> … </svg>

<!-- 2 · GSAP, before your script -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>

<!-- 3 · this file -->
<script src="/js/saf-animation.js"></script>`,
    can: ['Every property the studio offers, including CSS filters and 3D transforms',
          'Scroll triggers and scroll-scrubbing',
          'Per-element stagger, motion paths, yoyo and infinite repeats',
          'Reduced-motion handling built in'],
    cant: ['Needs JavaScript and the GSAP library (~70 KB gzipped for core + ScrollTrigger)',
           'Will not run inside an <img> tag or a CSS background'],
  },

  html: {
    tag: 'Complete web page',
    what: `A single self-contained .html file: the markup, the styling and the GSAP
      script together, loading GSAP from a CDN. Made for previewing, sending to a
      client, or dropping straight onto static hosting.`,
    embed: `Save as animation.html and open it in a browser.
To publish, upload the one file — nothing else is needed.
To lift it into an existing page, copy the <svg> and the <script> out of it.`,
    can: ['Runs as-is with no build step or server',
          'Same capability as the GSAP export',
          'Easy to hand to someone who just needs to see it'],
    cant: ['Not meant to be pasted into a CMS page as-is — take the parts you need',
           'Requires an internet connection for the CDN'],
  },

  wp: {
    tag: 'WordPress · Bricks / Divi',
    what: `The same animation delivered the way WordPress wants it: GSAP and your
      script registered through wp_enqueue_script from a child theme, with the SVG
      going into a Code element. Inline &lt;script&gt; tags get stripped or deferred by
      LiteSpeed, SiteGround Optimizer and WP Rocket, which is why this exists.`,
    embed: `1 · Save the JS block as  /wp-content/themes/YOUR-CHILD/js/saf-animation.js
2 · Paste the PHP block into your child theme functions.php
3 · Edit is_page( 'your-page-slug' ) so it only loads where it is needed
4 · Paste the SVG into a Bricks Code element or Divi Code module,
    keeping the id="saf-root" wrapper intact`,
    can: ['Survives aggressive JS optimisation and caching plugins',
          'Loads only on the page you scope it to',
          'Cache-busted automatically via filemtime()'],
    cant: ['Requires a child theme (or a snippets plugin) to hold the PHP',
           'Bricks may need the Code element signed before it will execute'],
  },

  smil: {
    tag: 'Animated SVG · no JavaScript',
    what: `One .svg file that animates itself using SMIL, the animation system built
      into the SVG format. No script, no library, nothing external — which means it
      keeps animating in places where JavaScript never runs at all.`,
    embed: `<!-- as an image -->
<img src="/img/logo-animated.svg" alt="" width="420">

<!-- as a CSS background -->
.hero { background-image: url('/img/logo-animated.svg'); }

<!-- or inline, if you want CSS to reach inside it -->
<svg id="saf-root" viewBox="…"> … </svg>`,
    can: ['Works inside <img>, CSS background-image, and inline',
          'No JavaScript at all — immune to script blocking and JS optimisation',
          'One portable file you can upload to a media library',
          'Transforms, opacity, fill/stroke, stroke width, line drawing and motion paths'],
    cant: ['No CSS filters — blur, brightness, hue-rotate and friends are dropped',
           'No 3D transforms (rotationX/Y, perspective) or percentage offsets',
           'No scroll triggers: a standalone file cannot see the page scroll, so it plays on load',
           'Larger than the CSS export — easing is baked in as sampled keyframes',
           'Not supported in Internet Explorer'],
  },

  css: {
    tag: 'CSS keyframes · no JavaScript',
    what: `@keyframes rules plus the selectors that use them. Pure CSS, so it runs
      as early as the stylesheet loads and costs nothing at runtime.`,
    embed: `<!-- markup, from the Indexed SVG tab -->
<svg id="saf-root" viewBox="…"> … </svg>

/* then paste this into your stylesheet, or a <style> block */`,
    can: ['Zero JavaScript and zero libraries',
          'Transforms, opacity and CSS filters',
          'Infinite repeats and yoyo via animation-direction'],
    cant: ['No line drawing, motion paths, colour tweens or stagger — those need GSAP',
           'No scroll triggers',
           'Every element animates on its own clock; there is no shared timeline',
           'Needs transform-box: fill-box, which is already included'],
  },

  svg: {
    tag: 'Markup only',
    what: `The document as it stands on the canvas — split text, exploded paths, new
      colours and any icons you inserted — cleaned of studio bookkeeping and given
      the id="saf-root" handle the generated code targets.`,
    embed: `Paste directly into your page, a Bricks Code element, or a Divi Code module.
Pair it with the GSAP, WordPress or CSS tab to make it move.`,
    can: ['The exact ids the other exports reference',
          'Safe to hand to a developer or commit to a repo',
          'Still a plain static SVG — usable anywhere'],
    cant: ['Does not animate on its own — it is only the markup'],
  },
};
