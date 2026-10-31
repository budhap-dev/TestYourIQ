// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, oklchToHex } from '../src/styles/color';
import {
  PALETTES,
  buildPalette,
  renderThemesCss,
  type ColorMode,
  type PaletteTokens,
} from '../src/styles/palettes';

type Pair = [fg: keyof PaletteTokens, bg: keyof PaletteTokens, min: number];

// Text needs 4.5:1; non-text UI (borders on controls, focus rings) needs 3:1.
const PAIRS: Pair[] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surfaceSunken', 4.5],
  ['text', 'accentSoft', 4.5],
  ['textMuted', 'bg', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textMuted', 'surfaceSunken', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'accentSoft', 4.5],
  ['accentContrast', 'accent', 4.5],
  ['accentContrast', 'accentHover', 4.5],
  ['positive', 'bg', 4.5],
  ['positive', 'surface', 4.5],
  ['noticeText', 'noticeBg', 4.5],
  ['borderStrong', 'bg', 3],
  ['borderStrong', 'surface', 3],
  ['focusRing', 'bg', 3],
  ['focusRing', 'surface', 3],
];

describe('colour maths', () => {
  it('converts known OKLCH values to sRGB', () => {
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff');
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe('#000000');
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('palettes', () => {
  it('has ten palettes with unique ids', () => {
    expect(PALETTES).toHaveLength(10);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(10);
  });

  for (const palette of PALETTES) {
    for (const mode of ['light', 'dark'] as ColorMode[]) {
      it(`${palette.id} (${mode}) meets WCAG AA contrast`, () => {
        const tokens = buildPalette(palette, mode);
        const failures = PAIRS.map(([fg, bg, min]) => ({
          pair: `${fg} on ${bg}`,
          ratio: contrastRatio(tokens[fg], tokens[bg]),
          min,
        })).filter((r) => r.ratio < r.min);
        expect(failures).toEqual([]);
      });
    }
  }

  it('themes.css is up to date (run `npm run gen:themes`)', () => {
    const onDisk = readFileSync(resolve('src/styles/themes.css'), 'utf8');
    const normalise = (s: string) => s.replace(/\s+/g, '');
    expect(normalise(onDisk)).toBe(normalise(renderThemesCss()));
  });
});
