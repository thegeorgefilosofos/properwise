// npx tsx supabase/functions/_shared/mydataEngine.test.ts
//
// Ο ΚΙΝΗΤΗΡΑΣ ΑΠΕΝΑΝΤΙ ΣΤΟΝ ΨΕΥΤΙΚΟ ΔΙΑΚΟΜΙΣΤΗ ΤΗΣ ΑΑΔΕ.
//
// Η βάση εδώ είναι μνήμη που κρατά τους ίδιους κανόνες με τη μετανάστευση
// (μίσθωση, συναίνεση, μοναδικός ΜΑΡΚ ανά ΑΦΜ, ΜΑΡΚ που προχωρά μόνο στο τέλος
// των σελίδων). Τους ίδιους κανόνες τους ελέγχει πάνω σε πραγματικό Postgres το
// scripts/db/mydata-probe.sql. Ο διακομιστής είναι ο scripts/mydata-fake/server.mjs.
import { startFakeAade, FAKE_USER, FAKE_KEY } from '../../../scripts/mydata-fake/server.mjs'
import { runAccountant, nextRetryAt, TRANSIENT, type Store, type Target, type SyncKind, type IngestInput } from './mydataEngine.ts'
import type { ErrorCode, InvalidDoc } from './mydata.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const A = '099000013', B = '099000025', C = '099000037'

interface Consent { id: string; afm: string; live: boolean; lastMark: string; resume: Target['resume']; status: string; error: ErrorCode | null; added: number; more: boolean }

function memoryStore(consents: Consent[], opts: { key?: string; killAfterPages?: Record<string, number> } = {}) {
  const docs = new Map<string, { afm: string; mark: string; status: string; gross: number; credit: boolean }>()
  let lease: string | null = null
  const pagesSeen: Record<string, number> = {}
  const log: string[] = []
  const quarantine: InvalidDoc[] = []
  const ingests: IngestInput[] = []
  const deferred: (string[] | null)[] = []
  const actors: (string | null)[] = []
  let ended: { error: ErrorCode | null; added: number } | null = null
  const store: Store = {
    async begin(_a: string, _k: SyncKind, actor: string | null) {
      actors.push(actor)
      if (lease) return { ok: false, reason: 'busy' }
      lease = `L${Math.random()}`
      return { ok: true, lease }
    },
    async credentials() { return opts.key === undefined ? { aadeUserId: FAKE_USER, key: FAKE_KEY } : opts.key ? { aadeUserId: FAKE_USER, key: opts.key } : null },
    async targets(_a, l) {
      if (l !== lease) return []
      return consents.filter(c => c.live).map(c => ({ consentId: c.id, afm: c.afm, windowFrom: '2025-01-01', lastMark: c.lastMark, resume: c.resume }))
    },
    async consentLive(id, l) {
      const c = consents.find(x => x.id === id)!
      const kill = opts.killAfterPages?.[id]
      if (kill !== undefined && (pagesSeen[id] ?? 0) >= kill) c.live = false
      return l === lease && c.live
    },
    async ingest(i: IngestInput) {
      const c = consents.find(x => x.id === i.consentId)!
      if (i.lease !== lease || !c.live) return { ok: false, added: 0 }
      pagesSeen[c.id] = (pagesSeen[c.id] ?? 0) + 1
      ingests.push(i)
      quarantine.push(...(i.quarantine ?? []))
      let added = 0
      for (const d of i.docs) {
        const k = `${c.afm}:${d.mark}`
        if (docs.has(k)) continue
        docs.set(k, { afm: c.afm, mark: d.mark, status: d.cancelled ? 'cancelled' : 'pending', gross: d.gross_cents, credit: d.is_credit })
        if (!d.cancelled) added++
      }
      for (const x of i.cancels) { const d = docs.get(`${c.afm}:${x.invoice_mark}`); if (d) d.status = 'cancelled' }
      // Ιδιο με τη βάση: greatest(last_mark, p_max_mark). Το null δεν προχωρά.
      if (i.done) { if (i.maxMark !== null && BigInt(i.maxMark) > BigInt(c.lastMark)) c.lastMark = i.maxMark; c.resume = null } else c.resume = i.resume
      return { ok: true, added }
    },
    async clientDone(l, id, error, added, more) {
      const c = consents.find(x => x.id === id)!
      c.status = error ? (error === 'forbidden' ? 'forbidden' : 'error') : 'ok'
      c.error = error; c.added = added; c.more = more
      log.push(`${id}:${error ?? 'ok'}`)
    },
    async end(_a, l, error, added) { if (l === lease) { lease = null; ended = { error, added } } },
    async defer(_a, ids) { deferred.push(ids) },
  }
  return { store, docs, log, quarantine, ingests, deferred, actors, get ended() { return ended }, holdLease: () => { lease = 'other' } }
}

