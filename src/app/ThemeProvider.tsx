import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { PaletteId } from '../styles/palettes';
import {
  ThemeContext,
  applyTheme,
  readStoredMode,
  readStoredPalette,
  type ThemeMode,
  type ThemeState,
} from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToSystemScheme(onChange: () => void): () => void {
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const systemPrefersDark = () => window.matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const [palette, setPalette] = useState<PaletteId>(readStoredPalette);
  const prefersDark = useSyncExternalStore(subscribeToSystemScheme, systemPrefersDark, () => false);

  useEffect(() => applyTheme(mode, palette), [mode, palette]);

  const value = useMemo<ThemeState>(
    () => ({
      mode,
      palette,
      resolvedMode: mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode,
      setMode,
      setPalette,
    }),
    [mode, palette, prefersDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
