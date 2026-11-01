import { createContext, useContext } from 'react';
import { DEFAULT_PALETTE, isPaletteId, type ColorMode, type PaletteId } from '../styles/palettes';

export type ThemeMode = 'system' | ColorMode;

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const MODE_KEY = 'theme';
const PALETTE_KEY = 'palette';

// Storage can throw (private mode, blocked site data); theme choice is a convenience only.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function readStoredMode(): ThemeMode {
  const v = read(MODE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function readStoredPalette(): PaletteId {
  const v = read(PALETTE_KEY);
  return isPaletteId(v) ? v : DEFAULT_PALETTE;
}

export function applyTheme(mode: ThemeMode, palette: PaletteId): void {
  const root = document.documentElement;
  if (mode === 'system') delete root.dataset.theme;
  else root.dataset.theme = mode;
  root.dataset.palette = palette;
  write(MODE_KEY, mode === 'system' ? null : mode);
  write(PALETTE_KEY, palette === DEFAULT_PALETTE ? null : palette);
}

/** Matches the browser bar (and the installed app's title bar) to the current page background. */
export function syncThemeColor(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (!bg) return;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = bg;
  }
}

export interface ThemeState {
  mode: ThemeMode;
  palette: PaletteId;
  /** The mode actually in effect once "system" is resolved. */
  resolvedMode: ColorMode;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: PaletteId) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
