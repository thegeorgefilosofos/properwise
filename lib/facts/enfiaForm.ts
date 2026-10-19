// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΟΡΜΑ ΤΟΥ ΠΙΝΑΚΑ ΕΝΦΙΑ ΣΤΗ ΜΗΧΑΝΗ, ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Χωριστό αρχείο από το lib/facts/enfia.ts για το βάρος: ο Προϋπολογισμός
// χρειάζεται μόνο αυτή τη μετάφραση, όχι το ημερολόγιο των δόσεων.
// ═══════════════════════════════════════════════════════════════════════════
import { estimateENFIA, enfiaAgeKeyFromYearBuilt, normalizeEnfiaAgeKey, type ENFIAResult } from '@/lib/billing/enfia';

const num = (v: unknown): number => parseFloat(String(v ?? '')) || 0;

/** Τα πεδία της φόρμας, όπως τα αποθηκεύει η ενότητα ρυθμίσεων «services». */
type EnfiaFormKey = 'enfiaSqm' | 'enfiaZone' | 'enfiaFloor' | 'enfiaAge' | 'enfiaOwnership'
  | 'enfiaTotalVal' | 'enfiaPropVal' | 'enfiaReductions';

// ═══ ΤΑ ΔΥΟ ΚΛΕΙΔΙΑ ΤΩΝ ΠΑΛΙΩΝ ΚΤΙΡΙΩΝ ΛΗΓΟΥΝ ΜΕ ΤΟ ΕΤΟΣ ═══════════════════
// Η επιλογή «Παλαιότητα» αποθηκεύεται ως κλειδί, χωρίς έτος. Το «πριν από το
// 1930» (0,8) και το «άνω των 100 ετών» (0,60) όμως δεν είναι κλιμάκια ετών:
// κρίνονται από το έτος ανέγερσης ΚΑΙ το έτος φορολογίας (lib/billing/enfia.ts,
// `enfiaOldBuildingKey`). Ένα κτίριο του 1927 που κρατούσε «pre1930» το 2026
// θα έμενε στο 0,8 και τον ΕΝΦΙΑ 2028, όταν είναι πια 101 ετών και ισχύει το
// 0,60. Όταν η καρτέλα του ακινήτου έχει έτος κατασκευής, το κλειδί αυτών των
// δύο βγαίνει από εκείνο. Τα κλειδιά του πίνακα (y0_4 … y26_plus) μένουν όπως
// τα διάλεξε ο ιδιοκτήτης και έτος που λείπει ή είναι απίθανο αφήνει το
// αποθηκευμένο όπως είναι.
const YEAR_BOUND_AGE_KEYS = new Set(['pre1930', 'over100']);

/** Το κλειδί παλαιότητας που μετρά: το αποθηκευμένο, ή το έτος ανέγερσης για τα παλιά κτίρια. */
export function effectiveEnfiaAge(
  stored: unknown, yearBuilt: number | string | null | undefined, year: number,
): string {
  const k = typeof stored === 'string' ? stored : '';
  if (!YEAR_BOUND_AGE_KEYS.has(normalizeEnfiaAgeKey(k))) return k;
  return enfiaAgeKeyFromYearBuilt(yearBuilt, year) ?? k;
}

/**
 * Η εκτίμηση από τη φόρμα του πίνακα ΕΝΦΙΑ, ή `null` όταν δεν έχει ζώνη και
 * εμβαδόν. Η ΜΙΑ ανάγνωση των ρυθμίσεων για Λογιστική και Προϋπολογισμό.
 *
 * ΤΟ ΣΦΑΛΜΑ, ΜΕΤΡΗΜΕΝΟ (13.10.2026). Ο Προϋπολογισμός διάβαζε τις ίδιες
 * ρυθμίσεις με δική του κλήση και έβαζε «2ος όροφος» όταν ο όροφος έλειπε
 * (`svc.enfiaFloor || 'second'`), αντίθετα με τον κανόνα της μηχανής ότι το
 * άγνωστο είναι 1,00. Ίδιο διαμέρισμα 90 τ.μ., ζώνη 751 έως 1.500, 26+ ετών,
 * χωρίς όροφο: 254,52€ (21,21€ τον μήνα) στον Προϋπολογισμό, 252,00€ (21,00€)
 * στη Λογιστική, στην Επισκόπηση και στη Νόα.
 *
 * Δέχεται `unknown` στα πεδία: ο Προϋπολογισμός διαβάζει τις ρυθμίσεις ως
 * ελεύθερο αντικείμενο και ένα κατεστραμμένο `enfiaReductions` δεν πρέπει να
 * ρίξει την οθόνη.
 */
export function enfiaFromSettings(
  s: Partial<Record<EnfiaFormKey, unknown>>, year: number, atticaMainland: boolean | null,
  /** Το έτος κατασκευής της καρτέλας, όταν υπάρχει· βλ. `effectiveEnfiaAge`. */
  yearBuilt?: number | string | null,
): ENFIAResult | null {
  // Ο όροφος και η παλαιότητα περνούν ΟΠΩΣ ΕΙΝΑΙ: κενό σημαίνει άγνωστο και η
  // μηχανή το μεταφράζει σε 1,00. Καμία προεπιλογή που να σπρώχνει προς τα πάνω.
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v) || undefined;
  return estimateENFIA({
    sqm: num(s.enfiaSqm),
    zone: str(s.enfiaZone) ?? '',
    floor: str(s.enfiaFloor),
    age: str(effectiveEnfiaAge(s.enfiaAge, yearBuilt, year)),
    ownership: num(s.enfiaOwnership) || 100,
    totalValue: num(s.enfiaTotalVal),
    propertyValue: num(s.enfiaPropVal),
    reductions: Array.isArray(s.enfiaReductions) ? s.enfiaReductions.filter((r): r is string => typeof r === 'string') : [],
    atticaMainland,
    year,
  });
}
