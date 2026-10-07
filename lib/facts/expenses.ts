// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΑΠΑΝΕΣ ΤΟΥ ΕΤΟΥΣ: ΔΥΟ ΡΗΤΑ ΜΕΡΗ ΚΑΙ ΤΟ ΑΘΡΟΙΣΜΑ ΤΟΥΣ
// ─────────────────────────────────────────────────────────────────────────
// Για το ίδιο ακίνητο και το ίδιο έτος (Παγκράτι, λογαριασμός επίδειξης):
//   · η Επισκόπηση έγραφε «Δαπάνες 10.159,70€» στο πλακίδιο αλλά έβγαζε την
//     καθαρή απόδοση από μια ΑΛΛΗ προβολή (πάγιες × επαναλήψεις + απλήρωτοι)·
//   · το Χαρτοφυλάκιο έπαιρνε το σύνολο ΟΛΟΥ του έτους, μαζί με ό,τι λήγει τον
//     Δεκέμβριο· και το πολλαπλασίαζε επί 12 / μήνες που πέρασαν: ≈12.192€·
//   · το «Καθαρό ως σήμερα» αφαιρούσε από τα έσοδα ως σήμερα τις δαπάνες ως
//     τις 31/12.
//
// ΕΝΑΣ ΟΡΙΣΜΟΣ. Κάθε γραμμή του ενιαίου ημερολογίου (lib/expenses/ledger.ts,
// δαπάνες και λογαριασμοί, κάθε ευρώ μία φορά) με ημερομηνία μέσα στο έτος
// πηγαίνει σε ακριβώς ένα από τρία μέρη:
//   · ΠΛΗΡΩΜΕΝΕΣ ΩΣ ΣΗΜΕΡΑ: ημερομηνία ως σήμερα, πληρωμένη·
//   · ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΕΣ ΕΩΣ 31/12: ημερομηνία μετά από σήμερα·
//   · ΛΗΞΙΠΡΟΘΕΣΜΕΣ: ημερομηνία ως σήμερα, απλήρωτη (λογαριασμός που έληξε).
// Το σύνολο είναι το άθροισμα των τριών, χωρίς καμία προβολή. Στη βάση το
// `expenses.paid` είναι `true` εξ ορισμού, οπότε η ημερομηνία κρίνει: δαπάνη
// με ημερομηνία στις 20/11 είναι προγραμματισμένη, όχι πληρωμένη.
// ═══════════════════════════════════════════════════════════════════════════
import {
  mergeLedger, ledgerOfYear, ledgerTotal,
  type LedgerBill, type LedgerExpense, type LedgerEntry,
} from '@/lib/expenses/ledger';
import { roundHalfUp } from '@/lib/core/money';
import { EXPENSE_LABELS, EXPENSE_SHORT_LABELS } from './labels';

export interface YearExpenses {
  year: number;
  /** Ημερομηνία ως σήμερα, πληρωμένες. */
  paid: number;
  /** Ημερομηνία μετά από σήμερα, μέσα στο έτος. */
  scheduled: number;
  /** Ημερομηνία ως σήμερα, απλήρωτες. */
  overdue: number;
  /** paid + scheduled + overdue. */
  total: number;
  /** Οι γραμμές του έτους, για όποια οθόνη τις απαριθμεί. */
  entries: LedgerEntry[];
}

const cents = (n: number) => roundHalfUp(n, 2);

/** Τα τρία μέρη, από γραμμές του ενιαίου ημερολογίου. */
export function yearExpensesOf(entries: readonly LedgerEntry[], year: number, today: string): YearExpenses {
  const t = today.slice(0, 10);
  const ofYear = ledgerOfYear([...entries], year);
  const paid: LedgerEntry[] = [], scheduled: LedgerEntry[] = [], overdue: LedgerEntry[] = [];
  for (const e of ofYear) {
    if (e.date > t) scheduled.push(e);
    else if (e.paid) paid.push(e);
    else overdue.push(e);
  }
  const p = cents(ledgerTotal(paid)), s = cents(ledgerTotal(scheduled)), o = cents(ledgerTotal(overdue));
  return { year, paid: p, scheduled: s, overdue: o, total: cents(p + s + o), entries: ofYear };
}

/** Τα τρία μέρη, από τις γραμμές της βάσης (λογαριασμοί και δαπάνες). */
export function yearExpenses(bills: readonly LedgerBill[], expenses: readonly LedgerExpense[], year: number, today: string): YearExpenses {
  return yearExpensesOf(mergeLedger([...bills], [...expenses]).entries, year, today);
}

/** Τα μέρη ως κείμενο, με τις ίδιες λέξεις σε κάθε οθόνη. Τα ποσά τα μορφοποιεί ο καλών. */
export function expenseParts(y: YearExpenses, fmt: (n: number) => string): string {
  const parts = [`${EXPENSE_LABELS.paid} ${fmt(y.paid)}`, `${EXPENSE_LABELS.scheduled} ${fmt(y.scheduled)}`];
  if (y.overdue > 0) parts.push(`${EXPENSE_LABELS.overdue} ${fmt(y.overdue)}`);
  return parts.join(' + ');
}

/**
 * Τα μέρη σε στενό πλακίδιο: πρώτα το ποσό, μετά η σύντομη λέξη. Ίδια ποσά και
 * ίδια σειρά με το `expenseParts`· αλλάζει μόνο το μήκος.
 */
export function expensePartsShort(y: YearExpenses, fmt: (n: number) => string): string {
  const parts = [`${fmt(y.paid)} ${EXPENSE_SHORT_LABELS.paid}`, `${fmt(y.scheduled)} ${EXPENSE_SHORT_LABELS.scheduled}`];
  if (y.overdue > 0) parts.push(`${fmt(y.overdue)} ${EXPENSE_SHORT_LABELS.overdue}`);
  return parts.join(' + ');
}
