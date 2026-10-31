import { oklchToHex } from './color';

/**
 * Colour palettes. Each one is described by a few OKLCH parameters and expanded into a full
 * light and dark token set. Lightness levels are shared across palettes so contrast stays
 * consistent; tests/themes.test.ts checks every pair against WCAG 2.2 AA.
 *
 * After editing, run `npm run gen:themes` to regenerate src/styles/themes.css.
 */

export interface PaletteDef {
  id: string;
  label: string;
  /** Accent hue in OKLCH degrees. */
  hue: number;
  /** Accent chroma (0 = grey, ~0.15 = vivid). */
  chroma: number;
  /** Hue and chroma for the tinted neutrals (backgrounds, text, borders). */
  neutralHue: number;
  neutralChroma: number;
}

export const PALETTES = [
  { id: 'slate', label: 'Slate', hue: 225, chroma: 0.09, neutralHue: 80, neutralChroma: 0.008 },
  { id: 'ocean', label: 'Ocean', hue: 252, chroma: 0.13, neutralHue: 240, neutralChroma: 0.008 },
  { id: 'indigo', label: 'Indigo', hue: 278, chroma: 0.14, neutralHue: 280, neutralChroma: 0.009 },
  { id: 'plum', label: 'Plum', hue: 322, chroma: 0.12, neutralHue: 320, neutralChroma: 0.008 },
  { id: 'rose', label: 'Rose', hue: 355, chroma: 0.12, neutralHue: 10, neutralChroma: 0.008 },
  { id: 'crimson', label: 'Crimson', hue: 25, chroma: 0.15, neutralHue: 30, neutralChroma: 0.007 },
  {
    id: 'terracotta',
    label: 'Terracotta',
    hue: 45,
    chroma: 0.12,
    neutralHue: 60,
    neutralChroma: 0.01,
  },
  { id: 'amber', label: 'Amber', hue: 75, chroma: 0.11, neutralHue: 85, neutralChroma: 0.012 },
  { id: 'sage', label: 'Sage', hue: 150, chroma: 0.07, neutralHue: 140, neutralChroma: 0.01 },
  {
    id: 'graphite',
    label: 'Graphite',
    hue: 260,
    chroma: 0.015,
    neutralHue: 260,
    neutralChroma: 0.004,
  },
] as const satisfies readonly PaletteDef[];

export type PaletteId = (typeof PALETTES)[number]['id'];
export type ColorMode = 'light' | 'dark';

export const DEFAULT_PALETTE: PaletteId = 'slate';

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && PALETTES.some((p) => p.id === value);
}

export interface PaletteTokens {
  bg: string;
  surface: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
  accentContrast: string;
  accentSoft: string;
  focusRing: string;
  positive: string;
  noticeBg: string;
  noticeText: string;
}

const POSITIVE_HUE = 145;
const NOTICE_HUE = 80;

export function buildPalette(p: PaletteDef, mode: ColorMode): PaletteTokens {
  const n = (l: number, cScale = 1) =>
    oklchToHex({ l, c: p.neutralChroma * cScale, h: p.neutralHue });
  const a = (l: number, cScale = 1) => oklchToHex({ l, c: p.chroma * cScale, h: p.hue });
  const focusHue = (p.hue + 180) % 360;

  if (mode === 'light') {
    return {
      bg: n(0.972),
      surface: n(0.995, 0.5),
      surfaceSunken: n(0.935, 1.2),
      text: n(0.22, 1.5),
      textMuted: n(0.48, 1.5),
      border: n(0.885),
      borderStrong: n(0.6),
      accent: a(0.45),
      accentHover: a(0.38),
      accentContrast: oklchToHex({ l: 0.99, c: 0.005, h: p.hue }),
      accentSoft: a(0.93, 0.25),
      focusRing: oklchToHex({ l: 0.55, c: 0.17, h: focusHue }),
      positive: oklchToHex({ l: 0.47, c: 0.12, h: POSITIVE_HUE }),
      noticeBg: oklchToHex({ l: 0.95, c: 0.03, h: NOTICE_HUE }),
      noticeText: oklchToHex({ l: 0.38, c: 0.07, h: NOTICE_HUE - 5 }),
    };
  }

  return {
    bg: n(0.175, 1.5),
    surface: n(0.215, 1.5),
    surfaceSunken: n(0.145, 1.5),
    text: n(0.93, 1.2),
    textMuted: n(0.74, 1.5),
    border: n(0.32, 1.5),
    borderStrong: n(0.58, 1.5),
    accent: a(0.8, 0.85),
    accentHover: a(0.86, 0.7),
    accentContrast: oklchToHex({ l: 0.18, c: 0.03, h: p.hue }),
    accentSoft: a(0.28, 0.3),
    focusRing: oklchToHex({ l: 0.8, c: 0.15, h: focusHue }),
    positive: oklchToHex({ l: 0.8, c: 0.12, h: POSITIVE_HUE }),
    noticeBg: oklchToHex({ l: 0.26, c: 0.03, h: NOTICE_HUE }),
    noticeText: oklchToHex({ l: 0.88, c: 0.07, h: NOTICE_HUE }),
  };
}

const SHADOWS: Record<ColorMode, string> = {
  light: '0 1px 2px rgb(20 22 26 / 6%), 0 4px 16px rgb(20 22 26 / 6%)',
  dark: '0 1px 2px rgb(0 0 0 / 30%), 0 4px 16px rgb(0 0 0 / 25%)',
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Render the full themes stylesheet. Palettes set --l-* and --d-* variables; the mode picks one set. */
export function renderThemesCss(): string {
  const tokenNames = Object.keys(buildPalette(PALETTES[0], 'light')) as (keyof PaletteTokens)[];

  const paletteBlocks = PALETTES.map((p) => {
    const light = buildPalette(p, 'light');
    const dark = buildPalette(p, 'dark');
    const selector =
      p.id === DEFAULT_PALETTE
        ? `:root,\n:root[data-palette='${p.id}']`
        : `:root[data-palette='${p.id}']`;
    const lines = [
      ...tokenNames.map((t) => `  --l-${kebab(t)}: ${light[t]};`),
      ...tokenNames.map((t) => `  --d-${kebab(t)}: ${dark[t]};`),
    ];
    return `/* ${p.label} */\n${selector} {\n${lines.join('\n')}\n}`;
  });

  const mapping = (mode: ColorMode, indent: string) =>
    [
      `${indent}color-scheme: ${mode};`,
      ...tokenNames.map((t) => `${indent}--${kebab(t)}: var(--${mode[0]}-${kebab(t)});`),
      `${indent}--shadow: ${SHADOWS[mode]};`,
    ].join('\n');

  return [
    '/* Generated by scripts/gen-themes.ts from src/styles/palettes.ts. Do not edit by hand. */',
    '',
    paletteBlocks.join('\n\n'),
    '',
    `:root {\n${mapping('light', '  ')}\n}`,
    '',
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {\n${mapping('dark', '    ')}\n  }\n}`,
    '',
    `:root[data-theme='dark'] {\n${mapping('dark', '  ')}\n}`,
    '',
  ].join('\n');
}
