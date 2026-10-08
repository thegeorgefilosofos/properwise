// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΤΡΟΦΟΔΟΣΙΕΣ ΣΤΟΝ ΕΛΕΓΧΟ ΥΓΕΙΑΣ: ΕΝΑ EMAIL ΟΤΑΝ ΣΠΑΣΟΥΝ, ΕΝΑ ΟΤΑΝ ΞΑΝΑΣΤΑΘΟΥΝ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ (28.09.2026). Ο έλεγχος επιτοκίων έγραφε «credit balance is too
// low» κάθε πρωί από τις 3 Σεπτεμβρίου. Η `watch_bank_feed()` κοκκίνιζε στο
// pg_cron, όπως σχεδιάστηκε, αλλά το κόκκινο εκεί δεν το βλέπει κανείς χωρίς
// να ανοίξει τον πίνακα. Είκοσι πέντε μέρες τα επιτόκια έμεναν παλιά και η Νόα
// δεν απαντούσε.
//
// ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΜΕ ΤΙΣ ΣΕΛΙΔΕΣ: μήνυμα μόνο στη ΜΕΤΑΒΑΣΗ. Ο έλεγχος τρέχει κάθε
// τέταρτο· ένα email ανά πέρασμα θα γινόταν θόρυβος την πρώτη ώρα.
//
// Η ΜΙΑ ΔΙΑΦΟΡΑ: η πρώτη μέτρηση που βρίσκει σπασμένη τροφοδοσία ΣΤΕΛΝΕΙ. Στις
// σελίδες το «δεν ξέρω πώς ήταν» σωπαίνει, γιατί μια σελίδα που δεν απαντά
// φαίνεται αμέσως. Μια τροφοδοσία που σπάει δεν φαίνεται πουθενά. Αυτή ακριβώς
// η σιωπή κράτησε είκοσι πέντε μέρες.
//
// ΚΑΘΑΡΟ .mjs ΧΩΡΙΣ Deno, όπως το probe.mjs: το φορτώνει η συνάρτηση άκρου και
// το δοκιμάζει το Node.
//
// ΤΑ ΔΕΔΟΜΕΝΑ ΑΝΑΦΟΡΑΣ ΜΠΑΙΝΟΥΝ ΣΤΟΝ ΙΔΙΟ ΚΑΝΟΝΑ (08.10.2026). Ενα πρόγραμμα
// δανείου έμεινε ζωντανό τρεις μήνες μετά τον κύκλο του και το βρήκε άνθρωπος,
// τυχαία. Η `reference_data_health()` το κρίνει και ακολουθεί την ίδια μετάβαση.
// ═══════════════════════════════════════════════════════════════════════════

/** Τι ισχύει ως τότε για τις τιμές τροφοδοσίας: η οθόνη κρατά τις τελευταίες. */
const LAST_CONFIRMED = 'Ως τότε η εφαρμογή δείχνει τις τελευταίες επιβεβαιωμένες τιμές.'

/**
 * Οι τροφοδοσίες που παρακολουθούνται, με το RPC που κρίνει την καθεμία και τη
 * φράση «ως τότε» της καθεμίας. Νέα τροφοδοσία μπαίνει ΤΕΛΕΥΤΑΙΑ: οι δοκιμές
 * διαβάζουν τις δύο πρώτες κατά θέση.
 */
export const FEEDS = [
  { path: 'feed:bank', rpc: 'bank_feed_health', name: 'Επιτόκια τραπεζών', after: LAST_CONFIRMED },
  { path: 'feed:market', rpc: 'market_feed_health', name: 'Δείκτες αγοράς (ΕΚΤ, Euribor)', after: LAST_CONFIRMED },
  {
    path: 'feed:reference', rpc: 'reference_data_health', name: 'Προγράμματα της καρτέλας Δάνεια',
    after: 'Ως τότε η καρτέλα Δάνεια δείχνει το πρόγραμμα ως ενεργό. Τι κάνεις: έλεγξε τον φορέα και γράψε μετανάστευση που ενημερώνει το verified_at και την προθεσμία ή κλείνει τη γραμμή με status = ended.',
  },
]

const clip = (s, n = 300) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

/**
 * Γραμμή για τη στήλη `details` του `health_checks`, από την απάντηση του RPC.
 * Αποτυχία ανάγνωσης μετρά ως σπασμένη: μια τροφοδοσία που δεν ελέγχεται δεν
 * είναι υγιής.
 */
export function feedEntry(feed, row, error) {
  if (error || !row) return { path: feed.path, ok: false, why: clip(`δεν διαβάστηκε η κατάσταση: ${error?.message ?? 'κενή απάντηση'}`) }
  return { path: feed.path, ok: Boolean(row.ok), why: clip(row.reason || (row.ok ? 'εντάξει' : 'χωρίς αιτία')) }
}

/** Η προηγούμενη κατάσταση κάθε τροφοδοσίας, από το `details` της τελευταίας γραμμής. */
export function previousFeeds(details) {
  const prev = new Map()
  if (!Array.isArray(details)) return prev
  for (const d of details) {
    if (d && typeof d.path === 'string' && d.path.startsWith('feed:')) prev.set(d.path, Boolean(d.ok))
  }
  return prev
}

/**
 * Το μήνυμα για όσες τροφοδοσίες άλλαξαν κατάσταση, ή `null`.
 *
 * Σπάει: ήταν υγιής ή δεν ξέραμε. Τώρα δεν είναι.
 * Ξαναστήνεται: ήταν σπασμένη. Τώρα είναι υγιής.
 */
export function feedAlert(prev, entries) {
  const broke = entries.filter(e => !e.ok && prev.get(e.path) !== false)
  const healed = entries.filter(e => e.ok && prev.get(e.path) === false)
  if (!broke.length && !healed.length) return null

  const name = (e) => FEEDS.find(f => f.path === e.path)?.name ?? e.path
  const subject = broke.length
    ? `PROPERWISE · σταμάτησε τροφοδοσία: ${broke.map(name).join(' · ')}`
    : `PROPERWISE · η τροφοδοσία δουλεύει ξανά: ${healed.map(name).join(' · ')}`
  const lines = []
  for (const e of broke) lines.push(`ΣΤΑΜΑΤΗΣΕ · ${name(e)}`, `  ${e.why}`, '')
  for (const e of healed) lines.push(`ΞΑΝΑ ΣΕ ΛΕΙΤΟΥΡΓΙΑ · ${name(e)}`, '')
  if (broke.some(e => /credit balance/i.test(e.why))) {
    lines.push('Τελείωσε το υπόλοιπο στον πάροχο AI. Σταματούν οι απαντήσεις της Νόας και η σάρωση εγγράφων.',
      'Τι κάνεις: console.anthropic.com · Billing · αγορά υπολοίπου και αυτόματη αναπλήρωση.', '')
  }
  // Μία φορά κάθε φράση: δύο σπασμένες τροφοδοσίες τιμών δεν τη λένε δύο φορές.
  // Διαδρομή χωρίς γραμμή στο FEEDS κρατά την παλιά φράση, όπως πριν.
  const after = new Set(broke.map(e => FEEDS.find(f => f.path === e.path)?.after ?? LAST_CONFIRMED))
  for (const a of after) lines.push(a)
  return { subject, lines }
}
