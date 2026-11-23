#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΨΕΥΤΙΚΟΣ ΔΙΑΚΟΜΙΣΤΗΣ myDATA ΓΙΑ ΔΟΚΙΜΕΣ, ΧΩΡΙΣ ΚΛΕΙΔΙΑ ΤΗΣ ΑΑΔΕ
// ─────────────────────────────────────────────────────────────────────────
// Απαντά στη RequestDocs όπως την περιγράφει η τεκμηρίωση ERP v2.0.2 (§4.2),
// με τα δείγματα του supabase/functions/_shared/mydataFixtures/, που
// επικυρώθηκαν με το επίσημο requestedInvoicesDoc-v2.0.2.xsd.
//
// ΤΑ «ΚΛΕΙΔΙΑ» ΕΔΩ ΔΕΝ ΕΙΝΑΙ ΚΛΕΙΔΙΑ. `fake-user` / `fakeKeyOnlyForTests0000` υπάρχουν μόνο
// για να ελεγχθεί ότι οι δύο κεφαλίδες της §4.1 φεύγουν· κανένα πραγματικό
// διαπιστευτήριο δεν γράφεται ποτέ στο αποθετήριο.
//
// ΧΡΗΣΗ
//   node scripts/mydata-fake/server.mjs            (θύρα 8787)
//   MYDATA_ENV=fake MYDATA_FAKE_URL=http://127.0.0.1:8787  για τη συνάρτηση
//
// ΣΥΜΠΕΡΙΦΟΡΑ ΑΝΑ ΑΦΜ (entityVatNumber), όταν δεν δοθεί σενάριο:
//   099000013  σελίδα 1 με συνέχεια, μετά σελίδα 2· μετά τον ΜΑΡΚ 400001000000113, άδειο
//   099000025  403: ο πελάτης δεν έχει εξουσιοδοτήσει τον λογιστή στο myAADE
//   χωρίς ΑΦΜ  άδειο RequestedDoc (ο έλεγχος σύνδεσης)
//   άλλο ΑΦΜ   άδειο RequestedDoc
// Λάθος κεφαλίδες: 401.
// ═══════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const FAKE_USER = 'fake-user'
export const FAKE_KEY = 'fakeKeyOnlyForTests0000'

const FIX = new URL('../../supabase/functions/_shared/mydataFixtures/', import.meta.url)
const fixture = (name) => readFileSync(new URL(name, FIX), 'utf8')

/**
 * Ξεκινά τον διακομιστή. `plan`: ΑΦΜ → λίστα απαντήσεων που καταναλώνονται με
 * τη σειρά. Καθε απάντηση είναι αριθμός (κωδικός HTTP με κενό σώμα), όνομα
 * δείγματος («page1.xml») ή `{ status, body, headers }`.
 */
export function startFakeAade({ port = 0, plan = {} } = {}) {
  const queues = Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, [...v]]))
  const requests = []
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const q = Object.fromEntries(url.searchParams)
    requests.push({ path: url.pathname, query: q, user: req.headers['aade-user-id'] ?? null })
    const send = (status, body = '', headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/xml; charset=utf-8', ...headers })
      res.end(body)
    }
    if (url.pathname !== '/RequestDocs') return send(404)
    if (req.headers['aade-user-id'] !== FAKE_USER || req.headers['ocp-apim-subscription-key'] !== FAKE_KEY) return send(401)
    if (!q.mark) return send(400, fixture('response-error.xml'))
    const afm = q.entityVatNumber ?? ''
    const step = queues[afm]?.shift()
    if (step !== undefined) {
      if (typeof step === 'number') return send(step)
      if (typeof step === 'string') return send(200, step.endsWith('.xml') ? fixture(step) : step)
      return send(step.status, step.body ?? '', step.headers ?? {})
    }
    if (afm === '099000025') return send(403)
    if (afm === '099000013') {
      if (BigInt(q.mark) >= 400001000000113n) return send(200, fixture('empty.xml'))
      if (q.nextPartitionKey === '099000013-2026-11' && q.nextRowKey === '400001000000102') return send(200, fixture('page2.xml'))
      return send(200, fixture('page1.xml'))
    }
    return send(200, fixture('empty.xml'))
  })
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address()
      resolve({ url: `http://127.0.0.1:${p}`, requests, close: () => new Promise(r => server.close(r)) })
    })
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787)
  startFakeAade({ port }).then(({ url }) => console.log(`Ψεύτικο myDATA στο ${url} (κεφαλίδες: ${FAKE_USER} / ${FAKE_KEY})`))
}
