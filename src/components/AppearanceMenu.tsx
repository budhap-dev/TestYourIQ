import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { THEME_MODES, useTheme, type ThemeMode } from '../app/theme';
import { PALETTES, buildPalette, type PaletteId } from '../styles/palettes';
import styles from './AppearanceMenu.module.css';

const MODE_LABELS: Record<ThemeMode, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

// Swatch colours for both modes, computed once.
const SWATCHES = PALETTES.map((p) => ({
  id: p.id,
  label: p.label,
  light: buildPalette(p, 'light'),
  dark: buildPalette(p, 'dark'),
}));

export function AppearanceMenu() {
  const { mode, palette, resolvedMode, setMode, setPalette } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const name = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="Appearance"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className={styles.triggerIcon} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor" />
        </svg>
        <span className={styles.triggerLabel} aria-hidden="true">
          Appearance
        </span>
      </button>

      {open && (
        <div id={panelId} className={styles.panel} role="group" aria-label="Appearance">
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Mode</legend>
            <div className={styles.segmented}>
              {THEME_MODES.map((m) => (
                <label key={m} className={styles.segment}>
                  <input
                    type="radio"
                    name={`${name}-mode`}
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  <span className={styles.segmentLabel}>{MODE_LABELS[m]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Colour</legend>
            <div className={styles.swatches}>
              {SWATCHES.map((s) => {
                const tokens = s[resolvedMode];
                const chipStyle = {
                  '--chip-bg': tokens.bg,
                  '--chip-accent': tokens.accent,
                } as CSSProperties;
                return (
                  <label key={s.id} className={styles.swatch}>
                    <input
                      type="radio"
                      name={`${name}-palette`}
                      value={s.id}
                      checked={palette === s.id}
                      onChange={() => setPalette(s.id as PaletteId)}
                    />
                    <span className={styles.swatchBody}>
                      <span className={styles.chip} style={chipStyle} aria-hidden="true" />
                      {s.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
