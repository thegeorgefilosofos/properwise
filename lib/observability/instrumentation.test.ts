// npx tsx lib/observability/instrumentation.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ `onRequestError` ΤΗΣ ΡΙΖΑΣ: ΤΙ ΑΝΑΦΕΡΕΙ ΚΑΙ ΤΙ ΟΧΙ
// ─────────────────────────────────────────────────────────────────────────
// Το Next του δίνει ολόκληρο το αίτημα: διαδρομή με query string, κεφαλίδες με
// cookie και την εξαίρεση με το μήνυμά της. Από αυτά ταξιδεύουν μόνο το αρχείο
// της διαδρομής, η μέθοδος και ο τύπος της εξαίρεσης. Και μόνο για διαδρομές
// API: απόδοση σελίδας, server action και proxy μένουν έξω για τώρα.
// ═══════════════════════════════════════════════════════════════════════════
import { onRequestError } from '../../instrumentation'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

type Ctx = Parameters<typeof onRequestError>[2]
const request = {
  path: '/api/x?email=a@b.gr',
  method: 'POST',
  headers: { cookie: 'sb-access-token=μυστικό-cookie' },
}
const ctx = (routeType: Ctx['routeType']): Ctx => ({
  routerKind: 'App Router', routePath: '/api/x', routeType,
  renderSource: 'server-rendering', revalidateReason: undefined, renderType: 'dynamic',
} as Ctx)

/** Ο,τι θα έφευγε στο δίκτυο, για όσο κρατά το `fn`. */
async function captured(fn: () => Promise<void>): Promise<string[]> {
  const sent: string[] = []
  const realFetch = globalThis.fetch
  const realDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  const realLog = console.error
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc123@o1.ingest.sentry.io/456'
  globalThis.fetch = ((_: string, init: { body: string }) => {
    sent.push(String(init?.body ?? ''))
    return Promise.resolve(new Response(''))
  }) as unknown as typeof fetch
  console.error = () => {}
  try { await fn() } finally {
    globalThis.fetch = realFetch
    console.error = realLog
    if (realDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN
    else process.env.NEXT_PUBLIC_SENTRY_DSN = realDsn
  }
  return sent
}

const valueOf = (body: string) =>
  (JSON.parse(body.split('\n')[2]) as { exception: { values: { value: string }[] } }).exception.values[0].value

async function run() {
  for (const t of ['render', 'action', 'proxy'] as const) {
    const sent = await captured(() => onRequestError(new Error(`σελίδα ${t}`), request, ctx(t)) as Promise<void>)
    ok(`routeType «${t}»: τίποτα δεν φεύγει`, sent.length === 0)
  }

  const one = await captured(() =>
    onRequestError(new TypeError('foo@bar.gr μυστικό μήνυμα'), request, ctx('route')) as Promise<void>)
  ok('διαδρομή API: φεύγει ένας φάκελος', one.length === 1)
  const body = one[0] ?? ''
  ok('με το αρχείο της διαδρομής και τον τύπο της εξαίρεσης', body.includes('/api/x') && body.includes('TypeError'))
  ok('ποτέ το request.path με το query string', !body.includes('email=a@b.gr') && !body.includes('a@b.gr'))
  ok('ποτέ τιμή κεφαλίδας', !body.includes('μυστικό-cookie') && !body.includes('sb-access-token'))
  ok('ποτέ το μήνυμα της εξαίρεσης', !body.includes('foo@bar.gr') && !body.includes('μυστικό μήνυμα'))

  // Δύο διαφορετικά σφάλματα της ίδιας διαδρομής είναι δύο θέματα, με δικό
  // τους φρένο το καθένα.
  const two = await captured(async () => {
    await onRequestError(new TypeError('α'), request, ctx('route'))
    await onRequestError(new RangeError('β'), request, ctx('route'))
  })
  ok('TypeError και RangeError δίνουν δύο διαφορετικές τιμές',
    two.length === 2 && valueOf(two[0]) !== valueOf(two[1]))
}

run().then(() => {
  console.log(fail ? `✗ observability/instrumentation: ${fail} απέτυχαν από ${pass + fail}` : `✓ observability/instrumentation: ${pass} έλεγχοι πέρασαν`)
  if (fail) process.exit(1)
})
