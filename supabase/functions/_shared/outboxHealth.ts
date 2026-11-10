// ═══════════════════════════════════════════════════════════════════════════
// Η ΥΓΕΙΑ ΤΗΣ ΟΥΡΑΣ EMAIL ΣΤΟΝ ΕΛΕΓΧΟ ΥΓΕΙΑΣ
// ─────────────────────────────────────────────────────────────────────────
// Η `email_outbox_health()` (20261110132000) δίνει τις καταστάσεις του
// τελευταίου 24ώρου. Χωρίς αναγνώστη ήταν μέτρηση που δεν κοιτά κανείς. Το
// health-check τη διαβάζει και απαντά `email_ok` ΔΙΠΛΑ στο `ok`, όπως το
// `feeds_ok`: το `ok` μένει «οι σελίδες απαντούν», γιατί το διαβάζει η
// `health_status()`.
//
// ΚΑΤΩΦΛΙΑ. Ενα failed ή ένα probably_sent τη μέρα είναι θόρυβος (λάθος
// διεύθυνση, μια επανάληψη). Πέντε είναι μοτίβο: κάτι σπάει ή ξαναστέλνει
// με το ίδιο κλειδί.
// ═══════════════════════════════════════════════════════════════════════════

export const OUTBOX_LIMITS = { failed: 5, probably_sent: 5 } as const

export interface OutboxVerdict { ok: boolean; counts: Record<string, number>; why: string }

/** Η κρίση από τις γραμμές της `email_outbox_health()`. Σφάλμα ανάγνωσης = όχι εντάξει. */
export function outboxVerdict(rows: unknown, error: { message: string } | null): OutboxVerdict {
  if (error || !Array.isArray(rows)) return { ok: false, counts: {}, why: 'η ουρά δεν διαβάστηκε: ' + (error?.message ?? 'κενή απάντηση') }
  const counts: Record<string, number> = {}
  for (const r of rows as { status?: unknown; n?: unknown }[]) {
    if (typeof r?.status === 'string') counts[r.status] = Number(r.n) || 0
  }
  const over = (Object.keys(OUTBOX_LIMITS) as (keyof typeof OUTBOX_LIMITS)[])
    .filter(k => (counts[k] ?? 0) >= OUTBOX_LIMITS[k])
    .map(k => `${k}: ${counts[k]} (όριο ${OUTBOX_LIMITS[k]})`)
  return { ok: over.length === 0, counts, why: over.length ? over.join(' · ') : 'εντάξει' }
}
