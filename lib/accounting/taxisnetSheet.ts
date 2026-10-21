// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΦΥΛΛΟ ΚΩΔΙΚΩΝ: ΤΙ ΠΛΗΚΤΡΟΛΟΓΕΙ Ο ΛΟΓΙΣΤΗΣ ΣΤΟ TAXISNET, ΓΡΑΜΜΗ ΓΡΑΜΜΗ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΛΕΙΠΕ. Ο φάκελος είχε το Ε2 με τη σειρά των στηλών του εντύπου και, μέσα
// στο ίδιο βιβλίο, τους κωδικούς του πίνακα 4Δ2. Ο λογιστής όμως δεν πληκτρολογεί
// από δύο φύλλα που δεν του λένε τι ελέγχθηκε: ανοίγει το προσυμπληρωμένο, το
// συγκρίνει με το μάτι και σημειώνει με μολύβι ποια γραμμή «στέκει». Αυτό το
// μολύβι γίνεται εδώ στήλη.
//
// ΤΙ ΕΙΝΑΙ. Ένα φύλλο ανά ΑΦΜ (ο φάκελος είναι ήδη ένας ανά ΑΦΜ) με δύο
// πίνακες: οι κωδικοί του Ε1 με το ποσό τους και οι γραμμές του Ε2 με τις στήλες
// 13 έως 16. Κάθε γραμμή λέει ρητά «Ελέγχθηκε», «Λείπει», «Διαφέρει» ή «Δεν
// ελέγχθηκε» και γιατί.
//
// ΚΑΝΕΝΑΣ ΚΩΔΙΚΟΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ. Οι κωδικοί έρχονται από το
// lib/accounting/e1Codes.ts (Ε1, πίνακας 4Δ2, Φ-01.001, με την πηγή του), τα
// ποσά από το ίδιο `buildE1Summary` και τις ίδιες γραμμές `buildE2Row` που
// γράφουν το «01 Ε2» και ο έλεγχος από την ίδια σύγκριση με το προσυμπληρωμένο
// που γράφει το «02 Έλεγχος φακέλου». Δεύτερη αριθμητική θα σήμαινε δύο σύνολα
// που μπορούν να διαφωνήσουν μέσα στον ίδιο φάκελο.
// ═══════════════════════════════════════════════════════════════════════════
import { buildE1Summary, type E2RowDetail } from '@/lib/billing/e2';
import { E1_4D2, E1_4D2_SOURCE } from './e1Codes';
import type { PrefilledReconciliation } from '@/lib/billing/e2Reconcile';
import { e2PowerSupply } from '@/lib/property/powerSupply';
import { fe } from '@/lib/core/format';
import { roundHalfUp } from '@/lib/core/money';

/** Η κατάσταση μιας γραμμής, όπως τη διαβάζει ο λογιστής πριν πληκτρολογήσει. */
export type CheckState = 'checked' | 'missing' | 'differs' | 'unchecked';

export const CHECK_LABEL: Record<CheckState, string> = {
  checked: 'Ελέγχθηκε',
  missing: 'Λείπει',
  differs: 'Διαφέρει',
  unchecked: 'Δεν ελέγχθηκε',
};

export interface LineCheck {
  state: CheckState;
  /** Τι ακριβώς λείπει ή διαφέρει, σε μία πρόταση. Κενό όταν ελέγχθηκε. */
  detail: string;
}

/** Μία γραμμή του Ε2, με τα ποσά των στηλών 13 έως 16 όπως μπαίνουν στο έντυπο. */
export interface SheetE2Line {
  propertyName: string;
  atak: string;
  tenantName: string;
  tenantAfm: string;
  from: string;
  to: string;
  months: number | '';
  ownershipPct: number;
  col13: number | '';
  col14: number | '';
  col15: number | '';
  col16: number | '';
  check: LineCheck;
}

/** Μία γραμμή του Ε1, πίνακας 4Δ2: κωδικός, ποσό και αν στέκει. */
export interface SheetE1Line {
  code: string;
  spouseCode: string;
  label: string;
  amount: number | '';
  check: LineCheck;
}

export interface TaxisnetSheet {
  year: number;
  ownerAfm: string;
  e1: SheetE1Line[];
  e2: SheetE2Line[];
  /** Πόσες γραμμές (Ε1 και Ε2 μαζί) είναι σε κάθε κατάσταση. */
  counts: Record<CheckState, number>;
  source: string;
}

/** Το ακίνητο όπως το χρειάζεται ο έλεγχος: ΑΤΑΚ και παροχή ρεύματος. */
export interface SheetProperty {
  id: string;
  name: string;
  atak: string | null;
  power_supply_no?: string | null;
}

const join = (xs: readonly string[]) => xs.filter(Boolean).join(', ');

