// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΑΘΟΛΙΚΟ ΤΟΥ ΑΚΙΝΗΤΟΥ, ΜΕ ΜΙΑ ΑΝΑΓΝΩΣΗ ΚΑΙ ΕΝΑ ΣΥΝΟΛΟ ΚΑΝΟΝΩΝ
// ─────────────────────────────────────────────────────────────────────────
// Οι Δαπάνες και τα τσιπ «Θέλουν την προσοχή σου» του Προϋπολογισμού πρέπει να
// βλέπουν ΤΙΣ ΙΔΙΕΣ γραμμές: όλο το ιστορικό, μόνο του χρήστη, χωρίς τα έξοδα
// που χρεώνονται στον ενοικιαστή. Με δύο αναγνώσεις, το «2 εκκρεμούν» άνοιγε
// λίστα τριών (ανασκόπηση PR 576). Τώρα και οι δύο καλούν αυτό.
// ═══════════════════════════════════════════════════════════════════════════
import type { Db } from './bills';
import * as billStore from './bills';
import * as expenseStore from './expenses';
import type { LedgerBill, LedgerExpense } from '@/lib/expenses/ledger';

export interface LedgerSource { bills: LedgerBill[]; expenses: LedgerExpense[]; error: unknown }

export async function ledgerSource(db: Db, propertyId: string, userId: string): Promise<LedgerSource> {
  const [b, e] = await Promise.all([
    billStore.ofPropertyWithError<LedgerBill>(db, propertyId, billStore.LEDGER_COLUMNS, userId),
    expenseStore.ledgerWithError(db, propertyId, { userId, excludeCategory: 'tenant_extra' }),
  ]);
  return { bills: b.rows, expenses: e.rows as unknown as LedgerExpense[], error: b.error ?? e.error ?? null };
}
