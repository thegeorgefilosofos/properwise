// npx tsx lib/billing/aiLimitsSql.test.ts
//
// ΤΑ ΟΡΙΑ ΖΟΥΝ ΣΕ ΔΥΟ ΜΕΡΗ ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΛΕΝΕ ΤΟ ΙΔΙΟ. Το lib/billing/aiLimits.ts
// τα δείχνει στην οθόνη και στο /paketa· η `ai_plan_limits()` της βάσης τα
// επιβάλλει (20261002100000, 20261005150000). Αν αλλάξει το ένα χωρίς το άλλο, ο χρήστης
// διαβάζει «30 ερωτήσεις» και η βάση τον σταματά στις 20, ή το αντίστροφο.
// Διαβάζεται η ΤΕΛΕΥΤΑΙΑ μετάβαση που ορίζει ΚΑΘΕ συνάρτηση, χωριστά: η
// 20261003100000 ξαναγράφει την `ai_plan_limits` και τη `bump_scan_usage`
// χωρίς να αγγίξει τη `bump_ai_usage`, που μένει στην 20261002100000.
import { readFileSync, readdirSync } from 'node:fs'
import {
  dailyLimitsByRank, aiLimitsFor, effectiveAiLimits, SCAN_LIMITS, TRIAL_LIMITS,
  FREE_POOL_PER_MONTH, MAX_PER_MINUTE, PLAN_RANK_ORDER, TRIAL_SCANS_PER_MONTH,
} from './aiLimits'

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
}

const dir = 'supabase/migrations'
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
/** Το σώμα της συνάρτησης όπως το ορίζει η ΤΕΛΕΥΤΑΙΑ μετάβαση που την ορίζει. */
function latest(fn: string): string {
  const head = `create or replace function public.${fn}`
  const file = files.find(f => readFileSync(`${dir}/${f}`, 'utf8').includes(head))
  if (!file) { console.error(`✗ καμία μετάβαση δεν ορίζει την ${fn}`); process.exit(1) }
  const sql = readFileSync(`${dir}/${file}`, 'utf8')
  const from = sql.indexOf(head)
  const end = sql.indexOf('$$;', from)
  return sql.slice(from, end < 0 ? undefined : end + 3)
}
const body = latest('ai_plan_limits()')
const num = (k: string) => Number(new RegExp(`'${k}',\\s*(\\d+)`).exec(body)?.[1])
const arr = (k: string) => (new RegExp(`'${k}',\\s*jsonb_build_array\\(([^)]*)\\)`).exec(body)?.[1] ?? '')
  .split(',').map(x => x.trim()).map(x => x === 'null' ? null : Number(x))

eq('σειρά βαθμών', PLAN_RANK_ORDER, ['free', 'solo', 'owner', 'agency', 'office'])
eq('ανά λεπτό', num('per_minute'), MAX_PER_MINUTE)
eq('ημέρα ανά βαθμό', arr('day'), dailyLimitsByRank())
eq('μήνας ανά βαθμό', arr('month'), PLAN_RANK_ORDER.map(p => aiLimitsFor(p).perMonth))
eq('σάρωση ανά βαθμό', arr('scan'), PLAN_RANK_ORDER.map(p => SCAN_LIMITS[p]))
eq('δοκιμή ημέρα', num('trial_day'), TRIAL_LIMITS.perDay)
eq('δοκιμή μήνας', num('trial_month'), TRIAL_LIMITS.perMonth)
// Ο δοκιμαστής στο ακριβότερο πληρωμένο πακέτο: το ταβάνι του φαίνεται μόνο εκεί.
eq('δοκιμαστής ημέρα', num('tester_day'), effectiveAiLimits('office', true, true).perDay)
eq('δοκιμαστής μήνας', num('tester_month'), effectiveAiLimits('office', true, true).perMonth)
eq('δεξαμενή', num('pool'), FREE_POOL_PER_MONTH)
eq('δοκιμή σάρωση', num('trial_scan'), TRIAL_SCANS_PER_MONTH)

// ΚΑΝΕΝΑ ΟΡΙΟ ΑΠΟ ΤΟΝ ΚΑΛΟΥΝΤΑ (20261005150000). Οι `take_ai_unit` και
// `take_scan_unit` δεν παίρνουν ορίσματα ορίων: διαβάζουν μόνο την
// `ai_plan_limits()`. Η συμπεριφορά δοκιμάζεται σε αληθινή βάση στο
// scripts/db/rls-probe.sql και στο scripts/test-ai-units-concurrency.mjs· εδώ
// ότι το κείμενο λέει το ίδιο με τον TS.
const ai = latest('take_ai_unit')
const scan = latest('take_scan_unit')
eq('take_ai_unit: υπογραφή χωρίς όρια', /take_ai_unit\(p_uid uuid, p_request_id uuid\)/.test(ai), true)
eq('take_scan_unit: υπογραφή χωρίς όρια', /take_scan_unit\(p_uid uuid, p_request_id uuid, p_file_hash text\)/.test(scan), true)
eq('take_ai_unit: δοκιμή από τη trial_day', /if not v_pay then\s*\n\s*v_lday := least\(v_lday, \(v_lim->>'trial_day'\)/.test(ai), true)
eq('take_ai_unit: δοκιμαστής από τη tester_month', /v_lmon := least\(v_lmon, \(v_lim->>'tester_month'\)/.test(ai), true)
const pay = /v_pay\s*:=\s*coalesce\(v_plan, 'free'\) in \(([^)]*)\)/
eq('take_scan_unit: ίδιος ορισμός του «πληρώνει» με την take_ai_unit', pay.exec(scan)?.[1], pay.exec(ai)?.[1])
eq('take_scan_unit: ταβάνι της δοκιμής από τη trial_scan', /v_cap->>'trial_scan'/.test(scan), true)
eq('take_scan_unit: χρεώνει την κοινή δεξαμενή', /insert into public\.ai_budget/.test(scan), true)
eq('take_scan_unit: αρνείται με λόγο pool', /'reason', 'pool'/.test(scan), true)
eq('η δεξαμενή χρεώνεται μόνο κάτω από το ταβάνι', /where public\.ai_budget\.free_count < v_lpool/.test(ai) && /where public\.ai_budget\.free_count < v_lpool/.test(scan), true)
// Οι μεταβατικές δεν διαβάζουν τα ορίσματά τους.
eq('bump_ai_usage: περιτύλιγμα της take_ai_unit', /return public\.take_ai_unit\(auth\.uid\(\), gen_random_uuid\(\)\);/.test(latest('bump_ai_usage')), true)
eq('bump_scan_usage: περιτύλιγμα της take_scan_unit', /return public\.take_scan_unit\(auth\.uid\(\), gen_random_uuid\(\), null\);/.test(latest('bump_scan_usage')), true)

console.log(fail ? `✗ aiLimitsSql: ${fail} απέτυχαν από ${pass + fail}` : `✓ aiLimitsSql: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
