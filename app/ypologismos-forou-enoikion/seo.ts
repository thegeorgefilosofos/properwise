// ═══════════════════════════════════════════════════════════════════════════
// Η ΧΡΟΝΙΑ ΤΗΣ ΣΕΛΙΔΑΣ ΚΑΙ ΤΟ ΛΥΜΕΝΟ ΠΑΡΑΔΕΙΓΜΑ, ΑΠΟ ΤΗ ΜΗΧΑΝΗ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΖΟΥΝ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ page.tsx. Η σελίδα εξάγει μόνο ό,τι ορίζει ο Next. Η
// δοκιμή (app/toolSeo.test.ts) ΔΕΝ τα εισάγει: αποδίδει τη σελίδα, ανοίγει τον
// σύνδεσμο του παραδείγματος όπως ο υπολογιστής και ξαναϋπολογίζει ανεξάρτητα.
//
// ΚΑΝΕΝΑ ΠΟΣΟ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ (13.10.2026). Ο ιδιοκτήτης ζήτησε «12.000€
// ενοίκιο → 1.710€ φόρος, από τον υπάρχοντα υπολογιστή». Εδώ γράφονται μόνο οι
// δύο τιμές των πεδίων, όπως τις παίρνει ο υπολογιστής (μηνιαίο ενοίκιο και
// μήνες). Το ετήσιο, η έκπτωση, το φορολογητέο, ο φόρος και το κλιμάκιο
// βγαίνουν από τις ίδιες συναρτήσεις με το `r` του RentTaxCalculator.tsx, με
// την κλίμακα της χρονιάς (guard-tax-year). Αν αλλάξει ο νόμος, το παράδειγμα
// αλλάζει μαζί του.
//
// Η ΧΡΟΝΙΑ ΕΙΝΑΙ ΑΥΤΗ ΠΟΥ ΑΝΟΙΓΕΙ Ο ΥΠΟΛΟΓΙΣΤΗΣ. Ίδια κλήση με το
// `openingYear` του RentTaxCalculator.tsx: η τρέχουσα από τον Αύγουστο, η
// περσινή ως τον Ιούλιο (lib/core/declarationYear.ts). Η επικεφαλίδα, ο
// τίτλος και το παράδειγμα δεν μπορούν έτσι να λένε άλλη χρονιά από τη φόρμα
// που ανοίγει από κάτω τους.
// ═══════════════════════════════════════════════════════════════════════════
import { rentalIncomeTax, rentalBracketsForYear, FIRST_YEAR_NEW_BRACKETS } from '@/lib/billing/greekTax';
import { presumptiveDeductionRateForYear } from '@/lib/billing/presumptive';
import { incomeYearFor } from '@/lib/core/declarationYear';
import { toolQuery } from '@/lib/tools/permalink';
import { bracketSlices, rateScaleEach, ratePct } from '../odigos/taxText';
import { SPEC } from './spec';

const PATH = '/ypologismos-forou-enoikion';

/** Η χρονιά εισοδήματος με την οποία ανοίγει σήμερα ο υπολογιστής. */
export const rentPageYear = (today: string): number =>
  incomeYearFor('', today, FIRST_YEAR_NEW_BRACKETS - 1);

/** Η επικεφαλίδα: η φράση που ψάχνει ο ιδιοκτήτης, με τη χρονιά της φόρμας. */
export const rentH1 = (year: number): string =>
  `Φόρος ενοικίων ${year}: υπολογισμός με το δικό σου ενοίκιο`;

/** Ο τίτλος στη σελίδα αποτελεσμάτων. Ήταν «2026» γραμμένο με το χέρι. */
export const rentTitle = (year: number): string =>
  `Υπολογισμός φόρου ενοικίων ${year} με τα δικά σου δεδομένα`;

/**
 * Η περιγραφή για τη μηχανή αναζήτησης, με την ίδια χρονιά με τον τίτλο. Ήταν
 * σταθερή, «κλίμακα του 2026», ενώ ο τίτλος ακολουθεί τη χρονιά της φόρμας:
 * από τον Αύγουστο του 2027 θα έλεγαν άλλη χρονιά ο καθένας. Η κλίμακα και η
 * έκπτωση είναι αυτές που εφαρμόζει ο υπολογιστής για τη χρονιά (με είσπραξη
 * μέσω τράπεζας, όπως η προεπιλογή της φόρμας).
 */
export const rentDesc = (year: number): string =>
  `Υπολόγισε πόσο φόρο θα πληρώσεις για τα ενοίκιά σου με την κλίμακα του ${year} `
  + `(${rateScaleEach(rentalBracketsForYear(year))}) και την τεκμαρτή έκπτωση `
  + `${ratePct(presumptiveDeductionRateForYear(year, true))}. Δωρεάν, χωρίς εγγραφή.`;

// Οι δύο τιμές των πεδίων του παραδείγματος: 1.000€ τον μήνα για 12 μήνες.
const MONTHLY = 1_000;
const MONTHS = 12;

/**
 * Το λυμένο παράδειγμα της χρονιάς, με τη διεύθυνση που το ανοίγει στον
 * υπολογιστή. Η είσπραξη είναι μέσω τράπεζας, όπως η προεπιλογή της φόρμας.
 */
export function rentExample(year: number) {
  const brackets = rentalBracketsForYear(year);
  const gross = MONTHLY * MONTHS;
  const rate = presumptiveDeductionRateForYear(year, true);
  const taxable = gross * (1 - rate);
  const tax = rentalIncomeTax(taxable, brackets);
  return {
    monthly: MONTHLY, months: MONTHS, gross, rate, deduction: gross - taxable, taxable, tax, net: gross - tax,
    slices: bracketSlices(taxable, brackets),
    href: PATH + toolQuery(SPEC, { ...SPEC, enoikio: String(MONTHLY), mines: String(MONTHS), etos: String(year) }),
  };
}
