// ═══════════════════════════════════════════════════════════════════════════
// Ο ΚΙΝΗΤΗΡΑΣ ΤΟΥ ΣΥΓΧΡΟΝΙΣΜΟΥ myDATA: ΜΙΑ ΟΥΡΑ ΑΝΑ ΠΕΛΑΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Η συνάρτηση `mydata-sync` δίνει τρία πράγματα: πρόσβαση στη βάση (`Store`),
// `fetch` και ρολόι. Ολη η σειρά των βημάτων ζει εδώ και δοκιμάζεται με ψεύτικη
// βάση και τον ψεύτικο διακομιστή ΑΑΔΕ (scripts/mydata-fake/server.mjs), χωρίς
// Deno και χωρίς δίκτυο προς τα έξω.
//
// ΚΑΝΟΝΕΣ ΠΟΥ ΚΡΑΤΑ (σχέδιο ιδιοκτήτη 23/11/2026, «Πίνακας περιπτώσεων»):
//   · ΕΝΑΣ ΣΥΓΧΡΟΝΙΣΜΟΣ ΑΝΑ ΛΟΓΙΣΤΗ: η βάση δίνει μίσθωση (`begin`) και κάθε
//     εγγραφή την επαληθεύει. Δεύτερο τρέξιμο παίρνει «busy» και φεύγει.
//   · Η ΣΥΝΑΙΝΕΣΗ ΕΛΕΓΧΕΤΑΙ ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΚΛΗΣΗ ΣΤΗΝ ΑΑΔΕ, όχι μία φορά στην
//     αρχή: πελάτης που πάτησε «Ανάκληση» στη μέση του τρεξίματος δεν
//     ξαναζητείται ούτε μία σελίδα.
//   · ΑΠΟΤΥΧΙΑ ΕΝΟΣ ΠΕΛΑΤΗ ΔΕΝ ΡΙΧΝΕΙ ΤΟΥΣ ΑΛΛΟΥΣ. Μόνο το 401 (κλειδί που δεν
//     ισχύει) σταματά τα πάντα, γιατί αφορά τον λογιστή και όχι τον πελάτη.
//   · ΣΤΑΔΙΑΚΑ: μόνο ΜΑΡΚ μετά τον τελευταίο. Ο ΜΑΡΚ προχωρά μόνο όταν
//     τελειώσουν ΟΛΕΣ οι σελίδες· ως τότε κρατιέται το σημείο συνέχισης
//     (nextPartitionKey/nextRowKey), ώστε ένα κόψιμο να συνεχίζει από εκεί.
//   · ΟΡΙΟ ΧΡΟΝΟΥ: οι συναρτήσεις άκρου κόβονται. Ο κινητήρας σταματά πριν από
//     το όριο και όσοι πελάτες δεν πρόλαβαν παίρνουν νέα προσπάθεια σε ένα
//     λεπτό (`defer`), όχι την επόμενη νύχτα.
//   · ΤΙΠΟΤΑ ΔΕΝ ΧΑΝΕΤΑΙ ΣΙΩΠΗΛΑ: παραστατικό που η ανάγνωση δεν δέχτηκε μπαίνει
//     σε καραντίνα, ο ΜΑΡΚ σταματά ΠΡΙΝ από αυτό (ή δεν προχωρά καθόλου, όταν
//     ούτε ο ΜΑΡΚ του διαβάζεται), ο πελάτης φαίνεται «Θέλει έλεγχο» και
//     φεύγει ειδοποίηση σε εμάς μόνο με κωδικό.
//   · ΙΔΙΟ ΕΡΩΤΗΜΑ ΣΕ ΟΛΗ ΤΗ ΣΕΛΙΔΟΠΟΙΗΣΗ: το `dateTo` παγώνει μέσα στο σημείο
//     συνέχισης, ώστε μια συνέχιση την άλλη μέρα να στέλνει το token με το
//     ερώτημα που το γέννησε.
// ═══════════════════════════════════════════════════════════════════════════
import {
  parseRequestedDoc, toInboxDoc, classifyHttp, retryDelayMs, requestDocsUrl, aadeHeaders,
  athensIso, maxMark, safeErrorCode, type ContinuationToken, type ErrorCode, type ParseError, type InvalidDoc,
} from './mydata.ts'
import { classifyDoc, type ClassifyRules, type ProviderHistory, type Reason } from './mydataClassify.ts'
import { KIND_CATEGORY, providerByAfm } from '../../../lib/mydata/providers.ts'

