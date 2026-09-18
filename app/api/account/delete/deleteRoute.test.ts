// npx tsx app/api/account/delete/deleteRoute.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΙΑΓΡΑΦΗ ΘΕΛΕΙ ΔΕΥΤΕΡΟ ΠΑΡΑΓΟΝΤΑ ΚΑΙ ΚΟΒΕΙ ΠΡΙΝ ΑΚΟΥΜΠΗΣΕΙ ΤΙΠΟΤΑ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΕΛΕΓΧΕΤΑΙ ΚΕΙΜΕΝΟ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΑ. Η route.ts εισάγει το
// lib/supabase/server, που φορτώνει next/headers: εκτός αιτήματος του Next δεν
// τρέχει σε Node. Η καθαρή λογική του δεύτερου βήματος ζει στο lib/auth/mfa.ts
// και δοκιμάζεται εκεί. Εδώ φυλάγεται ό,τι είναι ΔΟΜΙΚΟ στη διαδρομή: ότι
// υπάρχει fail-fast με 403, ότι στέκει ΠΡΙΝ από κάθε αμετάκλητη ενέργεια (θύρα
// εμπόρου, σάρωση αρχείων, κλήση διαγραφής) και ότι το 42501 της βάσης —η ίδια
// πύλη, ένα επίπεδο πιο κάτω— γίνεται 403 αντί για γενικό 502.
//
// ΤΙ ΕΙΝΑΙ Η ΑΠΩΛΕΙΑ ΑΝ ΣΠΑΣΕΙ. Μια συνεδρία «aal1» με δηλωμένη συσκευή —ακριβώς
// αυτό που φτιάχνει όποιος κρατά κλεμμένο κωδικό— θα διέγραφε ολόκληρο τον
// λογαριασμό μέσω μιας διαδρομής που ο διαμεσολαβητής εξαιρεί ρητά.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, 'route.ts'), 'utf8')
const ROOT = join(HERE, '..', '..', '..', '..')
const MIGRATION = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20260917120000_2fa_fylaei_ti_diagrafi.sql'), 'utf8')

// ── 1. Η ΠΥΛΗ ΥΠΑΡΧΕΙ ΚΑΙ ΕΙΝΑΙ 403 ────────────────────────────────────────
const iGate = SRC.indexOf('sessionNeedsSecondStep(')
const iRpc  = SRC.indexOf("rpc('delete_my_account')")
ok('η διαδρομή καλεί το sessionNeedsSecondStep', iGate >= 0)
ok('καλεί ακόμη τη διαγραφή', iRpc >= 0)

/** Η δήλωση `return NextResponse.json(...)` που ξεκινά στο `i`, ολόκληρη. */
function statementAt(src: string, i: number): string {
  const open = src.indexOf('(', i)
  let depth = 0
  for (let j = open; j < src.length; j++) {
    if (src[j] === '(') depth++
    else if (src[j] === ')') { depth--; if (depth === 0) return src.slice(i, j + 1) }
  }
  return src.slice(i)
}

// Η έξοδος του fail-fast: το πρώτο return μετά τον έλεγχο.
const iGateReturn = SRC.indexOf('return NextResponse.json(', iGate)
const gateExit = iGateReturn >= 0 ? statementAt(SRC, iGateReturn) : ''
ok('ο έλεγχος επιστρέφει 403', /status:\s*403/.test(gateExit))
ok('με το μήνυμα του δεύτερου βήματος (MFA_SAY)', /MFA_SAY\.ask/.test(gateExit))
ok('το MFA_SAY εισάγεται από το lib/auth/mfa', /from '@\/lib\/auth\/mfa'/.test(SRC))

