// ═══════════════════════════════════════════════════════════════════════════
// Η ΖΩΝΗ ΜΕΤΡΗΣΕΩΝ ΤΗΣ ΑΓΓΛΙΚΗΣ ΑΡΧΙΚΗΣ, ΧΩΡΙΣΤΑ ΑΠΟ ΤΑ ΚΕΙΜΕΝΑ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΔΙΚΟ ΤΗΣ ΑΡΧΕΙΟ. Το πλήθος των παρόχων βγαίνει από το PROVIDERS, που
// φέρνει ολόκληρο τον κατάλογο ρεύματος με τους πίνακες της ΡΑΑΕΥ. Τα κείμενα
// της αρχικής (landing.ts) τα διαβάζουν και οι κάρτες κοινοποίησης
// (app/og/shareEn.ts), δηλαδή τα μεταδεδομένα σχεδόν κάθε δημόσιας σελίδας·
// όσο ζούσαν μαζί, ο κατάλογος ανέβαινε στο ίχνος τριάντα συναρτήσεων που δεν
// τον καλούν ποτέ (scripts/server-weight.mjs). Εδώ τον φέρνει μόνο η σελίδα
// που δείχνει τη ζώνη (app/en/view.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import { RENTAL_TAX_BRACKETS_2026 } from '@/lib/billing/greekTax';
import { DOC_TYPES } from '@/lib/billing/documents';
import { PROVIDERS } from '@/lib/energy/catalogue';
import { READ_INSURERS } from '@/app/dashboard/components/insurance/catalog';
import { fmtFor } from '@/lib/core/format';

const f = fmtFor('en');
const rate = (r: number) => f.fpRate(r * 100);

/** Η ζώνη των τεσσάρων μετρήσεων. Ολα από την πηγή τους. */
export function statsEn() {
  const docKinds = DOC_TYPES.filter(d => d.id !== 'other').length;
  const low = rate(RENTAL_TAX_BRACKETS_2026[0].rate);
  const high = rate(RENTAL_TAX_BRACKETS_2026[RENTAL_TAX_BRACKETS_2026.length - 1].rate);
  return [
    { n: String(docKinds), u: 'document types', l: 'Bills, leases and government documents.' },
    { n: String(PROVIDERS.length), u: 'power providers', l: 'Their tariffs, with the month last checked.' },
    { n: String(READ_INSURERS), u: 'insurers', l: 'Home and commercial cover, compared by coverage.' },
    { n: String(RENTAL_TAX_BRACKETS_2026.length), u: 'tax brackets', l: `On rental income, ${low} to ${high} (Law 5246/2025).` },
  ];
}
