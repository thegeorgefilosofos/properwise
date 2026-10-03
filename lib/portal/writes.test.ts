// npx tsx lib/portal/writes.test.ts
//
// ΤΙ ΦΥΛΑΓΕΤΑΙ. Η βάση απαντά στις εγγραφές της πύλης με true, false, null ή
// σφάλμα και καθένα ζητά άλλη κίνηση από τον ενοικιαστή. Αν το null διαβαστεί
// ως «απέτυχε, δοκίμασε ξανά», ο ενοικιαστής ξαναπατά με τον ίδιο λάθος
// κωδικό και κλειδώνεται έξω. Αν το σφάλμα κλειδώματος διαβαστεί ως δίκτυο,
// του λέμε να ελέγξει το σήμα του. Και η κλήση πρέπει να κουβαλά ΠΑΝΤΑ το
// `p_pin`, αλλιώς η βάση την αρνείται σε κάθε σύνδεσμο με κωδικό.
import { callPortalWrite, portalWriteMessage, portalWriteOutcome, PORTAL_SAY, type RpcResult } from './writes'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

// ── 1. Η ΑΠΑΝΤΗΣΗ ΤΗΣ ΒΑΣΗΣ ─────────────────────────────────────────────────
ok('true: έγινε', portalWriteOutcome({ data: true, error: null }) === 'ok')
ok('false: δεν έγινε', portalWriteOutcome({ data: false, error: null }) === 'refused')
ok('null: ο κωδικός δεν έγινε δεκτός', portalWriteOutcome({ data: null, error: null }) === 'pin')
ok('portal_locked: κλείδωμα',
  portalWriteOutcome({ data: null, error: { code: 'P0001', message: 'portal_locked' } }) === 'locked')
ok('portal_rate_limited: ταβάνι',
  portalWriteOutcome({ data: null, error: { code: 'P0001', message: 'portal_rate_limited' } }) === 'rate_limited')
ok('δίκτυο: γενική αποτυχία, όχι κωδικός',
  portalWriteOutcome({ data: null, error: { message: 'TypeError: Failed to fetch' } }) === 'refused')
ok('παράξενη τιμή: γενική αποτυχία', portalWriteOutcome({ data: 'ναι', error: null }) === 'refused')

// ── 2. ΤΑ ΜΗΝΥΜΑΤΑ ──────────────────────────────────────────────────────────
ok('κωδικός: το κοινό μήνυμα', portalWriteMessage('pin', 'Χ', 'Υ') === PORTAL_SAY.pin)
ok('κλείδωμα: το κοινό μήνυμα', portalWriteMessage('locked', 'Χ', 'Υ') === PORTAL_SAY.locked)
ok('ταβάνι: το μήνυμα του καλούντος', portalWriteMessage('rate_limited', 'Χ', 'Υ') === 'Υ')
ok('άρνηση: το μήνυμα του καλούντος', portalWriteMessage('refused', 'Χ', 'Υ') === 'Χ')
for (const [k, v] of Object.entries(PORTAL_SAY)) {
  ok(`${k}: χωρίς «&», «→» ή κόμμα πριν από «και»`, !/[&→]|,\s*(και|κι)(?!\p{L})/u.test(v))
}

// ── 3. Η ΚΛΗΣΗ ΚΟΥΒΑΛΑ ΤΟΝ ΚΩΔΙΚΟ ───────────────────────────────────────────
async function calls(answers: RpcResult[], pin: string | null) {
  const seen: Record<string, unknown>[] = []
  const rpc = (_fn: string, args: Record<string, unknown>) => {
    seen.push(args)
    return Promise.resolve(answers[Math.min(seen.length - 1, answers.length - 1)])
  }
  const res = await callPortalWrite(rpc, 'declare_rent_payment', { p_token: 't', p_payment_id: 'x', p_note: '' }, pin)
  return { res, seen }
}

const main = async () => {
  {
    const { res, seen } = await calls([{ data: true, error: null }], '4321')
    ok('μία κλήση όταν η βάση ξέρει το p_pin', seen.length === 1)
    ok('ο κωδικός φεύγει ως p_pin', seen[0].p_pin === '4321')
    ok('τα υπόλοιπα ορίσματα μένουν', seen[0].p_token === 't' && seen[0].p_payment_id === 'x')
    ok('η απάντηση περνά αυτούσια', res.data === true)
  }
  {
    const { seen } = await calls([{ data: true, error: null }], null)
    ok('χωρίς κωδικό στον σύνδεσμο φεύγει ρητό p_pin: null', 'p_pin' in seen[0] && seen[0].p_pin === null)
  }
  {
    // Η σελίδα ανέβηκε πριν τη μετανάστευση: η παλιά υπογραφή δεν έχει p_pin.
    const { res, seen } = await calls([
      { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
      { data: true, error: null },
    ], null)
    ok('PGRST202: ξαναρωτά μία φορά', seen.length === 2)
    ok('PGRST202: η δεύτερη κλήση είναι η παλιά, χωρίς p_pin', !('p_pin' in seen[1]))
    ok('PGRST202: κρατά την απάντηση της δεύτερης', res.data === true)
  }
  {
    const { seen } = await calls([{ data: null, error: { code: 'P0001', message: 'portal_locked' } }], '1')
    ok('άλλο σφάλμα: καμία δεύτερη κλήση', seen.length === 1)
  }
  {
    const { seen } = await calls([{ data: null, error: null }], '0000')
    ok('λάθος κωδικός: καμία δεύτερη κλήση που θα μετρούσε ξανά στο κλείδωμα', seen.length === 1)
  }

  console.log(fail === 0 ? `✓ portal writes: ${pass} έλεγχοι πέρασαν` : `✗ portal writes: ${fail} απέτυχαν από ${pass + fail}`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
