// ═══════════════════════════════════════════════════════════════════════════
// Εισαγωγή κίνησης τραπεζικού λογαριασμού (CSV) + αυτόματη αντιστοίχιση σε
// αναμενόμενα ενοίκια και έξοδα. ΚΑΘΑΡΗ λογική (χωρίς I/O/DOM): παίρνει κείμενο
// CSV, βγάζει κινήσεις και προτείνει αντιστοιχίσεις — ο χρήστης επιβεβαιώνει.
// Υποστηρίζει ελληνικές μορφές (διαχωριστικό , ; ή tab· ποσά 1.234,56).
// ═══════════════════════════════════════════════════════════════════════════

import { parseAmount, parseDate as coreParseDate } from '../core/greek'
import { csvDelimiter, csvSplitLine } from '../core/csv'

export interface BankTxn {
  date: string          // ISO YYYY-MM-DD (κενό αν δεν αναγνωρίστηκε)
  description: string
  amount: number        // θετικό = πίστωση (είσοδος), αρνητικό = χρέωση (έξοδος)
  raw: string
  /** Αποτύπωμα της κίνησης για τη διπλοεγγραφή. Δες `keyOfLine` πιο κάτω. */
  key: string
}

const DATE_KEYS = ['ημερομηνία', 'ημ/νία', 'date', 'ημερ']
const DESC_KEYS = ['περιγραφή', 'αιτιολογία', 'description', 'λεπτομέρειες', 'κίνηση', 'συναλλαγή']
const AMOUNT_KEYS = ['ποσό', 'amount', 'αξία']
const DEBIT_KEYS = ['χρέωση', 'debit', 'χρεωσεις']
const CREDIT_KEYS = ['πίστωση', 'credit', 'πιστωσεις']
/** Υπόλοιπο λογαριασμού μετά την κίνηση: δεν είναι ποτέ το ποσό της. */
const BALANCE_KEYS = ['υπόλοιπο', 'balance']
/** Σημάδια ημερομηνίας αξίας: προτιμάται η ημερομηνία της συναλλαγής. */
const VALUE_DATE_KEYS = ['αξία', 'value']

// Ο ΑΝΑΛΥΤΗΣ ΕΦΥΓΕ ΣΤΟ lib/core/csv.ts. Ήταν σωστός και ιδιωτικός εδώ, ενώ δύο
// ακόμη οθόνες διάβαζαν CSV με δικό τους, λανθασμένο. Τώρα ένας.
const detectDelimiter = csvDelimiter
const splitCsvLine = csvSplitLine

/**
 * Ποσό κίνησης. Η ανάγνωση γίνεται ΜΙΑ φορά, στο lib/core/greek.ts — εδώ απλώς
 * επανεξάγεται, ώστε το ίδιο αντίγραφο κίνησης να διαβάζεται ίδια από την
 * Τραπεζική Εισαγωγή και από τη Μαζική Καταχώρηση.
 *
 * ΠΡΟΣΟΧΗ: εδώ ΔΕΝ μπαίνει το φίλτρο «κάτω από 0,01 / πάνω από 1.000.000» του
 * lib/billing/parse.ts. Αυτό αφορά το ταίριασμα λογαριασμών· σε τραπεζικό
 * αντίγραφο θα έκοβε σιωπηλά κάθε μεγάλη μεταφορά.
 */
export { parseAmount }

/**
 * Ημερομηνία κίνησης σε ISO, ή '' αν δεν είναι ημερομηνία (οι καλούντες εδώ
 * συγκρίνουν με κενό κείμενο).
 *
 * Κόβει τυχόν ώρα: πολλές τράπεζες δίνουν «2026-03-15 10:42» ή «2026-03-15T10:42»
 * στη στήλη ημερομηνίας.
 */
export function parseDate(s: string): string {
  return coreParseDate(String(s ?? '').trim().split(/[T ]/)[0]) ?? ''
}