/** Τι λείπει από τη γραμμή, από τα ίδια τα στοιχεία της. */
function missingOf(p: SheetProperty, row: E2RowDetail, i: number): string[] {
  const l = row.lines[i];
  const out: string[] = [];
  if (!(p.atak || '').trim()) out.push('ΑΤΑΚ');
  if (l.tenantName && !l.tenantAfm) out.push('ΑΦΜ μισθωτή (στ. 7)');
  if (l.estimated) out.push('καταχωρημένα μισθώματα ή διαμονές (το ποσό είναι εκτίμηση)');
  if (!l.use) out.push('είδος μίσθωσης (στ. 17)');
  if (!e2PowerSupply(p.power_supply_no)) out.push('αριθμός παροχής ρεύματος (στ. 18)');
  return out;
}

/**
 * Ο έλεγχος μιας γραμμής: πρώτα ό,τι λείπει από τα στοιχεία (αυτό δεν το
 * διορθώνει καμία σύγκριση), μετά η σύγκριση με το προσυμπληρωμένο.
 */
function checkOf(missing: readonly string[], r: PrefilledReconciliation, key: string): LineCheck {
  if (missing.length) return { state: 'missing', detail: `Λείπει: ${join(missing)}.` };
  if (r.status === 'not_uploaded') return { state: 'unchecked', detail: 'Το προσυμπληρωμένο Ε2 δεν έχει ανέβει.' };
  const line = r.lines.find(x => x.key === key);
  if (!line) return { state: 'unchecked', detail: 'Η γραμμή δεν μπήκε στη σύγκριση.' };
  if (line.status === 'match') return { state: 'checked', detail: 'Συμφωνεί με το προσυμπληρωμένο.' };
  if (line.status === 'vacant') return { state: 'checked', detail: 'Κενό στο έτος, χωρίς ποσό.' };
  return { state: 'differs', detail: line.findings[0]?.text || 'Διαφέρει από το προσυμπληρωμένο.' };
}

const RANK: Record<CheckState, number> = { missing: 3, differs: 2, unchecked: 1, checked: 0 };
/** Η χειρότερη κατάσταση κερδίζει: ένας κωδικός στέκει μόνο αν στέκουν όλες οι γραμμές του. */
const worst = (xs: readonly CheckState[]): CheckState =>
  xs.reduce<CheckState>((a, s) => (RANK[s] > RANK[a] ? s : a), 'checked');

const e1Key = (l: { code: string; category: string }) => `${l.code}|${l.category}`;

/**
 * Το φύλλο ενός ΑΦΜ. `properties[i]` αντιστοιχεί στο `rows[i]`, όπως στο
 * `loadE2Rows` (η ίδια ομάδα ΑΦΜ που γράφει το Ε2 του φακέλου).
 */
