// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΟΝΟΜΑ ΑΛΛΑΖΕΙ ΜΙΑ ΦΟΡΑ ΤΟΝ ΜΗΝΑ: ΜΙΑ ΠΗΓΗ ΓΙΑ ΤΙΣ ΔΥΟ ΟΘΟΝΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Η σελίδα trust το υπόσχεται «για λόγους ασφάλειας». Το επιβάλλει η βάση
// (migration 20261110131000, `lock_full_name_change`, ίδιες 30 ημέρες). Το
// όνομα το γράφουν δύο οθόνες: ο Λογαριασμός (TabSettings) και τα στοιχεία
// τιμολόγησης (Billing). Ως τις 10/11/2026 η δεύτερη το άλλαζε ελεύθερα.
// ═══════════════════════════════════════════════════════════════════════════

/** Ημέρες ανάμεσα σε δύο αλλαγές ονόματος. Ίδιο με το `interval '30 days'` της βάσης. */
export const NAME_LOCK_DAYS = 30;

export const NAME_LOCKED_TEXT = 'Το όνομα αλλάζει μία φορά τον μήνα.';

/** Πόσες ημέρες μένουν ως την επόμενη επιτρεπτή αλλαγή (0 = αλλάζει τώρα). */
export function nameDaysLeft(changedAt: string | null | undefined, nowMs: number): number {
  if (!changedAt) return 0;
  const t = new Date(changedAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, NAME_LOCK_DAYS - Math.floor((nowMs - t) / 86_400_000));
}

/** Η άρνηση της βάσης (`raise exception 'full_name_locked'`). */
export function nameLockedError(error: unknown): boolean {
  const m = (error as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.includes('full_name_locked');
}
