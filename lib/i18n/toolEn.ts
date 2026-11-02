'use client';
// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΑΓΓΛΙΚΑ ΤΩΝ ΥΠΟΛΟΓΙΣΤΩΝ ΦΤΑΝΟΥΝ ΜΟΝΟ ΣΤΙΣ ΑΓΓΛΙΚΕΣ ΣΕΛΙΔΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΜΕΤΡΗΜΕΝΟ (03.11.2026, scripts/perf-budget.mjs). Οι υπολογιστές έγιναν
// δίγλωσσοι με `useLocale()` και `en ? ENFIA_EN.x : '…'`: τα λεξικά
// (lib/i18n/en/tools/*) εισάγονταν στατικά από τα ίδια components πελάτη,
// οπότε κατέβαιναν ΚΑΙ στις ελληνικές σελίδες. Το /ypologismos-enfia πήγε
// 190,0 → 199,7 KB και του έμεναν 0,8 KB από την ανοχή, για κείμενο που ο
// Ελληνας επισκέπτης δεν βλέπει ποτέ.
//
// ΙΔΙΟ ΣΧΗΜΑ ΜΕ ΤΗΝ ΕΙΣΟΔΟ (lib/i18n/authEn.ts). Κάθε αγγλική σελίδα
// υπολογιστή τυλίγει τον υπολογιστή της σε έναν πάροχο `en.tsx` στον φάκελό
// της κάτω από το app/en, που είναι το ΜΟΝΟ component πελάτη που εισάγει το
// λεξικό της. Ο υπολογιστής ρωτά `useToolEn()`: `null` σημαίνει ελληνικά.
// Εδώ ζουν μόνο οι τύποι — `import type`, που δεν φτάνει στο πακέτο.
//
// Ο φύλακας scripts/guard-en-client.mjs κόβει κάθε component πελάτη έξω από
// το app/en που εισάγει τιμή από το lib/i18n/en/**.
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext } from 'react';
import type { Locale } from './locale';
import type { ENFIA_EN, ENFIA_FLOOR_EN, ENFIA_FLOOR_SHORT_EN, enfiaAgeChoicesEn, smallSettlementReliefEn } from './en/tools/enfia';
import type { RENT_EN, filingNoteEn, rateScaleEn } from './en/tools/rent';
import type { YIELD_EN } from './en/tools/yield';
import type { SHORT_EN } from './en/tools/short';
import type { MORTGAGE_EN } from './en/tools/mortgage';
import type { RENO_EN } from './en/tools/reno';
import type { BUY_EN, ledgerRowsEn, missingSentenceEn } from './en/tools/buy';
import type { PARTS_EN } from './en/landingParts';

/** Ενα κλειδί ανά υπολογιστή· ο πάροχος κάθε σελίδας δίνει μόνο το δικό του. */
export type ToolEn = {
  enfia?: {
    E: typeof ENFIA_EN; floor: typeof ENFIA_FLOOR_EN; floorShort: typeof ENFIA_FLOOR_SHORT_EN;
    ageChoices: typeof enfiaAgeChoicesEn; smallRelief: typeof smallSettlementReliefEn;
  };
  rent?: { E: typeof RENT_EN; filingNote: typeof filingNoteEn; rateScale: typeof rateScaleEn };
  yield?: { E: typeof YIELD_EN; rateScale: typeof rateScaleEn };
  short?: { E: typeof SHORT_EN };
  mortgage?: { E: typeof MORTGAGE_EN };
  reno?: { E: typeof RENO_EN };
  buy?: { E: typeof BUY_EN; ledgerRows: typeof ledgerRowsEn; missing: typeof missingSentenceEn };
  landing?: { C: typeof PARTS_EN.calc };
};

export const ToolEnContext = createContext<ToolEn | null>(null);

/**
 * Το «λεξικό» των ελληνικών σελίδων: κάθε ανάγνωση δίνει `undefined`.
 *
 * ΓΙΑΤΙ ΟΧΙ ΣΚΕΤΟ `undefined` (03.11.2026). Πριν από τον πάροχο το λεξικό
 * υπήρχε πάντα, οπότε μερικοί υπολογιστές διάβαζαν ένα πεδίο του ΚΑΙ στα
 * ελληνικά και το περνούσαν σε συνάρτηση που το αγνοούσε (π.χ. η βοήθεια του
 * επιτοκίου στο στεγαστικό). Με `undefined` στη θέση του λεξικού, το
 * `E.fixedMarket` έριχνε ολόκληρη την ελληνική σελίδα. Η ανάγνωση πεδίου εδώ
 * είναι ακίνδυνη· ό,τι εμφανίζεται στα ελληνικά μένει πίσω από `en ?`.
 */
export const NO_EN: Record<string, undefined> = new Proxy({}, { get: () => undefined });

/** Τα αγγλικά της σελίδας, ή `null` στις ελληνικές σελίδες. */
export function useToolEn(): ToolEn | null {
  return useContext(ToolEnContext);
}

/**
 * Το λεξικό ενός υπολογιστή και η γλώσσα που συνεπάγεται: χωρίς λεξικό η
 * σελίδα είναι ελληνική, ό,τι κι αν λέει η διαδρομή. Ετσι ένας αγγλικός
 * υπολογιστής χωρίς πάροχο δείχνει ελληνικά και όχι κενά πεδία.
 */
export function useToolDict<K extends keyof ToolEn>(key: K): { en: ToolEn[K]; locale: Locale } {
  const en = useContext(ToolEnContext)?.[key];
  return { en, locale: en ? 'en' : 'el' };
}
