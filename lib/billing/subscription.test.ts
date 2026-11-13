// npx tsx lib/billing/subscription.test.ts
//
// ΕΔΩ ΚΡΙΝΕΤΑΙ ΠΟΙΟΣ ΠΛΗΡΩΝΕΙ ΚΑΙ ΠΟΙΟΣ ΟΧΙ.
// Ενα λάθος σε αυτούς τους κανόνες δεν χαλάει οθόνη: ή χαρίζει συνδρομή, ή
// κόβει πρόσβαση σε πελάτη που πλήρωσε. Και τα δύο τα μαθαίνεις από παράπονο.
//
// ΜΕΤΑΚΟΜΙΣΑΝ ΜΑΖΙ ΜΕ ΤΟΥΣ ΚΑΝΟΝΕΣ. Οι έλεγχοι ζούσαν στη σουίτα του πρώτου
// εμπόρου, ενώ οι κανόνες που ελέγχουν είναι δικοί μας και ζουν στο
// «subscription.ts». Με την αφαίρεση εκείνου του κώδικα θα χάνονταν μαζί του.
import { readFileSync, readdirSync } from 'node:fs'
import { MOR_STATUSES, isMorStatus, isEntitled, PAST_DUE_GRACE_DAYS, pastDueUntil } from './subscription'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const NOW = '2026-08-20T10:00:00Z'

// ── ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ ────────────────────────────────────────────────────────
ok('επτά καταστάσεις, όσες ορίζει η εφαρμογή', MOR_STATUSES.length === 7)
ok('άγνωστη κατάσταση δεν αναγνωρίζεται', !isMorStatus('super_active'))
ok('κενό δεν αναγνωρίζεται', !isMorStatus('') && !isMorStatus(null) && !isMorStatus(7))

const ent = (status: string, endsAt: string | null = null) =>
  isEntitled({ status: status as never, endsAt }, NOW)

ok('η δοκιμή δίνει πρόσβαση', ent('on_trial'))
ok('η ενεργή δίνει πρόσβαση', ent('active'))
ok('η καθυστερημένη πληρωμή ΔΕΝ κόβει αμέσως', ent('past_due'))
ok('η παύση δεν είναι δωρεάν συνδρομή', !ent('paused'))
ok('η ανείσπρακτη δεν δίνει πρόσβαση', !ent('unpaid'))
ok('η ληγμένη δεν δίνει πρόσβαση', !ent('expired'))

// ΤΟ ΚΡΙΣΙΜΟ: η ακύρωση κρατά ό,τι πληρώθηκε και ούτε μέρα παραπάνω.
ok('ακυρωμένη με λήξη στο μέλλον: πρόσβαση', ent('cancelled', '2026-09-01T00:00:00Z'))
ok('ακυρωμένη με λήξη στο παρελθόν: τέλος', !ent('cancelled', '2026-08-01T00:00:00Z'))
ok('ακυρωμένη ΧΩΡΙΣ λήξη δεν εφευρίσκει περίοδο χάριτος', !ent('cancelled', null))
ok('η λήξη είναι η στιγμή, όχι η ημέρα', !ent('cancelled', NOW))

// ── Η ΑΠΟΤΥΧΗΜΕΝΗ ΠΛΗΡΩΜΗ ΕΧΕΙ ΟΡΙΟ ───────────────────────────────────────
// ΠΗΓΗ: έλεγχος ετοιμότητας πληρωμών 12/11/2026, «Λείπει (κώδικας)» 2. Το
// `past_due` έδινε πρόσβαση για πάντα, όσο ο έμπορος δεν έστελνε «unpaid».
const DAY = 86_400_000
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString()
const pd = (since: string | null) => isEntitled({ status: 'past_due', endsAt: null, pastDueSince: since }, NOW)

ok('η χάρη είναι θετικός ακέραιος ημερών', Number.isInteger(PAST_DUE_GRACE_DAYS) && PAST_DUE_GRACE_DAYS > 0)
ok('μέσα στη χάρη: πρόσβαση', pd(ago(PAST_DUE_GRACE_DAYS - 1)))
ok('στο τέλος της χάρης: τέλος', !pd(ago(PAST_DUE_GRACE_DAYS)))
ok('μετά τη χάρη: τέλος', !pd(ago(PAST_DUE_GRACE_DAYS + 30)))
ok('χωρίς ώρα πρώτης αποτυχίας δεν εφευρίσκεται λήξη', pd(null))
ok('ώρα που δεν διαβάζεται δεν κόβει', pd('χθες'))
ok('η λήξη της χάρης είναι ώρα, όχι μέρα',
   pastDueUntil('2026-08-10T10:30:00.000Z') === new Date(Date.parse('2026-08-10T10:30:00.000Z') + PAST_DUE_GRACE_DAYS * DAY).toISOString())
ok('χωρίς ώρα, χωρίς λήξη', pastDueUntil(null) === null && pastDueUntil('') === null)
ok('η χάρη δεν αγγίζει τις υπόλοιπες καταστάσεις',
   isEntitled({ status: 'active', endsAt: null, pastDueSince: ago(400) }, NOW))

// ── Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΣΤΗ ΒΑΣΗ ─────────────────────────────────────────────
// Η `user_plan_rank` κρίνει τα όρια στη βάση· αν έμενε πίσω, η οθόνη θα έλεγε
// «δωρεάν» και η βάση θα άφηνε τρία ακίνητα. Η αριθμητική σύγκριση των ημερών
// γίνεται και στο db-replay, πάνω σε πραγματικό Postgres.
{
  const dir = 'supabase/migrations'
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
  const latestFn = (head: string): string => {
    const file = files.find(f => readFileSync(`${dir}/${f}`, 'utf8').includes(head))
    if (!file) return ''
    const sql = readFileSync(`${dir}/${file}`, 'utf8')
    const from = sql.indexOf(head)
    return sql.slice(from, sql.indexOf('$$;', from) + 3)
  }
  const rank = latestFn('create or replace function public.user_plan_rank(')
  ok('η user_plan_rank διαβάζει την ώρα της πρώτης αποτυχίας', /mor_past_due_at/.test(rank))
  ok('και κόβει με την past_due_grace_days()', /v_status = 'past_due'/.test(rank) && /past_due_grace_days\(\)/.test(rank))
  ok('η ακυρωμένη που έληξε κόβεται ακόμη', /v_status = 'cancelled' and v_ends is not null and v_ends <= now\(\)/.test(rank))
  const days = /returns int[^$]*\$\$ select (\d+) \$\$/.exec(latestFn('create or replace function public.past_due_grace_days('))?.[1]
  ok('η βάση και η εφαρμογή μετρούν τις ίδιες ημέρες χάρης', Number(days) === PAST_DUE_GRACE_DAYS)
  const lock = latestFn('create or replace function public.lock_billing_plan(')
  for (const col of ['mor_past_due_at', 'mor_revoked_at', 'mor_revoked_reason', 'mor_revoked_ref', 'mor_last_transaction_id']) {
    ok(`ο πελάτης δεν γράφει το ${col} σε INSERT`, new RegExp(`new\\.${col} := null;`).test(lock))
    ok(`ο πελάτης δεν γράφει το ${col} σε UPDATE`, new RegExp(`new\\.${col}\\s+:= old\\.${col};`).test(lock))
  }
}

console.log(fail === 0 ? `✓ subscription: ${pass} έλεγχοι πέρασαν` : `✗ subscription: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
