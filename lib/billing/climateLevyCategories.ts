// ═══════════════════════════════════════════════════════════════════════════
// ΤΕΛΟΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ: ΟΙ ΚΑΤΗΓΟΡΙΕΣ ΠΟΥ Η ΜΗΧΑΝΗ ΔΕΝ ΥΠΟΛΟΓΙΖΕΙ ΑΚΟΜΗ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ (05.10.2026). Ο οδηγός «Φορολογία Airbnb 2026» δείχνει πίνακα με
// έξι κατηγορίες καταλυμάτων, ενώ η εφαρμογή υπολογίζει μόνο τις δύο της
// βραχυχρόνιας μίσθωσης (CLIMATE_LEVY_FROM_2025 στο greekTax.ts). Τα υπόλοιπα
// ποσά θα γράφονταν με το χέρι μέσα στο κείμενο της σελίδας. Ζουν εδώ, με την
// πηγή τους και με δοκιμή που τα καρφώνει (climateLevyCategories.test.ts).
//
// ΟΙ ΓΡΑΜΜΕΣ ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ ΔΕΝ ΞΑΝΑΓΡΑΦΟΝΤΑΙ: είναι οι ίδιες αναφορές στο
// CLIMATE_LEVY_FROM_2025 που χρεώνει ο υπολογισμός. Αν αλλάξει ο νόμος, αλλάζει
// εκεί και ο πίνακας ακολουθεί.
//
// ΠΗΓΗ ΤΩΝ ΥΠΟΛΟΙΠΩΝ ΠΟΣΩΝ (ισχύουν από 1.1.2025): άρθρο 44 ν.5177/2025 (ΦΕΚ Α΄
// 21/14.02.2025), κωδικοποίηση του πρώην άρθρου 53 ν.4389/2016 όπως
// αντικαταστάθηκε με το άρθρο 30 ν.5073/2023 και τροποποιήθηκε με το άρθρο 24
// ν.5162/2024 · διαδικασία Α.1217/2023 όπως τροποποιήθηκε με την Α.1202/2024
// (ΦΕΚ Β΄ 7301/31.12.2024). Υψηλή περίοδος Απρίλιος έως Οκτώβριος, χαμηλή
// Νοέμβριος έως Μάρτιος (isHighSeasonMonth).
//
// ΔΙΑΣΤΑΥΡΩΣΗ (05.10.2026). Τα τέσσερα ποσά εκτός βραχυχρόνιας ελέγχθηκαν με
// το κείμενο του άρθρου 44 ν.5177/2025 (taxheaven.gr/law/5177/2025/arthro/44)
// και με τρεις ανεξάρτητες δημοσιεύσεις των ποσών του 2025 (naftemporiki.gr
// 1872264, taxheaven.gr/news/68586, pelatologio.gr): επιπλωμένα δωμάτια 2€ και
// 0,50€, τουριστική κατοικία κάτω των 80 τ.μ. 8€ και 2€, από 80 τ.μ. και άνω
// 15€ και 4€, έπαυλη 15€ και 4€. Συμφωνούν όλες.
//
// Το τέλος παρεπιδημούντων: 0,5% (MUNICIPAL_ACCOM_TAX_RATE, greekTax.ts) και
// έως 0,75% με απόφαση δημοτικού συμβουλίου, άρθρο 30 ν.5143/2024 (ΦΕΚ Α΄
// 161/11.10.2024).
// ═══════════════════════════════════════════════════════════════════════════
import { CLIMATE_LEVY_FROM_2025, climateLevyRates, isHighSeasonMonth, climateLevyForNights } from './greekTax';

/** Ποσά ανά ημερήσια χρήση: υψηλή (Απρ–Οκτ) και χαμηλή (Νοε–Μαρ) περίοδος. */
type LevyRates = { readonly high: number; readonly low: number };

/**
 * ΤΟ ΚΑΤΩΦΛΙ ΤΩΝ ΤΕΤΡΑΓΩΝΙΚΩΝ. Στη μονοκατοικία βραχυχρόνιας το υψηλό ποσό
 * ισχύει ΑΝΩ των 80 τ.μ. (`climateLevyRates`, >80)· στην τουριστική επιπλωμένη
 * κατοικία ΑΠΟ 80 τ.μ. και πάνω (≥80). Ο αριθμός είναι ένας· η δοκιμή ελέγχει
 * ότι συμφωνεί με αυτόν που χρεώνει το `climateLevyRates`.
 */
export const CLIMATE_LEVY_AREA_SQM = 80;

