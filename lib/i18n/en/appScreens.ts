// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΙΕΣ ΟΘΟΝΕΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΕΙΝΑΙ ΣΤΑ ΑΓΓΛΙΚΑ
// ─────────────────────────────────────────────────────────────────────────
// Το /en, η ξενάγηση και η εγγραφή έγραφαν «The app is in Greek today.
// English is on the way.» ενώ τέσσερις οθόνες ήταν ήδη αγγλικές (Χ8,
// αξιολόγηση 23/11/2026). Η λίστα είναι δεμένη με τα λεξικά της εφαρμογής
// (lib/i18n/appEn.tsx): νέο λεξικό οθόνης χωρίς όνομα εδώ δεν περνά τον
// έλεγχο τύπων, οπότε η πρόταση δεν μένει πίσω από την εφαρμογή.
// ═══════════════════════════════════════════════════════════════════════════
import type { AppEnKey } from '@/lib/i18n/appEn';

/** Το όνομα κάθε αγγλικής οθόνης, όπως το γράφει το μενού (SHELL_EN.nav). */
export const APP_EN_SCREENS: Record<Exclude<AppEnKey, 'shell' | 'errors'>, string> = {
  overview: 'Overview',
  expenses: 'Expenses',
  tenants: 'Tenants',
  settings: 'Account',
};

const names = Object.values(APP_EN_SCREENS);

/** «Α, Β, Γ and Δ are in English.» Χωρίς κόμμα πριν από το «and», όπως στα ελληνικά. */
export const APP_LANGUAGE_EN =
  `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are in English. The rest of the app is in Greek for now.`;
