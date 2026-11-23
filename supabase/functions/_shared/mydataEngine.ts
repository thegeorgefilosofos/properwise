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
//     το όριο και ό,τι έμεινε το παίρνει η επόμενη εκτέλεση.
// ═══════════════════════════════════════════════════════════════════════════
import {
  parseRequestedDoc, toInboxDoc, classifyHttp, retryDelayMs, requestDocsUrl, aadeHeaders,
  athensIso, maxMark, safeErrorCode, type ContinuationToken, type ErrorCode, type ParseError,
} from './mydata.ts'

export type SyncKind = 'manual' | 'auto' | 'nightly' | 'retry'

export interface Target {
  consentId: string
  afm: string
  windowFrom: string
  lastMark: string
  resume: { partitionKey: string; rowKey: string; fromMark: string; maxMark: string } | null
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
}

export interface IngestInput {
  lease: string
  consentId: string
  docs: IngestDoc[]
  cancels: { invoice_mark: string; cancellation_mark: string }[]
  maxMark: string
  resume: Target['resume']
  done: boolean
}

/** Η βάση, όπως τη χρειάζεται ο κινητήρας. Κάθε μέθοδος ελέγχει μόνη της ό,τι γράφει. */
export interface Store {
  begin(accountantId: string, kind: SyncKind): Promise<{ ok: true; lease: string } | { ok: false; reason: string; retryAt?: string | null }>
  credentials(accountantId: string): Promise<{ aadeUserId: string; key: string } | null>
  targets(accountantId: string, lease: string, kind: SyncKind): Promise<Target[]>
  consentLive(consentId: string, lease: string): Promise<boolean>
  ingest(input: IngestInput): Promise<{ ok: boolean; added: number }>
  /** Η βάση γράφει κατάσταση και, για παροδικό σφάλμα, πότε ξαναδοκιμάζεται (ίδιος κανόνας με το `nextRetryAt`). */
  clientDone(lease: string, consentId: string, error: ErrorCode | null, added: number, more: boolean): Promise<void>
  end(accountantId: string, lease: string, error: ErrorCode | null, added: number): Promise<void>
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
  alert?: (code: ParseError, aadeCodes: string[]) => void
  rand?: () => number
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
export async function runAccountant(d: EngineDeps, accountantId: string, kind: SyncKind): Promise<RunResult> {
  const out: RunResult = { ok: false, clients: 0, added: 0, failed: 0, partial: false }
  const begun = await d.store.begin(accountantId, kind)
  if (!begun.ok) return { ...out, reason: begun.reason, retryAt: begun.retryAt ?? null }
  const lease = begun.lease
  let connError: ErrorCode | null = null
  try {
    const creds = await d.store.credentials(accountantId)
    if (!creds) { connError = 'no_key'; return { ...out, reason: 'no_key' } }
    const headers = aadeHeaders(creds.aadeUserId, creds.key)
    const targets = await d.store.targets(accountantId, lease, kind)
    let lastRequest = 0

    for (const t of targets) {
      if (Date.now() > d.deadline - RESERVE_MS) { out.partial = true; break }
      out.clients++
      let added = 0
      let error: ErrorCode | null = null
      let more = false
      const fromMark = t.resume?.fromMark ?? t.lastMark
      let seen = t.resume?.maxMark ?? t.lastMark
      let next: ContinuationToken | null = t.resume ? { partitionKey: t.resume.partitionKey, rowKey: t.resume.rowKey } : null
      try {
        for (let page = 0; ; page++) {
          if (page >= MAX_PAGES || Date.now() > d.deadline - RESERVE_MS) { more = true; out.partial = true; break }
          // Η ΣΥΝΑΙΝΕΣΗ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΣΕΛΙΔΑ.
          if (!await d.store.consentLive(t.consentId, lease)) { error = 'not_linked'; break }
          const wait = lastRequest + GAP_MS - Date.now()
          if (wait > 0) await d.sleep(wait)
          lastRequest = Date.now()
          const url = requestDocsUrl(d.base, {
            mark: fromMark, entityVatNumber: t.afm, dateFrom: t.windowFrom, dateTo: athensIso(d.now()), next,
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
          for (const inv of parsed.invoices) {
            const m = toInboxDoc(inv, t.afm)
            if (m.kind !== 'doc') continue
            docs.push({
              mark: m.mark, counterpart_afm: m.counterpartAfm, counterpart_name: m.counterpartName,
              doc_type: m.docType, series: m.series, aa: m.aa, issue_date: m.issueDate, title: m.title,
              net_cents: m.netCents, vat_cents: m.vatCents, gross_cents: m.grossCents,
              is_credit: m.credit, cancelled: m.cancelled, cancellation_mark: m.cancellationMark,
            })
          }
          // Ο ΜΑΡΚ μετρά ΚΑΙ όσα δεν έγιναν δαπάνη: αλλιώς θα ζητιούνταν ξανά κάθε φορά.
          seen = maxMark([...parsed.invoices.map(i => i.mark), ...parsed.cancellations.map(c => c.cancellationMark)], seen)
          const done = parsed.next === null
          const r = await d.store.ingest({
            lease, consentId: t.consentId, docs,
            cancels: parsed.cancellations.map(c => ({ invoice_mark: c.invoiceMark, cancellation_mark: c.cancellationMark })),
            maxMark: seen,
            resume: done ? null : { partitionKey: parsed.next!.partitionKey, rowKey: parsed.next!.rowKey, fromMark, maxMark: seen },
            done,
          })
          if (!r.ok) { error = 'not_linked'; break }
          added += r.added
          if (done) break
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
