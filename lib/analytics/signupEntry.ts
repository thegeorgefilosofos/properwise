// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟ ΠΟΙΑ ΣΕΛΙΔΑ ΞΕΚΙΝΗΣΕ Η ΕΓΓΡΑΦΗ
// ─────────────────────────────────────────────────────────────────────────
// Οι σύνδεσμοι εγγραφής βάζουν `?from=` με μία λέξη από κλειστό κατάλογο:
// αρχική, οδηγός, υπολογιστής, πακέτα. Η σελίδα εγγραφής τη στέλνει στο ανώνυμο
// χωνί (lib/analytics/signupFunnel.ts) ως `p_entry`. Καμία διεύθυνση, κανένα
// αναγνωριστικό: ό,τι δεν είναι λέξη του καταλόγου γίνεται «other» εδώ, πριν
// φύγει και η βάση το ελέγχει ξανά (20261113163700).
//
// Μικρό αρχείο χωρίς εξαρτήσεις, ώστε οι σελίδες που φτιάχνουν τον σύνδεσμο να
// μην τραβούν τον κώδικα της μέτρησης.
// ═══════════════════════════════════════════════════════════════════════════

export const SIGNUP_ENTRIES = ['home', 'guide', 'calculator', 'pricing', 'other'] as const;
export type SignupEntry = typeof SIGNUP_ENTRIES[number];

const isEntry = (s: unknown): s is SignupEntry =>
  typeof s === 'string' && (SIGNUP_ENTRIES as readonly string[]).includes(s);

/** Η είσοδος από το `?from=` της διεύθυνσης· ό,τι άλλο (ή τίποτα) γίνεται «other». */
export function signupEntry(search: string): SignupEntry {
  let from: string | null = null;
  try { from = new URLSearchParams(search).get('from'); } catch { return 'other'; }
  return isEntry(from) ? from : 'other';
}

/**
 * Ο σύνδεσμος εγγραφής με το σημείο εισόδου. Κρατά ό,τι query και ό,τι #
 * έχει ήδη (`plan`, `cycle`, `next`) και αντικαθιστά ένα παλιό `from`.
 * Άγνωστη είσοδος ή «other»: ο σύνδεσμος μένει όπως ήταν.
 */
export function withSignupEntry(href: string, entry: SignupEntry): string {
  if (!isEntry(entry) || entry === 'other') return href;
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const base = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const qAt = base.indexOf('?');
  const path = qAt >= 0 ? base.slice(0, qAt) : base;
  const q = new URLSearchParams(qAt >= 0 ? base.slice(qAt + 1) : '');
  q.set('from', entry);
  return `${path}?${q.toString()}${hash}`;
}
