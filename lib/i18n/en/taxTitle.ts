// ═══════════════════════════════════════════════════════════════════════════
// Ο ΑΓΓΛΙΚΟΣ ΤΙΤΛΟΣ ΜΙΑΣ ΦΟΡΟΛΟΓΙΚΗΣ ΠΡΟΘΕΣΜΙΑΣ, ΑΠΟ ΤΟ ΕΙΔΟΣ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ο τίτλος βγαίνει από το είδος (`kind`) και τη σειρά της δόσης στο
// αναγνωριστικό, ποτέ από μετάφραση του ελληνικού `title`. Το αρχείο δεν
// εισάγει τίποτα, ώστε να το διαβάζουν και οι συναρτήσεις άκρης (Deno), που
// γράφουν τις υπενθυμίσεις: εκεί η προθεσμία φτάνει ως γραμμή του ημερολογίου
// με `source = "tax:<id>"` (lib/tax/greekTaxCalendar.ts, taxEventSource).
// ═══════════════════════════════════════════════════════════════════════════

const ordinal = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/** Ο,τι χρειάζεται ο τίτλος από μια υποχρέωση του ημερολογίου. */
export interface TaxTitleInput { kind: string; id: string; confidence?: string }

/** Ο τίτλος μιας υποχρέωσης, ή κενό για είδος που δεν υπάρχει. */
export function taxTitleEn(o: TaxTitleInput): string {
  const k = Number(o.id.split('-').pop());
  switch (o.kind) {
    case 'enfia-issue': return o.confidence === 'statutory' ? 'ENFIA: assessment notice issued' : 'ENFIA: assessment notice issued (expected)';
    case 'enfia-first': return 'ENFIA: 1st installment';
    case 'enfia-instalment': return Number.isFinite(k) ? `ENFIA: ${ordinal(k)} installment` : 'ENFIA: installment';
    case 'enfia-last': return 'ENFIA: last installment';
    case 'e9': return 'Form E9: check or report changes to your properties';
    case 'income-autofile': return 'Check the pre-filled tax return before it is filed automatically';
    case 'income-decl': return 'Income tax return (forms E1 and E2 for property)';
    case 'income-instalment': return Number.isFinite(k) ? `Income tax: ${ordinal(k)} installment` : 'Income tax: installment';
    case 'str-registry': return 'Short-term rental stays: monthly filing (AADE registry)';
    case 'str-climate-fee': return 'Climate crisis resilience fee: payment';
    default: return '';
  }
}

const TAX_SOURCE = /^tax:(([a-z0-9]+(?:-[a-z]+)*)-\d{4}(?:-\d{1,2})?)$/;

/**
 * Ο αγγλικός τίτλος μιας γραμμής ημερολογίου που έγραψε ο φορολογικός
 * συγχρονισμός, ή `null` για κάθε άλλη γραμμή (τον τίτλο της τον έγραψε ο
 * χρήστης και μένει όπως τον έγραψε).
 *
 * Το ελληνικό `title` διαβάζεται μόνο για δύο γεγονότα που δεν λέει το
 * αναγνωριστικό: αν το εκκαθαριστικό ΕΝΦΙΑ «αναμένεται» και αν ο φόρος
 * πληρώνεται σε μία δόση.
 */
export function taxEventTitleEn(source: string | null | undefined, greekTitle?: string | null): string | null {
  const m = TAX_SOURCE.exec(String(source ?? ''));
  if (!m) return null;
  const title = String(greekTitle ?? '');
  if (m[2] === 'enfia-first' && title.includes('μία δόση')) return 'ENFIA: payment in a single installment';
  const confidence = m[2] === 'enfia-issue' && title.includes('αναμένεται') ? 'announced' : 'statutory';
  return taxTitleEn({ kind: m[2], id: m[1], confidence }) || null;
}
