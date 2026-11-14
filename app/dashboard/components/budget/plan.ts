// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΣΧΕΔΙΟ ΤΟΥ ΜΗΝΑ: ΣΤΟΧΟΙ, ΠΡΟΟΔΟΣ, ΣΤΡΟΓΓΥΛΟΠΟΙΗΣΗ, ΠΑΡΑΔΕΙΓΜΑ
// ─────────────────────────────────────────────────────────────────────────
// Καθαρές συναρτήσεις, χωρίς React, ώστε κάθε κανόνας της οθόνης να ελέγχεται.
//
// ΚΑΝΕΝΑΣ ΣΤΟΧΟΣ ΠΟΥ ΔΕΝ ΕΒΑΛΕΣ. Ο νέος χρήστης έβλεπε «Στόχος 390,00€» για
// σχέδιο που δεν έκανε ποτέ, ενώ το άθροισμα των εφευρεμένων στόχων ανά
// κατηγορία έβγαινε 415,00€. Τώρα ο στόχος είναι είτε δικός σου είτε κανένας.
// ═══════════════════════════════════════════════════════════════════════════
import { sumCents } from '@/lib/expenses/attention';
import { budgetBucket, resolveCategory } from '@/lib/expenses/taxonomy';

/** Στόχος: ποσό που όρισες, ή `null` όταν δεν όρισες. Το ρητό 0 είναι στόχος. */
export type Target = number | null;

