'use client';

// ═══════════════════════════════════════════════════════════════════════════
// ΣΤΕΝΗ ΟΘΟΝΗ, ΚΑΤΩ ΑΠΟ 600
// ─────────────────────────────────────────────────────────────────────────
// Για προεπιλογές που αλλάζουν με το πλάτος (το Αρχείο ανοίγει σε λίστα στο
// τηλέφωνο). Ίδιο σχήμα με το `useCoarsePointer`: εξωτερική πηγή με
// `useSyncExternalStore`, οπότε μία απόδοση και καμία ασυμφωνία ενυδάτωσης.
// ═══════════════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 599px)';

let mql: MediaQueryList | null = null;
const query = (): MediaQueryList | null => {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  if (!mql) mql = window.matchMedia(QUERY);
  return mql;
};

const subscribe = (onChange: () => void): (() => void) => {
  const mq = query();
  if (!mq) return () => {};
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

const getSnapshot = () => query()?.matches ?? false;
const getServerSnapshot = () => false;

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
