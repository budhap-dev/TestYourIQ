/**
 * Minimal colour maths for theme generation: OKLCH → sRGB hex with gamut mapping,
 * and WCAG 2.x contrast ratio. Framework-free so scripts and tests can use it.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

type Rgb = [number, number, number];

function oklchToLinearSrgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const EPS = 1e-6;

function inGamut(rgb: Rgb): boolean {
  return rgb.every((v) => v >= -EPS && v <= 1 + EPS);
}

/** Reduce chroma (keeping lightness and hue) until the colour fits in sRGB. */
function toGamut(color: Oklch): Rgb {
  const rgb = oklchToLinearSrgb(color);
  if (inGamut(rgb)) return rgb;
  let lo = 0;
  let hi = color.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinearSrgb({ ...color, c: mid }))) lo = mid;
    else hi = mid;
  }
  return oklchToLinearSrgb({ ...color, c: lo });
}

function encodeGamma(v: number): number {
  const x = Math.min(1, Math.max(0, v));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

function decodeGamma(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function oklchToHex(color: Oklch): string {
  return (
    '#' +
    toGamut(color)
      .map((v) =>
        Math.round(encodeGamma(v) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    decodeGamma(v / 255),
  ) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