// ── Η «ΗΜΕΡΟΜΗΝΙΑ ΑΞΙΑΣ» ΓΙΝΟΤΑΝ ΣΤΗΛΗ ΠΟΣΟΥ ──────────────────────────────
// Η αναζήτηση στήλης ήταν υποσυμβολοσειρά με πρώτη νίκη την πιο αριστερή
// στήλη. Το «αξία» είναι κλειδί ποσού, οπότε η «Ημερομηνία Αξίας» ή «Ημ/νία
// Αξίας», που τη δίνουν οι περισσότερες ελληνικές τράπεζες, διαβαζόταν ως
// ποσό: καμία γραμμή δεν είχε αριθμό εκεί και η εισαγωγή έβγαζε μηδέν
// κινήσεις. Το ίδιο έπαθε η περιγραφή: το «συναλλαγή» έπιανε την «Ημ/νία
// Συναλλαγής». Τώρα:
//   1. οι επικεφαλίδες συγκρίνονται χωρίς τόνους και πεζά,
//   2. ακριβές ταίριασμα νικά ταίριασμα λέξης και αυτό νικά υποσυμβολοσειρά,
//   3. κάθε ρόλος διαλέγει μόνο ανάμεσα σε στήλες που δεν έχει πάρει άλλος,
//   4. στήλη που μοιάζει με ημερομηνία ή υπόλοιπο δεν γίνεται ποτέ ποσό.

/** Πεζά, χωρίς τόνους και με σίγμα αντί για τελικό σίγμα. */
function norm(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ς/g, 'σ').trim()
}

/** Πόσο καλά ταιριάζει η επικεφαλίδα: 3 ακριβώς, 2 λέξη, 1 υποσυμβολοσειρά, 0 καθόλου. */
function matchScore(header: string, keys: string[]): number {
  const h = norm(header)
  if (!h) return 0
  const words = h.split(/[^\p{L}\p{N}/]+/u).filter(Boolean)
  let best = 0
  for (const raw of keys) {
    const k = norm(raw)
    if (h === k) return 3
    if (words.includes(k)) best = Math.max(best, 2)
    else if (h.includes(k)) best = Math.max(best, 1)
  }
  return best
}

const matches = (header: string, keys: string[]) => matchScore(header, keys) > 0

/** Η στήλη που ταιριάζει καλύτερα, εκτός από όσες αποκλείονται· στην ισοπαλία η αριστερότερη. */
function findCol(headers: string[], keys: string[], skip: (i: number) => boolean = () => false): number {
  let best = -1, bestScore = 0
  for (let i = 0; i < headers.length; i++) {
    if (skip(i)) continue
    const sc = matchScore(headers[i], keys)
    if (sc > bestScore) { best = i; bestScore = sc }
  }
  return best
}

interface Columns { di: number; desc: number; ai: number; debit: number; credit: number }

function findColumns(headers: string[]): Columns {
  const isDate = (i: number) => matches(headers[i], DATE_KEYS)
  // Ημερομηνία συναλλαγής πρώτα· η ημερομηνία αξίας μόνο αν δεν υπάρχει άλλη.
  let di = findCol(headers, DATE_KEYS, i => matches(headers[i], VALUE_DATE_KEYS))
  if (di < 0) di = findCol(headers, DATE_KEYS)
  // Ούτε η περιγραφή παίρνει στήλη χρημάτων: το «Ποσό Συναλλαγής» είναι ποσό.
  // ΔΥΟ ΠΕΡΑΣΜΑΤΑ. Πρώτα μόνο στήλες χωρίς καμία λέξη χρημάτων, όπως πάντα.
  // Αν δεν υπάρχει τέτοια, μια στήλη με λέξη χρημάτων γίνεται περιγραφή όταν η
  // λέξη περιγραφής ταιριάζει καλύτερα: η «Αιτιολογία Χρέωσης» (λέξη
  // «αιτιολογία» έναντι μέρους του «χρέωσης»). Το δεύτερο πέρασμα σε ένα
  // βήμα έκανε την «Κίνηση Χρέωσης» περιγραφή και έχανε κάθε χρέωση: γι' αυτό
  // δεν παίρνει ποτέ τη μόνη στήλη χρέωσης ή πίστωσης όταν δεν υπάρχει στήλη
  // ποσού να την αντικαταστήσει.
  const MONEY = [AMOUNT_KEYS, DEBIT_KEYS, CREDIT_KEYS, BALANCE_KEYS]
  const moneyScore = (i: number) => Math.max(...MONEY.map(k => matchScore(headers[i], k)))
  const hasAmountCol = headers.some((_, i) => !isDate(i) && matches(headers[i], AMOUNT_KEYS) &&
    ![DEBIT_KEYS, CREDIT_KEYS, BALANCE_KEYS].some(k => matches(headers[i], k)))
  const soleOf = (keys: string[], i: number) => matches(headers[i], keys) &&
    headers.every((h, j) => j === i || isDate(j) || !matches(h, keys))
  const neededForMoney = (i: number) => !hasAmountCol && (soleOf(DEBIT_KEYS, i) || soleOf(CREDIT_KEYS, i))
  let desc = findCol(headers, DESC_KEYS, i => isDate(i) || moneyScore(i) > 0)
  if (desc < 0) desc = findCol(headers, DESC_KEYS, i =>
    isDate(i) || moneyScore(i) >= matchScore(headers[i], DESC_KEYS) || neededForMoney(i))
  const taken = (i: number) => isDate(i) || i === desc
  const debit = findCol(headers, DEBIT_KEYS, taken)
  const credit = findCol(headers, CREDIT_KEYS, taken)
  const ai = findCol(headers, AMOUNT_KEYS, i =>
    taken(i) || i === debit || i === credit || [DEBIT_KEYS, CREDIT_KEYS, BALANCE_KEYS].some(k => matches(headers[i], k)))
  return { di, desc, ai, debit, credit }
}

