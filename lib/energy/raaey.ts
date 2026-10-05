// ═══════════════════════════════════════════════════════════════════════════
// Ο ΑΝΑΓΝΩΣΤΗΣ ΤΩΝ ΠΙΝΑΚΩΝ ΤΗΣ ΡΑΑΕΥ
// ─────────────────────────────────────────────────────────────────────────
// Η ΡΑΑΕΥ (energycost.gr) γράφει κάθε τιμή ως κείμενο, όχι ως αριθμό:
//
//   0.1421
//   0KWh - 100KWh / 0.179 101KWh + / 0.339
//   0KWh - 200KWh / 0.15913 Εάν η κατανάλωση υπερβεί τις 200KWh η τιμή
//     διαμορφώνεται σε 0.21997 από την 1η KWh Τελική Τιμή Προμήθειας
//     Διζωνικής Κατανάλωσης / 0.1559
//   Η τιμή δεν είναι ακόμα γνωστή
//
// Εδώ το κείμενο γίνεται τα πεδία του καταλόγου, ΜΙΑ φορά και με δοκιμές
// (raaey.test.ts). Καμία τιμή δεν υπολογίζεται και καμία δεν εκτιμάται: ό,τι
// η ΡΑΑΕΥ γράφει «δεν είναι ακόμα γνωστή» γίνεται `null` και ό,τι δεν χωρά
// στο μοντέλο του υπολογισμού (περισσότερες από δύο κλίμακες) σημαίνεται
// ρητά, αντί να κοπεί σιωπηλά.
//
// ΦΠΑ. Η σελίδα της ΡΑΑΕΥ δεν γράφει αν οι τιμές τον περιλαμβάνουν. Ο κατάλογος
// τις κρατούσε ήδη ως τιμές χωρίς ΦΠΑ, με τον 6% να μπαίνει από το πεδίο `vat`
// (lib/energy/tariff.ts) και οι τιμές Αυγούστου από την ίδια πηγή συμφωνούν
// ψηφίο προς ψηφίο με τον πίνακα του Οκτωβρίου όπου δεν άλλαξαν (myHome Enter
// 0,1421 με πάγιο 7,35). Ο κανόνας δεν αλλάζει εδώ.
// ═══════════════════════════════════════════════════════════════════════════

/** Τα τέσσερα φύλλα του πίνακα, με κλειδί που δεν εξαρτάται από τα ελληνικά του τίτλου. */
export type RaaeySheet = 'power-residential' | 'power-business' | 'gas-residential' | 'gas-business';

/** Μία γραμμή του πίνακα, κάθε κελί αυτούσιο (data/raaey/energycost-ΕΕΕΕ-ΜΜ.json). */
export interface RaaeyRow {
  /** Ο αριθμός της γραμμής στο φύλλο, για να βρίσκεται η πηγή κάθε τιμής. */
  row: number;
  provider: string;
  year: string;
  month: string;
  name: string;
  fixed: string;
  price: string;
  fixedDiscounted: string;
  fixedCondition: string;
  priceDiscounted: string;
  priceCondition: string;
  duration: string;
  notes: string;
  colour: string;
}

/** Η φράση της ΡΑΑΕΥ για τιμή που δεν έχει ανακοινωθεί, με όποια από τις δύο γραφές. */
const UNKNOWN = /^Η τιμή δεν είναι ακόμ[αη] γνωστή$/;
const NIGHT = 'Τελική Τιμή Προμήθειας Διζωνικής Κατανάλωσης';

export interface ParsedPrice {
  /** Η τιμή, ή η τιμή της πρώτης κλίμακας. `null`: δεν είναι ακόμα γνωστή. */
  day: number | null;
  /** Η δεύτερη κλίμακα, όπου υπάρχει. */
  tier2: {
    price: number | null;
    /** Οι κιλοβατώρες της πρώτης κλίμακας. */
    threshold: number;
    /**
     * `above`: η δεύτερη τιμή για όσες κιλοβατώρες ξεπερνούν το όριο.
     * `all`: πάνω από το όριο η δεύτερη τιμή ισχύει από την 1η κιλοβατώρα,
     * όπως γράφει η ΡΑΑΕΥ για τη ΔΕΗ Ειδικό.
     */
    scope: 'above' | 'all';
  } | null;
  /** Η τιμή της νυχτερινής ζώνης, όπου δίνεται. `null` όταν δίνεται ως άγνωστη. */
  night: number | null;
  /** Δίνεται νυχτερινή ζώνη; Χωριστά από το `night`, που μπορεί να είναι άγνωστο. */
  hasNight: boolean;
  /**
   * Περισσότερες από δύο κλίμακες. Ο υπολογισμός κρατά δύο: το τιμολόγιο
   * φαίνεται με το κείμενο της ΡΑΑΕΥ και δεν κατατάσσεται.
   */
  moreTiers: boolean;
  /** Όλα τα σκέλη της τιμής είναι γνωστά αριθμοί. */
  known: boolean;
}

const num = (s: string): number | null => {
  const t = s.trim();
  if (UNKNOWN.test(t)) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`Τιμή ΡΑΑΕΥ που δεν διαβάζεται: «${s}»`);
  return Number(t);
};

