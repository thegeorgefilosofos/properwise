// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΛΙΜΑΚΑ ΤΩΝ ΕΝΟΙΚΙΩΝ ΣΕ ΛΕΞΕΙΣ, ΑΠΟ ΤΑ ΚΛΙΜΑΚΙΑ ΠΟΥ ΥΠΟΛΟΓΙΖΟΥΝ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ (07/10/2026). Ο κανόνας του αποθετηρίου λέει ότι οι αριθμοί
// φόρου βγαίνουν από τον κώδικα (lib/billing/**), όχι από το χέρι. Οι οδηγοί
// και ο υπολογιστής ενοικίων έγραφαν όμως «15 / 25 / 35 / 45%», «όριο 36.000€»
// και «1.800€ με 15%» ως κείμενο, σε πέντε αρχεία, δίπλα στον πίνακα που
// υπολογίζει. Αν άλλαζε ένα κλιμάκιο, ο υπολογισμός θα άλλαζε και το κείμενο όχι.
//
// Εδώ ζουν μόνο ΓΡΑΦΕΣ των κλιμακίων. Οι συντελεστές και τα όρια μένουν στο
// lib/billing/greekTax.ts· οι αριθμοί περνούν από τους κοινούς μορφοποιητές
// (lib/core/format), ώστε το «15%» και το «12.000€» να γράφονται όπως παντού.
//
// Χωρίς React και χωρίς 'use client': το διαβάζουν και ο υπολογιστής του
// πελάτη και οι οδηγοί του διακομιστή.
// ═══════════════════════════════════════════════════════════════════════════
import { fn, fpRate } from '@/lib/core/format';
import type { TaxBracket } from '@/lib/billing/greekTax';

/** Ο συντελεστής ως ποσοστό, όπως τον γράφει ο νόμος: 0.15 → «15%». */
export const ratePct = (rate: number): string => fpRate(rate * 100);

/** «15 / 25 / 35 / 45%»: οι συντελεστές με ένα σύμβολο στο τέλος. */
export const rateScale = (brackets: readonly TaxBracket[]): string =>
  `${brackets.map(b => fn(b.rate * 100)).join(' / ')}%`;

/** «15% / 25% / 35% / 45%»: κάθε συντελεστής με το σύμβολό του. */
export const rateScaleEach = (brackets: readonly TaxBracket[]): string =>
  brackets.map(b => ratePct(b.rate)).join(' / ');

/** «15%, 25%, 35% και 45%»: οι συντελεστές μέσα σε πρόταση. */
export function rateSeries(brackets: readonly TaxBracket[]): string {
  const parts = brackets.map(b => ratePct(b.rate));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} και ${parts[parts.length - 1]}` : parts.join('');
}

/** Πού ξεκινά το ανώτερο κλιμάκιο: πάνω από αυτό ισχύει ο ανώτερος συντελεστής. */
export const topBracketFrom = (brackets: readonly TaxBracket[]): number => brackets[brackets.length - 1].from;

/**
 * Το φορολογητέο κομμένο στα κλιμάκιά του: πλάτος, συντελεστής και φόρος του
 * καθενός. Το άθροισμα των `tax` είναι ακριβώς το `rentalIncomeTax` του ίδιου
 * ποσού, γιατί κάνει τον ίδιο υπολογισμό· το κείμενο «τα πρώτα 12.000€ με 15%»
 * διαβάζεται από εδώ αντί να γράφεται.
 */
export function bracketSlices(taxable: number, brackets: readonly TaxBracket[]) {
  return brackets
    .filter(b => taxable > b.from)
    .map(b => {
      const width = Math.min(taxable, b.to) - b.from;
      return { from: b.from, to: b.to, rate: b.rate, width, tax: width * b.rate };
    });
}
