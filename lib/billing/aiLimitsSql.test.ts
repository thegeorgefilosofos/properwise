// npx tsx lib/billing/aiLimitsSql.test.ts
//
// ΤΑ ΟΡΙΑ ΖΟΥΝ ΣΕ ΔΥΟ ΜΕΡΗ ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΛΕΝΕ ΤΟ ΙΔΙΟ. Το lib/billing/aiLimits.ts
// τα δείχνει στην οθόνη και στο /paketa· η `ai_plan_limits()` της βάσης τα
// επιβάλλει (20261002100000). Αν αλλάξει το ένα χωρίς το άλλο, ο χρήστης
// διαβάζει «30 ερωτήσεις» και η βάση τον σταματά στις 20, ή το αντίστροφο.
// Διαβάζεται η ΤΕΛΕΥΤΑΙΑ μετάβαση που ορίζει τη συνάρτηση.
import { readFileSync, readdirSync } from 'node:fs'
import {
  dailyLimitsByRank, monthlyLimitsByRank, scanLimitsByRank, TRIAL_LIMITS, TESTER_LIMITS,
  FREE_POOL_PER_MONTH, MAX_PER_MINUTE, PLAN_RANK_ORDER,
} from './aiLimits'

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
}

const dir = 'supabase/migrations'
const file = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
  .find(f => /create or replace function public\.ai_plan_limits\(\)/.test(readFileSync(`${dir}/${f}`, 'utf8')))
if (!file) { console.error('✗ καμία μετάβαση δεν ορίζει την ai_plan_limits()'); process.exit(1) }
const sql = readFileSync(`${dir}/${file}`, 'utf8')
const body = sql.slice(sql.indexOf('create or replace function public.ai_plan_limits()'))
const num = (k: string) => Number(new RegExp(`'${k}',\\s*(\\d+)`).exec(body)?.[1])
const arr = (k: string) => (new RegExp(`'${k}',\\s*jsonb_build_array\\(([^)]*)\\)`).exec(body)?.[1] ?? '')
  .split(',').map(x => x.trim()).map(x => x === 'null' ? null : Number(x))

eq('σειρά βαθμών', PLAN_RANK_ORDER, ['free', 'solo', 'owner', 'agency', 'office'])
eq('ανά λεπτό', num('per_minute'), MAX_PER_MINUTE)
eq('ημέρα ανά βαθμό', arr('day'), dailyLimitsByRank())
eq('μήνας ανά βαθμό', arr('month'), monthlyLimitsByRank())
eq('σάρωση ανά βαθμό', arr('scan'), scanLimitsByRank())
eq('δοκιμή ημέρα', num('trial_day'), TRIAL_LIMITS.perDay)
eq('δοκιμή μήνας', num('trial_month'), TRIAL_LIMITS.perMonth)
eq('δοκιμαστής ημέρα', num('tester_day'), TESTER_LIMITS.perDay)
eq('δοκιμαστής μήνας', num('tester_month'), TESTER_LIMITS.perMonth)
eq('δεξαμενή', num('pool'), FREE_POOL_PER_MONTH)

// Και ο καλών δεν σηκώνει το όριο: κάθε όριο περνά από `least` με του διακομιστή.
const ai = sql.slice(sql.indexOf('create or replace function public.bump_ai_usage'))
eq('bump_ai_usage: ημέρα με least', /v_lday\s*:=\s*least\(v_lday,/.test(ai), true)
eq('bump_ai_usage: μήνας με least', /v_lmon\s*:=\s*least\(v_lmon,/.test(ai), true)
eq('bump_ai_usage: δοκιμή χωρίς όρισμα του καλούντος', /if not v_pay then\s*\n\s*v_lday := least\(v_lday, \(v_lim->>'trial_day'\)/.test(ai), true)

console.log(fail ? `✗ aiLimitsSql: ${fail} απέτυχαν από ${pass + fail}` : `✓ aiLimitsSql: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
