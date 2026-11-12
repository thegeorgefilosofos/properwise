// ═══════════════════════════════════════════════════════════════════════════
// ΣΕ ΠΟΙΟΝ ΦΕΥΓΕΙ ΕΝΑ ΕΝΗΜΕΡΩΤΙΚΟ: ΜΟΝΟ ΜΕ ΡΗΤΟ «ΝΑΙ» ΚΑΙ ΣΥΝΔΕΣΜΟ ΑΠΕΓΓΡΑΦΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Ο έλεγχος κλίμακας (10/11/2026) βρήκε ότι οι δύο αποστολείς (newsletter,
// market digest) διάβαζαν τις προτιμήσεις σε ΕΝΑ αίτημα. Πάνω από 1.000
// γραμμές το PostgREST κόβει σιωπηλά, ο χάρτης έμενε μισός και το φίλτρο
// `pref?.product_news !== false` έβγαινε αληθές για όποιον έλειπε: το μήνυμα
// έφευγε και σε όσους είχαν κάνει απεγγραφή, με σύνδεσμο «/unsubscribe/» ή
// «/unsubscribe/undefined».
//
// Τώρα: η απόφαση είναι ΡΗΤΗ. Φεύγει μόνο σε χρήστη που ΕΧΕΙ γραμμή, με τη
// στήλη ακριβώς `true` και με token απεγγραφής. Οτιδήποτε λείπει σημαίνει
// «όχι». Η γραμμή που δημιουργεί ο αποστολέας περνά από τον trigger
// `marketing_prefs_from_signup`, που την κλείνει για όποιον δεν συναίνεσε στην
// εγγραφή, οπότε κανένας δεν «ανοίγει» από εδώ.
// ═══════════════════════════════════════════════════════════════════════════

import { allPages, PAGE_SIZE } from './pages.ts'

export type NewsKind = 'product_news' | 'market_news'

export interface PrefRow { user_id: string; product_news?: unknown; market_news?: unknown; unsubscribe_token?: unknown }
export interface Recipient { id: string; email: string; token: string }

/** Η καθαρή απόφαση: ποιοι από τους χρήστες παίρνουν το μήνυμα. */
export function audience(users: { id: string; email: string }[], prefs: PrefRow[], kind: NewsKind): { recipients: Recipient[]; skippedNoToken: number } {
  const byUser = new Map(prefs.map(p => [p.user_id, p]))
  const recipients: Recipient[] = []
  let skippedNoToken = 0
  for (const u of users) {
    const p = byUser.get(u.id)
    if (!p || p[kind] !== true) continue
    const token = typeof p.unsubscribe_token === 'string' ? p.unsubscribe_token.trim() : ''
    if (!token) { skippedNoToken++; continue }
    recipients.push({ id: u.id, email: u.email, token })
  }
  return { recipients, skippedNoToken }
}

// Το ελάχιστο σχήμα του πελάτη που χρειάζεται εδώ, χωρίς `any`.
type Err = { message: string } | null
interface Chain extends PromiseLike<{ data: unknown; error: Err }> {
  select(cols: string): Chain
  order(col: string, o: { ascending: boolean }): Chain
  range(from: number, to: number): Chain
}
interface Db {
  from(table: string): Chain & { upsert(rows: unknown[], o: { onConflict: string; ignoreDuplicates: boolean }): PromiseLike<{ error: Err }> }
}

/** Εξασφαλίζει γραμμή προτιμήσεων ανά χρήστη, σε παρτίδες. Η υπάρχουσα δεν αγγίζεται. */
export async function ensurePrefs(db: Db, userIds: string[]): Promise<{ message: string } | null> {
  for (let i = 0; i < userIds.length; i += PAGE_SIZE) {
    const { error } = await db.from('email_marketing_prefs')
      .upsert(userIds.slice(i, i + PAGE_SIZE).map(id => ({ user_id: id })), { onConflict: 'user_id', ignoreDuplicates: true })
    if (error) return error
  }
  return null
}

/** Ολες οι προτιμήσεις, σε σελίδες, με σταθερή ταξινόμηση στο μοναδικό κλειδί. */
export async function readPrefs(db: Db, kind: NewsKind): Promise<{ rows: PrefRow[]; error: Err }> {
  const { rows, error } = await allPages<PrefRow>((from, to) => db.from('email_marketing_prefs')
    .select(`user_id,${kind},unsubscribe_token`).order('user_id', { ascending: true }).range(from, to) as PromiseLike<{ data: PrefRow[] | null; error: Err }>)
  return { rows, error }
}

/**
 * Κλειδί που κάνει μια παρτίδα ιδιοδύναμη στο Resend (κρατιέται 24 ώρες):
 * αν η ίδια εκτέλεση ξανατρέξει, η ίδια παρτίδα δεν ξαναφεύγει.
 */
export async function batchKey(prefix: string, recipients: Recipient[], salt = ''): Promise<string> {
  // Το `salt` λέει ΤΙ στέλνεται (ανακοινώσεις, εβδομάδα): άλλο μήνυμα στους
  // ίδιους παραλήπτες την ίδια μέρα παίρνει άλλο κλειδί και δεν «καταπίνεται».
  const data = new TextEncoder().encode(`${salt}|${recipients.map(r => r.id).join(',')}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hash)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}-${hex}`
}
