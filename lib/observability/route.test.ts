// npx tsx lib/observability/route.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΑΝΑΦΟΡΑ ΔΙΑΔΡΟΜΗΣ ΔΕΝ ΚΟΥΒΑΛΑ ΤΙΠΟΤΑ ΑΠΟ ΤΟΝ ΧΡΗΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// Η αιτία μιας αποτυχίας είναι συχνά σφάλμα της Supabase, του εμπόρου ή της
// Anthropic, με μήνυμα που μπορεί να γράφει email, ΑΦΜ ή όνομα. Ο αναφορέας
// καθαρίζει μόνο κλειδιά του `extra`, οπότε η προστασία ζει εδώ: από την αιτία
// ταξιδεύουν ο τύπος και τα πλαίσια `at …` της στοίβας, τίποτα άλλο.
//
// ΤΟ ΠΑΓΙΔΕΥΜΕΝΟ ΣΗΜΕΙΟ, ΜΕΤΡΗΜΕΝΟ: η V8 γράφει στην κορυφή της στοίβας ΟΛΕΣ
// τις γραμμές ενός πολύγραμμου μηνύματος. «Η στοίβα χωρίς την πρώτη γραμμή»
// στέλνει τη δεύτερη γραμμή του μηνύματος. Ο πρώτος έλεγχος υπάρχει γι' αυτό.
// ═══════════════════════════════════════════════════════════════════════════
import { buildRouteReport, reportRoute, causeNameOf, codeOf } from './route'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const PII = ['foo@bar.gr', '123456789', 'Γιώργος']
const clean = (v: unknown) => { const j = JSON.stringify(v); return PII.every(p => !j.includes(p)) }

// ── ΠΟΛΥΓΡΑΜΜΟ ΜΗΝΥΜΑ ΣΤΗΝ ΑΙΤΙΑ ─────────────────────────────────────────
{
  const cause = new Error('first\nfoo@bar.gr ΑΦΜ 123456789 Γιώργος')
  const r = buildRouteReport('api/x', 'write failed', { status: 502, cause })
  const out = { message: r.error.message, extra: r.extra }
  ok('καμία γραμμή του μηνύματος δεν ταξιδεύει', clean(out) && !JSON.stringify(out).includes('first'))
  const frames = String(r.extra.causeFrames).split(' | ')
  ok('κάθε πλαίσιο είναι γραμμή «at …»', frames.length > 0 && frames.every(f => f.startsWith('at ')))
  ok('ο τύπος της αιτίας ταξιδεύει', r.extra.causeName === 'Error')
  ok('η ετικέτα είναι σταθερή', r.error.message === '[api/x] write failed 502')
}

// ── ΑΙΤΙΕΣ ΠΟΥ ΔΕΝ ΣΥΜΠΕΡΙΦΕΡΟΝΤΑΙ ─────────────────────────────────────
{
  const hostile = new Error('foo@bar.gr')
  Object.defineProperty(hostile, 'stack', { get() { throw new Error('123456789') } })
  const circular: Record<string, unknown> = { email: 'foo@bar.gr' }
  circular.self = circular
  const agg = new AggregateError([new Error('Γιώργος foo@bar.gr')], 'πολλά 123456789')
  const causes: unknown[] = [hostile, 'foo@bar.gr 123456789', null, circular, agg]
  let threw = false
  const outs: unknown[] = []
  try {
    for (const cause of causes) {
      const r = buildRouteReport('api/x', 'write failed', { status: 502, cause })
      outs.push({ message: r.error.message, extra: r.extra })
    }
  } catch { threw = true }
  ok('getter στοίβας που πετάει, κείμενο, null, κυκλικό, AggregateError: καμία εξαίρεση', !threw && outs.length === causes.length)
  ok('…και κανένα προσωπικό δεδομένο στην έξοδο', outs.every(clean))
  ok('ο τύπος του κειμένου είναι «string», όχι το κείμενο', causeNameOf('foo@bar.gr') === 'string')
}

// ── Ο ΚΩΔΙΚΟΣ ΕΙΝΑΙ ΚΩΔΙΚΟΣ, ΟΧΙ ΜΗΝΥΜΑ ─────────────────────────────────
{
  ok('κωδικός SQLSTATE περνά', codeOf({ code: '23505', message: 'foo@bar.gr' }) === '23505')
  ok('χωρίς κωδικό, null', codeOf({ message: 'foo@bar.gr' }) === null && codeOf(null) === null)
}

// ── ΑΠΟΣΤΟΛΗ ΕΞΩ ΑΠΟ ΑΙΤΗΜΑ ──────────────────────────────────────────────
// Το `after()` πετάει εκτός αιτήματος (σουίτα, σενάριο). Η αναφορά όχι.
async function sending() {
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
  let threw = false
  try {
    await reportRoute('api/x', 'write failed', { status: 502, cause: new Error('foo@bar.gr μυστικό') })
  } catch { threw = true } finally {
    globalThis.fetch = realFetch
    console.error = realLog
    if (realDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN
    else process.env.NEXT_PUBLIC_SENTRY_DSN = realDsn
  }
  ok('εκτός αιτήματος: καμία εξαίρεση', !threw)
  ok('φεύγει ακριβώς ένας φάκελος', sent.length === 1)
  const ev = sent[0] ? JSON.parse(sent[0].split('\n')[2]) as { exception: { values: { value: string }[] } } : null
  ok('η τιμή της εξαίρεσης είναι η ετικέτα', ev?.exception.values[0].value === '[api/x] write failed 502')
  ok('το μήνυμα της αιτίας δεν ταξιδεύει', !!sent[0] && !sent[0].includes('foo@bar.gr') && !sent[0].includes('μυστικό'))
}

sending().then(() => {
  console.log(fail ? `✗ observability/route: ${fail} απέτυχαν από ${pass + fail}` : `✓ observability/route: ${pass} έλεγχοι πέρασαν`)
  if (fail) process.exit(1)
})