export type SyncKind = 'manual' | 'auto' | 'nightly' | 'retry'

export interface Target {
  consentId: string
  afm: string
  windowFrom: string
  lastMark: string
  resume: Resume | null
}

/**
 * Το σημείο συνέχισης. `dateTo` παγώνει το ερώτημα· `capMark` είναι ο
 * μεγαλύτερος ΜΑΡΚ που επιτρέπεται να γραφτεί ως «τελευταίος» (κάτω από το
 * πρώτο παραστατικό σε καραντίνα) και `block` σημαίνει ότι ο ΜΑΡΚ δεν προχωρά
 * καθόλου (άκυρο χωρίς αναγνώσιμο ΜΑΡΚ).
 */
export interface Resume {
  partitionKey: string
  rowKey: string
  fromMark: string
  maxMark: string
  dateTo?: string
  capMark?: string | null
  block?: boolean
}

export interface IngestDoc {
  mark: string
  counterpart_afm: string
  counterpart_name: string | null
  doc_type: string
  series: string
  aa: string
  issue_date: string
  title: string
  net_cents: number
  vat_cents: number
  gross_cents: number
  is_credit: boolean
  cancelled: boolean
  cancellation_mark: string | null
  /** Θωράκιση: ο ΜΑΡΚ του αρχικού παραστατικού για συσχετιζόμενο πιστωτικό. */
  correlated_mark: string | null
  /**
   * Α2. `auto`: η βάση το καταχωρεί χωρίς πάτημα, αν ο πελάτης έχει ΕΝΑ ακίνητο
   * (αλλιώς το κρατά για έλεγχο με `pick_property`). `review`: περιμένει τον
   * χρήστη με την κατηγορία προσυμπληρωμένη. Οι απορρίψεις δεν φτάνουν εδώ.
   */
  tier: 'auto' | 'review'
  /** slug της ταξινομίας, ή null. */
  category: string | null
  /** Η ετικέτα και η ομάδα της κατηγορίας, μόνο για το `auto` (η δαπάνη γράφεται στη βάση). */
  category_label: string | null
  expense_group: string | null
  /** Το όνομα του παρόχου από το μητρώο, για το «Πάροχος» της δαπάνης. */
  vendor: string | null
  reasons: Reason[]
}

export interface IngestInput {
  lease: string
  consentId: string
  docs: IngestDoc[]
  cancels: { invoice_mark: string; cancellation_mark: string }[]
  quarantine: InvalidDoc[]
  /** Α2: πόσα δεν αφορούν ακίνητα. Μόνο το πλήθος· τίποτα άλλο δεν αποθηκεύεται. */
  rejected: number
  /** Πόσα ήρθαν από την ΑΑΔΕ σε αυτή τη σελίδα (για το αρχείο πρόσβασης). */
  fetched: number
  /** null: ο ΜΑΡΚ δεν προχωρά. */
  maxMark: string | null
  resume: Target['resume']
  done: boolean
}

/** Η βάση, όπως τη χρειάζεται ο κινητήρας. Κάθε μέθοδος ελέγχει μόνη της ό,τι γράφει. */
export interface Store {
  begin(accountantId: string, kind: SyncKind, actor: string | null): Promise<{ ok: true; lease: string } | { ok: false; reason: string; retryAt?: string | null }>
  credentials(accountantId: string): Promise<{ aadeUserId: string; key: string } | null>
  targets(accountantId: string, lease: string, kind: SyncKind): Promise<Target[]>
  consentLive(consentId: string, lease: string): Promise<boolean>
  ingest(input: IngestInput): Promise<{ ok: boolean; added: number }>
  /** Η βάση γράφει κατάσταση και, για παροδικό σφάλμα, πότε ξαναδοκιμάζεται (ίδιος κανόνας με το `nextRetryAt`). */
  clientDone(lease: string, consentId: string, error: ErrorCode | null, added: number, more: boolean): Promise<void>
  end(accountantId: string, lease: string, error: ErrorCode | null, added: number): Promise<void>
  /** Νέα προσπάθεια σε ένα λεπτό για όσους δεν πρόλαβαν (null: όλοι του λογιστή). */
  defer(accountantId: string, consentIds: string[] | null): Promise<void>
  /**
   * Α2: τα επιβεβαιωμένα παραστατικά του πελάτη ανά ΑΦΜ εκδότη (πλήθος, μέσος
   * όρος, τελευταία κατηγορία). Χωρίς αυτό κανείς δεν είναι «γνωστός» και όλα
   * πάνε για έλεγχο: η έλλειψη δεν χαλαρώνει τίποτα.
   */
  providerStats?(lease: string, consentId: string): Promise<Record<string, ProviderHistory>>
}

