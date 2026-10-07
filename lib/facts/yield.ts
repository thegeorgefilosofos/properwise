// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΠΟΔΟΣΗ: ΜΙΑ ΣΥΝΑΡΤΗΣΗ, Η ΒΑΣΗ ΓΡΑΦΕΤΑΙ ΠΑΝΤΑ
// ─────────────────────────────────────────────────────────────────────────
// Δύο συναρτήσεις έκαναν την ίδια διαίρεση: `computeYields`
// (lib/billing/propertyFacts.ts, Επισκόπηση, Σύγκριση) και `yields`
// (lib/market/returns.ts, Αποδόσεις). Η πρώτη έβγαζε την καθαρή ΠΡΟ φόρου, η
// δεύτερη και ΜΕΤΑ φόρου· οι οθόνες έγραφαν και τις δύο «Καθαρή απόδοση»:
// δύο διαφορετικά ποσοστά για το ίδιο ακίνητο με το ίδιο όνομα.
//
// Τώρα ο τύπος ζει εδώ και οι δύο παλιές συναρτήσεις τον καλούν. Η ετικέτα
// βγαίνει από το `basis` (YIELD_LABELS): «προ φόρου» ή «μετά φόρου», πάντα.
//
// ΚΑΙ ΟΙ ΔΑΠΑΝΕΣ ΤΗΣ ΚΑΘΑΡΗΣ ΖΟΥΝ ΕΔΩ (`yieldCosts`). Η Επισκόπηση αφαιρούσε
// μόνο τις καταγεγραμμένες δαπάνες· οι Αποδόσεις πρόσθεταν από πάνω προμήθεια
// πλατφόρμας, καθαρισμό και τέλη από το μοντέλο της βραχυχρόνιας. Ίδια ετικέτα,
// «Καθαρή απόδοση προ φόρου», 3,01% στη μία οθόνη και 1,70% στην άλλη. Και
// όποιος είχε ήδη περάσει τις προμήθειες της Airbnb ως δαπάνη τις πλήρωνε δύο
// φορές στον υπολογισμό.
//
// Ο ΚΑΝΟΝΑΣ, όπως τον κάνει ο λογιστής: η δαπάνη που καταγράφηκε μετρά όπως
// καταγράφηκε. Ένα εκτιμώμενο κόστος μπαίνει ΜΟΝΟ για είδος που δεν έχει καμία
// καταγεγραμμένη γραμμή στη χρονιά. Κι όταν μπει έστω ένα, ο αριθμός δεν είναι
// πια «Καθαρή απόδοση προ φόρου» αλλά «Εκτιμώμενη καθαρή απόδοση προ φόρου».
// Χωρίς εκτιμήσεις, κάθε οθόνη βγάζει τον ίδιο αριθμό από τα ίδια στοιχεία.
// ═══════════════════════════════════════════════════════════════════════════
import { resolveCategory } from '@/lib/expenses/taxonomy';
import { YIELD_LABELS, YIELD_SHORT_LABELS, PLATFORM_FEE_LABELS } from './labels';

export interface YieldInput {
  /** Ετήσια έσοδα (ενοίκια ή ακαθάριστο φιλοξενίας). */
  annualIncome: number;
  /** Αξία ακινήτου. */
  value: number;
  /** Ετήσιες δαπάνες λειτουργίας (lib/facts/expenses: `total`). */
  annualExpenses: number;
  /** Ετήσιος φόρος εισοδήματος που αναλογεί· χωρίς αυτόν δεν υπάρχει «μετά φόρου». */
  annualTax?: number | null;
}

export interface PropertyYield {
  /** Ποσοστά, χωρίς στρογγυλοποίηση· 0 όταν λείπει η αξία. */
  gross: number;
  net_pre_tax: number;
  /** `null` όταν δεν δόθηκε φόρος: δεν επινοούμε μηδενικό φόρο. */
  net_after_tax: number | null;
}

const fin = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const pos = (n: unknown): number => Math.max(0, fin(n));

export function propertyYield(i: YieldInput): PropertyYield {
  const value = pos(i.value);
  const income = pos(i.annualIncome);
  const exp = pos(i.annualExpenses);
  const pct = (x: number) => (value > 0 ? (x / value) * 100 : 0);
  return {
    gross: pct(income),
    net_pre_tax: pct(income - exp),
    net_after_tax: i.annualTax == null ? null : pct(income - exp - pos(i.annualTax)),
  };
}

// ── ΟΙ ΔΑΠΑΝΕΣ ΤΗΣ ΚΑΘΑΡΗΣ ΑΠΟΔΟΣΗΣ ──────────────────────────────────────────

/**
 * Κόστη της βραχυχρόνιας που το μοντέλο εκτιμά όταν δεν έχουν καταγραφεί.
 * Το όνομα είναι το `slug` της κατηγορίας δαπάνης (lib/expenses/taxonomy.ts):
 * γραμμή αυτής της κατηγορίας μέσα στη χρονιά σημαίνει «καταγράφηκε».
 */
export type ModelledCostKind = 'platform_fee' | 'cleaning' | 'climate_levy' | 'accommodation_tax';

