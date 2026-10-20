// npx tsx app/api/billing/checkout/checkoutGate.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΑΜΕΙΟ ΑΡΝΕΙΤΑΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ ΟΣΟ Ο ΠΩΛΗΤΗΣ ΕΙΝΑΙ ΑΝΩΝΥΜΟΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (νομική αξιολόγηση 20/10/2026). Ζωντανό κλειδί εμπόρου στην
// παραγωγή, φορέας χωρίς όνομα, διεύθυνση, ΑΦΜ και τηλέφωνο: το ταμείο
// άνοιγε. Η οθόνη κρύβει πλέον το κουμπί, αλλά η απόφαση δεν επιτρέπεται να
// ζει μόνο στην οθόνη: ένας σελιδοδείκτης φτάνει εδώ κατευθείαν.
//
// ΓΙΑΤΙ ΚΕΙΜΕΝΟ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΑ. Οπως στο deleteRoute.test.ts: η route.ts
// φορτώνει το next/headers και εκτός αιτήματος του Next δεν τρέχει σε Node.
// Η ίδια η συνθήκη δοκιμάζεται με συμπεριφορά στο lib/legal/billingWords.test.ts.
// Εδώ φυλάγεται η ΘΕΣΗ της: πριν από κάθε απάντηση «available: true» και πριν
// ζητηθεί σύνδεσμος πληρωμής από τον έμπορο.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, 'route.ts'), 'utf8')
const PLAN = readFileSync(join(HERE, '..', 'plan', 'route.ts'), 'utf8')

const iGate = SRC.indexOf('checkoutState(process.env)')
const iClosed = SRC.indexOf('return closed()', iGate)
const iOpen = SRC.indexOf('mor.openCheckout(')
const iFirstAvailable = SRC.indexOf('available: true')

ok('το ταμείο ρωτά τη συνθήκη με την ταυτότητα (checkoutState)', iGate >= 0)
ok('με κλειστή συνθήκη επιστρέφει την απάντηση «κλειστό»', iClosed > iGate && /if \(!gate\.live\)/.test(SRC))
ok('η συνθήκη στέκει πριν ζητηθεί σύνδεσμος από τον έμπορο', iGate >= 0 && iOpen > iGate)
ok('και πριν από κάθε «available: true» (και του probe)', iGate >= 0 && iFirstAvailable > iGate)
ok('το ταμείο δεν ρωτά πια μόνο τον έμπορο', !/mor\.isLive\(/.test(SRC))

const iPlanGate = PLAN.indexOf('checkoutIsLive(process.env)')
const iChange = PLAN.indexOf('mor.changePlan(')
ok('η αλλαγή πακέτου ρωτά την ίδια συνθήκη', iPlanGate >= 0)
ok('πριν από την αλλαγή στον έμπορο', iPlanGate >= 0 && iChange > iPlanGate)
ok('η αλλαγή πακέτου δεν ρωτά μόνο τον έμπορο', !/mor\.isLive\(/.test(PLAN))

console.log(fail === 0 ? `✓ checkoutGate: ${pass} έλεγχοι πέρασαν` : `✗ checkoutGate: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