// ── ΤΟ ΑΠΟΤΥΠΩΜΑ ΤΗΣ ΤΡΑΠΕΖΑΣ ΕΣΒΗΝΕ ΑΛΗΘΙΝΕΣ ΚΙΝΗΣΕΙΣ ─────────────────────
// Το κλειδί ήταν `ημερομηνία|ποσό|περιγραφή`, κομμένο στους 200 χαρακτήρες.
// Δύο αναλήψεις 50,00 από το ίδιο ΑΤΜ την ίδια ημέρα έδιναν ΤΟ ΙΔΙΟ κλειδί,
// και το upsert με ignoreDuplicates κρατούσε μία: η δεύτερη χανόταν σιωπηλά
// και στους δύο πίνακες (expenses, bank_transactions). Στο Ε2 έμπαιναν 50,00
// αντί για 100,00, ενώ το αντίγραφο της τράπεζας δίπλα έδειχνε δύο γραμμές.
//
// Το αρχείο δίνει περισσότερες από τρεις στήλες: υπόλοιπο μετά την κίνηση,
// κωδικό συναλλαγής, αύξοντα αριθμό. Δεν τα διαβάζουμε ονομαστικά, γιατί
// κάθε τράπεζα τα ονομάζει αλλιώς, αλλά είναι ΟΛΑ μέσα στη γραμμή: το κλειδί
// δένεται σε ολόκληρη τη γραμμή. Οταν ακόμη και η γραμμή είναι κατά λέξη
// ίδια, ξεχωρίζει η σειρά εμφάνισης μέσα στο ίδιο αρχείο.
// Κόστος: ένα hash 32 bit ανά γραμμή. Η σειρά μένει σταθερή ανάμεσα σε δύο
// εξαγωγές, γιατί μετριέται μόνο μέσα σε ομάδα πανομοιότυπων γραμμών, που
// έχουν εξ ορισμού την ίδια ημερομηνία και δεν χωρίζονται από ένα διάστημα.

/** Πρόθεμα μορφής: ξεχωρίζει τα νέα αποτυπώματα από τα παλιά της βάσης. */
const KEY_VERSION = 'v2'

/** FNV-1a 32 bit. Σταθερό και μικρό, όχι κρυπτογραφικό: δεν χρειάζεται. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}

/** Το αποτύπωμα μιας γραμμής: ημερομηνία, ποσό, όλη η γραμμή, σειρά. */
function keyOfLine(date: string, amount: number, line: string, nth: number): string {
  return `${KEY_VERSION}|${date}|${amount.toFixed(2)}|${fnv1a(line)}|${nth}`
}

/**
 * ΤΟ ΠΑΛΙΟ ΑΠΟΤΥΠΩΜΑ, ΜΟΝΟ ΓΙΑ ΑΝΑΓΝΩΡΙΣΗ.
 *
 * Ο,τι εισήχθη πριν από αυτή την αλλαγή είναι γραμμένο έτσι στη βάση. Χωρίς
 * τον έλεγχο και με το παλιό κλειδί, η πρώτη εισαγωγή μετά την αναβάθμιση θα
 * ξανάγραφε ΚΑΘΕ παλιά κίνηση ως καινούργια: διπλά έξοδα σε όλο το έτος.
 */
