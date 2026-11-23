// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΑΝΟΝΑΣ ΤΩΝ 12 ΩΡΩΝ (ιδιοκτήτης 23/11/2026)
// ─────────────────────────────────────────────────────────────────────────
// Ανοίγει ο λογιστής τον χώρο του: συγχρονισμός μόνο αν ο τελευταίος είναι
// τουλάχιστον 12 ώρες πίσω. Τον ρωτούν η οθόνη (MydataCard) και η συνάρτηση
// άκρου (μέσω supabase/functions/_shared/mydata.ts)· η βάση τον ξαναελέγχει
// στη `mydata_sync_begin`. Χωρίς καμία εισαγωγή, ώστε να φορτώνει και σε Deno.
// ═══════════════════════════════════════════════════════════════════════════

export const AUTO_SYNC_HOURS = 12;

/**
 * Ημερομηνία που δεν διαβάζεται μετρά ως «ποτέ»: ένας συγχρονισμός παραπάνω
 * κοστίζει λιγότερο από έναν που δεν έγινε. Ημερομηνία στο μέλλον (ρολόι
 * συσκευής) δεν ξεκινά τίποτα.
 */
export function shouldAutoSync(lastSyncAt: string | null | undefined, now: Date = new Date(), hours = AUTO_SYNC_HOURS): boolean {
  if (!lastSyncAt) return true;
  const t = Date.parse(lastSyncAt);
  if (!Number.isFinite(t)) return true;
  const diff = now.getTime() - t;
  if (diff < 0) return false;
  return diff >= hours * 3600_000;
}
