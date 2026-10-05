// ═══════════════════════════════════════════════════════════════════════════
// ΑΠΟ ΤΗ ΓΡΑΜΜΗ ΤΗΣ ΡΑΑΕΥ ΣΤΟ ΤΙΜΟΛΟΓΙΟ ΤΟΥ ΚΑΤΑΛΟΓΟΥ
// ─────────────────────────────────────────────────────────────────────────
// Ένας δρόμος για όλα: τα τιμολόγια που υπήρχαν ήδη στον κατάλογο και
// ενημερώθηκαν από τον πίνακα του μήνα κουβαλούν `raaey: 'φύλλο:γραμμή'` και
// οι τιμές τους πρέπει να είναι ΑΚΡΙΒΩΣ αυτές που βγάζει το `raaeyPrices` για
// τη γραμμή τους (το raaey.test.ts το ελέγχει ένα προς ένα). Όσα τιμολόγια
// του πίνακα δεν υπήρχαν μπαίνουν από εδώ, με το ίδιο `raaeyPrices`.
//
// ΤΙ ΔΕΝ ΜΠΑΙΝΕΙ:
//   · όσα η ΡΑΑΕΥ γράφει «μη εμπορικά διαθέσιμο»: δεν προστίθενται. Όσα από
//     αυτά υπήρχαν ήδη μένουν, για όποιον τα έχει, αλλά δεν προτείνονται.
//   · γραμμές με τιμή που μοιάζει λάθος της πηγής (`RAAEY_REJECTED`).
//   · δεύτερη ίδια γραμμή: ο πίνακας γράφει μερικά τιμολόγια δύο φορές, με
//     τα ίδια ακριβώς κελιά.
// ═══════════════════════════════════════════════════════════════════════════
import type { LocalTariff, ProviderGroup } from './catalogue';
import type { GasTariff, GasProvider } from './gas';
import RAAEY_DATA from './raaeyData.json';
import {
  RAAEY_BADGE, parseRaaeyDuration, parseRaaeyFixed, parseRaaeyPrice, raaeyMonthGen, raaeyText, type RaaeySheet,
} from './raaey';

// Η μεταγραφή του πίνακα, όπως τη γράφει το scripts/energy/raaey-import.mjs.
export const RAAEY_MONTH: string = RAAEY_DATA.month;
export const RAAEY_READ_AT: string = RAAEY_DATA.readAt;
export const RAAEY_COLUMNS: readonly string[] = RAAEY_DATA.columns;
const RAAEY_GAS_NOTES: Record<string, string> = RAAEY_DATA.gasNotes;
export const RAAEY_ROWS: Record<string, (string | number)[][]> = RAAEY_DATA.rows;

/** Ο μήνας του πίνακα σε γενική: «Οκτωβρίου 2026». */
export const RAAEY_MONTH_GEN = raaeyMonthGen(RAAEY_MONTH);

/** Η γραμμή, με τα κελιά που κρατά η εφαρμογή. */
export interface RaaeyCells {
  sheet: RaaeySheet;
  row: number;
  provider: string;
  name: string;
  fixed: string;
  price: string;
  fixedDiscounted: string;
  fixedCondition: string;
  priceDiscounted: string;
  priceCondition: string;
  duration: string;
  colour: string;
  /** Η ΡΑΑΕΥ το γράφει «μη εμπορικά διαθέσιμο». */
  notAvailable: boolean;
}

export const raaeyRows = (sheet: RaaeySheet): RaaeyCells[] =>
  (RAAEY_ROWS[sheet] ?? []).map(r => {
    const o = Object.fromEntries(RAAEY_COLUMNS.map((c, i) => [c, r[i]])) as Record<string, string | number>;
    return { ...(o as unknown as Omit<RaaeyCells, 'sheet' | 'notAvailable'>), sheet, row: Number(o.row), notAvailable: r[RAAEY_COLUMNS.length] === 1 };
  });

/**
 * ΓΡΑΜΜΕΣ ΠΟΥ ΔΕΝ ΠΕΡΝΟΥΝ, ΜΕ ΤΟΝ ΛΟΓΟ ΤΟΥΣ.
 *
 * Η τιμή χωρίς έκπτωση μικρότερη από την τιμή με έκπτωση, ή τιμή αερίου
 * δεκαπλάσια φθηνότερη από κάθε άλλη της αγοράς, δεν είναι προσφορά: είναι
 * ολισθημένο δεκαδικό στην πηγή. Περασμένη, θα έβγαινε πρώτη στη σύγκριση.
 */