export function legacyKeyOf(t: { date: string; description: string; amount: number }): string {
  return cutUtf16(`${t.date}|${t.amount}|${t.description}`, 200)
}

// ── ΤΟ ΚΟΨΙΜΟ ΣΤΟΥΣ 200 ΕΣΠΑΓΕ EMOJI ΣΤΗ ΜΕΣΗ ──────────────────────────────
// Το `.slice(0, 200)` μετρά μονάδες UTF-16. Ενα emoji πιάνει δύο: όταν το όριο
// έπεφτε ανάμεσά τους, έμενε μισό ζεύγος και το encodeURIComponent έριχνε
// εξαίρεση μέσα στον έλεγχο διπλών. Εδώ, αν το κόψιμο σπάει ζεύγος, πέφτει
// και το μισό. Το όριο μένει σε μονάδες UTF-16 ΕΠΙΤΗΔΕΣ: σε κάθε άλλη
// περίπτωση το κλειδί βγαίνει ΙΔΙΟ με όσα έγραψε το `.slice` στη βάση, ενώ
// ένα κόψιμο σε σημεία κώδικα θα άλλαζε κάθε παλιό κλειδί που έχει emoji.

/** Κόβει στις `max` μονάδες UTF-16 χωρίς να αφήσει μισό ζεύγος surrogate. */
function cutUtf16(s: string, max: number): string {
  if (s.length <= max) return s
  const c = s.charCodeAt(max - 1)
  return s.slice(0, c >= 0xd800 && c <= 0xdbff ? max - 1 : max)
}

// ── Ο ΕΛΕΓΧΟΣ ΔΙΠΛΩΝ ΕΒΛΕΠΕ ΜΟΝΟ ΤΙΣ ΠΡΩΤΕΣ ΧΙΛΙΕΣ ΚΙΝΗΣΕΙΣ ──────────────────
// Η οθόνη διάβαζε ΟΛΑ τα αποτυπώματα του χρήστη με ένα ερώτημα χωρίς σελίδες.
// Το PostgREST κόβει την απάντηση στις 1.000 γραμμές, οπότε από τη χιλιοστή
// πρώτη κίνηση και μετά τα παλιά αποτυπώματα δεν έφταναν ποτέ και οι παλιές
// κινήσεις ξαναγύριζαν για έλεγχο ως καινούργιες. Τώρα ρωτάμε μόνο για τα
// αποτυπώματα του αρχείου (νέο και παλιό κλειδί κάθε γραμμής), σε ομάδες.
// Η ομάδα κλείνει στα 200 κλειδιά ή όταν το μήκος στο URL περάσει το όριο:
// τα παλιά κλειδιά φτάνουν τους 200 χαρακτήρες και σε ελληνικά το URL
// εξαπλασιάζεται, οπότε 200 τέτοια δεν χωρούν σε ένα αίτημα.
// ΤΟ ΜΗΚΟΣ ΜΕΤΡΙΕΤΑΙ ΟΠΩΣ ΤΟ ΓΡΑΦΕΙ Ο postgrest-js: τιμή με κόμμα ή παρένθεση
// μπαίνει σε εισαγωγικά, το κόμμα ανάμεσα στις τιμές γίνεται %2C και όλα
// κωδικοποιούνται με URLSearchParams, όπου το «(» γίνεται %28. Το
// encodeURIComponent αφήνει τις παρενθέσεις ως έχουν και μετρούσε λιγότερα:
// περιγραφές γεμάτες παρενθέσεις έβγαζαν URL 7.600 χαρακτήρων.
// Η αναζήτηση (I/O) δίνεται από τον καλούντα: εδώ μένει καθαρή λογική.

const KEY_CHUNK = 200
/** Ο προϋπολογισμός της τιμής `in.(…)`. Με τη βάση του URL μένει κάτω από 6.000. */
const KEY_CHUNK_CHARS = 5600

/** Πόσους χαρακτήρες πιάνει η τιμή στο URL, μαζί με το κόμμα που τη χωρίζει. */
function urlLength(k: string): number {
  const v = /[,()]/.test(k) ? `"${k}"` : k
  return new URLSearchParams({ x: v }).toString().length - 2 + 3
}

