// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΦΟΡΟΛΟΓΙΚΑ ΟΡΙΑ: ΠΟΤΕ ΤΑ ΕΙΔΕ ΑΝΘΡΩΠΟΣ ΚΑΙ ΑΠΟ ΠΟΥ, ΣΤΗΝ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// Το μητρώο ισχύος (lib/legal/validity.ts) ξέρει για κάθε κλίμακα, συντελεστή
// και τέλος πότε ελέγχθηκε και από ποια πηγή. Καμία οθόνη δεν το έδειχνε: οι
// δημόσιοι υπολογιστές έγραφαν τον νόμο χωρίς ημερομηνία και η κάρτα της
// κλίμακας στη Λογιστική ούτε τον νόμο. Εδώ δεν αντιγράφεται καμία ημερομηνία·
// διαβάζεται από το μητρώο. Η γραμμή γράφεται με το `asOfLine` του καταλόγου τιμών.
// ═══════════════════════════════════════════════════════════════════════════
import { regulated } from '@/lib/legal/validity';
import { feWhole, fpRate } from '@/lib/core/format';
import type { TaxBracket } from '@/lib/billing/greekTax';
import type { AsOf } from './prices';

/**
 * Τα όρια που εμφανίζει κάθε δημόσιος υπολογιστής και κάθε οθόνη φόρου, ως
 * εγγραφές του μητρώου ισχύος. Η «τελευταία ενημέρωση» μιας ομάδας είναι ο
 * ΠΑΛΑΙΟΤΕΡΟΣ έλεγχος των εγγραφών της: τόσο φρέσκια είναι η σελίδα όσο το
 * πιο παλιό της νούμερο.
 */
export const TAX_LIMIT_GROUPS = {
  rent: ['rental-brackets', 'presumptive-deduction'],
  business: ['business-brackets'],
  enfia: ['enfia-coefficients', 'enfia-thresholds'],
  short: ['climate-levy', 'rental-brackets', 'str-registry'],
  yield: ['rental-brackets', 'presumptive-deduction', 'enfia-coefficients'],
} as const;
export type TaxLimitGroup = keyof typeof TAX_LIMIT_GROUPS;

const GROUP_LABEL: Record<TaxLimitGroup, string> = {
  rent: 'Κλίμακα φόρου ενοικίων και τεκμαρτή έκπτωση',
  business: 'Κλίμακα επιχειρηματικής δραστηριότητας',
  enfia: 'Συντελεστές και όρια ΕΝΦΙΑ',
  short: 'Τέλος ανθεκτικότητας, κλίμακα ενοικίων, μητρώο βραχυχρόνιας',
  yield: 'Κλίμακα ενοικίων, τεκμαρτή έκπτωση, ΕΝΦΙΑ',
};

/** Πότε ελέγχθηκαν τα όρια μιας ομάδας και από πού, από το μητρώο ισχύος. */
export function taxLimitAsOf(group: TaxLimitGroup): AsOf {
  const rows = TAX_LIMIT_GROUPS[group].map(id => regulated(id));
  const oldest = rows.map(r => r.checkedAt).sort()[0] ?? null;
  return {
    label: GROUP_LABEL[group],
    checkedAt: oldest,
    source: 'μητρώο ισχύος της εφαρμογής, με τον νόμο ή την ΑΑΔΕ',
    url: rows[0]?.source,
  };
}

/**
 * Η κλίμακα σε μία πρόταση, από τα ίδια κλιμάκια που υπολογίζουν τον φόρο:
 * «15% έως 12.000€, 25% έως 24.000€, 35% έως 36.000€ και 45% πάνω από αυτά».
 * Οθόνη που έγραφε την ίδια φράση με το χέρι θα έμενε στην περσινή κλίμακα την
 * πρώτη φορά που αλλάζει ο νόμος.
 */
export function bracketsSentence(brackets: readonly TaxBracket[]): string {
  const parts = brackets.map(b => (Number.isFinite(b.to)
    ? `${fpRate(b.rate * 100)} έως ${feWhole(b.to)}`
    : `${fpRate(b.rate * 100)} πάνω από αυτά`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} και ${parts[parts.length - 1]}` : parts.join('');
}