// ── 2. ΚΟΒΕΙ ΠΡΙΝ ΑΚΟΥΜΠΗΣΕΙ ΤΙΠΟΤΑ ΑΜΕΤΑΚΛΗΤΟ ────────────────────────────
// Fail-fast σημαίνει: πριν την ακύρωση της συνδρομής, πριν τη σάρωση αρχείων
// και πριν την ίδια τη διαγραφή. Αλλιώς μια συνεδρία που θα απορριπτόταν έτσι
// κι αλλιώς θα προλάβαινε να ακυρώσει συνδρομή ή να σβήσει αρχεία.
ok('η πύλη στέκει ΠΡΙΝ την κλήση διαγραφής', iGate >= 0 && iGate < iRpc)
const iCancel = SRC.indexOf('mor.cancel(')
const iSweep  = SRC.indexOf('sweepOwnFiles(')
ok('η πύλη στέκει ΠΡΙΝ την ακύρωση συνδρομής', iCancel >= 0 && iGate < iCancel)
ok('η πύλη στέκει ΠΡΙΝ τη σάρωση αρχείων', iSweep >= 0 && iGate < iSweep)
ok('το 403 του fail-fast βγαίνει πριν φτάσει η ροή στη διαγραφή',
  iGateReturn >= 0 && iGateReturn < iRpc)

// ── 3. ΑΜΥΝΑ ΣΕ ΒΑΘΟΣ: ΤΟ 42501 ΤΗΣ ΒΑΣΗΣ ΓΙΝΕΤΑΙ 403 ──────────────────────
// Αν παρακαμφθεί ο έλεγχος από πάνω, η βάση σηκώνει 42501. Η διαδρομή το
// διαβάζει ως «λείπει το δεύτερο βήμα» (403), όχι ως «κάτι χάλασε» (502).
const iAfterRpc = iRpc >= 0 ? SRC.slice(iRpc) : ''
ok('το 42501 της βάσης αντιστοιχίζεται', /error\.code === '42501'/.test(iAfterRpc))
const i42501 = SRC.indexOf("error.code === '42501'")
const mapExit = i42501 >= 0 ? statementAt(SRC, SRC.indexOf('return NextResponse.json(', i42501)) : ''
ok('η αντιστοίχιση 42501 επιστρέφει 403', /status:\s*403/.test(mapExit))
ok('με το ίδιο μήνυμα του δεύτερου βήματος', /MFA_SAY\.ask/.test(mapExit))

// ── 4. Η ΠΥΛΗ ΤΗΣ ΒΑΣΗΣ, ΣΤΗΝ ΜΕΤΑΝΑΣΤΕΥΣΗ ────────────────────────────────
// Η οριστική άμυνα: ισχύει όποιος κι αν καλέσει τη συνάρτηση.
ok('η μετανάστευση ξαναορίζει την delete_my_account',
  /create or replace function public\.delete_my_account/.test(MIGRATION))
ok('η πύλη ελέγχει το aal2 του διακριτικού', /is distinct from 'aal2'/.test(MIGRATION))
ok('ζητά επαληθευμένο παράγοντα στο auth.mfa_factors',
  /auth\.mfa_factors/.test(MIGRATION) && /status = 'verified'/.test(MIGRATION))
ok('σηκώνει 42501 (insufficient_privilege)', /errcode = '42501'/.test(MIGRATION))
// Η πύλη μπαίνει ΜΕΤΑ τον έλεγχο του uid και ΠΡΙΝ την erase_account.
const iUid   = MIGRATION.indexOf('uid is null')
const iGateM = MIGRATION.indexOf("is distinct from 'aal2'")
const iErase = MIGRATION.indexOf('return public.erase_account(uid)')
ok('η πύλη στέκει μετά τον έλεγχο uid και πριν τη διαγραφή',
  iUid >= 0 && iGateM > iUid && iErase > iGateM)
// Τα δικαιώματα μένουν ακριβώς όπως πριν.
ok('ανακαλείται από public και anon',
  /revoke all\s+on function public\.delete_my_account\(\) from public, anon;/.test(MIGRATION))
ok('δίνεται σε authenticated και service_role',
  /grant\s+execute on function public\.delete_my_account\(\) to authenticated, service_role;/.test(MIGRATION))

console.log(fail === 0 ? `✓ delete route: ${pass} έλεγχοι πέρασαν` : `✗ delete route: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