/** Τα αποτυπώματα προς έλεγχο σε ομάδες που χωρούν σε ένα αίτημα. */
export function dedupKeyChunks(txns: BankTxn[], maxKeys = KEY_CHUNK, maxChars = KEY_CHUNK_CHARS): string[][] {
  const keys = [...new Set(txns.flatMap(t => [t.key, legacyKeyOf(t)]))]
  const out: string[][] = []
  let cur: string[] = [], len = 0
  for (const k of keys) {
    const kl = urlLength(k)
    if (cur.length && (cur.length >= maxKeys || len + kl > maxChars)) { out.push(cur); cur = []; len = 0 }
    cur.push(k); len += kl
  }
  if (cur.length) out.push(cur)
  return out
}

/** Μία ομάδα ερωτήματος: ποια από αυτά τα αποτυπώματα υπάρχουν ήδη. */
export type DedupLookup = (keys: string[]) => PromiseLike<{ data: { dedup_hash: string }[] | null; error: unknown }>

/**
 * Ποια αποτυπώματα του αρχείου υπάρχουν ήδη. Στο πρώτο σφάλμα σταματά.
 * Και η εξαίρεση γυρίζει ως `error`: η οθόνη καλεί εδώ έξω από `try` και μια
 * απόρριψη θα άφηνε τον χρήστη χωρίς μήνυμα και χωρίς επόμενο βήμα.
 */
export async function findKnownKeys(txns: BankTxn[], lookup: DedupLookup): Promise<{ seen: Set<string>; error: unknown }> {
  const seen = new Set<string>()
  try {
    for (const chunk of dedupKeyChunks(txns)) {
      const { data, error } = await lookup(chunk)
      if (error) return { seen, error }
      for (const r of data || []) seen.add(r.dedup_hash)
    }
  } catch (e) {
    return { seen, error: e ?? new Error('Ο έλεγχος διπλών απέτυχε') }
  }
  return { seen, error: null }
}

// ── ΤΟ ΠΟΣΟ ΠΟΥ ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ ΕΡΙΧΝΕ ΤΗ ΓΡΑΜΜΗ ΣΙΩΠΗΛΑ ────────────────────
// Το `continue` της γραμμής 82 πετούσε κάθε γραμμή χωρίς αναγνωρίσιμο ποσό
// (κενό κελί, «ΥΠΟΛΟΙΠΟ», μορφή που δεν αναγνωρίζεται) χωρίς κανέναν μετρητή,
// και η μόνη ανατροφοδότηση της οθόνης ήταν το μήνυμα που βγαίνει όταν δεν
// διαβάζεται ΚΑΜΙΑ κίνηση. Σε αντίγραφο όπου διαβάστηκαν οι μισές γραμμές, ο
// χρήστης δεν μάθαινε τίποτα για τις άλλες μισές: η εισαγωγή έμοιαζε πλήρης.
// Ο μετρητής επιστρέφεται τώρα μαζί με τις κινήσεις, ώστε η οθόνη να μπορεί
// να πει πόσες γραμμές έμειναν εκτός.
export interface BankCsvRead {
  txns: BankTxn[]
  unreadable: number   // γραμμές δεδομένων που πετάχτηκαν, χωρίς ποσό
}

/** Διαβάζει CSV κειμένου: τις κινήσεις ΚΑΙ όσες γραμμές δεν διαβάστηκαν. */
export function readBankCsv(text: string): BankCsvRead {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length)
  if (lines.length < 2) return { txns: [], unreadable: 0 }
  const delim = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delim)
  const { di, desc, ai, debit, credit } = findColumns(headers)
  const out: BankTxn[] = []
  let unreadable = 0
  // Πόσες φορές έχει ξαναφανεί η ίδια ακριβώς γραμμή μέσα στο ίδιο αρχείο.
  const seenLine = new Map<string, number>()
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r], delim)
    if (!cells.length) { unreadable++; continue }
    const date = parseDate(di >= 0 ? cells[di] || '' : '')
    const description = desc >= 0 ? (cells[desc] || '') : cells.filter((_, i) => i !== di && i !== ai).join(' ').trim()
    let amount: number | null = null
    if (ai >= 0) amount = parseAmount(cells[ai] || '')
    else if (debit >= 0 || credit >= 0) {
      const d = debit >= 0 ? parseAmount(cells[debit] || '') : null
      const c = credit >= 0 ? parseAmount(cells[credit] || '') : null
      if (c != null && c !== 0) amount = Math.abs(c)
      else if (d != null && d !== 0) amount = -Math.abs(d)
    }
    if (amount == null) { unreadable++; continue }
    // Τα κενά κανονικοποιούνται: ένα κενό παραπάνω δεν κάνει νέα κίνηση.
    const line = lines[r].trim().replace(/\s+/g, ' ')
    const nth = (seenLine.get(line) || 0) + 1
    seenLine.set(line, nth)
    out.push({ date, description, amount, raw: lines[r], key: keyOfLine(date, amount, line, nth) })
  }
  return { txns: out, unreadable }
}