export interface EngineDeps {
  store: Store
  fetch: (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; text(): Promise<string>; headers: { get(n: string): string | null } }>
  base: string
  now: () => Date
  sleep: (ms: number) => Promise<void>
  /** Πότε πρέπει να έχει σταματήσει το τρέξιμο (χιλιοστά epoch). */
  deadline: number
  /** Σφάλμα σχήματος: η ΑΑΔΕ άλλαξε κάτι. Ποτέ με σώμα απάντησης ή ΑΦΜ. */
  alert?: (code: ParseError | 'invalid_invoice', aadeCodes: string[]) => void
  rand?: () => number
  /** Για δοκιμές: λίστα «δεν αφορά ακίνητα» άλλη από του αποθετηρίου. */
  classifyRules?: ClassifyRules
}

/** Πόσες προσπάθειες για 429 / 5xx / κενό σώμα / δίκτυο. */
export const ATTEMPTS = 3
/** Ελάχιστη απόσταση ανάμεσα σε δύο αιτήματα του ίδιου λογιστή προς την ΑΑΔΕ. */
export const GAP_MS = 300
/** Πόσες σελίδες ανά πελάτη σε ένα τρέξιμο· οι υπόλοιπες συνεχίζουν στο επόμενο. */
export const MAX_PAGES = 30
/** Πόσο χρόνο αφήνουμε πριν το όριο για να γραφτεί η κατάσταση. */
export const RESERVE_MS = 8000
const REQUEST_TIMEOUT_MS = 25_000

/** Ο κώδικας του σφάλματος ανάγνωσης που αξίζει ειδοποίηση σε εμάς. */
export const ALERT_ON: ReadonlySet<ParseError> = new Set(['unexpected_root', 'unknown_element', 'invalid_token', 'doctype'])

/** Τα παροδικά σφάλματα: ο πελάτης ξαναδοκιμάζεται μόνος του με αυξανόμενη αναμονή. */
export const TRANSIENT: ReadonlySet<ErrorCode> = new Set(['rate', 'server', 'empty', 'network', 'timeout', 'unknown'])

/**
 * Πότε ξαναδοκιμάζεται ένας πελάτης μετά από αποτυχίες στη σειρά: 15 λεπτά,
 * 30, 60, 120… ως 6 ώρες. Ο νυχτερινός συγχρονισμός τον ξαναπιάνει ούτως ή άλλως.
 */
export function nextRetryAt(failures: number, now: Date): string {
  const min = Math.min(15 * 2 ** Math.max(0, failures - 1), 360)
  return new Date(now.getTime() + min * 60_000).toISOString()
}

export interface RunResult {
  ok: boolean
  reason?: string
  retryAt?: string | null
  clients: number
  added: number
  failed: number
  partial: boolean
}

type Fetched = { kind: 'ok'; body: string } | { kind: 'fail'; code: ErrorCode; fatal: boolean }

