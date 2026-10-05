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
// ερώτημα. Από 05.10.2026 η χρέωση είναι η `takeUnit` (lib/billing/aiUnits.ts,
// take_ai_unit / take_scan_unit με τον ρόλο υπηρεσίας).
const iBump  = SRC.indexOf('await takeUnit(')
const iModel = SRC.indexOf('api.anthropic.com')
ok('η διαδρομή χρεώνει με takeUnit', iBump >= 0)
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
// Η επιστροφή γίνεται με το κλειδί του αιτήματος και η βάση τη δέχεται μία
// φορά. Ενα σημείο κλήσης, μία σημαία που γλιτώνει και τη δεύτερη κλήση.
eq('ένα και μόνο σημείο κλήσης προς τη βάση', SRC.split('refundUnit(').length - 1, 1)
ok('η επιστροφή στέλνει το κλειδί αυτού του αιτήματος', /await refundUnit\(user\.id, requestId, pool\)/.test(SRC))
ok('το κλειδί το φτιάχνει ο διακομιστής', /const requestId = newRequestId\(\);/.test(SRC))
ok('η χρέωση στέλνει το ίδιο κλειδί', /await takeUnit\([^)]*requestId/.test(SRC))
ok('η σημαία εμποδίζει τη δεύτερη επιστροφή', /if \(refunded\) return;/.test(SRC))
ok('η σημαία μπαίνει ΠΡΙΝ την κλήση, όχι μετά',
  SRC.indexOf('refunded = true;') < SRC.indexOf('await refundUnit('))
ok('καμία παλιά επιστροφή «μίας» χωρίς κλειδί', !/refundAiUsage\(|refundScanUsage\(/.test(SRC))

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
// απάντηση και ο βοηθός θα ήταν δωρεάν χωρίς όριο. Η παλιά `refund_ai_usage`
// μένει όσο ζει η μεταβατική `bump_ai_usage` (20261005150000).
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

// ── 9. ΠΟΙΟΣ ΜΕΤΡΗΤΗΣ ΚΑΙ ΠΟΙΑ ΟΡΙΑ: ΜΟΝΟ Ο ΔΙΑΚΟΜΙΣΤΗΣ (05.10.2026) ────────
// Το `kind` του σώματος διάλεγε τον μετρητή και τα όρια ταξίδευαν ως
// ορίσματα. Τώρα ο μετρητής βγαίνει από το ίδιο το σώμα (`meterKind`: αρχείο
// στο σχήμα της σάρωσης → σάρωση, αλλιώς Νόα) και τα όρια τα ξέρει η βάση.
const CODE = SRC.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
ok('ο μετρητής βγαίνει από το σώμα με meterKind', /const scan = meterKind\(body\) === 'scan';/.test(SRC))
ok('το `kind` του πελάτη δεν διαβάζεται', !/body\??\.kind/.test(CODE))
ok('κανένα όριο δεν στέλνεται στη βάση', !/p_(day|month|pool|max_min|trial_|tester_)/.test(CODE))
ok('καμία κλήση στις παλιές bump_*', !/bump_(ai|scan)_usage/.test(CODE))
ok('η επανάχρηση αρχείου δεν ζει πια στη μνήμη', !/scanSeen|SCAN_REUSE_MAX/.test(CODE))
ok('η σάρωση στέλνει το αποτύπωμα του αρχείου', /scan \? fileHash\(body\) : null/.test(SRC))
ok('η βάση που δεν απαντά κλείνει (503), δεν ανοίγει', /if \(u == null\) \{[\s\S]{0,300}?status: 503/.test(SRC))
ok('μόνο ρητό `allowed === true` περνά', !/allowed === false/.test(CODE) && /u\.allowed !== true/.test(SRC))

// ── 10. ΤΑ ΜΗΝΥΜΑΤΑ ΤΗΣ ΑΡΝΗΣΗΣ ΣΑΡΩΣΗΣ ───────────────────────────────────
const scanGate = SRC.slice(SRC.indexOf('if (scan && u.allowed !== true)'), SRC.indexOf('if (!scan) {'))
ok('η σάρωση χειρίζεται την άρνηση της δεξαμενής', /u\.reason === 'pool'\s*\?\s*scanPoolExhaustedMessage\(/.test(scanGate))
ok('το μήνυμα του μήνα παίρνει το όριο της βάσης', /scansExhaustedMessage\(canBuy, [^)]*u\.month_limit/.test(scanGate))

// ── 11. Η ΜΕΤΑΝΑΣΤΕΥΣΗ ΤΗΣ ΧΡΕΩΣΗΣ ─────────────────────────────────────────
const UNITS = readFileSync(
  join(HERE, '..', '..', '..', 'supabase', 'migrations',
       '20261005150000_i_monada_xreonetai_prin_ton_paroxo_kai_to_checkin_kleidonei.sql'), 'utf8')
for (const sig of ['take_ai_unit(uuid, uuid)', 'take_scan_unit(uuid, uuid, text)', 'refund_ai_unit(uuid, uuid, boolean)']) {
  ok(`${sig}: μόνο service_role`, UNITS.includes(`grant execute on function public.${sig} to service_role;`)
    && UNITS.includes(`revoke all on function public.${sig} from public, anon, authenticated;`))
}
ok('οι νέες συναρτήσεις δεν παίρνουν όρια ως ορίσματα',
  /function public\.take_ai_unit\(p_uid uuid, p_request_id uuid\)/.test(UNITS)
  && /function public\.take_scan_unit\(p_uid uuid, p_request_id uuid, p_file_hash text\)/.test(UNITS))

console.log(fail === 0 ? `✓ anthropic route: ${pass} έλεγχοι πέρασαν` : `✗ anthropic route: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
