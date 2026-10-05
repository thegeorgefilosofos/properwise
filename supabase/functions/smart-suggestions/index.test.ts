// ═══════════════════════════════════════════════════════════════════════════
// Η edge function των προτάσεων περνά από το ΙΔΙΟ ταβάνι κόστους AI.
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η smart-suggestions καλούσε το Anthropic κατευθείαν, χωρίς
// μετρητή. Δεύτερος δρόμος προς το ίδιο κλειδί, χωρίς ταβάνι — το μηνιαίο
// όριο και η κοινή δεξαμενή απλώς παρακάμπτονταν.
//
// ΑΠΟ 05.10.2026 (20261005150000) η χρέωση γίνεται με την `take_ai_unit`, μόνο
// με τον ρόλο υπηρεσίας και ρητό χρήστη από το JWT. Τα όρια ΔΕΝ ζουν πια εδώ:
// το αντίγραφο του lib/billing/aiLimits.ts που ταξίδευε ως ορίσματα έφυγε και
// αυτός ο έλεγχος κρατά ότι δεν ξαναγυρίζει.
//
// ΓΙΑΤΙ ΕΛΕΓΧΕΙ ΚΕΙΜΕΝΟ ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΑ: η index.ts είναι Deno (Deno.env
// στο module scope, Deno.serve) — δεν φορτώνεται σε Node. Η συμπεριφορά της
// `take_ai_unit` ελέγχεται στη βάση (scripts/db/rls-probe.sql,
// scripts/test-ai-units-concurrency.mjs).
//
// Τρέξε: npx tsx supabase/functions/smart-suggestions/index.test.ts
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) {
  if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) }
}

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf8')
const CODE = SRC.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

// ── 1. Η χρέωση υπάρχει και τρέχει ΠΡΙΝ πληρώσουμε το μοντέλο ─────────────
const iTake  = SRC.indexOf("'take_ai_unit'")
const iModel = SRC.indexOf('api.anthropic.com')
const iUser  = SRC.indexOf('const userId = userData.user.id')
ok('η function καλεί την take_ai_unit', iTake >= 0)
ok('υπάρχει κλήση στο Anthropic για να φυλαχθεί', iModel >= 0)
ok('η χρέωση προηγείται της κλήσης του μοντέλου', iTake >= 0 && iModel >= 0 && iTake < iModel)
ok('ο χρήστης βγαίνει από το JWT πριν τη χρέωση', iUser >= 0 && iUser < iTake)

// ── 2. Με ποιον client και με ποια ορίσματα ───────────────────────────────
// Η take_ai_unit εκτελείται μόνο από service_role. Με τον client του χρήστη
// θα έπαιρνε 42501 και θα έκοβε ΟΛΟΥΣ.
const rpcCaller = SRC.match(/(\w+)\.rpc\(\s*'take_ai_unit'/)?.[1]
ok('το RPC καλείται με το service, μετά τον έλεγχο του JWT', rpcCaller === 'service')
const args = SRC.match(/\.rpc\(\s*'take_ai_unit',\s*\{([^}]*)\}/)?.[1] ?? ''
const keys = [...args.matchAll(/(\w+)\s*:/g)].map(m => m[1]).sort()
ok('η κλήση στέλνει μόνο χρήστη και κλειδί αιτήματος', JSON.stringify(keys) === JSON.stringify(['p_request_id', 'p_uid']))
ok('ο χρήστης είναι αυτός του token', /p_uid:\s*userId/.test(args))
ok('το κλειδί το φτιάχνει η function', /const requestId = crypto\.randomUUID\(\)/.test(SRC))

// ── 3. Κανένα όριο δεν ζει ή ταξιδεύει από εδώ ────────────────────────────
ok('κανένα αντίγραφο ορίων στον κώδικα', !/perDayByRank|perMonthByRank|freePoolPerMonth|trialPerDay|testerPerMonth|AI_LIMITS/.test(CODE))
ok('κανένα p_day, p_month, p_max_min, p_trial_*, p_tester_*', !/p_(day|month|max_min|trial_|tester_)/.test(CODE))
ok('καμία κλήση στην παλιά bump_ai_usage', !/bump_ai_usage/.test(CODE))

// ── 4. Το { error } ελέγχεται και κλείνει ─────────────────────────────────
const errBinding = SRC.match(
  /const\s*\{[^}]*\berror:\s*(\w+)[^}]*\}\s*=\s*await\s+service\.rpc\(\s*'take_ai_unit'/,
)?.[1]
ok('το σφάλμα του RPC δεσμεύεται σε μεταβλητή', !!errBinding)
if (errBinding) {
  const iErrGuard = SRC.indexOf(`if (${errBinding}`)
  ok('σε σφάλμα RPC η function σταματά πριν το μοντέλο', iErrGuard > iTake && iErrGuard < iModel)
}

// ── 5. Σε υπέρβαση επιστρέφεται καθαρό σφάλμα, όχι κλήση στο μοντέλο ──────
// Ό,τι δεν είναι ρητό `allowed === true` είναι άρνηση.
const iDenied = SRC.indexOf('allowed !== true')
ok('η απάντηση «δεν επιτρέπεται» του RPC ελέγχεται αυστηρά', iDenied >= 0)
ok('η υπέρβαση κόβει πριν το μοντέλο', iDenied > iTake && iDenied < iModel)
ok('η υπέρβαση γυρίζει 429', /allowed !== true[\s\S]{0,700}?\}, 429\)/.test(SRC))
ok('κανένα `allowed === false` που θα άφηνε το `null` να περάσει', !/allowed === false/.test(CODE))

// ── 6. Η αποτυχία του παρόχου επιστρέφει τη μονάδα, με το ίδιο κλειδί ─────
const iRefund = SRC.indexOf("'refund_ai_unit'")
ok('η επιστροφή γίνεται με refund_ai_unit και το ίδιο κλειδί',
  iRefund > iTake && /'refund_ai_unit',\s*\{\s*p_uid:\s*userId,\s*p_request_id:\s*requestId/.test(SRC))
ok('μη επιτυχής απάντηση του παρόχου → επιστροφή', /if \(!aiRes\.ok\) \{\s*await giveBack\(\)/.test(SRC))
ok('πτώση του αιτήματος → επιστροφή', /\} catch \(err\) \{[\s\S]{0,200}?await giveBack\(\)/.test(SRC))

console.log(`\nsmart-suggestions: ✓ ${passed} · ✗ ${failed}`)
if (failed) process.exit(1)
