// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΛΕΓΧΟΣ ΥΓΕΙΑΣ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΛΕΕΙ «ΕΝΤΑΞΕΙ» ΧΩΡΙΣ ΝΑ ΕΧΕΙ ΜΕΤΡΗΣΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΜΕΤΡΗΘΗΚΕ ΣΤΗΝ ΠΑΡΑΓΩΓΗ (07/09/2026, με ερωτήματα στη βάση):
//
//   public.health_checks                              0 γραμμές, ποτέ καμία
//   public.health_status()                            ok = false
//   cron.job_run_details, jobid 53 «health-every-15»   59 succeeded, 0 failed
//   cron.job_run_details, jobid 54 «health-watch»       1 succeeded, 0 failed
//   cron.job_run_details, jobid 52 «bank-feed-watch»    5 succeeded, ok = FALSE
//   net._http_response, 24 γραμμές ώς 16:45 UTC        200 {"skipped":"λείπει…"}
//   .github/workflows/health.yml                      βήμα «skipped», run «success»
//
// Πράσινα σήματα πάνω σε μηδέν μετρήσεις. Η σουίτα φυλάει τα σημεία που τα
// παρήγαγαν: τη συνάρτηση, τους ΤΡΕΙΣ νυχτερινούς φύλακες της βάσης — ο
// κώδικάς τους είναι ο ίδιος ώς τη λέξη — το workflow και τον έλεγχο
// εξαρτήσεων του PR.
//
// ΓΙΑΤΙ ΕΛΕΓΧΕΙ ΚΕΙΜΕΝΟ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΑ: η index.ts είναι Deno (Deno.env
// στο module scope, Deno.serve) και δεν φορτώνεται σε Node — όπως ακριβώς και
// στη smart-suggestions/index.test.ts. Τα άλλα τρία σημεία είναι SQL και YAML.
//
// Τρέξε: npx tsx supabase/functions/health-check/index.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) {
  if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const SRC = readFileSync(join(HERE, 'index.ts'), 'utf8')

// ── 1. Λείπει το μυστικό: η απάντηση ΔΕΝ είναι πράσινη ─────────────────────
// Η γραμμή έγραφε `{ skipped: … }, 200`. Το pg_net την κατέγραψε αυτολεξεί.
const miss = SRC.match(/if \(!base\) return json\(\{([^}]*)\},\s*(\d{3})\)/)
const missBody = miss ? miss[1] : ''
const missStatus = miss ? Number(miss[2]) : 0
ok('υπάρχει η άρνηση για το HEALTH_BASE_URL που λείπει', !!miss)
ok('η άρνηση δεν απαντά 2xx', missStatus >= 400)
ok('η άρνηση είναι σφάλμα διακομιστή, δηλαδή 5xx', missStatus >= 500 && missStatus < 600)
ok('το σώμα λέει «error», όχι «skipped»', /\berror:/.test(missBody) && !/\bskipped:/.test(missBody))
ok('το μήνυμα ονομάζει τη μεταβλητή που λείπει', missBody.includes('HEALTH_BASE_URL'))

// ── 2. Ο καθρέφτης των αδελφών συναρτήσεων ────────────────────────────────
// ΟΧΙ καρφωμένο 500: ρωτάει τις άλλες συναρτήσεις άκρου τι απαντούν όταν λείπει
// μυστικό και απαιτεί ΕΝΑ κοινό νούμερο. Αν αύριο αλλάξει η σύμβαση, το τεστ
// απαιτεί να αλλάξει παντού μαζί, αντί να την επαναλάβει.
const FUNCS = join(ROOT, 'supabase', 'functions')
const siblings = new Set<number>()
for (const dir of readdirSync(FUNCS)) {
  if (dir === '_shared' || dir === 'health-check') continue
  let src = ''
  try { src = readFileSync(join(FUNCS, dir, 'index.ts'), 'utf8') } catch { continue }
  for (const m of src.matchAll(/if \(!RESEND_API_KEY\) return json\(\{[^}]*\},\s*(\d{3})\)/g)) siblings.add(Number(m[1]))
}
ok('βρέθηκαν αδελφές που αρνούνται σε μυστικό που λείπει', siblings.size > 0)
ok('όλες οι αδελφές απαντούν με τον ίδιο κωδικό', siblings.size === 1)
ok('ο κωδικός εδώ είναι ο ίδιος με των αδελφών', siblings.has(missStatus))

