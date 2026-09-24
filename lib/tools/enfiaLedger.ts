// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΝΑΛΥΣΗ ΤΟΥ ΕΝΦΙΑ ΑΘΡΟΙΖΕΙ ΜΠΡΟΣΤΑ ΣΤΟΝ ΑΝΑΓΝΩΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ. Με τις προεπιλογές του δημόσιου υπολογιστή η σελίδα
// έγραφε «Κύριος φόρος 240,38€ · Μείωση −60,09€ · ΕΝΦΙΑ 180,28€». Όποιος
// έκανε την αφαίρεση έβρισκε 180,29€. Η μηχανή (lib/billing/enfia.ts) βγάζει
// μείωση και ετήσιο από τους ΑΣΤΡΟΓΓΥΛΟΥΣ αριθμούς και στρογγυλεύει τον καθένα
// χωριστά: 240,3799… × 25% = 60,0949… → 60,09, ενώ 240,38 × 25% = 60,095 → 60,10.
//
// ΤΙ ΚΑΝΕΙ ΕΔΩ. Το ετήσιο μένει αυτό της μηχανής (είναι το ίδιο νούμερο που
// βλέπει ο χρήστης μέσα στην εφαρμογή) και η μείωση που τυπώνεται είναι η
// διαφορά των ποσών που τυπώνονται. Ο αναγνώστης που αφαιρεί βρίσκει ακριβώς
// το ετήσιο· και η διαφορά ισούται με τη σωστή στρογγύλευση του ποσοστού πάνω
// στο στρογγυλό ποσό, οπότε δεν είναι τέχνασμα.
// ═══════════════════════════════════════════════════════════════════════════
import { ENFIA_WEALTH_REDUCTION, type ENFIAResult } from '@/lib/billing/enfia';

const cents = (n: number) => Math.round(n * 100) / 100;

/** Τα ποσά της ανάλυσης όπως τυπώνονται, με το ετήσιο της μηχανής ως σύνολο. */
interface EnfiaLedger { basic: number; extra: number; supplementary: number; reduction: number }

/**
 * Οι γραμμές της ανάλυσης, ώστε κύριος + πρόσθετος + προσαύξηση − μείωση =
 * ετήσιο, στο λεπτό.
 *
 * Με μείωση, η μείωση είναι η διαφορά. Χωρίς μείωση (περιουσία πάνω από τα
 * 400.000€) μένει ώς ένα λεπτό από τη χωριστή στρογγύλευση των τριών ποσών·
 * το παίρνει η τελευταία γραμμή που υπάρχει, όπως η τελευταία δόση παίρνει τη
 * διαφορά της στρογγυλοποίησης στον πίνακα των δόσεων.
 */
export function enfiaLedger(r: Pick<ENFIAResult, 'basic' | 'extra' | 'supplementary' | 'reductionPct' | 'annual'>): EnfiaLedger {
  const out = { basic: r.basic, extra: r.extra, supplementary: r.supplementary, reduction: 0 };
  const diff = cents(r.basic + r.extra + r.supplementary - r.annual);
  if (r.reductionPct > 0) out.reduction = Math.max(0, diff);
  else if (out.supplementary > 0) out.supplementary = cents(out.supplementary - diff);
  else if (out.extra > 0) out.extra = cents(out.extra - diff);
  else out.basic = cents(out.basic - diff);
  return out;
}

/**
 * Το ανώτατο όριο περιουσίας του κλιμακίου της αυτόματης μείωσης, ή `null`
 * όταν η περιουσία ξεπερνά κάθε κλιμάκιο με μείωση. Ο αναγνώστης δεν ξέρει ότι
 * το 25% κρίνεται από τη συνολική αξία· το όριο του το λέει.
 */
export function enfiaWealthBracketLimit(totalValue: number): number | null {
  const b = ENFIA_WEALTH_REDUCTION.find(x => totalValue <= x.limit);
  return b && b.pct > 0 && Number.isFinite(b.limit) ? b.limit : null;
}
