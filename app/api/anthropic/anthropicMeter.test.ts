// npx tsx app/api/anthropic/anthropicMeter.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΛΗΘΙΝΗ ΔΙΑΔΡΟΜΗ, ΜΕ ΨΕΥΤΙΚΗ ΒΑΣΗ ΚΑΙ ΨΕΥΤΙΚΟ ΠΑΡΟΧΟ
// ─────────────────────────────────────────────────────────────────────────
// Το anthropicRoute.test.ts διαβάζει την πηγή, γιατί η route.tsx φέρνει
// `next/headers` μέσω του lib/supabase/server και εκτός αιτήματος του Next δεν
// τρέχει. Εδώ τα τέσσερα σημεία που δένουν τη διαδρομή με τον κόσμο
// (συνεδρία, δεύτερο βήμα, πελάτης υπηρεσίας, ειδοποίηση υπολοίπου)
// αντικαθίστανται στον φορτωτή του Node και καλείται το ΠΡΑΓΜΑΤΙΚΟ `POST`. Ο
// πάροχος είναι ένα `fetch` που μετρά.
//
// ΤΙ ΚΡΙΝΕΤΑΙ (20261005150000, απόφαση CEO 05.10.2026):
//   · πάνω από το όριο: ΚΑΜΙΑ κλήση στον πάροχο·
//   · `kind: 'scan'` χωρίς αρχείο → μετρητής της Νόας, ποτέ σάρωση·
//   · πραγματικό αρχείο χωρίς `kind` → σάρωση, με το αποτύπωμα του αρχείου·
//   · κανένα όριο και κανένας χρήστης από το σώμα δεν φτάνει στη βάση·
//   · αποτυχία παρόχου → ΜΙΑ επιστροφή, με το κλειδί της χρέωσης·
//   · βάση που δεν απαντά → 503 και καμία κλήση στον πάροχο.
// ═══════════════════════════════════════════════════════════════════════════
import Module from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) pass++
  else { fail++; console.error('✗ ' + name + (detail ? `  (${detail})` : '')) }
}

// ── Ο ΦΟΡΤΩΤΗΣ: τέσσερα ονόματα, τέσσερα υποκατάστατα ─────────────────────
// Το tsx μεταγλωττίζει σε CommonJS, οπότε η αντικατάσταση γίνεται στο
// `Module._resolveFilename`, πάνω από τον δικό του επιλυτή των `@/`.
const STUBS: Record<string, string> = {
  '@/lib/supabase/server': 'exports.createClient = async () => globalThis.__meter.session();',
  '@/lib/auth/secondStep': 'exports.requireSecondStep = async () => null;',
  '@/lib/supabase/service': 'exports.createServiceClient = () => globalThis.__meter.db;',
  '@/lib/assistant/creditAlert': 'exports.alertOutOfCredit = async () => {};',
}
const STUB_DIR = mkdtempSync(join(tmpdir(), 'anthropic-meter-'))
process.on('exit', () => rmSync(STUB_DIR, { recursive: true, force: true }))
const stubPath: Record<string, string> = {}
Object.entries(STUBS).forEach(([spec, code], i) => {
  stubPath[spec] = join(STUB_DIR, `stub${i}.cjs`)
  writeFileSync(stubPath[spec], code)
})
type Resolver = (request: string, ...rest: unknown[]) => string
const M = Module as unknown as { _resolveFilename: Resolver }
const realResolve = M._resolveFilename
M._resolveFilename = function (request: string, ...rest: unknown[]) {
  return stubPath[request] ?? realResolve.call(this, request, ...rest)
}