const consent = (id: string, afm: string): Consent => ({ id, afm, live: true, lastMark: '0', resume: null, status: 'new', error: null, added: 0, more: false })

const sleeps: number[] = []
const deps = (url: string, store: Store, extra: Partial<Parameters<typeof runAccountant>[0]> = {}) => ({
  store, base: url, now: () => new Date('2026-11-23T10:00:00Z'),
  fetch: (u: string, init: { headers: Record<string, string> }) => fetch(u, { headers: init.headers }),
  sleep: async (ms: number) => { sleeps.push(ms) },
  deadline: Date.now() + 60_000, rand: () => 0,
  ...extra,
})

// tsx τρέχει τις σουίτες ως CommonJS: χωρίς await στην κορυφή.
void (async () => {
  const fake = await startFakeAade()
  try {
    // ── 1. Πλήρης πρώτος συγχρονισμός: δύο σελίδες, ακύρωση, πιστωτικό ────────
    {
      const c1 = consent('a', A)
      const m = memoryStore([c1])
      const r = await runAccountant(deps(fake.url, m.store), 'acc1', 'manual')
      ok('1: το τρέξιμο τελειώνει χωρίς σφάλμα', r.ok && r.failed === 0)
      ok('1: τρία νέα (101, 102, 110)· το ακυρωμένο 111 δεν μετρά', r.added === 3)
      ok('1: ο 102 ακυρώθηκε στη σελίδα 2', m.docs.get(`${A}:400001000000102`)?.status === 'cancelled')
      ok('1: το 111 μπήκε ως ακυρωμένο, όχι ως εκκρεμές', m.docs.get(`${A}:400001000000111`)?.status === 'cancelled')
      ok('1: πιστωτικό με θετικό ποσό και σημαία', m.docs.get(`${A}:400001000000110`)?.credit === true && m.docs.get(`${A}:400001000000110`)?.gross === 1240)
      ok('1: αυτοτιμολόγηση και τίτλος κτήσης δεν μπαίνουν', !m.docs.has(`${A}:400001000000112`) && !m.docs.has(`${A}:400001000000113`))
      ok('1: ο ΜΑΡΚ προχωρά στον μεγαλύτερο, μαζί με τον ΜΑΡΚ ακύρωσης', c1.lastMark === '400001000000191' && c1.resume === null)
      ok('1: η μίσθωση απελευθερώνεται', m.ended !== null && m.ended.error === null)
      const req = fake.requests.filter(x => x.query.entityVatNumber === A)
      ok('1: δύο αιτήματα για τον πελάτη', req.length === 2)
      ok('1: entityVatNumber = ΑΦΜ πελάτη, mark=0 στην πρώτη', req[0].query.mark === '0' && req[0].user === FAKE_USER)
      ok('1: η δεύτερη σελίδα με τον ΙΔΙΟ mark και τη συνέχεια', req[1].query.mark === '0' && req[1].query.nextPartitionKey === '099000013-2026-11')
      ok('1: dateFrom/dateTo dd/MM/yyyy', req[0].query.dateFrom === '01/01/2025' && req[0].query.dateTo === '23/11/2026')
      ok('1: κανένα κλειδί στο αποτέλεσμα', !JSON.stringify(r).includes(FAKE_KEY))
    }

    // ── 2. Δεύτερο τρέξιμο: μόνο μετά τον τελευταίο ΜΑΡΚ, κανένα διπλότυπο ───
    {
      const cA = consent('a', A)
      const m = memoryStore([cA])
      await runAccountant(deps(fake.url, m.store), 'acc1', 'manual')
      ok('2: ο ΜΑΡΚ μετά το πρώτο τρέξιμο είναι ο ΜΑΡΚ ακύρωσης 191', cA.lastMark === '400001000000191')
      const before = fake.requests.length
      const r2 = await runAccountant(deps(fake.url, m.store), 'acc1', 'nightly')
      ok('2: κανένα νέο', r2.added === 0 && r2.ok)
      ok('2: το αίτημα ζητά μετά τον τελευταίο ΜΑΡΚ', fake.requests[before].query.mark === '400001000000191')
      ok('2: τα παραστατικά μένουν τέσσερα (101, 102, 110, 111), χωρίς διπλά', m.docs.size === 4)
    }

    // ── 3. 403 για έναν πελάτη: απομονώνεται, οι άλλοι συνεχίζουν ──────────────
    {
      const cB = consent('b', B), cA = consent('a', A)
      const m = memoryStore([cB, cA])
      const r = await runAccountant(deps(fake.url, m.store), 'acc1', 'nightly')
      ok('3: ο Β σε «forbidden» (TAXISnet)', cB.status === 'forbidden' && cB.error === 'forbidden')
      ok('3: ο Α συγχρονίστηκε κανονικά', cA.status === 'ok' && cA.added === 3)
      ok('3: το τρέξιμο δεν θεωρείται αποτυχία του λογιστή', r.ok && r.failed === 1)
      ok('3: κανένα σφάλμα σύνδεσης', m.ended?.error === null)
    }

    // ── 4. 401: το κλειδί δεν ισχύει, σταματούν όλοι ────────────────────────
    {
      const cA = consent('a', A), cC = consent('c', C)
      const m = memoryStore([cA, cC], { key: 'wrong-key' })
      const r = await runAccountant(deps(fake.url, m.store), 'acc1', 'nightly')
      ok('4: αποτυχία με «auth»', !r.ok && r.reason === 'auth')
      ok('4: ο δεύτερος πελάτης δεν ζητήθηκε καν', cC.status === 'new')
      ok('4: η κατάσταση γράφεται στον λογιστή', m.ended?.error === 'auth')
    }

    // ── 5. Χωρίς κλειδί ──────────────────────────────────────────────────────
    {
      const m = memoryStore([consent('a', A)], { key: '' })
      const r = await runAccountant(deps(fake.url, m.store), 'acc1', 'manual')
      ok('5: χωρίς κλειδί δεν φεύγει αίτημα', !r.ok && r.reason === 'no_key')
    }

    // ── 6. 429 με Retry-After και μετά επιτυχία ────────────────────────────
    {
      const f = await startFakeAade({ plan: { [C]: [{ status: 429, headers: { 'retry-after': '2' } }, 'empty.xml'] } })
      sleeps.length = 0
      const cC = consent('c', C)
      const m = memoryStore([cC])
      const r = await runAccountant(deps(f.url, m.store), 'acc1', 'manual')
      ok('6: μετά το 429 πετυχαίνει', r.ok && cC.status === 'ok')
      ok('6: τηρεί το Retry-After (2 δευτ.)', sleeps.includes(2000))
      await f.close()
    }

    // ── 7. 5xx τρεις φορές: σφάλμα διακομιστή, ο άλλος πελάτης περνά ─────────
    {
      const f = await startFakeAade({ plan: { [C]: [503, 502, 500] } })
      const cC = consent('c', C), cA = consent('a', A)
      const m = memoryStore([cC, cA])
      const r = await runAccountant(deps(f.url, m.store), 'acc1', 'nightly')
      ok('7: ο C σε «server» μετά από τρεις προσπάθειες', cC.error === 'server' && f.requests.filter(x => x.query.entityVatNumber === C).length === 3)
      ok('7: ο Α δεν επηρεάζεται', cA.status === 'ok' && cA.added === 3)
      ok('7: παροδικό σφάλμα: ξαναδοκιμάζεται μόνο του', TRANSIENT.has('server') && !TRANSIENT.has('forbidden') && !TRANSIENT.has('auth'))
      ok('7: ο ΜΑΡΚ του C δεν προχώρησε', cC.lastMark === '0')
      ok('7: το τρέξιμο συνεχίζει', r.ok)
      await f.close()
    }

    // ── 8. 200 με κενό σώμα: δεν είναι «κανένα παραστατικό» ─────────────────
    {
      const f = await startFakeAade({ plan: { [C]: [{ status: 200, body: '' }, { status: 200, body: '' }, { status: 200, body: '' }] } })
      const cC = consent('c', C)
      const m = memoryStore([cC])
      await runAccountant(deps(f.url, m.store), 'acc1', 'manual')
      ok('8: κενό σώμα: «empty», ο ΜΑΡΚ μένει', cC.error === 'empty' && cC.lastMark === '0')
      await f.close()
    }

    // ── 9. Ανάκληση στη μέση: η δεύτερη σελίδα δεν ζητείται ποτέ ────────────
    {
      const cA = consent('a', A)
      const m = memoryStore([cA], { killAfterPages: { a: 1 } })
      const before = fake.requests.length
      await runAccountant(deps(fake.url, m.store), 'acc1', 'manual')
      ok('9: μόνο η πρώτη σελίδα ζητήθηκε', fake.requests.length - before === 1)
      ok('9: ο ΜΑΡΚ δεν προχώρησε (δεν τελείωσαν οι σελίδες)', cA.lastMark === '0')
      ok('9: σημειώνεται ότι η σύνδεση δεν ισχύει', cA.error === 'not_linked')
    }

    // ── 10. Όριο χρόνου μετά την πρώτη σελίδα: συνέχεια από το σημείο διακοπής ─
    {
      const cA = consent('a', A)
      const m = memoryStore([cA])
      let calls = 0
      const tight = deps(fake.url, m.store, {
        fetch: async (u: string, init: { headers: Record<string, string> }) => { calls++; return fetch(u, { headers: init.headers }) },
      })
      // Η προθεσμία λήγει μόλις τελειώσει η πρώτη σελίδα.
      const realIngest = m.store.ingest.bind(m.store)
      let first = true
      m.store.ingest = async (i) => { const r = await realIngest(i); if (first) { first = false; tight.deadline = Date.now() } return r }
      const r = await runAccountant(tight, 'acc1', 'nightly')
      ok('10: σταματά πριν το όριο, με «partial»', r.partial && calls === 1)
      ok('10: κρατά το σημείο συνέχισης', cA.resume?.partitionKey === '099000013-2026-11' && cA.resume?.fromMark === '0')
      ok('10: σημειώνει ότι υπάρχει κι άλλο', cA.more === true)
      const before = fake.requests.length
      const r2 = await runAccountant(deps(fake.url, m.store), 'acc1', 'retry')
      ok('10: το επόμενο τρέξιμο ξεκινά από τη σελίδα 2', fake.requests[before].query.nextPartitionKey === '099000013-2026-11' && fake.requests[before].query.mark === '0')
      ok('10: και ολοκληρώνει', r2.ok && cA.resume === null && cA.lastMark === '400001000000191')
    }

    // ── 11. Δεύτερο τρέξιμο ενώ τρέχει το πρώτο ────────────────────────────
    {
      const m = memoryStore([consent('a', A)])
      m.holdLease()
      const before = fake.requests.length
      const r = await runAccountant(deps(fake.url, m.store), 'acc1', 'manual')
      ok('11: «busy», κανένα αίτημα', !r.ok && r.reason === 'busy' && fake.requests.length === before)
    }

    // ── 12. Η ΑΑΔΕ άλλαξε το σχήμα: τίποτα δεν γράφεται, ειδοποίηση σε εμάς ──
    {
      const weird = '<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"><invoicesDocV3/></RequestedDoc>'
      const f = await startFakeAade({ plan: { [C]: [weird] } })
      const alerts: string[] = []
      const cC = consent('c', C)
      const m = memoryStore([cC])
      await runAccountant(deps(f.url, m.store, { alert: (code: string) => alerts.push(code) }), 'acc1', 'nightly')
      ok('12: ειδοποίηση «unknown_element»', alerts.length === 1 && alerts[0] === 'unknown_element')
      ok('12: σφάλμα «parse», τίποτα δεν γράφτηκε', cC.error === 'parse' && m.docs.size === 0)
      await f.close()
    }

    // ── 13. Η απάντηση σφάλματος της ΑΑΔΕ (ResponseDoc) ─────────────────────
    {
      const f = await startFakeAade({ plan: { [C]: ['response-error.xml'] } })
      const alerts: string[] = []
      const cC = consent('c', C)
      const m = memoryStore([cC])
      await runAccountant(deps(f.url, m.store, { alert: (code: string) => alerts.push(code) }), 'acc1', 'nightly')
      ok('13: ResponseDoc: «aade_error», όχι ειδοποίηση σχήματος', cC.error === 'aade_error' && alerts.length === 0)
      await f.close()
    }

    // ── 16. Ακυρα παραστατικά: καραντίνα, ο ΜΑΡΚ σταματά πριν από αυτά ─────
    {
      const inv = (mark: string, type: string, gross: string) => `<invoice><mark>${mark}</mark>` +
        `<issuer><vatNumber>099000049</vatNumber><country>GR</country><branch>0</branch></issuer>` +
        `<counterpart><vatNumber>${C}</vatNumber><country>GR</country><branch>0</branch></counterpart>` +
        `<invoiceHeader><series>Α</series><aa>${mark.slice(-3)}</aa><issueDate>2026-11-10</issueDate><invoiceType>${type}</invoiceType><currency>EUR</currency></invoiceHeader>` +
        `<invoiceSummary><totalNetValue>10.00</totalNetValue><totalVatAmount>2.40</totalVatAmount><totalWithheldAmount>0.00</totalWithheldAmount>` +
        `<totalFeesAmount>0.00</totalFeesAmount><totalStampDutyAmount>0.00</totalStampDutyAmount><totalOtherTaxesAmount>0.00</totalOtherTaxesAmount>` +
        `<totalDeductionsAmount>0.00</totalDeductionsAmount><totalGrossValue>${gross}</totalGrossValue></invoiceSummary></invoice>`
      const page = (body: string) => `<RequestedDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"><invoicesDoc>${body}</invoicesDoc></RequestedDoc>`
      const f = await startFakeAade({ plan: { [C]: [page(inv('100', '1.7', '12.40') + inv('101', '2.1', '-5.00') + inv('102', '2.1', '12.40'))] } })
      const alerts: string[] = []
      const cC = consent('c', C)
      const m = memoryStore([cC])
      const r = await runAccountant(deps(f.url, m.store, { alert: (code: string) => alerts.push(code) }), 'acc1', 'nightly')
      ok('16 H1: το 102 γράφεται', m.docs.has(`${C}:102`) && m.docs.size === 1)
      ok('16 H1: τα 100 και 101 μπαίνουν σε καραντίνα, δεν χάνονται', m.quarantine.map(q => q.mark).join(',') === '100,101')
      ok('16 H1: η αιτία είναι κωδικός', m.quarantine.every(q => /^[a-z_]{1,40}$/.test(q.reason)) && m.quarantine[0]?.reason === 'invoice_type')
      ok('16 H1: ο ΜΑΡΚ σταματά πριν από το πρώτο άκυρο (99), όχι στο 102', cC.lastMark === '99')
      ok('16 H1: η κατάσταση ΔΕΝ είναι OK', cC.status === 'error' && cC.error === 'quarantine' && r.failed === 1)
      ok('16 H1: ειδοποίηση σε εμάς μόνο με κωδικό', alerts.length === 1 && alerts[0] === 'invalid_invoice')
      await f.close()

      // Ακυρο χωρίς αναγνώσιμο ΜΑΡΚ: ο ΜΑΡΚ δεν προχωρά καθόλου.
      const f2 = await startFakeAade({ plan: { [C]: [page(inv('abc', '2.1', '12.40') + inv('202', '2.1', '12.40'))] } })
      const c2 = consent('c', C)
      const m2 = memoryStore([c2])
      await runAccountant(deps(f2.url, m2.store), 'acc1', 'nightly')
      ok('16 H1: άκυρο χωρίς ΜΑΡΚ: καραντίνα με null', m2.quarantine.length === 1 && m2.quarantine[0]?.mark === null)
      ok('16 H1: άκυρο χωρίς ΜΑΡΚ: ο ΜΑΡΚ μένει 0', c2.lastMark === '0' && c2.error === 'quarantine')
      await f2.close()
    }

    // ── 17. Το dateTo παγώνει μέσα στο σημείο συνέχισης ──────────────────────
    {
      const cA = consent('a', A)
      cA.resume = { partitionKey: '099000013-2026-11', rowKey: '400001000000102', fromMark: '0', maxMark: '400001000000101', dateTo: '2026-11-20' }
      const m = memoryStore([cA])
      const before = fake.requests.length
      await runAccountant(deps(fake.url, m.store), 'acc1', 'nightly')
      ok('17 H4: η συνέχεια στέλνει το dateTo του ερωτήματος που τη γέννησε', fake.requests[before].query.dateTo === '20/11/2026')
      const cB = consent('a', A)
      const m2 = memoryStore([cB])
      const tight = deps(fake.url, m2.store)
      const realIngest = m2.store.ingest.bind(m2.store)
      m2.store.ingest = async (i) => { const r = await realIngest(i); tight.deadline = Date.now(); return r }
      await runAccountant(tight, 'acc1', 'nightly')
      ok('17 H4: το σημείο συνέχισης κρατά το dateTo', cB.resume?.dateTo === '2026-11-23')
    }

    // ── 18. Οσοι δεν πρόλαβαν ξαναμπαίνουν σε ένα λεπτό ─────────────────────
    {
      const cA = consent('a', A), cC = consent('c', C), cX = consent('x', '099000049')
      const m = memoryStore([cA, cC, cX])
      const tight = deps(fake.url, m.store)
      const realDone = m.store.clientDone.bind(m.store)
      m.store.clientDone = async (...a) => { await realDone(...a); tight.deadline = Date.now() }
      const r = await runAccountant(tight, 'acc1', 'nightly')
      ok('18 M3: σταματά μετά τον πρώτο', r.partial && cA.status === 'ok' && cC.status === 'new')
      ok('18 M3: οι δύο που δεν πρόλαβαν παίρνουν νέα προσπάθεια', JSON.stringify(m.deferred) === JSON.stringify([['c', 'x']]))
    }

    // ── 19. Αρχείο πρόσβασης: ποιος ξεκίνησε, πόσα ήρθαν ανά σελίδα ─────────
    {
      const cA = consent('a', A)
      const m = memoryStore([cA])
      await runAccountant(deps(fake.url, m.store), 'acc1', 'manual', 'acc1')
      ok('19 M4: η μίσθωση ξέρει ποιος πάτησε «τώρα»', m.actors[0] === 'acc1')
      ok('19 M4: κάθε σελίδα λέει πόσα ήρθαν από την ΑΑΔΕ (2 και 5)', m.ingests.map(i => i.fetched).join(',') === '2,5')
      const m2 = memoryStore([consent('a', A)])
      await runAccountant(deps(fake.url, m2.store), 'acc1', 'nightly')
      ok('19 M4: το cron δεν έχει πρόσωπο', m2.actors[0] === null)
    }

    // ── 14. Το δίκτυο κόβεται ───────────────────────────────────────────────
    {
      const cC = consent('c', C)
      const m = memoryStore([cC])
      await runAccountant(deps('http://127.0.0.1:1', m.store), 'acc1', 'nightly')
      ok('14: «network», ο πελάτης ξαναδοκιμάζεται', cC.error === 'network' && TRANSIENT.has('network'))
    }
  } finally {
    await fake.close()
  }

  // ── 15. Πότε ξαναδοκιμάζεται ─────────────────────────────────────────────
  const t0 = new Date('2026-11-23T10:00:00Z')
  ok('15: μετά από 1 αποτυχία: 15 λεπτά', nextRetryAt(1, t0) === '2026-11-23T10:15:00.000Z')
  ok('15: μετά από 3: 60 λεπτά', nextRetryAt(3, t0) === '2026-11-23T11:00:00.000Z')
  ok('15: ταβάνι 6 ώρες', nextRetryAt(20, t0) === '2026-11-23T16:00:00.000Z')

  console.log(`mydataEngine: ${pass} ✓ · ${fail} ✗`)
  if (fail) process.exit(1)
})()