async function fetchPage(d: EngineDeps, url: string, headers: Record<string, string>): Promise<Fetched> {
  let last: Fetched = { kind: 'fail', code: 'network', fatal: false }
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let retryAfter: string | null = null
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null
      const timer = ctrl ? setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS) : null
      let res
      try { res = await d.fetch(url, { headers, signal: ctrl?.signal }) } finally { if (timer) clearTimeout(timer) }
      const body = await res.text()
      const v = classifyHttp(res.status, body)
      if (v.code === 'ok') return { kind: 'ok', body }
      last = { kind: 'fail', code: v.code, fatal: v.fatal }
      if (!v.retry) return last
      retryAfter = res.headers.get('retry-after')
    } catch (e) {
      last = { kind: 'fail', code: (e as { name?: string })?.name === 'AbortError' ? 'timeout' : 'network', fatal: false }
    }
    const wait = retryDelayMs(attempt, retryAfter, d.rand ? d.rand() : Math.random())
    if (attempt === ATTEMPTS - 1 || Date.now() + wait > d.deadline - RESERVE_MS) break
    await d.sleep(wait)
  }
  return last
}

/**
 * Ενα τρέξιμο για έναν λογιστή. Επιστρέφει πάντα αποτέλεσμα· δεν πετά.
 * Κανένα μήνυμα εδώ δεν περιέχει κλειδί, ΑΦΜ ή σώμα απάντησης.
 */
