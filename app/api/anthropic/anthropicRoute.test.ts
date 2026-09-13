// npx tsx app/api/anthropic/anthropicRoute.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΜΙΑ ΕΞΟΔΟΣ ΧΩΡΙΣ ΑΠΑΝΤΗΣΗ ΔΕΝ ΚΡΑΤΑΕΙ ΤΗ ΧΡΕΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΕΛΕΓΧΕΤΑΙ ΚΕΙΜΕΝΟ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΑ. Η route.tsx εισάγει
// `next/headers` μέσω του lib/supabase/server: εκτός αιτήματος του Next δεν
// φορτώνεται σε Node, οπότε δεν καλείται σε τεστ. Η ΚΑΘΑΡΗ λογική
// (αντιστοίχιση σφαλμάτων, χρονικό όριο) ζει στο lib/assistant/upstream.ts και
// δοκιμάζεται εκεί με πραγματικές κλήσεις. Εδώ φυλάγεται ό,τι είναι ΔΟΜΙΚΟ και
// φαίνεται στην πηγή: ότι κάθε έξοδος σφάλματος επιστρέφει τη μονάδα, ότι
// κρατά τις κεφαλίδες υπολοίπου, ότι η κλήση έχει όριο χρόνου και ότι το σώμα
// δεν διαβάζεται πια πριν τον έλεγχο της απάντησης.
//
// ΤΙ ΜΕΤΡΗΘΗΚΕ ΠΑΝΩ ΣΤΟΝ ΠΡΟΗΓΟΥΜΕΝΟ ΚΩΔΙΚΑ: αυτό το αρχείο, τρεχούμενο πάνω
// στη διαδρομή ΠΡΙΝ τη διόρθωση, απέτυχε σε 12 από τους 28 ελέγχους. Οι δύο
// πρώτοι πίνακες αστοχίας ονόμασαν τις γραμμές 174, 185, 199, 271 και 280 ως
// «έξοδοι σφάλματος χωρίς επιστροφή της μονάδας» — τις ίδιες πέντε και ως
// «έξοδοι χωρίς τις κεφαλίδες υπολοίπου». Οι υπόλοιποι δεκαέξι πέρασαν και
// τότε: η χρέωση προηγούνταν ήδη της κλήσης και η μετανάστευση ελέγχεται
// χωριστά από τη διαδρομή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, 'route.tsx'), 'utf8')
const MIGRATION = readFileSync(
  join(HERE, '..', '..', '..', 'supabase', 'migrations',
       '20260907180000_i_erotisi_pou_den_apantithike_epistrefetai.sql'), 'utf8')

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

// ── 1. Η χρέωση προηγείται της κλήσης ──────────────────────────────────────
// Ο μόνος έλεγχος που περνούσε και πριν. Μένει: αν κάποιος μετακινήσει τη
// χρέωση μετά την κλήση, η επιστροφή από κάτω γίνεται λάθος απάντηση σε λάθος
// ερώτημα.
const iBump  = SRC.indexOf("'bump_ai_usage'")
const iModel = SRC.indexOf('api.anthropic.com')
ok('η διαδρομή χρεώνει με bump_ai_usage', iBump >= 0)
ok('η χρέωση προηγείται της κλήσης στον πάροχο', iBump >= 0 && iModel > iBump)

// ── 2. ΚΑΘΕ ΕΞΟΔΟΣ ΣΦΑΛΜΑΤΟΣ ΜΕΤΑ ΤΗ ΧΡΕΩΣΗ ΕΠΙΣΤΡΕΦΕΙ ΤΗ ΜΟΝΑΔΑ ──────────
// Η περιοχή αρχίζει στο κλειδί: ό,τι είναι πριν (401 χωρίς σύνδεση, 429
// εξαντλημένου πακέτου) δεν έχει χρεώσει ή έχει χρεώσει σωστά — ο χρήστης που
// χτύπησε το όριό του ΔΕΝ δικαιούται επιστροφή, το όριο είναι ήδη περασμένο.
const iKey = SRC.indexOf('const apiKey = process.env.ANTHROPIC_API_KEY')
// Η περιοχή τελειώνει με το POST: το 405 του GET δεν έχει χρεώσει τίποτα.
const iEnd = SRC.indexOf('export async function GET')
ok('βρέθηκε η αρχή της περιοχής που έχει ήδη χρεώσει', iKey > iBump)
ok('βρέθηκε το τέλος του POST', iEnd > iKey)

