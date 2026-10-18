// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΙΚΕΦΑΛΙΔΑ ΚΑΙ ΤΑ ΔΥΟ ΠΑΡΑΔΕΙΓΜΑΤΑ ΕΝΦΙΑ, ΑΠΟ ΤΗ ΜΗΧΑΝΗ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΖΟΥΝ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ page.tsx για τον ίδιο λόγο με το seo.ts του φόρου
// ενοικίων: η σελίδα εξάγει μόνο ό,τι ορίζει ο Next. Η δοκιμή
// (app/toolSeo.test.ts) ανοίγει κάθε παράδειγμα στον υπολογιστή και συγκρίνει.
//
// ΤΑ ΠΟΣΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΗΝ ΙΔΙΑ ΚΛΗΣΗ ΜΕ ΤΟ EnfiaCalculator.tsx (13.10.2026):
// `estimateENFIA` με ιδιοκτησία 100%, χωρίς βοηθητικούς χώρους και αξία ίση με
// τα τετραγωνικά επί την τιμή ζώνης. Εδώ γράφονται μόνο τα στοιχεία των δύο
// ακινήτων· ο συντελεστής, η μείωση και το ετήσιο ποσό είναι της μηχανής, με
// τους δύο κανόνες των παλιών κτιρίων του Μέρους 2 (0,8 και 0,60, άρθρο 11
// ν.5219/2025, πηγή στο lib/billing/enfia.ts).
//
// ΓΙΑΤΙ ΑΥΤΑ ΤΑ ΔΥΟ ΑΚΙΝΗΤΑ. Το πρώτο είναι το συνηθισμένο διαμέρισμα· το
// δεύτερο είναι το κτίριο του 1925 με τα 80 τ.μ. που έδωσε ο ιδιοκτήτης για το
// 0,60. Και στα δύο η αξία τ.μ. × τιμή ζώνης μένει κάτω από το πρώτο όριο της
// μείωσης, όπως και η φορολογητέα αξία του άρθρου 6 ΚΦΠ με τον Σ. Παλαιότητας
// 0,60: η μείωση βγαίνει ίδια με όποια από τις δύο αξίες κι αν κριθεί. Με
// μεγαλύτερη τιμή ζώνης οι δύο αξίες μπορούν να πέσουν σε άλλο κλιμάκιο (το
// ανοιχτό ερώτημα της τιμής ζώνης του Μέρους 2, που περιμένει απόφαση).
//
// Η ΠΑΛΑΙΟΤΗΤΑ ΑΠΟ ΤΟ ΕΤΟΣ ΑΝΕΓΕΡΣΗΣ, ΜΕ ΤΗ ΣΥΝΑΡΤΗΣΗ ΤΗΣ ΜΗΧΑΝΗΣ. Τον ΕΝΦΙΑ
// του 2026 το 1925 είναι «άνω των 100 ετών»· το κλιμάκιο ακολουθεί τη χρονιά
// της σελίδας χωρίς να ξαναγραφτεί.
// ═══════════════════════════════════════════════════════════════════════════
import {
  estimateENFIA, zoneKeyFromPricePerSqm, enfiaAgeKeyFromYearBuilt, enfiaAgeChoices,
  enfiaFloorCoef, enfiaAgeCoef, ENFIA_ZONE_TAX,
} from '@/lib/billing/enfia';
import { ENFIA_FLOOR_SHORT } from '@/lib/billing/enfiaFloors';
import { enfiaLedger, enfiaWealthBracketLimit } from '@/lib/tools/enfiaLedger';
import { toolQuery } from '@/lib/tools/permalink';
import { SPEC } from './spec';

const PATH = '/ypologismos-enfia';

/** Η επικεφαλίδα: η φράση που ψάχνει ο ιδιοκτήτης, με το έτος του υπολογισμού. */
export const enfiaH1 = (year: number): string => `ΕΝΦΙΑ ${year}: υπολογισμός για το δικό σου ακίνητο`;

// Τα στοιχεία των δύο ακινήτων, όπως τα παίρνουν τα πεδία του υπολογιστή.
const EXAMPLES = [
  { name: 'διαμέρισμα', sqm: 90, zonePrice: 1_000, floor: 'second', built: 1985 },
  { name: 'ισόγειο κτιρίου', sqm: 80, zonePrice: 700, floor: 'ground', built: 1925 },
] as const;

/** Τα δύο παραδείγματα για τον ΕΝΦΙΑ ενός έτους, με τη διεύθυνση που ανοίγει το καθένα. */
export function enfiaExamples(year: number) {
  const ages = enfiaAgeChoices(year);
  return EXAMPLES.map(e => {
    const zone = zoneKeyFromPricePerSqm(e.zonePrice);
    const age = enfiaAgeKeyFromYearBuilt(e.built, year);
    const value = e.sqm * e.zonePrice;
    const r = zone && age
      ? estimateENFIA({ sqm: e.sqm, auxSqm: 0, zone, floor: e.floor, age, ownership: 100, totalValue: value, propertyValue: value })
      : null;
    // Ένα παράδειγμα που δεν υπολογίζεται είναι σφάλμα του αρχείου, όχι κενό στη σελίδα.
    if (!zone || !age || !r) throw new Error(`Το παράδειγμα ΕΝΦΙΑ ${e.name} ${e.built} δεν υπολογίζεται για το ${year}.`);
    return {
      ...e, zone, age, value,
      floorLabel: ENFIA_FLOOR_SHORT[e.floor],
      ageLabel: ages.find(a => a.key === age)?.label ?? age,
      zoneTax: ENFIA_ZONE_TAX[zone] ?? 0,
      floorCoef: enfiaFloorCoef(e.floor),
      ageCoef: enfiaAgeCoef(age),
      ledger: enfiaLedger(r),
      reductionPct: r.reductionPct,
      bracket: enfiaWealthBracketLimit(value),
      annual: r.annual,
      href: PATH + toolQuery(SPEC, { ...SPEC, tm: String(e.sqm), zoni: String(e.zonePrice), orofos: e.floor, palaiotita: age }),
    };
  });
}