export const MODELLED_COST_KINDS: readonly ModelledCostKind[] = ['platform_fee', 'cleaning', 'climate_levy', 'accommodation_tax'];

export const MODELLED_COST_LABELS: Record<ModelledCostKind, string> = {
  platform_fee: 'προμήθεια πλατφόρμας',
  cleaning: 'καθαρισμός',
  climate_levy: 'τέλος ανθεκτικότητας',
  accommodation_tax: 'τέλος παρεπιδημούντων',
};

export interface YieldCostsInput {
  /** Δαπάνες έτους όπως καταγράφηκαν (lib/facts/expenses: `total`). */
  recorded: number;
  /** Οι κατηγορίες των γραμμών του έτους, όπως είναι γραμμένες στη βάση. */
  recordedCategories?: Iterable<string | null | undefined>;
  /** Εκτιμήσεις του μοντέλου, ανά είδος. Όσες έχουν καταγραφεί δεν μετρούν. */
  modelled?: Partial<Record<ModelledCostKind, number>>;
  /**
   * Προμήθειες πλατφόρμας γραμμένες στις διαμονές, χωρίς τους μήνες που είναι
   * ήδη δαπάνη (lib/facts/platformFees: `yieldPlatformFees(...).annual`).
   * Καταγραφή, όχι εκτίμηση: όταν υπάρχουν, η εκτίμηση προμήθειας δεν μπαίνει.
   */
  stayFees?: number;
}

export interface YieldCosts {
  /** recorded + stayFees + modelled: ό,τι αφαιρείται στην καθαρή απόδοση. */
  total: number;
  recorded: number;
  /** Οι προμήθειες των διαμονών που μπήκαν (καταγραφή, όχι εκτίμηση). */
  stayFees: number;
  /** Το άθροισμα των εκτιμήσεων που μπήκαν. */
  modelled: number;
  /** Τα είδη που μπήκαν ως εκτίμηση (με ποσό > 0). */
  modelledKinds: ModelledCostKind[];
  /** Τα είδη που ΔΕΝ μπήκαν ως εκτίμηση επειδή υπάρχουν ήδη στις δαπάνες ή στις διαμονές. */
  recordedKinds: ModelledCostKind[];
  /** «recorded»: μόνο καταγραφές· «estimated»: με εκτίμηση από πάνω. */
  basis: 'recorded' | 'estimated';
}

/**
 * Οι δαπάνες που αφαιρούνται στην καθαρή απόδοση: οι καταγεγραμμένες, συν
 * όσες εκτιμήσεις αφορούν είδος χωρίς καμία καταγεγραμμένη γραμμή.
 */
export function yieldCosts(i: YieldCostsInput): YieldCosts {
  const recorded = pos(i.recorded);
  const stayFees = pos(i.stayFees);
  const have = new Set<string>();
  for (const c of i.recordedCategories ?? []) {
    const slug = resolveCategory(c);
    if (slug) have.add(slug);
  }
  // Η προμήθεια της διαμονής είναι καταγραφή: με αυτήν, το ποσοστό του
  // μοντέλου δεν μπαίνει από πάνω (lib/facts/platformFees.ts).
  if (stayFees > 0) have.add('platform_fee');
  let modelled = 0;
  const modelledKinds: ModelledCostKind[] = [];
  const recordedKinds: ModelledCostKind[] = [];
  for (const k of MODELLED_COST_KINDS) {
    const amount = pos(i.modelled?.[k]);
    if (amount <= 0) continue;
    if (have.has(k)) { recordedKinds.push(k); continue; }
    modelled += amount;
    modelledKinds.push(k);
  }
  return {
    total: recorded + stayFees + modelled, recorded, stayFees, modelled, modelledKinds, recordedKinds,
    basis: modelled > 0 ? 'estimated' : 'recorded',
  };
}

/** Η ετικέτα της καθαρής προ φόρου για τη βάση των δαπανών της. */
export function netPreTaxLabel(c: Pick<YieldCosts, 'basis'>, short = false): string {
  if (c.basis === 'estimated') return short ? YIELD_SHORT_LABELS.net_pre_tax_estimated : YIELD_LABELS.net_pre_tax_estimated;
  return short ? YIELD_SHORT_LABELS.net_pre_tax : YIELD_LABELS.net_pre_tax;
}

/**
 * Τι αφαιρέθηκε στην καθαρή, με λέξεις: «μετά από 3.980,00€ έξοδα και 1.140,00€
 * προμήθειες πλατφόρμας». Κάθε μέρος του `yieldCosts` με το όνομά του, ώστε η
 * προμήθεια των διαμονών και η εκτίμηση να μη χάνονται μέσα στα «έξοδα».
 */
export function yieldCostParts(c: Pick<YieldCosts, 'recorded' | 'stayFees' | 'modelled'>, fmt: (n: number) => string): string {
  const parts = [`${fmt(c.recorded)} έξοδα`];
  if (c.stayFees > 0) parts.push(`${fmt(c.stayFees)} ${PLATFORM_FEE_LABELS.short}`);
  if (c.modelled > 0) parts.push(`${fmt(c.modelled)} εκτίμηση κόστους`);
  const last = parts.pop() as string;
  return `μετά από ${parts.length ? `${parts.join(', ')} και ${last}` : last}`;
}