// ── Η ΨΕΥΤΙΚΗ ΒΑΣΗ ─────────────────────────────────────────────────────────
type Call = { fn: string; args: Record<string, unknown> }
const state = {
  user: 'u-0',
  limit: Infinity,
  taken: 0,
  down: false,
  calls: [] as Call[],
  refunded: new Set<string>(),
}
const db = {
  rpc(fn: string, args: Record<string, unknown>) {
    state.calls.push({ fn, args })
    if (state.down) return Promise.resolve({ data: null, error: { message: 'down' } })
    if (fn === 'take_ai_unit' || fn === 'take_scan_unit') {
      if (state.taken >= state.limit) return Promise.resolve({ data: { allowed: false, reason: 'month', rank: 1 }, error: null })
      state.taken++
      return Promise.resolve({ data: { allowed: true, rank: 1, month: state.taken, month_limit: 30, day: state.taken, day_limit: 10 }, error: null })
    }
    if (fn === 'refund_ai_unit') {
      const id = String(args.p_request_id)
      if (state.refunded.has(id)) return Promise.resolve({ data: { refunded: false, reason: 'already' }, error: null })
      state.refunded.add(id)
      return Promise.resolve({ data: { refunded: true }, error: null })
    }
    return Promise.resolve({ data: null, error: { message: 'άγνωστη ' + fn } })
  },
}
;(globalThis as unknown as { __meter: unknown }).__meter = {
  db,
  session: () => ({ auth: { getUser: async () => ({ data: { user: { id: state.user } } }) } }),
}

// ── Ο ΨΕΥΤΙΚΟΣ ΠΑΡΟΧΟΣ ─────────────────────────────────────────────────────
let providerCalls = 0
let providerStatus = 200
globalThis.fetch = (async () => {
  providerCalls++
  return new Response(JSON.stringify(providerStatus === 200
    ? { content: [{ type: 'text', text: 'εντάξει' }] }
    : { error: { type: 'api_error', message: 'boom' } }), { status: providerStatus, headers: { 'content-type': 'application/json' } })
}) as typeof fetch
process.env.ANTHROPIC_API_KEY = 'test-only'

async function main() {
const { NextRequest } = await import('next/server')
const { SITE_HOST } = await import('@/lib/core/site')
const { POST } = await import('./route')

let seq = 0
function fresh(limit = Infinity) {
  state.user = `u-${++seq}`
  state.limit = limit
  state.taken = 0
  state.down = false
  state.calls = []
  state.refunded = new Set()
  providerCalls = 0
  providerStatus = 200
}
async function send(body: unknown) {
  const req = new NextRequest(`https://${SITE_HOST}/api/anthropic`, {
    method: 'POST',
    headers: { origin: `https://${SITE_HOST}`, host: SITE_HOST, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return POST(req)
}
const ask = (extra: Record<string, unknown> = {}) =>
  ({ messages: [{ role: 'user', content: 'Πόσο ΕΝΦΙΑ πληρώνω;' }], ...extra })
const PNG = Buffer.from('ψεύτικη εικόνα για τον έλεγχο').toString('base64')
const scanBody = (extra: Record<string, unknown> = {}) => ({
  messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } },
    { type: 'text', text: 'Διάβασε τον λογαριασμό.' },
  ] }],
  ...extra,
})
const takes = () => state.calls.filter(c => c.fn.startsWith('take_'))

// ── 1. ΠΑΝΩ ΑΠΟ ΤΟ ΟΡΙΟ: ΚΑΜΙΑ ΚΛΗΣΗ ΣΤΟΝ ΠΑΡΟΧΟ ──────────────────────────
fresh(3)
const statuses: number[] = []
for (let i = 0; i < 8; i++) statuses.push((await send(ask())).status)
ok('όριο τρία, οκτώ ερωτήσεις: ακριβώς τρεις κλήσεις στον πάροχο', providerCalls === 3, `κλήσεις ${providerCalls}`)
ok('οι πέντε πάνω από το όριο παίρνουν 429', statuses.filter(s => s === 429).length === 5, statuses.join(','))
ok('καμία επιστροφή για ερώτηση που δεν χρεώθηκε', !state.calls.some(c => c.fn === 'refund_ai_unit'))

// ── 2. `kind: 'scan'` ΧΩΡΙΣ ΑΡΧΕΙΟ ΕΙΝΑΙ ΕΡΩΤΗΣΗ ───────────────────────────
fresh()
for (let i = 0; i < 5; i++) await send(ask({ kind: 'scan' }))
ok('πέντε «σαρώσεις» χωρίς αρχείο: πέντε χρεώσεις στη Νόα', takes().length === 5 && takes().every(c => c.fn === 'take_ai_unit'),
  takes().map(c => c.fn).join(','))
ok('και καμία στον μετρητή σαρώσεων', !state.calls.some(c => c.fn === 'take_scan_unit'))

