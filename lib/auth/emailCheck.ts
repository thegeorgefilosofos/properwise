// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ EMAIL ΤΗΣ ΕΓΓΡΑΦΗΣ, ΕΛΕΓΜΕΝΟ ΣΤΟ ΠΕΔΙΟ ΚΑΙ ΟΧΙ ΑΠΟ ΤΟΝ ΠΕΡΙΗΓΗΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Η φόρμα στηριζόταν στο εγγενές `type="email" required`: το μήνυμα ερχόταν
// από τον περιηγητή, στη δική του γλώσσα και μέσα στο Instagram συχνά καθόλου.
// Εδώ ο έλεγχος γίνεται στον κώδικα, με ελληνική πρόταση που λέει τι να
// διορθωθεί και με πρόταση για τα συχνά τυπογραφικά στο όνομα του παρόχου
// (gmail.con, hotmial.com). Καθαρό αρχείο, χωρίς React: το διαβάζουν η φόρμα
// και οι δοκιμές.
// ═══════════════════════════════════════════════════════════════════════════

export type EmailProblem = 'empty' | 'invalid'

/** Αρκετά αυστηρό για να πιάσει το προφανές λάθος, αρκετά χαλαρό για να μην απορρίψει πραγματική διεύθυνση. */
const SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

/** Τι λείπει από τη διεύθυνση· `null` όταν μοιάζει σωστή. Τελικός κριτής μένει η Auth. */
export function emailProblem(email: string): EmailProblem | null {
  const e = email.trim()
  if (!e) return 'empty'
  return SHAPE.test(e) ? null : 'invalid'
}

/** Οι πάροχοι που γράφουν σχεδόν όλοι οι επισκέπτες μας. */
const DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.gr', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'otenet.gr', 'windowslive.com'] as const

/** Απόσταση Levenshtein, μόνο για λέξεις λίγων χαρακτήρων. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[b.length]
}

/**
 * Η διεύθυνση με διορθωμένο πάροχο, όταν ο πάροχος απέχει ένα ή δύο
 * πλήκτρα από γνωστό. `null` όταν δεν υπάρχει τι να προταθεί.
 */
export function suggestEmail(email: string): string | null {
  const e = email.trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return null
  const domain = e.slice(at + 1)
  if (!domain || (DOMAINS as readonly string[]).includes(domain)) return null
  let best: string | null = null, bestD = 3
  for (const d of DOMAINS) {
    const dist = distance(domain, d)
    if (dist < bestD) { best = d; bestD = dist }
  }
  // Δύο αλλαγές μόνο όταν το όνομα είναι μακρύ: «aol.com» δεν γίνεται «gmail.com».
  if (!best || (bestD === 2 && domain.length < 8)) return null
  return `${email.trim().slice(0, at)}@${best}`
}

/** Τα μηνύματα του πεδίου, ελληνικά. Τα αγγλικά ζουν στο lib/i18n/en/auth.ts. */
export const EMAIL_MSG = {
  empty: 'Γράψε το email σου.',
  invalid: 'Το email δεν φαίνεται σωστό. Έλεγξε το @ και την κατάληξη (π.χ. .gr ή .com).',
  suggest: 'Μήπως εννοείς',
} as const
