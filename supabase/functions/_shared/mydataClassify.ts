// ═══════════════════════════════════════════════════════════════════════════
// myDATA: ΑΥΤΟΜΑΤΑ, ΓΙΑ ΕΛΕΓΧΟ Ή ΑΠΟΡΡΙΨΗ (PR-Α2)
// ─────────────────────────────────────────────────────────────────────────
// Ντετερμινιστικό, πρώτα το πιο συντηρητικό (σχέδιο ιδιοκτήτη 23/11/2026,
// «ΑΥΣΤΗΡΟΠΟΙΗΣΗ», «ΟΡΙΟ ΕΛΕΓΧΟΥ», «ΔΙΟΡΘΩΣΗ 12:00»):
//
//   1. ΑΠΟΡΡΙΨΗ ΧΩΡΙΣ ΑΠΟΘΗΚΕΥΣΗ: εκδότης της λίστας «δεν αφορά ακίνητα». Ο
//      κινητήρας δεν το στέλνει καν στη βάση· μετρά μόνο το πλήθος. Ο ΜΑΡΚ
//      προχωρά ούτως ή άλλως (ο δρομέας μετρά όλα όσα ήρθαν).
//   2. ΑΥΤΟΜΑΤΑ: ΜΟΝΟ εκδότης του μητρώου παρόχων (lib/mydata/providers.ts) που
//      έχει ελέγξει άνθρωπος (`checkedAt` ≠ null) και που ο χρήστης έχει ήδη
//      καταχωρήσει τουλάχιστον μία φορά, με τύπο από τους συνηθισμένους
//      λογαριασμούς, ποσά που κλείνουν όπως τα δίνει η ΑΑΔΕ, όχι πιστωτικό, με
//      καθαρή αξία (προ ΦΠΑ) ως το όριο και ως 2× τον μέσο όρο του ίδιου
//      παρόχου. Χωρίς ΚΑΔ (RgWsPublic2) κανένας άλλος δεν γίνεται αυτόματος.
//      Η βάση ξαναελέγχει το ιστορικό ανά ΑΦΜ ΚΑΙ ακίνητο (mydata_ingest).
//      ΘΩΡΑΚΙΣΗ 24/11/2026: σήμερα κανένας πάροχος δεν έχει `checkedAt`, άρα
//      στην πράξη όλα πάνε για έλεγχο ώσπου να τους επιβεβαιώσει άνθρωπος.
//   3. ΓΙΑ ΕΛΕΓΧΟ: όλα τα άλλα, με την κατηγορία προσυμπληρωμένη όπου είναι
//      γνωστή και τους λόγους ως κωδικούς, ώστε η οθόνη να πει ΜΙΑ πρόταση.
//
// Η ΒΑΣΗ ΚΡΙΝΕΙ ΕΝΑ ΑΚΟΜΗ: το ακίνητο. Αυτόματη καταχώρηση μόνο όταν ο πελάτης
// έχει ένα ακίνητο (mydata_ingest)· με περισσότερα το ίδιο παραστατικό πάει για
// έλεγχο με λόγο `pick_property`, γιατί η ίδια ΔΕΗ μπορεί να είναι δύο σπίτια.
//
// Χωρίς δίκτυο, χωρίς βάση, χωρίς ρολόι: τρέχει ίδια σε Deno και σε Node.
// ═══════════════════════════════════════════════════════════════════════════
import { providerByAfm, cleanAfm, KIND_CATEGORY, NOT_PROPERTY, type ProviderKind, type Provider } from '../../../lib/mydata/providers.ts'
import { BANK_PAYMENT_LIMIT_CENTS, UNUSUAL_FACTOR } from '../../../lib/mydata/limits.ts'

export type Tier = 'auto' | 'review' | 'reject'

/** Οι λόγοι ελέγχου, με τη σειρά που τους λέει η οθόνη (ο πρώτος μετρά). */
export const REASONS = ['over_limit', 'credit', 'amounts', 'unusual_amount', 'doc_type', 'new_provider', 'provider_unchecked', 'unknown_provider'] as const
export type Reason = typeof REASONS[number]