/** Μόνο οι κινήσεις, για όποιον δεν μετρά τις γραμμές που έμειναν εκτός. */
export function parseBankCsv(text: string): BankTxn[] {
  return readBankCsv(text).txns
}

// ── Αντιστοίχιση σε αναμενόμενα ενοίκια & έξοδα ──────────────────────────────
export interface ExpectedRent { id: string; label: string; amount: number; dueDate: string }
export interface RentMatch { rentId: string; txn: BankTxn; confidence: 'high' | 'medium' }
export interface ExpenseSuggestion { txn: BankTxn; description: string; amount: number }
export interface MatchResult {
  rentMatches: RentMatch[]           // πιστώσεις που ταιριάζουν σε αναμενόμενο ενοίκιο
  expenseSuggestions: ExpenseSuggestion[] // χρεώσεις → πιθανά έξοδα προς καταχώρηση
  unmatched: BankTxn[]
}

// ΔΕΝ ΕΙΝΑΙ «ημέρες μεταξύ»: είναι ΑΠΟΣΤΑΣΗ, χωρίς πρόσημο και γυρίζει
// `Infinity` σε άκυρη ημερομηνία ώστε η αντιστοίχιση να την απορρίψει αντί να
// τη θεωρήσει τέλεια. Με το γενικό όνομα, ο επόμενος θα την καλούσε για
// προθεσμία και θα έπαιρνε θετικό αριθμό για κάτι που έχει ήδη περάσει.
const dayGap = (a: string, b: string) => {
  const t1 = Date.parse(a + 'T00:00:00Z'), t2 = Date.parse(b + 'T00:00:00Z')
  if (isNaN(t1) || isNaN(t2)) return Infinity
  return Math.abs(t1 - t2) / 86400000
}
const money = (a: number, b: number) => Math.abs(a - b) <= 0.5

/**
 * Αντιστοιχίζει κινήσεις: πιστώσεις που ισούνται με αναμενόμενο ενοίκιο (και είναι
 * κοντά χρονικά) → RentMatch· λοιπές χρεώσεις → προτάσεις εξόδων. Κάθε αναμενόμενο
 * και κάθε κίνηση χρησιμοποιούνται το πολύ μία φορά.
 */
export function matchTransactions(txns: BankTxn[], expectedRents: ExpectedRent[], windowDays = 20): MatchResult {
  const usedTxn = new Set<number>()
  const usedRent = new Set<string>()
  const rentMatches: RentMatch[] = []
  // Πρώτα τα ενοίκια (πιστώσεις).
  for (const rent of expectedRents) {
    let best = -1; let bestDays = Infinity
    for (let i = 0; i < txns.length; i++) {
      if (usedTxn.has(i)) continue
      const t = txns[i]
      if (t.amount <= 0 || !money(t.amount, rent.amount)) continue
      const d = t.date ? dayGap(t.date, rent.dueDate) : windowDays
      if (d <= windowDays && d < bestDays) { best = i; bestDays = d }
    }
    if (best >= 0) {
      usedTxn.add(best); usedRent.add(rent.id)
      rentMatches.push({ rentId: rent.id, txn: txns[best], confidence: bestDays <= 5 ? 'high' : 'medium' })
    }
  }
  const expenseSuggestions: ExpenseSuggestion[] = []
  const unmatched: BankTxn[] = []
  for (let i = 0; i < txns.length; i++) {
    if (usedTxn.has(i)) continue
    const t = txns[i]
    if (t.amount < 0) expenseSuggestions.push({ txn: t, description: t.description || 'Τραπεζική χρέωση', amount: Math.abs(t.amount) })
    else unmatched.push(t)
  }
  return { rentMatches, expenseSuggestions, unmatched }
}