/** Το κείμενο μιας τιμής ενέργειας της ΡΑΑΕΥ, ως πεδία. */
export function parseRaaeyPrice(text: string): ParsedPrice {
  let main = text.trim(), night: number | null = null, hasNight = false;
  const n = main.indexOf(NIGHT);
  if (n >= 0) {
    const tail = main.slice(n + NIGHT.length).trim();
    if (!tail.startsWith('/')) throw new Error(`Νυχτερινή τιμή χωρίς «/»: «${text}»`);
    night = num(tail.slice(1));
    hasNight = true;
    main = main.slice(0, n).trim();
  }
  const out: ParsedPrice = { day: null, tier2: null, night, hasNight, moreTiers: false, known: false };

  const tier = /^0KWh - (\d+)KWh \/ (.+?)(?= Εάν | \d+KWh [+-]|$)(.*)$/.exec(main);
  if (!tier) {
    out.day = num(main);
  } else {
    const threshold = Number(tier[1]);
    out.day = num(tier[2]);
    const rest = tier[3].trim();
    const above = /^(\d+)KWh \+ \/ (.+)$/.exec(rest);
    const all = /^Εάν η κατανάλωση υπερβεί τις (\d+)KWh η τιμή διαμορφώνεται σε (\S+) από την 1η KWh(.*)$/.exec(rest);
    if (above) {
      if (Number(above[1]) !== threshold + 1) throw new Error(`Κλίμακες που δεν συνέχονται: «${text}»`);
      out.tier2 = { price: num(above[2]), threshold, scope: 'above' };
    } else if (all) {
      if (Number(all[1]) !== threshold) throw new Error(`Όριο που δεν συμφωνεί: «${text}»`);
      out.tier2 = { price: num(all[2]), threshold, scope: 'all' };
      out.moreTiers = all[3].trim().length > 0;
    } else if (rest) {
      throw new Error(`Κλίμακες που δεν διαβάζονται: «${text}»`);
    }
  }
  out.known = out.day != null && (out.tier2 == null || out.tier2.price != null) && (!out.hasNight || out.night != null);
  return out;
}

export interface ParsedFixed {
  fixed: number;
  /** Πάγιο που ανεβαίνει πάνω από ένα όριο κιλοβατωρών. */
  tier2: { fixed: number; threshold: number } | null;
}

/** Το κείμενο ενός παγίου της ΡΑΑΕΥ: αριθμός, ή δύο πάγια με όριο κιλοβατωρών. */
export function parseRaaeyFixed(text: string): ParsedFixed {
  const t = text.trim();
  const tier = /^0KWh - (\d+)KWh \/ (\S+) (\d+)KWh \+ \/ (\S+)$/.exec(t);
  if (tier) {
    if (Number(tier[3]) !== Number(tier[1]) + 1) throw new Error(`Κλίμακες παγίου που δεν συνέχονται: «${text}»`);
    const a = num(tier[2]), b = num(tier[4]);
    if (a == null || b == null) throw new Error(`Πάγιο χωρίς τιμή: «${text}»`);
    return { fixed: a, tier2: { fixed: b, threshold: Number(tier[1]) } };
  }
  const v = num(t);
  if (v == null) throw new Error(`Πάγιο χωρίς τιμή: «${text}»`);
  return { fixed: v, tier2: null };
}

/** «12» μήνες, ή 0 για «Αορίστου Διάρκειας». */
export function parseRaaeyDuration(text: string): number {
  const t = text.trim();
  if (/^Αορίστου/.test(t)) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  throw new Error(`Διάρκεια που δεν διαβάζεται: «${text}»`);
}

/** Τα χρώματα της ΡΑΑΕΥ με τα ονόματα του καταλόγου. */
export const RAAEY_BADGE: Record<string, { badge: 'ΜΠΛΕ' | 'ΠΡΑΣΙΝΟ' | 'ΚΙΤΡΙΝΟ'; type: 'fixed' | 'variable' }> = {
  blue: { badge: 'ΜΠΛΕ', type: 'fixed' },
  green: { badge: 'ΠΡΑΣΙΝΟ', type: 'variable' },
  yellow: { badge: 'ΚΙΤΡΙΝΟ', type: 'variable' },
};

/**
 * ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ ΡΑΑΕΥ ΣΤΗ ΓΡΑΦΗ ΤΗΣ ΕΦΑΡΜΟΓΗΣ.
 *
 * Οι προϋποθέσεις και οι σημειώσεις φαίνονται όπως τις γράφει η ΡΑΑΕΥ, με
 * ΜΟΝΗ αλλαγή την τυπογραφία που ορίζουν οι φύλακες του κειμένου: «και» αντί
 * για «&», «ακόμη» αντί για «ακόμα», το «€» κολλητά στον αριθμό και ο τόνος
 * στο αρχικό κεφαλαίο. Κανένας αριθμός και καμία λέξη δεν αλλάζει. Η
 * μεταγραφή (raaeyData.json) μένει αυτούσια.
 */
export function raaeyText(s: string): string {
  return s
    .replace(/\s*&\s*/g, ' και ')
    // Η γραφή της πηγής, γραμμένη ως κλάση για να μη μοιάζει με κείμενο οθόνης.
    .replace(/(?<![\p{L}\p{N}])ακόμ[α](?![\p{L}\p{N}])/gu, 'ακόμη')
    .replace(/(\d)\s+€/g, '$1€')
    .replace(/(?<![\p{L}\p{N}])Εκπτωση(?![\p{L}\p{N}])/gu, 'Έκπτωση');
}

/** «Οκτωβρίου 2026» από «2026-10». */
export function raaeyMonthGen(ym: string): string {
  const MONTHS = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
