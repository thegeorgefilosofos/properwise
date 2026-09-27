// npx tsx lib/billing/subscription.test.ts
//
// ΕΔΩ ΚΡΙΝΕΤΑΙ ΠΟΙΟΣ ΠΛΗΡΩΝΕΙ ΚΑΙ ΠΟΙΟΣ ΟΧΙ.
// Ενα λάθος σε αυτούς τους κανόνες δεν χαλάει οθόνη: ή χαρίζει συνδρομή, ή
// κόβει πρόσβαση σε πελάτη που πλήρωσε. Και τα δύο τα μαθαίνεις από παράπονο.
//
// ΜΕΤΑΚΟΜΙΣΑΝ ΜΑΖΙ ΜΕ ΤΟΥΣ ΚΑΝΟΝΕΣ. Οι έλεγχοι ζούσαν στη σουίτα του πρώτου
// εμπόρου, ενώ οι κανόνες που ελέγχουν είναι δικοί μας και ζουν στο
// «subscription.ts». Με την αφαίρεση εκείνου του κώδικα θα χάνονταν μαζί του.
import { MOR_STATUSES, isMorStatus, isEntitled } from './subscription'

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

console.log(fail === 0 ? `✓ subscription: ${pass} έλεγχοι πέρασαν` : `✗ subscription: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
