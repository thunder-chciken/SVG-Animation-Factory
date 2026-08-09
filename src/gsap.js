/* Single place where GSAP is imported and its plugins registered, so every
   other module gets an instance that already knows about ScrollTrigger and
   MotionPathPlugin. Importing 'gsap' directly anywhere else risks using it
   before registration has run. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

export { gsap, ScrollTrigger, MotionPathPlugin };