export function taxisnetSheet(input: {
  year: number;
  ownerAfm: string;
  properties: readonly SheetProperty[];
  rows: readonly E2RowDetail[];
  reconciliation: PrefilledReconciliation;
}): TaxisnetSheet {
  const { properties, rows, reconciliation: r } = input;

  // ── Ε2: μία γραμμή ανά μίσθωση, με το κλειδί που ξέρει η σύγκριση ─────
  const e2: SheetE2Line[] = [];
  const statesByProperty = new Map<string, { states: CheckState[]; name: string; missing: string[] }>();
  rows.forEach((row, pi) => {
    const p = properties[pi];
    const acc = { states: [] as CheckState[], name: p.name, missing: [] as string[] };
    row.lines.forEach((l, i) => {
      const missing = missingOf(p, row, i);
      const check = checkOf(missing, r, `${p.id}:${i}`);
      acc.states.push(check.state);
      acc.missing.push(...missing);
      e2.push({
        propertyName: p.name,
        atak: (p.atak || '').trim(),
        tenantName: l.tenantName,
        tenantAfm: l.tenantAfm,
        from: l.from,
        to: l.to,
        months: l.months,
        ownershipPct: row.ownershipPct,
        col13: l.source === 'rent' && l.gross > 0 ? l.gross : '',
        col14: '',
        col15: l.source === 'own_use' && l.gross > 0 ? l.gross : '',
        col16: '',
        check,
      });
    });
    statesByProperty.set(p.id, acc);
  });
  // Ό,τι έχει η ΑΑΔΕ και δεν έχει η εφαρμογή: ο λογιστής πρέπει να το δει
  // ΠΡΙΝ πληκτρολογήσει, γιατί το προσυμπληρωμένο θα το κρατήσει.
  for (const l of r.lines) {
    if (l.status !== 'missing_in_app' || !l.aade) continue;
    const a = l.aade;
    e2.push({
      propertyName: l.propertyName || a.address || 'Γραμμή της ΑΑΔΕ',
      atak: a.atak || '',
      tenantName: a.tenantName || '',
      tenantAfm: a.tenantAfm || '',
      from: a.from ? `${a.from.slice(8, 10)}/${a.from.slice(5, 7)}/${a.from.slice(0, 4)}` : '',
      to: a.to ? `${a.to.slice(8, 10)}/${a.to.slice(5, 7)}/${a.to.slice(0, 4)}` : '',
      months: a.months ?? '',
      ownershipPct: a.ownershipPct ?? 100,
      col13: a.incomeColumn === 13 ? a.gross : '',
      col14: a.incomeColumn === 14 ? a.gross : '',
      col15: a.incomeColumn === 15 ? a.gross : '',
      col16: a.incomeColumn === 16 ? a.gross : '',
      check: { state: 'missing', detail: l.findings[0]?.text || 'Υπάρχει μόνο στο προσυμπληρωμένο· λείπει από την εφαρμογή.' },
    });
  }

  // ── Ε1: οι κωδικοί του 4Δ2, με την κατάσταση των ακινήτων που τους γεμίζουν ─
  const summary = buildE1Summary([...rows]);
  const contributors = new Map<string, string[]>();
  rows.forEach((row, pi) => {
    for (const l of buildE1Summary([row]).lines) {
      const k = e1Key(l);
      contributors.set(k, [...(contributors.get(k) ?? []), properties[pi].id]);
    }
  });
  const e1: SheetE1Line[] = summary.lines.map(l => {
    if (l.unmapped) {
      return {
        code: '', spouseCode: '', label: l.label, amount: l.amount,
        check: { state: 'missing', detail: `Λείπει ο κωδικός: άγνωστος τύπος ακινήτου (${l.category}).` },
      };
    }
    const ids = contributors.get(e1Key(l)) ?? [];
    const parts = ids.map(id => statesByProperty.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
    const state = worst(parts.flatMap(x => x.states));
    const detail = state === 'checked' ? 'Όλες οι γραμμές του Ε2 που τον γεμίζουν ελέγχθηκαν.'
      : state === 'unchecked' ? 'Το προσυμπληρωμένο Ε2 δεν έχει ανέβει.'
      : `${CHECK_LABEL[state]} σε: ${join([...new Set(parts.filter(x => x.states.includes(state)).map(x => x.name))])}.`;
    return { code: l.code, spouseCode: l.spouseCode, label: l.label, amount: l.amount, check: { state, detail } };
  });
  // Τα ανείσπρακτα μετρήθηκαν στη στ. 13. Ο κωδικός τους υπάρχει μόνο με
  // δικαστική διεκδίκηση, που η εφαρμογή δεν καταγράφει: γράφεται ως γραμμή
  // που ΛΕΙΠΕΙ, χωρίς ποσό για πληκτρολόγηση.
  const unpaid = roundHalfUp(rows.reduce((s, x) => s + (x.unpaidRent || 0), 0), 2);
  if (unpaid > 0) {
    const u = E1_4D2.unpaid.home!;
    e1.push({
      code: u.code, spouseCode: u.spouseCode, label: u.label, amount: '',
      check: { state: 'missing', detail: `Ανείσπρακτα ${fe(unpaid)} είναι μέσα στο ποσό της εκμίσθωσης. Μεταφέρονται εδώ μόνο με διαταγή πληρωμής ή αγωγή (άρθρο 39 ΚΦΕ): λείπει η τεκμηρίωση.` },
    });
  }
  if (summary.ownUse > 0) {
    e1.push({
      code: '', spouseCode: '', label: 'Ιδιοχρησιμοποίηση κατοικίας', amount: summary.ownUse,
      check: { state: 'checked', detail: 'Ο πίνακας 4Δ2 δεν έχει κωδικό. Φαίνεται μόνο στη στ. 15 του Ε2.' },
    });
  }

  const counts: Record<CheckState, number> = { checked: 0, missing: 0, differs: 0, unchecked: 0 };
  for (const x of [...e1, ...e2]) counts[x.check.state]++;
  return { year: input.year, ownerAfm: input.ownerAfm, e1, e2, counts, source: E1_4D2_SOURCE };
}

/** Η μία φράση της σύνοψης: πόσες γραμμές στέκουν και πόσες όχι. */
export function sheetSummary(s: TaxisnetSheet): string {
  const total = s.e1.length + s.e2.length;
  if (total === 0) return 'Καμία γραμμή για δήλωση στο έτος.';
  const parts = (['checked', 'missing', 'differs', 'unchecked'] as const)
    .filter(k => s.counts[k] > 0)
    .map(k => `${CHECK_LABEL[k]}: ${s.counts[k]}`);
  return `${total === 1 ? '1 γραμμή' : `${total} γραμμές`} · ${parts.join(' · ')}`;
}