export const RAAEY_REJECTED: Record<string, string> = {
  'gas-business:2': 'EFA ENERGY «PLUS GAS EXTRA BUSINESS»: 0,01191 χωρίς έκπτωση και 0,09665 με έκπτωση, δηλαδή η τιμή χωρίς έκπτωση οκτώ φορές μικρότερη. Μοιάζει λάθος της πηγής (οδηγία ιδιοκτήτη 05.10.2026).',
  'gas-business:44': 'ΖΕΝΙΘ «Gas Business Save»: τιμή χωρίς έκπτωση άγνωστη και 0,009 με έκπτωση, δέκα φορές κάτω από κάθε τιμή αερίου του πίνακα. Μοιάζει λάθος της πηγής.',
};

/** Ο πάροχος της ΡΑΑΕΥ με το κλειδί του καταλόγου. */
export const RAAEY_PROVIDER: Record<string, { value: string; label: string; url: string }> = {
  'ΔΕΗ': { value: 'dei', label: 'ΔΕΗ', url: 'https://www.dei.gr' },
  'ΗΡΩΝ': { value: 'heron', label: 'Ήρων', url: 'https://www.heron.gr' },
  'PROTERGIA': { value: 'protergia', label: 'Protergia', url: 'https://www.protergia.gr' },
  'NRG': { value: 'nrg', label: 'NRG', url: 'https://www.nrg.gr' },
  'ΖΕΝΙΘ': { value: 'zenith', label: 'Zenith', url: 'https://www.zenith.gr' },
  'ΕΛΙΝΟΙΛ': { value: 'elin', label: 'Elin', url: 'https://energy.elin.gr' },
  'VOLTON': { value: 'volton', label: 'Volton', url: 'https://volton.gr' },
  'ENERWAVE': { value: 'enerwave', label: 'Enerwave', url: 'https://www.enerwave.gr' },
  'EUNICE': { value: 'eunice', label: 'Eunice Power', url: 'https://eunice-power.gr' },
  'ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΙΑ ΕΝΕΡΓΕΙΑΣ': { value: 'fysiko_aerio', label: 'Φυσικό αέριο Ελλάδος', url: 'https://www.fysikoaerioellados.gr' },
  'EFA ENERGY': { value: 'efa', label: 'EFA ENERGY', url: 'https://www.efaenergy.gr' },
  // Δύο πάροχοι υπάρχουν μόνο στον πίνακα της ΡΑΑΕΥ. Η ΡΑΑΕΥ δεν δίνει τη
  // σελίδα τους και δεν τη μαντεύουμε: ο σύνδεσμος οδηγεί στον ίδιο τον πίνακα.
  'OTE ESTATE': { value: 'ote_estate', label: 'OTE ESTATE', url: 'https://energycost.gr/' },
  'SOLAR ENERGY': { value: 'solar_energy', label: 'SOLAR ENERGY', url: 'https://energycost.gr/' },
};