const exits: { at: number; text: string }[] = []
for (const m of SRC.matchAll(/return NextResponse\.json\(/g)) {
  if (m.index !== undefined && m.index > iKey && m.index < iEnd) {
    exits.push({ at: m.index, text: statementAt(SRC, m.index) })
  }
}
ok('υπάρχουν έξοδοι μετά τη χρέωση για να ελεγχθούν', exits.length >= 6)

let prevEnd = iKey
const unrefunded: string[] = []
const headerless: string[] = []
for (const e of exits) {
  const isError = /status:/.test(e.text)
  const line = SRC.slice(0, e.at).split('\n').length
  if (isError && !SRC.slice(prevEnd, e.at).includes('await giveBack(')) unrefunded.push(`γρ. ${line}`)
  if (!e.text.includes('quotaHeaders(quota)')) headerless.push(`γρ. ${line}`)
  prevEnd = e.at + e.text.length
}
eq('καμία έξοδος σφάλματος χωρίς επιστροφή της μονάδας', unrefunded, [])
eq('καμία έξοδος χωρίς τις κεφαλίδες υπολοίπου', headerless, [])

// ── 3. ΜΙΑ ΦΟΡΑ, ΟΧΙ ΔΥΟ ───────────────────────────────────────────────────
// Η επιστροφή είναι αφαίρεση: δεύτερη κλήση για την ίδια αποτυχία χαρίζει
// ερώτηση. Ενα σημείο κλήσης προς τη βάση, μία σημαία που το φυλάει.
eq('ένα και μόνο σημείο κλήσης προς τη βάση', SRC.split('refundAiUsage(').length - 1, 1)
ok('η σημαία εμποδίζει τη δεύτερη επιστροφή', /if \(refunded\) return;/.test(SRC))
ok('η σημαία μπαίνει ΠΡΙΝ την κλήση, όχι μετά',
  SRC.indexOf('refunded = true;') < SRC.indexOf('await refundAiUsage('))

// ── 4. ΧΡΟΝΙΚΟ ΟΡΙΟ ────────────────────────────────────────────────────────
ok('η κλήση στον πάροχο έχει χρονικό όριο', /signal:\s*AbortSignal\.timeout\(UPSTREAM_TIMEOUT_MS\)/.test(SRC))
ok('η διαδρομή δηλώνει πόσο ζει', /export const maxDuration = \d+/.test(SRC))

// ── 5. ΤΟ ΣΩΜΑ ΔΙΑΒΑΖΕΤΑΙ ΑΣΦΑΛΩΣ ──────────────────────────────────────────
// Το `await response.json()` πετάει σε σώμα HTML (απάντηση πύλης) και η
// εξαίρεση έβγαζε «Εσωτερικό σφάλμα» για βλάβη που δεν είναι δική μας.
ok('κανένα ωμό response.json() στην απάντηση του παρόχου', !/response\.json\(\)/.test(SRC))
ok('το σώμα διαβάζεται ως κείμενο', /await response\.text\(\)/.test(SRC))
ok('η ανάλυση JSON είναι μέσα σε try', /try \{ data = text \? JSON\.parse\(text\) : null; \} catch/.test(SRC))

// ── 6. ΤΙΠΟΤΑ ΤΟΥ ΠΑΡΟΧΟΥ ΔΕΝ ΠΕΡΝΑΕΙ ΑΥΤΟΥΣΙΟ ΣΤΟΝ ΧΡΗΣΤΗ ────────────────
ok('το αγγλικό μήνυμα του παρόχου δεν φτάνει στην οθόνη', !/error: data\.error/.test(SRC))
ok('ο κωδικός του παρόχου δεν προωθείται', !/status: response\.status/.test(SRC))
ok('η ωμή αιτία πάει στα αρχεία καταγραφής', /console\.error\('Anthropic API error:'/.test(SRC))

// ── 7. Η ΜΕΤΑΝΑΣΤΕΥΣΗ: ΠΟΙΟΣ ΜΠΟΡΕΙ ΝΑ ΜΕΙΩΣΕΙ ΜΕΤΡΗΤΗ ────────────────────
// Με δικαίωμα στον `authenticated`, ο καθένας θα καλούσε το RPC μετά από κάθε
// απάντηση και ο βοηθός θα ήταν δωρεάν χωρίς όριο.
ok('η συνάρτηση επιστροφής υπάρχει', /create or replace function public\.refund_ai_usage/.test(MIGRATION))
ok('το δικαίωμα δίνεται μόνο στον service_role',
  /grant execute on function public\.refund_ai_usage\(uuid, boolean\) to service_role;/.test(MIGRATION))
ok('ανακαλείται από public, anon και authenticated',
  /revoke all on function public\.refund_ai_usage\(uuid, boolean\) from public, anon, authenticated;/.test(MIGRATION))
ok('κανένα grant προς authenticated ή anon', !/grant execute[^;]*refund_ai_usage[^;]*(authenticated|anon)/.test(MIGRATION))

// ── 8. ΤΙ ΑΚΡΙΒΩΣ ΕΠΙΣΤΡΕΦΕΤΑΙ ─────────────────────────────────────────────
const body = MIGRATION.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
ok('ο μετρητής του λεπτού ΔΕΝ επιστρέφεται', !/minute_count/.test(body))
ok('το ημερήσιο πακέτο επιστρέφεται', /day_count\s*=\s*greatest/.test(body))
ok('το μηνιαίο πακέτο επιστρέφεται', /month_count\s*=\s*greatest/.test(body))
ok('η δεξαμενή επιστρέφεται υπό όρο', /if p_pool then/.test(body))
ok('κανένας μετρητής δεν πέφτει κάτω από το μηδέν',
  (body.match(/greatest\([^)]*- 1, 0\)/g) || []).length === 3)
ok('η συνάρτηση κλειδώνει το search_path', /set search_path to 'public'/.test(body))

console.log(fail === 0 ? `✓ anthropic route: ${pass} έλεγχοι πέρασαν` : `✗ anthropic route: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
