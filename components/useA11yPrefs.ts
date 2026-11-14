'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΡΥΘΜΙΣΕΙΣ ΠΡΟΣΒΑΣΙΜΟΤΗΤΑΣ ΣΤΗ REACT
// ─────────────────────────────────────────────────────────────────────────
// Η ανάγνωση και η εγγραφή ζουν στο lib/core/a11yPrefs.ts. Εδώ μόνο η
// σύνδεση με τον localStorage μέσω του `useRemembered` (μία απόδοση χωρίς
// ασυμφωνία ενυδάτωσης και συγχρονισμός ανάμεσα σε καρτέλες) και η εγγραφή
// των ιδιοτήτων στο <html> τη στιγμή της αλλαγής.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback } from 'react';
import { useRemembered } from './useRememberedFlag';
import {
  A11Y_DEFAULTS, A11Y_KEY, LEGACY_LARGE, LEGACY_MOTION, applyA11y, parseA11y, serializeA11y, type A11yPrefs,
} from '@/lib/core/a11yPrefs';

const readLegacy = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const parse = (raw: string | null): A11yPrefs =>
  parseA11y(raw, raw ? undefined : { large: readLegacy(LEGACY_LARGE), motion: readLegacy(LEGACY_MOTION) });

export function useA11yPrefs(): [A11yPrefs, (patch: Partial<A11yPrefs>) => void] {
  const [prefs, setPrefs] = useRemembered<A11yPrefs>(A11Y_KEY, parse, serializeA11y, A11Y_DEFAULTS);
  const update = useCallback((patch: Partial<A11yPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try { applyA11y(document.documentElement, next); } catch { /* χωρίς DOM */ }
  }, [prefs, setPrefs]);
  return [prefs, update];
}
