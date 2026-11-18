'use client';
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΦΑΡΜΟΓΗ ΣΤΑ ΑΓΓΛΙΚΑ: ΛΕΞΙΚΟ ΑΝΑ ΟΘΟΝΗ, ΜΟΝΟ ΓΙΑ ΟΠΟΙΟΝ ΤΟ ΔΙΑΛΕΞΕ
// ─────────────────────────────────────────────────────────────────────────
// Ο πίνακας (/dashboard) κρατά τη διεύθυνσή του και η γλώσσα του έρχεται από
// την επιλογή του χρήστη (lib/i18n/locale.ts, appLocale). Το layout του τη
// δηλώνει με τον `AppLocaleProvider`, οπότε και το `useLocale()` την ξέρει.
//
// ΓΙΑΤΙ ΔΥΝΑΜΙΚΟ import(). Το ίδιο μέτρημα με τις αγγλικές σελίδες
// (lib/i18n/toolEn.ts, scripts/guard-en-client.mjs): λεξικό που εισάγεται
// στατικά από component πελάτη κατεβαίνει ΚΑΙ στον Ελληνα χρήστη. Εδώ κάθε
// λεξικό είναι δικό του κομμάτι (chunk) και κατεβαίνει μόνο όταν η γλώσσα
// είναι αγγλικά και η οθόνη του ανοίξει. Ο Ελληνας χρήστης δεν κατεβάζει
// τίποτα: το `useAppEn()` δίνει `null` και τα ελληνικά μένουν εκεί που ήταν,
// ίδια ως το τελευταίο byte.
//
// ΝΕΑ ΟΘΟΝΗ = ΕΝΑ ΚΛΕΙΔΙ ΣΤΟ `AppEn` ΚΑΙ ΕΝΑ ΣΤΟ `LOADERS`. Οι καρτέλες που
// φορτώνουν αργά (app/dashboard/components/lazyTabs.tsx) περιμένουν το λεξικό
// τους μέσα στον ίδιο φορτωτή (`withAppEn`), ώστε να μη δείξουν ούτε ένα
// καρέ ελληνικά σε όποιον διάλεξε αγγλικά.
// ═══════════════════════════════════════════════════════════════════════════
import { useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from './locale';
import { LocaleOverrideContext } from './useLocale';
import type { SHELL_EN } from './en/app/shell';
import type { SETTINGS_EN } from './en/app/settings';
import type { OVERVIEW_EN } from './en/app/overview';
import type { EXPENSES_EN } from './en/app/expenses';
import type { ERRORS_EN } from './en/app/errors';

/** Ενα κλειδί ανά οθόνη ή ομάδα οθονών. */
export type AppEn = {
  shell: typeof SHELL_EN;
  settings: typeof SETTINGS_EN;
  overview: typeof OVERVIEW_EN;
  expenses: typeof EXPENSES_EN;
  /** Τα σφάλματα των ειδοποιήσεων (toast), δίδυμο του lib/core/dbError.ts. */
  errors: typeof ERRORS_EN;
};
export type AppEnKey = keyof AppEn;

const LOADERS: { [K in AppEnKey]: () => Promise<AppEn[K]> } = {
  shell: () => import('./en/app/shell').then(m => m.SHELL_EN),
  settings: () => import('./en/app/settings').then(m => m.SETTINGS_EN),
  overview: () => import('./en/app/overview').then(m => m.OVERVIEW_EN),
  expenses: () => import('./en/app/expenses').then(m => m.EXPENSES_EN),
  errors: () => import('./en/app/errors').then(m => m.ERRORS_EN),
};

const cache: Partial<AppEn> = {};
const pending: Partial<Record<AppEnKey, Promise<void>>> = {};
const listeners = new Set<() => void>();
let version = 0;

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => version;
const serverSnapshot = () => 0;

/**
 * Κατεβάζει το λεξικό μιας οθόνης, μία φορά. Αν το κομμάτι δεν κατέβει
 * (δίκτυο), η οθόνη μένει ελληνική και η επόμενη ζήτηση ξαναδοκιμάζει: ποτέ
 * κενά πεδία.
 */
export function loadAppEn(key: AppEnKey): Promise<void> {
  if (cache[key]) return Promise.resolve();
  const running = pending[key];
  if (running) return running;
  const p = LOADERS[key]().then(
    dict => { (cache as Record<AppEnKey, unknown>)[key] = dict; version++; listeners.forEach(l => l()); },
    () => { delete pending[key]; },
  );
  pending[key] = p;
  return p;
}

/** Η γλώσσα της σελίδας όπως την έγραψε η ρίζα (`<html lang>`), στον περιηγητή. */
const pageIsEn = (): boolean => typeof document !== 'undefined' && document.documentElement.lang === 'en';

/**
 * Φορτωτής καρτέλας που περιμένει και τα λεξικά της, μόνο στα αγγλικά. Στα
 * ελληνικά είναι ο ίδιος φορτωτής, χωρίς καμία επιπλέον αναμονή.
 */
export function withAppEn<M>(keys: readonly AppEnKey[], load: () => Promise<M>): () => Promise<M> {
  return () => (pageIsEn()
    ? Promise.all([load(), ...keys.map(loadAppEn)]).then(([m]) => m)
    : load());
}

/** Το λεξικό μιας οθόνης στα αγγλικά, ή `null` στα ελληνικά (και όσο κατεβαίνει). */
export function useAppEn<K extends AppEnKey>(key: K): AppEn[K] | null {
  const en = useContext(LocaleOverrideContext) === 'en';
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => { if (en) void loadAppEn(key); }, [en, key]);
  return en ? (cache[key] ?? null) : null;
}

/** Η γλώσσα της εφαρμογής, για όσα σημεία τη θέλουν στη ρίζα της σελίδας. */
export function AppLocaleProvider({ locale, children }: { locale: Locale; children?: ReactNode }) {
  return <LocaleOverrideContext.Provider value={locale}>{children}</LocaleOverrideContext.Provider>;
}

/**
 * Γράφει την επιλογή στο cookie `pw_lang`, που διαβάζει το proxy.ts. Είναι το
 * ίδιο cookie με τον επιλογέα των δημόσιων σελίδων (app/LangSwitcher.tsx),
 * περιγραμμένο ήδη στην πολιτική απορρήτου.
 */
export function rememberAppLocale(locale: Locale): void {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch { /* χωρίς cookies η αλλαγή δεν κρατιέται· η σελίδα μένει ως έχει */ }
}
