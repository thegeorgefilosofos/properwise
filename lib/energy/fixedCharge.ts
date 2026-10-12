// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΑΓΙΟ ΤΟΥ ΡΕΥΜΑΤΟΣ, ΟΠΩΣ ΤΟ ΓΡΑΦΟΥΝ ΟΙ ΟΘΟΝΕΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΑΓΙΟ ΓΡΑΦΟΤΑΝ ΜΕ ΤΗΝ ΚΑΤΩ ΚΛΙΜΑΚΑ ΣΕ ΚΑΘΕ ΚΑΤΑΝΑΛΩΣΗ (12/10/2026). Το
// `monthlyCost` (lib/energy/tariff.ts) χρεώνει `fixed_tier2` όταν η κατανάλωση
// του μήνα ξεπερνά το `fixed_tier2_threshold`. Η κάρτα και η κατάταξη της
// καρτέλας «Ρεύμα» και η δημόσια σύγκριση τιμολογίων έγραφαν μόνο το κάτω
// πάγιο: πάνω από το όριο ο αριθμός «Πάγιο» και το ποσό του μήνα δεν έβγαιναν
// μεταξύ τους.
//
// ΠΟΙΑ ΤΙΜΟΛΟΓΙΑ. Ο πίνακας της ΡΑΑΕΥ (https://energycost.gr/, ανάγνωση
// 05/10/2026, lib/energy/raaeyData.json) γράφει το πάγιο σε δύο κλίμακες
// («0KWh - 150KWh / 7.95 151KWh + / 15.90») σε τέσσερις γραμμές: οικιακά 51
// (`nrg_adjust`) και 219 (`rx_pr_219`), επαγγελματικά 49 (`rx_pb_49`) και 167
// (`heron_blue_smart_biz`). Την ίδια μορφή έχουν και δύο τιμές Αυγούστου του
// παρόχου, χωρίς γραμμή της ΡΑΑΕΥ: `heron_blue_smart` και `nrg_adjust_biz`.
//
// ΜΙΑ ΣΥΝΑΡΤΗΣΗ, ΔΥΟ ΟΘΟΝΕΣ. Το BillsElectricity.tsx και το PowerCompare.tsx
// γράφουν το πάγιο μόνο από εδώ, ώστε να μην αποκλίνουν. Το fixedCharge.test.ts
// ελέγχει ότι το ποσό είναι αυτό που χρεώνει το `monthlyCost` γύρω από το
// όριο και ότι το «έως» της πρότασης είναι το ίδιο όριο. Το κάτω πάγιο
// ακολουθεί τον διακόπτη e-bill, το πάνω όχι, όπως στον υπολογισμό.
// ═══════════════════════════════════════════════════════════════════════════
import { fe, fn } from '@/lib/core/format';
import type { Tariff } from './tariff';

type FixedFields = Pick<Tariff, 'fixed' | 'fixed_ebill' | 'fixed_tier2' | 'fixed_tier2_threshold'>;

/** Το κάτω πάγιο, με τον διακόπτη e-bill. */
export const fixedBase = (t: FixedFields, ebill: boolean): number =>
  (ebill && t.fixed_ebill != null) ? t.fixed_ebill : t.fixed;

/** Η δεύτερη κλίμακα, όταν υπάρχει και αλλάζει το ποσό· αλλιώς `null`. */
export function fixedTier2(t: FixedFields, ebill: boolean): { fixed: number; threshold: number } | null {
  if (t.fixed_tier2 == null || t.fixed_tier2_threshold == null) return null;
  return t.fixed_tier2 === fixedBase(t, ebill) ? null : { fixed: t.fixed_tier2, threshold: t.fixed_tier2_threshold };
}

/** «7,95€», ή με δύο κλίμακες «7,95€ έως 150 kWh τον μήνα, 15,90€ πάνω από αυτές». */
export function fixedChargeText(t: FixedFields, ebill: boolean): string {
  const tier = fixedTier2(t, ebill);
  const base = fe(fixedBase(t, ebill));
  return tier ? `${base} έως ${fn(tier.threshold)} kWh τον μήνα, ${fe(tier.fixed)} πάνω από αυτές` : base;
}
