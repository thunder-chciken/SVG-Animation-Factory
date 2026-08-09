/* The CSS filter functions the studio can animate. Shared by the runtime
   timeline and the code exporters, which must agree on the composed string. */
export const FILTER_KEYS = ['blur', 'brightness', 'contrast', 'saturate', 'hueRotate', 'grayscale', 'sepia', 'invert'];

export const FILTER_FN = {
  blur: v => `blur(${v}px)`,
  brightness: v => `brightness(${v})`,
  contrast: v => `contrast(${v})`,
  saturate: v => `saturate(${v})`,
  hueRotate: v => `hue-rotate(${v}deg)`,
  grayscale: v => `grayscale(${v})`,
  sepia: v => `sepia(${v})`,
  invert: v => `invert(${v})`,
};