/**
 * Οι τύποι ενός συνηθισμένου λογαριασμού παρόχου (Παράρτημα 8.1): Τιμολόγιο
 * Πώλησης, Τιμολόγιο Παροχής Υπηρεσιών, Απόδειξη Λιανικής, Απόδειξη Παροχής
 * Υπηρεσιών, Απλοποιημένο Τιμολόγιο. Ενδοκοινοτικά, τρίτων χωρών, για λογαριασμό
 * τρίτων, συμπληρωματικά, συμβόλαια και αποδείξεις ενοικίου θέλουν μάτι.
 */
export const AUTO_TYPES: ReadonlySet<string> = new Set(['1.1', '2.1', '11.1', '11.2', '11.3'])

export interface ClassifyDoc {
  counterpartAfm: string
  docType: string
  netCents: number
  vatCents: number
  grossCents: number
  credit: boolean
  /** Τα σύνολα της ΑΑΔΕ κλείνουν μεταξύ τους (mydata.ts, `amountsClose`). */
  amountsClose: boolean
}

/** Τα επιβεβαιωμένα παραστατικά του ίδιου παρόχου για τον ίδιο πελάτη (όχι πιστωτικά). */
export interface ProviderHistory {
  n: number
  avgCents: number
  /** Η κατηγορία (slug) της τελευταίας επιβεβαίωσης. */
  category?: string | null
}

export interface Verdict {
  tier: Tier
  kind: ProviderKind | null
  /** slug της ταξινομίας, ή null όταν δεν είναι γνωστή. */
  category: string | null
  reasons: Reason[]
}

export interface ClassifyRules {
  /** ΑΦΜ που δεν αφορούν ακίνητα. Προεπιλογή: η λίστα του αποθετηρίου. */
  notProperty?: ReadonlySet<string>
  /** Το μητρώο παρόχων. Προεπιλογή: lib/mydata/providers.ts (οι δοκιμές δίνουν αντίγραφο). */
  registry?: (afm: string) => Provider | null
}

const DEFAULT_NOT_PROPERTY: ReadonlySet<string> = new Set(NOT_PROPERTY.map(n => n.afm))
const SLUG = /^[a-z_]{1,32}$/

export function classifyDoc(d: ClassifyDoc, history?: ProviderHistory | null, rules: ClassifyRules = {}): Verdict {
  const afm = cleanAfm(d.counterpartAfm)
  if ((rules.notProperty ?? DEFAULT_NOT_PROPERTY).has(afm)) return { tier: 'reject', kind: null, category: null, reasons: [] }

  const provider = (rules.registry ?? providerByAfm)(afm)
  const kind = provider?.kind ?? null
  const learned = history?.category && SLUG.test(history.category) ? history.category : null
  const category = kind ? KIND_CATEGORY[kind].slug : learned
  const seen = !!history && history.n > 0

  const why = new Set<Reason>()
  // Το όριο μετριέται στην ΚΑΘΑΡΗ αξία (προ ΦΠΑ)· το πιστωτικό δεν πληρώνεται,
  // άρα δεν ρωτά πώς πληρώθηκε (λογιστικός έλεγχος 24/11/2026, Σ4 και Μ1).
  if (!d.credit && d.netCents > BANK_PAYMENT_LIMIT_CENTS) why.add('over_limit')
  if (d.credit) why.add('credit')
  if (!d.amountsClose) why.add('amounts')
  if (seen && history!.avgCents > 0 && d.grossCents > UNUSUAL_FACTOR * history!.avgCents) why.add('unusual_amount')
  if (!AUTO_TYPES.has(d.docType)) why.add('doc_type')
  if (!seen) why.add('new_provider')
  if (!provider) why.add('unknown_provider')
  else if (provider.checkedAt === null) why.add('provider_unchecked')

  const reasons = REASONS.filter(r => why.has(r))
  return { tier: reasons.length ? 'review' : 'auto', kind, category, reasons }
}
