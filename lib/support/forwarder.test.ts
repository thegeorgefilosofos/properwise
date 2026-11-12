// npx tsx lib/support/forwarder.test.ts
//
// Η κοινή ρουτίνα της προώθησης: ίδιο σώμα και κλειδί γενιάς σε κάθε προσπάθεια,
// σωστό αποτέλεσμα στη βάση και καμία σιωπηλή απώλεια. Μαζί το cron και η
// κρίση του health-check.
import { readFileSync } from 'node:fs'
import { forwardOne, forwardAll, type ClaimedRow, type ForwardDeps } from './forwarder'
import { supportVerdict } from '../../supabase/functions/_shared/outboxHealth'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error(`✗ ${name}`) } }

const row: ClaimedRow = { id: 'r1', provider_id: 'em_1', reply_to: 'Π <p@x.test>', forward_subject: '[Πιθανή …] Θ', plan_rank: 4, forward_gen: 2 }
type Call = { id: string; outcome: string; code: string; uncertain: boolean }
const make = (status: number | 'throw', opts: { body?: boolean; settleState?: string | null; settleError?: boolean } = {}) => {
  const calls: Call[] = []
  const reqs: { key: string; body: Record<string, unknown> }[] = []
  const deps: ForwardDeps = {
    to: 'inbox@example.test', apiKey: 'k', ownDomains: ['properwise.gr'],
    fetchBody: async () => opts.body === false ? { ok: false, reason: 'όχι' } : { ok: true, body: { text: 'κείμενο', html: null } },
    settle: async (id, outcome, code, uncertain) => {
      calls.push({ id, outcome, code, uncertain })
      return { state: opts.settleState === undefined ? (outcome === 'sent' ? 'sent' : 'pending') : opts.settleState, error: opts.settleError ? new Error('x') : null }
    },
    fetcher: (async (_u: string, init: RequestInit) => {
      reqs.push({ key: (init.headers as Record<string, string>)['Idempotency-Key'], body: JSON.parse(String(init.body)) })
      if (status === 'throw') throw new Error('δίκτυο')
      return new Response('{}', { status })
    }) as unknown as typeof fetch,
  }
  return { deps, calls, reqs }
}

;(async () => {
  const a = make(200)
  await forwardOne(row, a.deps)
  ok('Χ3: κλειδί με τη γενιά της γραμμής', a.reqs[0]?.key === 'support-forward/em_1/2')
  ok('Χ3: ακριβώς το αποθηκευμένο reply_to και θέμα', a.reqs[0]?.body.reply_to === row.reply_to && a.reqs[0]?.body.subject === row.forward_subject)
  ok('επιτυχία: settle sent', a.calls[0]?.outcome === 'sent')

  const b = make(503); await forwardOne(row, b.deps)
  ok('5xx: settle retry, αβέβαιο', b.calls[0]?.outcome === 'retry' && b.calls[0]?.uncertain === true)
  const c = make(401); await forwardOne(row, c.deps)
  ok('401: settle config', c.calls[0]?.outcome === 'config' && c.calls[0]?.code === 'config:401')
  const d = make(400); await forwardOne(row, d.deps)
  ok('400: settle message, σίγουρο', d.calls[0]?.outcome === 'message' && d.calls[0]?.uncertain === false)
  const e = make(200, { body: false }); await forwardOne(row, e.deps)
  ok('σώμα που δεν ήρθε: τίποτα δεν στάλθηκε, retry, όχι αβέβαιο', e.reqs.length === 0 && e.calls[0]?.outcome === 'retry' && e.calls[0]?.uncertain === false)
  const f = make('throw'); await forwardOne(row, f.deps)
  ok('δίκτυο: retry, αβέβαιο', f.calls[0]?.outcome === 'retry' && f.calls[0]?.uncertain === true)

  // Χ2: σφάλμα στη σημείωση του αποτελέσματος δεν χάνεται.
  let threw = false
  try { await forwardOne(row, make(200, { settleError: true }).deps) } catch { threw = true }
  ok('Χ2: αποτυχία settle πετιέται (ο καλών απαντά 5xx)', threw)
  threw = false
  try { await forwardOne(row, make(200, { settleState: null }).deps) } catch { threw = true }
  ok('Χ2: γραμμή που χάθηκε πετιέται', threw)

  const t = await forwardAll([row, { ...row, id: 'r2' }], make(400, { settleState: 'failed' }).deps)
  ok('απολογισμός: οριστικές αποτυχίες με κωδικό', t.failed === 2 && t.codes.join() === 'message:400,message:400')

  // ── Το cron ────────────────────────────────────────────────────────────────
  const cron = readFileSync('app/api/support/forward/route.ts', 'utf8')
  ok('Χ2: το cron ζητά το μυστικό των εργασιών', cron.includes('if (!cronSecretOk(request.headers, process.env[CRON_SECRET_ENV]))'))
  ok('Χ2: πρώτα λήγουν τα παλιά, με ειδοποίηση', cron.indexOf("rpc('support_forward_expire')") < cron.indexOf("rpc('support_forward_claim'")
    && cron.includes("'support forward expired'"))
  ok('Χ2: σφάλματα του cron δίνουν 5xx', (cron.match(/status: 500 \}\);/g) ?? []).length >= 4)
  ok('Χ1: οριστική αποτυχία ειδοποιεί με κωδικό', cron.includes("if (tally.failed) void reportRoute(ROUTE, 'support forward failed'"))
  const mig = readFileSync('supabase/migrations/20261110134000_proteraiotita_kai_seira_diathesis.sql', 'utf8')
  ok('Χ2: pg_cron κάθε 10 λεπτά προς τη διαδρομή', mig.includes("cron.schedule('support-forward', '*/10 * * * *'") && mig.includes("'/api/support/forward'"))

  // ── Το health-check ───────────────────────────────────────────────────────
  ok('health: εντάξει χωρίς εκκρεμότητες', supportVerdict({ stale_pending: 0, failed_24h: 0 }, null).ok)
  ok('health: μήνυμα που περιμένει πάνω από 1 ώρα', !supportVerdict({ stale_pending: 2, failed_24h: 0 }, null).ok && supportVerdict({ stale_pending: 2, failed_24h: 0 }, null).stalePending === 2)
  ok('health: σφάλμα ανάγνωσης δεν είναι εντάξει', !supportVerdict(null, { message: 'x' }).ok)
  const hc = readFileSync('supabase/functions/health-check/index.ts', 'utf8')
  ok('health: το health-check αναφέρει την υποστήριξη', hc.includes("rpc('support_inbox_health')") && hc.includes('support_ok: support.ok') && hc.includes('support_stale_pending'))

  console.log(`support/forwarder: ${pass} ✓ · ${fail} ✗`)
  if (fail) process.exit(1)
})()