export function parseTarget(raw: unknown): Target {
  if (raw == null) return null;
  const s = String(raw).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Ο στόχος του μήνα: ο συνολικός αν τον όρισες, αλλιώς το άθροισμα όσων
 * κατηγοριών έχουν στόχο. Χωρίς κανέναν, `null`.
 */
export function planTotal(budgets: Record<string, string | undefined>, keys: readonly string[]): Target {
  const total = parseTarget(budgets.total);
  if (total != null) return total;
  const set = keys.map(k => parseTarget(budgets[k])).filter((v): v is number => v != null);
  return set.length ? sumCents(set) : null;
}

export interface Progress {
  /** Το πραγματικό ποσοστό, ακέραιο και χωρίς ταβάνι: 133 σημαίνει 133%. */
  pct: number;
  /** Το πλάτος της ράβδου, με ταβάνι το 100. */
  bar: number;
  over: boolean;
  /** Θετικό: πόσα μένουν. Αρνητικό: πόσο πέρασες. Σε λεπτά, όχι σε ευρώ. */
  left: number;
}

export function progress(spent: number, target: Target): Progress | null {
  if (target == null) return null;
  const s = Math.max(0, spent);
  if (target <= 0) return { pct: s > 0 ? 100 : 0, bar: s > 0 ? 100 : 0, over: s > 0, left: sumCents([-s]) };
  const ratio = (s / target) * 100;
  return { pct: Math.round(ratio), bar: Math.min(100, ratio), over: s > target + 0.004, left: sumCents([target, -s]) };
}

/** Ο ΕΝΑΣ δρόμος από μηνιαίο σε ετήσιο. Χωρίς στρογγυλοποίηση πριν από την εμφάνιση. */
export const yearly = (monthly: number): number => Math.round(monthly * 12 * 100) / 100;

/** Πρόταση στόχου από το ιστορικό: ο μέσος όρος, στο πλησιέστερο ευρώ πάνω. */
// Ο ΜΕΣΟΣ ΟΡΟΣ ΜΕΤΡΑ ΚΑΙ ΤΟΥΣ ΗΣΥΧΟΥΣ ΜΗΝΕΣ. Ενας υδραυλικός των 260€ σε
// τρεις μήνες δεν είναι στόχος 260€ τον μήνα· είναι 87€.
export const suggestTarget = (values: readonly number[]): number | null => {
  if (!values.some(v => v > 0)) return null;
  return Math.ceil(sumCents(values.map(v => Math.max(0, v))) / values.length);
};

export interface CatRow { key: string; label: string; actual: number; target: Target; projectedOver: boolean }

/**
 * Η σειρά των κατηγοριών: πρώτα όσες πέρασαν τον στόχο (η μεγαλύτερη υπέρβαση
 * πρώτη), μετά όσες θα τον περάσουν, μετά οι υπόλοιπες με κίνηση κατά ποσό.
 * Οσες δεν έχουν κίνηση μαζεύονται χωριστά.
 */
export function orderCats<R extends CatRow>(rows: readonly R[]): { active: R[]; idle: R[] } {
  const over = (r: R) => (r.target != null && r.actual > r.target + 0.004 ? r.actual - r.target : -1);
  const active = rows.filter(r => r.actual > 0).sort((a, b) => {
    const oa = over(a), ob = over(b);
    if (oa >= 0 || ob >= 0) return ob - oa;
    if (a.projectedOver !== b.projectedOver) return a.projectedOver ? -1 : 1;
    return b.actual - a.actual;
  });
  return { active, idle: rows.filter(r => !(r.actual > 0)) };
}

/**
 * Μια γραμμή της εισαγωγής: ο κουβάς που δείχνει η λίστα ΚΑΙ η κατηγορία που
 * γράφεται στη βάση. Η κατηγορία είναι πάντα κατηγορία του λεξιλογίου, ώστε
 * να γυρίζει στον ίδιο κουβά και οι Δαπάνες να τη λένε με το όνομά της.
 * Το έσοδο δεν είναι δαπάνη: κουβάς κενός, η γραμμή ξεκινά ανεπίλεκτη.
 *
 * Ο συναγερμός (`security`) πάει πλέον στην «Ασφάλεια», όπως ορίζει το
 * λεξιλόγιο· όχι στις «Λοιπές» όπου τον έβαζε ο παλιός πίνακας.
 */
export function importRow(parserCategory: string, matched = ''): { bucket: string; slug: string } {
  if (parserCategory === 'rent_income') return { bucket: '', slug: '' };
  // ΕΝΦΙΑ ΜΟΝΟ ΟΤΑΝ Η ΤΡΑΠΕΖΑ ΓΡΑΦΕΙ ΕΝΦΙΑ (επανέλεγχος PR 576). Ο αναλυτής
  // βάζει στο ίδιο «taxes» και ΑΑΔΕ, ΕΦΟΡΙΑ, ΕΦΚΑ, ΙΚΑ, ΤΕΒΕ. Γραμμένα ως
  // `enfia` έβγαιναν «ΕΝΦΙΑ» στις Δαπάνες και στη Λογιστική και μια πληρωμή
  // ΕΦΚΑ ίδιου ποσού μετρούσε ως πληρωμένη δόση ΕΝΦΙΑ (payDuplicate), δηλαδή
  // έσβηνε την υπενθύμιση. Οι υπόλοιπες μένουν αταξινόμητες στις «Λοιπές» και
  // διαλέγει ο χρήστης.
  if (parserCategory === 'taxes') {
    return /ENFIA|ΕΝΦΙΑ/i.test(matched) ? { bucket: 'services', slug: 'enfia' } : { bucket: 'other', slug: 'other' };
  }
  const slug = resolveCategory(parserCategory) ?? 'other';
  return { bucket: budgetBucket(slug), slug };
}

/** Το όνομα που αποθηκεύεται από το πεδίο «Όνομα»: κομμένο, μη κενό, διαφορετικό. */
export function nameToCommit(draft: string, current: string): string | null {
  const v = draft.trim().slice(0, 40);
  return v && v !== current.trim() ? v : null;
}

/**
 * Ο,ΤΙ ΞΟΔΕΨΕΣ, ΑΠΟ ΚΑΘΕ ΚΟΥΒΑ. Απόφαση (ανασκόπηση PR 576): η απόκρυψη μιας
 * κατηγορίας αφορά τη γραμμή και τον στόχο της, όχι τα χρήματα. Με άθροισμα
 * μόνο των ορατών, το «Ξόδεψες» έπεφτε κάτω από τον μήνα των Δαπανών.
 */
export const spentTotal = (byBucket: Record<string, number>): number =>
  sumCents(Object.values(byBucket).map(v => Number(v) || 0));

/** Ο,τι ξοδεύτηκε σε κουβάδες που δεν είναι ορατές κατηγορίες: μία γραμμή, χωρίς στόχο. */
export const hiddenSpend = (byBucket: Record<string, number>, visible: readonly string[]): number =>
  sumCents(Object.entries(byBucket).filter(([k]) => !visible.includes(k)).map(([, v]) => Number(v) || 0));

/**
 * ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΖΕΙ ΜΟΝΟ ΣΤΗ ΜΝΗΜΗ. Το «Δείξε μου» έγραφε οκτώ πραγματικές
 * δαπάνες στον πίνακα του χρήστη: φαίνονταν στις Δαπάνες, στα ετήσια σύνολα και
 * μια αποτυχημένη αφαίρεση μακριά από τη Λογιστική. Εδώ φτιάχνονται γραμμές
 * που δεν φεύγουν ποτέ από τον περιηγητή, με αναγνωριστικό `demo-`.
 */
export interface DemoRow {
  id: string; bill_id: null; amount: number; date: string; description: string;
  category: string; paid: boolean; expense_group: string; is_recurring: boolean;
  store_vendor: null; supplier_afm: null;
}
export function demoRows(today: Date): DemoRow[] {
  const y = today.getFullYear(), m = today.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const day = (d: number) => `${y}-${p2(m + 1)}-${p2(Math.min(d, today.getDate(), dim))}`;
  const s: [number, string, number, string, string][] = [
    [8, 'ΔΕΗ', 78.4, 'electricity', 'utilities'],
    [12, 'ΕΥΔΑΠ', 21.3, 'water', 'utilities'],
    [5, 'Vodafone', 34.9, 'internet', 'utilities'],
    [15, 'Φυσικό αέριο', 46, 'heating', 'utilities'],
    [10, 'Κοινόχρηστα', 40, 'common', 'fixed'],
    [3, 'Ασφάλεια κατοικίας', 18.5, 'insurance', 'insurance'],
    [18, 'Υδραυλικός', 60, 'maintenance', 'maintenance'],
    [20, 'Είδη καθαριότητας', 25, 'other', 'other'],
  ];
  return s.map(([d, description, amount, category, expense_group], i) => ({
    id: `demo-${i + 1}`, bill_id: null, amount, date: day(d), description, category,
    paid: true, expense_group, is_recurring: false, store_vendor: null, supplier_afm: null,
  }));
}
/** Οι στόχοι του παραδείγματος: κι αυτοί μόνο στη μνήμη. */
export const DEMO_TARGETS: Record<string, string> = {
  electricity: '70', water: '25', internet: '35', heating: '50', common: '40', insurance: '20', maintenance: '40', other: '30',
};

/** Μία ανάγνωση απέτυχε; Τότε η οθόνη δεν δείχνει μηδενικά, δείχνει σφάλμα. */
export const anyFailed = (results: readonly ({ error: unknown } | null | undefined)[]): boolean =>
  results.some(r => !!r && r.error != null);