/** Οι τιμές ενέργειας μιας γραμμής, όπως τις κρατά ο κατάλογος του ρεύματος. */
export function raaeyPrices(r: RaaeyCells, use: 'discounted' | 'base' = 'discounted') {
  const base = parseRaaeyPrice(r.price), disc = parseRaaeyPrice(r.priceDiscounted);
  const fb = parseRaaeyFixed(r.fixed), fd = parseRaaeyFixed(r.fixedDiscounted);
  // Η ΣΥΓΚΡΙΣΗ ΤΡΕΧΕΙ ΜΕ ΤΗΝ ΤΙΜΗ ΤΗΣ ΠΡΟΫΠΟΘΕΣΗΣ, όπως σε όλο τον κατάλογο
  // (συνέπεια, πάγια εντολή): η στήλη «με έκπτωση» της ΡΑΑΕΥ. Αν αυτή δεν
  // είναι ακόμη γνωστή ενώ η τιμή χωρίς έκπτωση είναι, μετρά η γνωστή.
  const p = use === 'base' || !disc.known ? base : disc;
  const f = use === 'base' ? fb : fd;
  const known = p.known && !p.moreTiers;
  return {
    kwh_day: known ? p.day : null,
    kwh_night: known && p.hasNight ? p.night : null,
    ...(known && p.tier2 ? { kwh_tier2: p.tier2.price as number, tier2_threshold: p.tier2.threshold, ...(p.tier2.scope === 'all' ? { tier2_scope: 'all' as const } : {}) } : {}),
    fixed: f.fixed,
    ...(f.tier2 ? { fixed_tier2: f.tier2.fixed, fixed_tier2_threshold: f.tier2.threshold } : {}),
    /** Οι τιμές χωρίς τις προϋποθέσεις, για την οθόνη. */
    undiscounted: base.known && !base.moreTiers
      ? { day: base.day as number, ...(base.tier2 ? { tier2: base.tier2.price as number } : {}), ...(base.hasNight ? { night: base.night as number } : {}), fixed: fb.fixed }
      : { day: null, fixed: fb.fixed },
    /** Το κείμενο της ΡΑΑΕΥ, όταν η τιμή δεν γράφεται σε πεδία. */
    priceText: known ? undefined : raaeyText(use === 'base' ? r.price : r.priceDiscounted),
    conditions: {
      ...(r.priceCondition ? { price: raaeyText(r.priceCondition) } : {}),
      ...(r.fixedCondition ? { fixed: raaeyText(r.fixedCondition) } : {}),
      ...(!disc.known && base.known ? { price: 'Η τιμή με έκπτωση δεν είναι ακόμη γνωστή. Μετρά η τιμή χωρίς έκπτωση.' } : {}),
    },
    known,
    moreTiers: p.moreTiers,
  };
}

/** Μια πρόταση χωρίς αριθμούς για το τιμολόγιο, από το χρώμα και τη διάρκεια. */
export function raaeyDesc(r: RaaeyCells): string {
  const months = parseRaaeyDuration(r.duration);
  const span = months ? `Σύμβαση ${months} μηνών.` : 'Αορίστου διάρκειας.';
  if (r.colour === 'blue') return `Σταθερή τιμή. ${span}`;
  if (r.colour === 'green') return `Ειδικό τιμολόγιο, η τιμή ανακοινώνεται κάθε 1η του μήνα. ${span}`;
  return `Κυμαινόμενη τιμή. ${span}`;
}

const segmentOf = (sheet: RaaeySheet) => (sheet.endsWith('business') ? 'business' : 'residential') as 'business' | 'residential';
const idOf = (r: RaaeyCells) => `rx_${r.sheet.replace('power-', 'p').replace('gas-', 'g').replace('residential', 'r').replace('business', 'b')}_${r.row}`;

/** Η «ταυτότητα» μιας γραμμής: δύο γραμμές με ίδια κελιά είναι το ίδιο τιμολόγιο. */
const same = (r: RaaeyCells) => JSON.stringify([r.provider, r.name, r.fixed, r.price, r.fixedDiscounted, r.fixedCondition, r.priceDiscounted, r.priceCondition, r.duration, r.colour]);

/** Οι γραμμές που προστίθενται: όχι συνδεδεμένες, όχι εκτός αγοράς, όχι απορριφθείσες, όχι διπλές. */
export function raaeyAdditions(sheet: RaaeySheet, linked: Set<string>): RaaeyCells[] {
  const seen = new Set<string>(), out: RaaeyCells[] = [];
  const all = raaeyRows(sheet);
  // Μια γραμμή ίδια με ήδη συνδεδεμένη είναι επίσης ήδη στον κατάλογο.
  for (const r of all) if (linked.has(`${sheet}:${r.row}`)) seen.add(same(r));
  for (const r of all) {
    const ref = `${sheet}:${r.row}`;
    if (linked.has(ref) || r.notAvailable || RAAEY_REJECTED[ref] || seen.has(same(r))) continue;
    seen.add(same(r));
    out.push(r);
  }
  return out;
}

