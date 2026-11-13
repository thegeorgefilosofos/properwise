// ═══════════════════════════════════════════════════════════════════════════
// ΤΙ ΧΡΕΙΑΖΕΤΑΙ ΕΣΕΝΑ: ΛΗΞΙΠΡΟΘΕΣΜΑ, ΑΠΛΗΡΩΤΑ, ΥΠΕΡΒΑΣΕΙΣ
// ─────────────────────────────────────────────────────────────────────────
// Ο Προϋπολογισμός δεν έλεγε τίποτα για ό,τι έχει λήξει και οι Δαπάνες το
// έγραφαν μόνο ως μία γραμμή βαθιά μέσα στη λίστα. Εδώ ορίζεται ΜΙΑ φορά τι
// μετρά ως ληξιπρόθεσμο και τι ως απλώς απλήρωτο, ώστε τα τσιπ του
// Προϋπολογισμού και το φίλτρο των Δαπανών να λένε τα ίδια νούμερα.
// ═══════════════════════════════════════════════════════════════════════════
import { budgetBucket } from './taxonomy';

/** Ό,τι χρειάζεται από μια γραμμή του καθολικού (lib/expenses/ledger.ts). */
export interface AttentionEntry {
  date: string;
  due: string | null;
  amount: number;
  paid: boolean;
  category: string;
  group: string | null;
}

/** Ληξιπρόθεσμο: απλήρωτο με προθεσμία ΠΡΙΝ από σήμερα (ημέρα Αθήνας, ISO). */
export const isOverdue = (e: AttentionEntry, today: string): boolean =>
  !e.paid && !!e.due && e.due < today;

/** Απλήρωτο που δεν έχει λήξει ακόμη. */
export const isPendingNotOverdue = (e: AttentionEntry, today: string): boolean =>
  !e.paid && !isOverdue(e, today);

/** Αθροισμα σε λεπτά, ώστε δύο οθόνες να μη διαφωνούν στο τελευταίο ψηφίο. */
export const sumCents = (xs: readonly number[]): number =>
  Math.round(xs.reduce((s, x) => s + Math.round((Number(x) || 0) * 100), 0)) / 100;

export interface AttentionCount { n: number; sum: number }
export interface Attention { overdue: AttentionCount; pending: AttentionCount }

export function attentionOf(entries: readonly AttentionEntry[], today: string): Attention {
  const over = entries.filter(e => isOverdue(e, today));
  const pend = entries.filter(e => isPendingNotOverdue(e, today));
  return {
    overdue: { n: over.length, sum: sumCents(over.map(e => e.amount)) },
    pending: { n: pend.length, sum: sumCents(pend.map(e => e.amount)) },
  };
}

/** Το φίλτρο με το οποίο ανοίγει η λίστα των Δαπανών από ένα τσιπ. */
export type LedgerFilter =
  | { kind: 'overdue' }
  | { kind: 'pending' }
  | { kind: 'buckets'; buckets: string[]; month: string; label: string };

/** Ο κουβάς του Προϋπολογισμού για μια γραμμή. Δική σου κατηγορία μένει ως έχει. */
export const bucketOfEntry = (e: Pick<AttentionEntry, 'category' | 'group'>, custom: readonly string[] = []): string =>
  e.group === 'maintenance' ? 'maintenance' : custom.includes(e.category) ? e.category : budgetBucket(e.category);

export function matchesLedgerFilter(e: AttentionEntry, f: LedgerFilter | null | undefined, today: string): boolean {
  if (!f) return true;
  if (f.kind === 'overdue') return isOverdue(e, today);
  if (f.kind === 'pending') return isPendingNotOverdue(e, today);
  return e.date.startsWith(f.month) && f.buckets.includes(bucketOfEntry(e, f.buckets));
}

/** «1 ληξιπρόθεσμη», «3 ληξιπρόθεσμες»: η λέξη είναι η δαπάνη, θηλυκό. */
export const overdueWord = (n: number): string => `${n} ${n === 1 ? 'ληξιπρόθεσμη' : 'ληξιπρόθεσμες'}`;
/** «1 εκκρεμεί», «2 εκκρεμούν». */
export const pendingWord = (n: number): string => `${n} ${n === 1 ? 'εκκρεμεί' : 'εκκρεμούν'}`;
/** «1 κατηγορία σε υπέρβαση», «4 κατηγορίες σε υπέρβαση». */
export const overWord = (n: number): string => `${n} ${n === 1 ? 'κατηγορία' : 'κατηγορίες'} σε υπέρβαση`;
