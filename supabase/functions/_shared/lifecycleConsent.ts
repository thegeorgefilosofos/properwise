// ═══════════════════════════════════════════════════════════════════════════
// ΕΜΠΟΡΙΚΟ EMAIL ΚΥΚΛΟΥ ΖΩΗΣ: ΦΕΥΓΕΙ ΜΟΝΟ ΜΕ ΡΗΤΟ «ΝΑΙ»
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Το send-lifecycle-email ρωτούσε `row.product_news !== false`.
// Οποιαδήποτε τιμή που δεν ήταν ακριβώς `false` (λείπει η στήλη, `null`,
// άλλο σχήμα απάντησης) μετρούσε ως συναίνεση και το εμπορικό μήνυμα έφευγε.
// Ο newsletter και το digest είχαν το ίδιο φίλτρο και διορθώθηκαν με τον ίδιο
// κανόνα (_shared/marketingAudience.ts): φεύγει μόνο με στήλη ακριβώς `true`
// και με διακριτικό απεγγραφής. Οτιδήποτε άλλο σημαίνει «όχι».
//
// Η επιλογή της εγγραφής δεν χάνεται: η γραμμή που δημιουργεί η
// `marketing_prefs_for_email` περνά από τον trigger `marketing_prefs_from_signup`,
// που την κλείνει για όποιον αρνήθηκε στην εγγραφή.
//
// ΤΑ ΣΥΝΑΛΛΑΚΤΙΚΑ ΔΕΝ ΠΕΡΝΟΥΝ ΑΠΟ ΕΔΩ. welcome, plan_upgraded, plan_downgraded,
// new_property και τα συναλλακτικά του καταλόγου φεύγουν πάντα· ο κανόνας
// αφορά ΜΟΝΟ όσα είναι στο COMMERCIAL ή στα DIGESTS.
// ═══════════════════════════════════════════════════════════════════════════

/** Τα events που είναι εμπορικά. Ολα τα άλλα είναι συναλλακτικά. */
export const COMMERCIAL = new Set([
  'upsell', 'seasonal', 'legislation', 'feedback', 'referral_invite', 'mobile_launch',
]);

export interface LifecyclePrefs { optedIn: boolean; unsubUrl: string }

/**
 * Από τη γραμμή της `marketing_prefs_for_email` στην απόφαση.
 * `null` όταν δεν υπάρχει γραμμή ή διακριτικό: ο καλών δεν στέλνει εμπορικό.
 */
export function prefsFromRow(data: unknown, appUrl: string): LifecyclePrefs | null {
  const row = (Array.isArray(data) ? data[0] : data) as { product_news?: unknown; unsubscribe_token?: unknown } | null | undefined;
  if (!row || typeof row !== 'object') return null;
  const token = typeof row.unsubscribe_token === 'string' ? row.unsubscribe_token.trim() : '';
  if (!token) return null;
  return { optedIn: row.product_news === true, unsubUrl: `${appUrl}/unsubscribe/${token}` };
}