/** Τα νέα τιμολόγια ρεύματος από τον πίνακα, στους παρόχους του καταλόγου. */
export function addRaaeyPower(providers: ProviderGroup[]): ProviderGroup[] {
  const linked = new Set(providers.flatMap(p => p.tariffs.map(t => t.raaey).filter((x): x is string => !!x)));
  for (const sheet of ['power-residential', 'power-business'] as const) {
    for (const r of raaeyAdditions(sheet, linked)) {
      const prov = RAAEY_PROVIDER[r.provider];
      if (!prov) throw new Error(`Άγνωστος πάροχος ΡΑΑΕΥ: ${r.provider}`);
      let g = providers.find(p => p.value === prov.value);
      if (!g) { g = { ...prov, tariffs: [] }; providers.push(g); }
      const { badge, type } = RAAEY_BADGE[r.colour];
      const p = raaeyPrices(r);
      const t: LocalTariff = {
        id: idOf(r), name: r.name, badge, type, segment: segmentOf(sheet), vat: 6,
        kwh_day: p.kwh_day, kwh_night: p.kwh_night,
        ...(p.kwh_tier2 != null ? { kwh_tier2: p.kwh_tier2, tier2_threshold: p.tier2_threshold, ...(p.tier2_scope ? { tier2_scope: p.tier2_scope } : {}) } : {}),
        fixed: p.fixed, fixed_ebill: null,
        ...(p.fixed_tier2 != null ? { fixed_tier2: p.fixed_tier2, fixed_tier2_threshold: p.fixed_tier2_threshold } : {}),
        no_fixed: p.fixed === 0,
        undiscounted: p.undiscounted,
        ...(p.priceText ? { priceText: p.priceText, priceUnsupported: p.moreTiers } : {}),
        ...(Object.keys(p.conditions).length ? { conditions: p.conditions } : {}),
        contract_months: parseRaaeyDuration(r.duration),
        ...(p.known ? { priceStatus: 'verified' as const, priceMonth: RAAEY_MONTH_GEN } : {}),
        // «Student» στο όνομα: απαιτεί φοιτητική ιδιότητα, δεν προτείνεται σε όλους.
        ...(/student/i.test(r.name) ? { studentOnly: true } : {}),
        raaey: `${sheet}:${r.row}`,
        desc: raaeyDesc(r),
      };
      g.tariffs.push(t);
    }
  }
  return providers;
}

/** Οι τιμές αερίου μιας γραμμής, όπως τις κρατά ο κατάλογος του αερίου. */
export function raaeyGasPrices(r: RaaeyCells) {
  const p = raaeyPrices(r);
  return {
    kwh: p.kwh_day,
    fixed: p.fixed,
    undiscounted: { kwh: p.undiscounted.day, fixed: p.undiscounted.fixed },
    ...(Object.keys(p.conditions).length ? { conditions: p.conditions } : {}),
    known: p.known,
  };
}

/** Τα νέα τιμολόγια αερίου από τον πίνακα. */
export function addRaaeyGas(providers: GasProvider[]): GasProvider[] {
  const linked = new Set(providers.flatMap(p => p.tariffs.map(t => t.raaey).filter((x): x is string => !!x)));
  for (const sheet of ['gas-residential', 'gas-business'] as const) {
    for (const r of raaeyAdditions(sheet, linked)) {
      const prov = RAAEY_PROVIDER[r.provider];
      if (!prov) throw new Error(`Άγνωστος πάροχος ΡΑΑΕΥ: ${r.provider}`);
      let g = providers.find(p => p.value === prov.value);
      if (!g) { g = { ...prov, tariffs: [] }; providers.push(g); }
      const { badge, type } = RAAEY_BADGE[r.colour];
      if (badge === 'ΠΡΑΣΙΝΟ') throw new Error(`Πράσινο τιμολόγιο αερίου: ${sheet}:${r.row}`);
      const p = raaeyGasPrices(r);
      const t: GasTariff = {
        id: idOf(r), name: r.name, badge, type, segment: segmentOf(sheet),
        kwh: p.kwh, fixed: p.fixed, undiscounted: p.undiscounted,
        ...(p.conditions ? { conditions: p.conditions } : {}),
        contract_months: parseRaaeyDuration(r.duration) || undefined,
        ...(p.known ? { priceMonth: RAAEY_MONTH_GEN } : {}),
        raaey: `${sheet}:${r.row}`,
        ...(raaeyGasNote(`${sheet}:${r.row}`) ? { desc: raaeyGasNote(`${sheet}:${r.row}`) } : {}),
      };
      g.tariffs.push(t);
    }
  }
  return providers;
}

/** Η σημείωση της ΡΑΑΕΥ για μια γραμμή αερίου, στη γραφή της εφαρμογής. */
export const raaeyGasNote = (ref: string): string | undefined => {
  const n = RAAEY_GAS_NOTES[ref];
  return n ? raaeyText(n) : undefined;
};
