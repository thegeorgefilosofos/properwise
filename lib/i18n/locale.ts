// ═══════════════════════════════════════════════════════════════════════════
// ΔΥΟ ΓΛΩΣΣΕΣ ΣΤΗ ΒΙΤΡΙΝΑ, ΜΙΑ ΣΤΗΝ ΕΦΑΡΜΟΓΗ
// ─────────────────────────────────────────────────────────────────────────
// Οι δημόσιες σελίδες (αρχική, τιμές, εργαλεία, οδηγοί, είσοδος, εγγραφή,
// νομικά) υπάρχουν και στα αγγλικά, κάτω από το /en, για τον υποψήφιο
// επενδυτή και τον ξένο ιδιοκτήτη που θέλει να καταλάβει τι είναι το προϊόν.
// Η ίδια η εφαρμογή (/dashboard) μένει ελληνική.
//
// Η ΓΛΩΣΣΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗ ΔΙΑΔΡΟΜΗ ΚΑΙ ΜΟΝΟ ΑΠΟ ΑΥΤΗ. Οχι από cookie, όχι
// από το Accept-Language: η ίδια διεύθυνση δίνει πάντα την ίδια γλώσσα, σε
// άνθρωπο και σε μηχανή αναζήτησης. Το cookie θυμάται μόνο την ΕΠΙΛΟΓΗ του
// επισκέπτη, για να τον κρατά στη γλώσσα του όταν ακολουθεί σύνδεσμο.
// ═══════════════════════════════════════════════════════════════════════════

export type Locale = 'el' | 'en';

/** Το πρόθεμα των αγγλικών σελίδων. */
export const EN_PREFIX = '/en';

/** Το cookie της επιλογής γλώσσας («el» ή «en»). Το γράφει ο επιλογέας. */
export const LOCALE_COOKIE = 'pw_lang';

/** Η κεφαλίδα αιτήματος με τη γλώσσα της σελίδας, από το proxy.ts στη ρίζα. */
export const LOCALE_HEADER = 'x-pw-locale';

/**
 * Η κεφαλίδα της διακριτικής πρότασης «View in English»: η αγγλική διαδρομή
 * της ελληνικής σελίδας, όταν ο περιηγητής δεν μιλά ελληνικά και ο
 * επισκέπτης δεν έχει διαλέξει γλώσσα.
 */
export const SUGGEST_HEADER = 'x-pw-suggest-en';

/** Ενας χρόνος: η επιλογή γλώσσας δεν ξεχνιέται σε κάθε επίσκεψη. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isEnPath = (path: string): boolean => path === EN_PREFIX || path.startsWith(EN_PREFIX + '/');

export const localeOfPath = (path: string | null | undefined): Locale => (path && isEnPath(path) ? 'en' : 'el');

/** Η μορφή του Open Graph για κάθε γλώσσα. */
export const OG_LOCALE: Record<Locale, string> = { el: 'el_GR', en: 'en_US' };

/** Το όνομα κάθε γλώσσας στη δική της γλώσσα, όπως στον επιλογέα. */
export const LOCALE_NAME: Record<Locale, string> = { el: 'Ελληνικά', en: 'English' };

/** Η σύντομη ετικέτα του κουμπιού: «ΕΛ» και «EN». */
export const LOCALE_SHORT: Record<Locale, string> = { el: 'ΕΛ', en: 'EN' };

/**
 * Αν ο περιηγητής ΔΕΝ μιλά καθόλου ελληνικά. Μόνο τότε η ελληνική σελίδα
 * προτείνει, διακριτικά, την αγγλική της — ποτέ ανακατεύθυνση (οδηγία της
 * Google για σελίδες ανά γλώσσα). Χωρίς κεφαλίδα, όπως οι μηχανές
 * αναζήτησης, δεν προτείνεται τίποτα.
 */
export function browserLacksGreek(acceptLanguage: string | null | undefined): boolean {
  const tags = (acceptLanguage ?? '')
    .split(',')
    .map(part => part.trim().split(';')[0].trim().toLowerCase())
    .filter(t => t && t !== '*');
  if (!tags.length) return false;
  return !tags.some(t => t === 'el' || t.startsWith('el-'));
}