/** Οι κατηγορίες του πίνακα, με τη σειρά του άρθρου 44 ν.5177/2025 όπως τη δείχνει ο οδηγός. */
export type ClimateLevyCategory =
  | 'str-small'           // διαμέρισμα βραχυχρόνιας (οποιοδήποτε εμβαδόν) ή μονοκατοικία έως 80 τ.μ.
  | 'str-house-large'     // μονοκατοικία βραχυχρόνιας άνω των 80 τ.μ.
  | 'tourist-small'       // τουριστική επιπλωμένη κατοικία κάτω των 80 τ.μ.
  | 'tourist-large'       // τουριστική επιπλωμένη κατοικία από 80 τ.μ. και άνω
  | 'tourist-villa'       // τουριστική επιπλωμένη έπαυλη (βίλα)
  | 'furnished-rooms';    // ενοικιαζόμενα επιπλωμένα δωμάτια – διαμερίσματα

export const CLIMATE_LEVY_CATEGORIES: readonly { id: ClimateLevyCategory; rates: LevyRates }[] = [
  // Η βραχυχρόνια: οι ίδιες τιμές που χρεώνει η εφαρμογή.
  { id: 'str-small', rates: CLIMATE_LEVY_FROM_2025.small },
  { id: 'str-house-large', rates: CLIMATE_LEVY_FROM_2025.large },
  // Άρθρο 44 ν.5177/2025 · Α.1202/2024. Δεν τις υπολογίζει ακόμη η εφαρμογή.
  { id: 'tourist-small', rates: { high: 8, low: 2 } },
  { id: 'tourist-large', rates: { high: 15, low: 4 } },
  { id: 'tourist-villa', rates: { high: 15, low: 4 } },
  { id: 'furnished-rooms', rates: { high: 2, low: 0.5 } },
];

/**
 * Το ανώτατο τέλος παρεπιδημούντων με απόφαση δημοτικού συμβουλίου: 0,75%
 * επί του μισθώματος, άρθρο 30 ν.5143/2024. Το βασικό 0,5% είναι το
 * MUNICIPAL_ACCOM_TAX_RATE του greekTax.ts.
 */
export const MUNICIPAL_ACCOM_TAX_MAX_RATE = 0.0075;

/** Ένας μήνας μιας διαμονής: ποιες νύχτες πέφτουν μέσα του και τι τέλος γράφουν. */
export type StayMonth = {
  year: number;
  /** 0 = Ιανουάριος. */
  month0: number;
  /** Η πρώτη και η τελευταία νύχτα του μήνα (ημέρα του μήνα). */
  firstNight: number;
  lastNight: number;
  nights: number;
  /** Το ποσό ανά ημερήσια χρήση στον μήνα, από τη μηχανή. */
  rate: number;
  /** nights × rate, από το `climateLevyForNights`. */
  levy: number;
  /** Η προθεσμία της μηνιαίας δήλωσης απόδοσης για τα στοιχεία του μήνα (ISO). */
  deadline: string;
};

const DAY = 86_400_000;
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Η ΠΡΟΘΕΣΜΙΑ ΤΗΣ ΔΗΛΩΣΗΣ ΑΠΟΔΟΣΗΣ: η τελευταία ημέρα του μήνα που ακολουθεί
 * τον μήνα έκδοσης του ειδικού στοιχείου (FAQ ΑΑΔΕ, ερ. 7 · Α.1202/2024).
 */
export function levyReturnDeadline(year: number, month0: number): string {
  return isoOf(Date.UTC(year, month0 + 2, 0));
}

/**
 * ΤΟ ΤΕΛΟΣ ΜΙΑΣ ΔΙΑΜΟΝΗΣ, ΑΝΑ ΜΗΝΑ. Όταν η διαμονή καλύπτει μήνες με
 * διαφορετικό ύψος τέλους, το ειδικό στοιχείο εκδίδεται για κάθε μήνα
 * ξεχωριστά (FAQ ΑΑΔΕ, ερ. 7). Οι νύχτες μετρούν από την άφιξη ως την
 * παραμονή της αναχώρησης· το ποσό και η περίοδος έρχονται από το
 * `climateLevyForNights`, το ίδιο που τρέχει ο υπολογισμός της εφαρμογής.
 */
export function levyByMonth(arrival: string, departure: string, sqm?: number | null, isHouse?: boolean): StayMonth[] {
  const out: StayMonth[] = [];
  const end = Date.parse(`${departure}T00:00:00Z`);
  for (let t = Date.parse(`${arrival}T00:00:00Z`); t < end; t += DAY) {
    const d = new Date(t);
    const year = d.getUTCFullYear(), month0 = d.getUTCMonth(), day = d.getUTCDate();
    const last = out.at(-1);
    if (last && last.year === year && last.month0 === month0) {
      last.lastNight = day;
      last.nights += 1;
    } else {
      out.push({ year, month0, firstNight: day, lastNight: day, nights: 1, rate: 0, levy: 0, deadline: levyReturnDeadline(year, month0) });
    }
  }
  const r = climateLevyRates(sqm, isHouse);
  for (const m of out) {
    m.rate = isHighSeasonMonth(m.month0) ? r.high : r.low;
    m.levy = climateLevyForNights(Array.from({ length: 12 }, (_, i) => (i === m.month0 ? m.nights : 0)), sqm, isHouse);
  }
  return out;
}
