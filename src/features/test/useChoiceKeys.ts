import { useEffect } from 'react';

/**
 * Keyboard control for answer options: number keys 1–8 choose, Enter confirms. Ignored while
 * typing in a form field.
 */
export function useChoiceKeys(
  optionCount: number,
  onSelect: (index: number) => void,
  onConfirm: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(optionCount, 8)) {
        e.preventDefault();
        onSelect(n - 1);
      } else if (e.key === 'Enter' && !target?.closest('a, button:not([aria-pressed])')) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [optionCount, onSelect, onConfirm, enabled]);
}