export async function runAccountant(d: EngineDeps, accountantId: string, kind: SyncKind, actor: string | null = null): Promise<RunResult> {
  const out: RunResult = { ok: false, clients: 0, added: 0, failed: 0, partial: false }
  const begun = await d.store.begin(accountantId, kind, actor)
  if (!begun.ok) return { ...out, reason: begun.reason, retryAt: begun.retryAt ?? null }
  const lease = begun.lease
  let connError: ErrorCode | null = null
  try {
    const creds = await d.store.credentials(accountantId)
    if (!creds) { connError = 'no_key'; return { ...out, reason: 'no_key' } }
    const headers = aadeHeaders(creds.aadeUserId, creds.key)
    const targets = await d.store.targets(accountantId, lease, kind)
    let lastRequest = 0

    for (let ti = 0; ti < targets.length; ti++) {
      const t = targets[ti]
      if (Date.now() > d.deadline - RESERVE_MS) {
        out.partial = true
        await d.store.defer(accountantId, targets.slice(ti).map(x => x.consentId))
        break
      }
      out.clients++
      let added = 0
      let error: ErrorCode | null = null
      let more = false
      const fromMark = t.resume?.fromMark ?? t.lastMark
      let seen = t.resume?.maxMark ?? t.lastMark
      // Το ερώτημα παγώνει για όλη τη σελιδοποίηση, ακόμη και μετά από διακοπή.
      const dateTo = t.resume?.dateTo ?? athensIso(d.now())
      let capMark: string | null = t.resume?.capMark ?? null
      let block = t.resume?.block === true
      let quarantined = false
      let next: ContinuationToken | null = t.resume ? { partitionKey: t.resume.partitionKey, rowKey: t.resume.rowKey } : null
      try {
        // Α2: το ιστορικό μία φορά ανά πελάτη. Μέσα στο ίδιο τρέξιμο ένας νέος
        // πάροχος μένει νέος για όλα του τα παραστατικά (πιο αυστηρό, όχι πιο χαλαρό).
        const history = d.store.providerStats ? await d.store.providerStats(lease, t.consentId) : {}
        for (let page = 0; ; page++) {
          if (page >= MAX_PAGES || Date.now() > d.deadline - RESERVE_MS) { more = true; out.partial = true; break }
          // Η ΣΥΝΑΙΝΕΣΗ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΣΕΛΙΔΑ.
          if (!await d.store.consentLive(t.consentId, lease)) { error = 'not_linked'; break }
          const wait = lastRequest + GAP_MS - Date.now()
          if (wait > 0) await d.sleep(wait)
          lastRequest = Date.now()
          const url = requestDocsUrl(d.base, {
            mark: fromMark, entityVatNumber: t.afm, dateFrom: t.windowFrom, dateTo, next,
          })
          const got = await fetchPage(d, url, headers)
          if (got.kind === 'fail') {
            error = got.code
            if (got.fatal) connError = got.code
            break
          }
          const parsed = parseRequestedDoc(got.body)
          if (!parsed.ok) {
            error = parsed.error === 'aade_error' ? 'aade_error' : 'parse'
            if (ALERT_ON.has(parsed.error)) d.alert?.(parsed.error, parsed.aadeCodes ?? [])
            break
          }
          const docs: IngestDoc[] = []
          let rejected = 0
          for (const inv of parsed.invoices) {
            const m = toInboxDoc(inv, t.afm)
            if (m.kind !== 'doc') continue
            const v = classifyDoc({
              counterpartAfm: m.counterpartAfm, docType: m.docType, netCents: m.netCents, vatCents: m.vatCents,
              grossCents: m.grossCents, credit: m.credit, amountsClose: m.amountsClose,
            }, history[m.counterpartAfm] ?? null, d.classifyRules)
            // ΑΠΟΡΡΙΨΗ ΧΩΡΙΣ ΑΠΟΘΗΚΕΥΣΗ: ούτε όνομα ούτε ποσό φεύγουν προς τη βάση.
            if (v.tier === 'reject') { rejected++; continue }
            const cat = v.tier === 'auto' && v.kind ? KIND_CATEGORY[v.kind] : null
            docs.push({
              mark: m.mark, counterpart_afm: m.counterpartAfm, counterpart_name: m.counterpartName,
              doc_type: m.docType, series: m.series, aa: m.aa, issue_date: m.issueDate, title: m.title,
              net_cents: m.netCents, vat_cents: m.vatCents, gross_cents: m.grossCents,
              is_credit: m.credit, cancelled: m.cancelled, cancellation_mark: m.cancellationMark,
              correlated_mark: m.correlatedMark,
              tier: cat ? 'auto' : 'review', category: v.category,
              category_label: cat?.label ?? null, expense_group: cat?.group ?? null,
              vendor: providerByAfm(m.counterpartAfm)?.name ?? null, reasons: v.reasons,
            })
          }
          // Ο ΜΑΡΚ μετρά ΚΑΙ όσα δεν έγιναν δαπάνη: αλλιώς θα ζητιούνταν ξανά κάθε φορά.
          seen = maxMark([...parsed.invoices.map(i => i.mark), ...parsed.cancellations.map(c => c.cancellationMark)], seen)
          // ΚΑΡΑΝΤΙΝΑ: ο ΜΑΡΚ σταματά πριν από το πρώτο άκυρο, ώστε να ξαναζητηθεί.
          if (parsed.quarantine.length) {
            quarantined = true
            for (const q of parsed.quarantine) {
              if (q.mark === null) { block = true; continue }
              const below = (BigInt(q.mark) - BigInt(1)).toString()
              if (capMark === null || BigInt(below) < BigInt(capMark)) capMark = below
            }
          }
          const allowed = block ? null : (capMark !== null && BigInt(capMark) < BigInt(seen) ? capMark : seen)
          const done = parsed.next === null
          const r = await d.store.ingest({
            lease, consentId: t.consentId, docs,
            cancels: parsed.cancellations.map(c => ({ invoice_mark: c.invoiceMark, cancellation_mark: c.cancellationMark })),
            quarantine: parsed.quarantine,
            rejected,
            fetched: parsed.invoices.length + parsed.cancellations.length + parsed.quarantine.length,
            maxMark: allowed,
            resume: done ? null : {
              partitionKey: parsed.next!.partitionKey, rowKey: parsed.next!.rowKey, fromMark, maxMark: seen,
              dateTo, capMark, block,
            },
            done,
          })
          if (!r.ok) { error = 'not_linked'; break }
          added += r.added
          if (done) {
            // Τα άκυρα δεν περνούν ως «OK»: ο πελάτης θέλει έλεγχο και εμείς
            // μαθαίνουμε ότι η ΑΑΔΕ έστειλε κάτι που δεν διαβάζουμε.
            if (quarantined || block || capMark !== null) {
              error = 'quarantine'
              d.alert?.('invalid_invoice', [])
            }
            break
          }
          next = parsed.next
        }
      } catch (e) {
        // Ενας πελάτης που σκάει δεν σταματά τους άλλους. Το σφάλμα μένει κωδικός.
        error = safeErrorCode((e as Error)?.message === 'bad_afm' ? 'no_afm' : 'unknown')
      }
      if (error) out.failed++
      out.added += added
      await d.store.clientDone(lease, t.consentId, error, added, more)
      if (connError) break
    }
    out.ok = connError === null
    if (connError) out.reason = connError
    return out
  } finally {
    await d.store.end(accountantId, lease, connError, out.added)
  }
}