// ── 3. Καμία γραμμή στο ιστορικό όταν λείπει η ρύθμιση ────────────────────
// Η alertOnTransition διαβάζει την τελευταία γραμμή: μια ψεύτικη ok = false θα
// παρήγαγε αργότερα email «η παραγωγή απαντά ξανά» για διακοπή που δεν συνέβη.
const iDeny = SRC.indexOf('if (!base) return json(')
const iInsert = SRC.indexOf(".from('health_checks').insert(")
ok('η συνάρτηση γράφει στο ιστορικό', iInsert > 0)
ok('η άρνηση προηγείται κάθε γραψίματος στο ιστορικό', iDeny > 0 && iDeny < iInsert)

// ── 4. ΚΑΙ ΟΙ ΤΡΕΙΣ νυχτερινοί φύλακες αποτυγχάνουν, δεν ψιθυρίζουν ────────
// Μετρημένο: το jobid 54 πήρε ok = false και κατέγραψε «succeeded»· το jobid
// 52 το ίδιο, με τη ροή τραπεζών ΟΝΤΩΣ χαλασμένη. Τρία αντίγραφα του ίδιου
// κώδικα: αν φυλαχθεί μόνο ο ένας, τα άλλα δύο ξαναγράφουν το ελάττωμα.
const MIG = join(ROOT, 'supabase', 'migrations')
const SQLS = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()
  .map(f => readFileSync(join(MIG, f), 'utf8'))

/** Το ΤΕΛΕΥΤΑΙΟ σώμα που ορίζει τη συνάρτηση: αυτό ισχύει μετά το db push. */
function lastBody(fn: string): string {
  const head = `create or replace function public.${fn}()`
  let body = ''
  for (const sql of SQLS) {
    const i = sql.indexOf(head)
    if (i < 0) continue
    const rest = sql.slice(i)
    const end = rest.indexOf('end $$;')
    body = end < 0 ? rest : rest.slice(0, end)
  }
  return body
}

for (const fn of ['watch_health', 'watch_market_feed', 'watch_bank_feed']) {
  const body = lastBody(fn)
  ok(`η ${fn} ορίζεται σε μετανάστευση`, body.length > 0)
  ok(`η ${fn} υψώνει σφάλμα όταν η υγεία δεν είναι εντάξει`, /raise\s+exception/.test(body))
  ok(`η ${fn} δεν αρκείται σε warning, που το pg_cron γράφει «succeeded»`, !/raise\s+warning/.test(body))
  ok(`η υγιής διαδρομή της ${fn} μένει αθόρυβη, με notice`, /raise\s+notice/.test(body))
}

// ── 5. Το workflow δεν βγαίνει πράσινο χωρίς να έχει ελέγξει τίποτα ───────
const YML = readFileSync(join(ROOT, '.github', 'workflows', 'health.yml'), 'utf8')
ok('το βήμα της διεύθυνσης τερματίζει με σφάλμα όταν δεν βρει διεύθυνση', /::error::/.test(YML) && /\n\s*exit 1\n/.test(YML))
ok('δεν παραλείπεται πια με σκέτη προειδοποίηση', !/::warning::Δεν βρέθηκε διεύθυνση/.test(YML))
ok('η δουλειά δημοσιεύει αν είχε διεύθυνση να ελέγξει', /configured:\s*\$\{\{\s*steps\.target\.outputs\.configured\s*\}\}/.test(YML))
ok('το issue διακοπής ανοίγει ΜΟΝΟ όταν υπήρχε διεύθυνση', /needs\.check\.outputs\.configured\s*==\s*'true'/.test(YML))

// ── 6. Οι αδυναμίες εξαρτήσεων κρίνονται στο PR ──────────────────────────
const CI = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
ok('το ci.yml ελέγχει αδυναμίες εξαρτήσεων στο PR', /npm audit/.test(CI))
ok('ο έλεγχος του PR κρίνει τα πακέτα παραγωγής', /npm audit[^\n]*--omit=dev/.test(CI))

console.log(`\nhealth-check: ✓ ${passed} · ✗ ${failed}`)
if (failed) process.exit(1)