// ── 3. ΠΡΑΓΜΑΤΙΚΟ ΑΡΧΕΙΟ ΧΩΡΙΣ `kind` ΕΙΝΑΙ ΣΑΡΩΣΗ ──────────────────────────
fresh()
await send(scanBody())
await send(scanBody({ kind: 'chat' }))
const hash = createHash('sha256').update(PNG).digest('hex')
ok('αρχείο χωρίς kind: σάρωση', takes()[0]?.fn === 'take_scan_unit')
ok('αρχείο με άλλο kind: πάλι σάρωση', takes()[1]?.fn === 'take_scan_unit')
ok('η σάρωση στέλνει το αποτύπωμα του αρχείου', takes().every(c => c.args.p_file_hash === hash))
// Αρχείο που δεν είναι πραγματικό (χωρίς περιεχόμενο) δεν κάνει την ερώτηση σάρωση.
fresh()
await send({ kind: 'scan', messages: [{ role: 'user', content: [
  { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '' } }, { type: 'text', text: 'x' }] }] })
ok('άδειο «αρχείο» με kind scan: ερώτηση στη Νόα', takes()[0]?.fn === 'take_ai_unit')

// ── 4. ΤΙΠΟΤΑ ΑΠΟ ΤΟ ΣΩΜΑ ΔΕΝ ΦΤΑΝΕΙ ΣΤΗ ΒΑΣΗ ──────────────────────────────
fresh()
await send(ask({ p_month: [100000], p_day: [100000], user_id: 'κάποιος-άλλος', p_uid: 'κάποιος-άλλος', limit: 9999 }))
await send(scanBody({ p_month: [100000], p_uid: 'κάποιος-άλλος' }))
const keys = takes().map(c => Object.keys(c.args).sort().join(','))
ok('η ερώτηση στέλνει μόνο χρήστη και κλειδί', keys[0] === 'p_request_id,p_uid', keys[0])
ok('η σάρωση στέλνει μόνο χρήστη, κλειδί και αποτύπωμα', keys[1] === 'p_file_hash,p_request_id,p_uid', keys[1])
ok('ο χρήστης είναι της συνεδρίας, όχι του σώματος', takes().every(c => c.args.p_uid === state.user))
ok('κάθε αίτημα έχει δικό του κλειδί', new Set(takes().map(c => c.args.p_request_id)).size === 2)

// ── 5. ΑΠΟΤΥΧΙΑ ΠΑΡΟΧΟΥ: ΜΙΑ ΕΠΙΣΤΡΟΦΗ, ΜΕ ΤΟ ΚΛΕΙΔΙ ΤΗΣ ΧΡΕΩΣΗΣ ────────────
for (const [label, body] of [['ερώτηση', ask()], ['σάρωση', scanBody()]] as const) {
  fresh()
  providerStatus = 500
  const res = await send(body)
  const refunds = state.calls.filter(c => c.fn === 'refund_ai_unit')
  ok(`${label}: ο πάροχος απέτυχε, ο χρήστης δεν βλέπει 200`, res.status !== 200, String(res.status))
  ok(`${label}: ακριβώς μία επιστροφή`, refunds.length === 1, String(refunds.length))
  ok(`${label}: με το κλειδί της χρέωσης`, refunds[0]?.args.p_request_id === takes()[0]?.args.p_request_id)
}
fresh()
await send(ask())
ok('επιτυχία: καμία επιστροφή', !state.calls.some(c => c.fn === 'refund_ai_unit') && providerCalls === 1)

// ── 6. Η ΒΑΣΗ ΔΕΝ ΑΠΑΝΤΑ: ΚΛΕΙΣΤΑ ──────────────────────────────────────────
fresh()
state.down = true
const r1 = await send(ask()), r2 = await send(scanBody())
ok('βάση κάτω: 503 στην ερώτηση και στη σάρωση', r1.status === 503 && r2.status === 503, `${r1.status}/${r2.status}`)
ok('βάση κάτω: καμία κλήση στον πάροχο', providerCalls === 0)

console.log(fail === 0 ? `✓ anthropic meter: ${pass} έλεγχοι πέρασαν` : `✗ anthropic meter: ${fail} απέτυχαν από ${pass + fail}`)
process.exit(fail ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
