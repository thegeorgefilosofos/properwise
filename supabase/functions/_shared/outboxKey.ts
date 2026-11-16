// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΚΛΕΙΔΙ ΜΟΝΑΔΙΚΟΤΗΤΑΣ ΤΗΣ ΟΥΡΑΣ ΠΡΟΣ ΤΟΝ RESEND
// ─────────────────────────────────────────────────────────────────────────
// Ο Resend κρατά το `Idempotency-Key` 24 ώρες ανά λογαριασμό. Δεύτερη κλήση με
// το ίδιο κλειδί και το ίδιο σώμα δεν στέλνει δεύτερο email.
//
// ΤΟ ΠΕΡΙΒΑΛΛΟΝ ΜΕΣΑ ΣΤΟ ΚΛΕΙΔΙ. Το staging και η παραγωγή έχουν δική τους
// ουρά, άρα ίδια `id`, αλλά μπορεί να μοιράζονται λογαριασμό Resend. Με κλειδί
// `outbox-<id>` η γραμμή 42 του staging «κατάπινε» τη γραμμή 42 της παραγωγής
// (ή έπαιρνε 409). Το project ref του Supabase τα χωρίζει.
//
// Η ΓΕΝΙΑ ΤΟΥ ΚΛΕΙΔΙΟΥ. Ο αριθμός στο τέλος αλλάζει ΜΟΝΟ όταν η προηγούμενη
// προσπάθεια σίγουρα δεν έστειλε (απάντηση λάθους από τον Resend ή κανένα
// κλειδί Resend). Ετσι μια αποτυχημένη απάντηση που ίσως κρατήθηκε για το
// κλειδί δεν ξαναπαίζεται για πάντα. Σε αβέβαιη έκβαση (λήξη χρόνου, χαμένη
// απάντηση) η επανάληψη κρατά το ίδιο κλειδί: αν το πρώτο έφυγε, ο Resend
// γυρίζει την πρώτη απάντηση χωρίς νέα αποστολή.
// ═══════════════════════════════════════════════════════════════════════════

/** Το project ref από το SUPABASE_URL (`https://<ref>.supabase.co`). */
export function projectRef(supabaseUrl: string): string {
  let host = ''
  try { host = new URL(supabaseUrl).hostname } catch { host = '' }
  const label = host.endsWith('.supabase.co') ? host.split('.')[0] : host
  const clean = label.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')
  return clean || 'local'
}

/** `outbox-<ref>-<id>-<γενιά>`: μοναδικό ανά περιβάλλον, γραμμή και γενιά. */
export function outboxIdempotencyKey(ref: string, outboxId: string, gen: number): string {
  return `outbox-${ref}-${outboxId}-${gen}`
}

/** Το `name` του σφάλματος του Resend (π.χ. `invalid_idempotent_request`), ή κενό. */
export function resendErrorName(body: string): string {
  try {
    const name = (JSON.parse(body) as { name?: unknown })?.name
    return typeof name === 'string' ? name.slice(0, 80) : ''
  } catch { return '' }
}
