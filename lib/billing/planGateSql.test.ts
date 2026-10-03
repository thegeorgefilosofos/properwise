// npx tsx lib/billing/planGateSql.test.ts
//
// ΤΟ ΛΟΥΚΕΤΟ ΤΟΥ ΠΕΛΑΤΟΛΟΓΙΟΥ ΚΑΙ ΤΗΣ ΟΜΑΔΑΣ ΖΕΙ ΣΕ ΔΥΟ ΜΕΡΗ ΚΑΙ ΠΡΕΠΕΙ ΝΑ
// ΛΕΕΙ ΤΟ ΙΔΙΟ. Η οθόνη κρίνει με το `requiredPlanForTab('clients')` και με το
// `PROFESSIONAL_MIN_PLAN` (lib/billing/entitlements.ts)· η βάση με τις
// πολιτικές `plan_ins_*`/`plan_upd_*` και την πύλη `plan_required` των
// συναρτήσεων της ομάδας (20261003140000). Αν η οθόνη κατεβάσει το
// πελατολόγιο σε «Ιδιοκτήτης+» και η βάση μείνει στο «Επαγγελματίας», ο
// συνδρομητής βλέπει την καρτέλα και κάθε αποθήκευση γυρίζει 42501.
//
// Διαβάζεται η ΤΕΛΕΥΤΑΙΑ μετάβαση που ορίζει κάθε πολιτική ή συνάρτηση, όπως
// στο aiLimitsSql.test.ts: μια επόμενη μετάβαση που θα ξαναγράψει μία από αυτές
// χωρίς την πύλη κοκκινίζει εδώ.
import { readFileSync, readdirSync } from 'node:fs'
import { requiredPlanForTab, requiredPlanForFeature, PROFESSIONAL_MIN_PLAN } from './entitlements'

let pass = 0, fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++; else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
}

const dir = 'supabase/migrations'
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()

/** Η τελευταία μετάβαση που περιέχει το κείμενο, με το περιεχόμενό της. */
function latestWith(text: string): string {
  const file = files.find(f => readFileSync(`${dir}/${f}`, 'utf8').includes(text))
  if (!file) { console.error(`✗ καμία μετάβαση δεν περιέχει «${text}»`); process.exit(1) }
  return readFileSync(`${dir}/${file}`, 'utf8')
}

/** Το σώμα της συνάρτησης όπως το ορίζει η ΤΕΛΕΥΤΑΙΑ μετάβαση που την ορίζει. */
function latestFn(fn: string): string {
  const head = `create or replace function public.${fn}`
  const sql = latestWith(head)
  const from = sql.indexOf(head)
  const end = sql.indexOf('$$;', from)
  return sql.slice(from, end < 0 ? undefined : end + 3)
}

const RANK = `\\(\\(select public\\.my_plan_rank\\(\\)\\) >= public\\.plan_rank\\('(\\w+)'\\)\\)`

/** Το πακέτο που ζητά η πολιτική εισαγωγής του πίνακα, από την τελευταία μετάβαση που την ορίζει. */
function insertPlan(table: string): string | undefined {
  const sql = latestWith(`create policy plan_ins_${table} on public.${table}`)
  const re = new RegExp(
    `create policy plan_ins_${table} on public\\.${table} as restrictive for insert to authenticated\\s+with check ${RANK};`)
  return re.exec(sql)?.[1]
}

/** Το ίδιο για την ενημέρωση: `using` και `with check` πρέπει να συμφωνούν. */
function updatePlan(table: string): string | undefined {
  const sql = latestWith(`create policy plan_upd_${table} on public.${table}`)
  const re = new RegExp(
    `create policy plan_upd_${table} on public\\.${table} as restrictive for update to authenticated\\s+using ${RANK}\\s+with check ${RANK};`)
  const m = re.exec(sql)
  if (!m) return undefined
  return m[1] === m[2] ? m[1] : `using:${m[1]} check:${m[2]}`
}

// ── ΤΟ ΠΕΛΑΤΟΛΟΓΙΟ ─────────────────────────────────────────────────────────
// Η καρτέλα και η δυνατότητα λένε το ίδιο πακέτο· αν ποτέ διαφωνήσουν, ο
// πίνακας /paketa θα υπόσχεται άλλο από αυτό που ανοίγει η καρτέλα.
const CRM = requiredPlanForTab('clients')
eq('καρτέλα και δυνατότητα «Πελατολόγιο»: ίδιο πακέτο', requiredPlanForFeature('clients'), CRM)
for (const t of ['clients', 'client_notes', 'client_documents', 'client_stays']) {
  eq(`${t}: εισαγωγή με το πακέτο της καρτέλας`, insertPlan(t), CRM)
  eq(`${t}: ενημέρωση με το πακέτο της καρτέλας`, updatePlan(t), CRM)
}

// ── Η ΟΜΑΔΑ ────────────────────────────────────────────────────────────────
for (const t of ['organizations', 'organization_members']) {
  eq(`${t}: εισαγωγή με το πακέτο του επαγγελματία`, insertPlan(t), PROFESSIONAL_MIN_PLAN)
  eq(`${t}: ενημέρωση με το πακέτο του επαγγελματία`, updatePlan(t), PROFESSIONAL_MIN_PLAN)
}

// ── ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΠΟΥ ΓΡΑΦΟΥΝ ΓΙΑ ΤΟΝ ΙΔΙΟΚΤΗΤΗ ──────────────────────────
// Η πύλη του πακέτου έρχεται ΜΕΤΑ την πύλη του δεύτερου βήματος (20261003120000)
// και σηκώνει «plan_required» με τον ίδιο κωδικό 42501.
const GATE = new RegExp(
  `if public\\.my_plan_rank\\(\\) < public\\.plan_rank\\('(\\w+)'\\) then\\s*\\n\\s*raise exception 'plan_required' using errcode = '42501';`)
for (const fn of ['clear_org_upgrade_request()', 'invite_org_member(',
                  'rename_organization(']) {
  const body = latestFn(fn)
  const name = fn.replace(/\(.*$/, '')
  eq(`${name}: πύλη πακέτου με το πακέτο του επαγγελματία`, GATE.exec(body)?.[1], PROFESSIONAL_MIN_PLAN)
  eq(`${name}: το δεύτερο βήμα ρωτιέται πρώτο`,
    body.indexOf('mfa_satisfied') > 0 && body.indexOf('mfa_satisfied') < body.search(GATE), true)
}

{
  const body = latestFn('ensure_organization()')
  const gate = body.search(GATE)
  eq('ensure_organization: πύλη πακέτου με το πακέτο του επαγγελματία', GATE.exec(body)?.[1], PROFESSIONAL_MIN_PLAN)
  eq('ensure_organization: η πύλη ζει μέσα στη δημιουργία, όχι πριν από την ανάγνωση',
    gate > body.indexOf('if v_org.id is null then') && body.indexOf('if v_org.id is null then') > 0, true)
}

// ── Η ΑΦΑΙΡΕΣΗ ΠΡΟΣΒΑΣΗΣ ΔΕΝ ΘΕΛΕΙ ΠΑΚΕΤΟ ──────────────────────────────────
// Ο ιδιοκτήτης που σταμάτησε τη συνδρομή βγάζει πάντα έναν πρώην συνεργάτη
// από την ομάδα του. Η `set_member_edit` κλειδώνει μόνο όταν ΔΙΝΕΙ δικαίωμα.
eq('revoke_org_member: χωρίς πύλη πακέτου', /plan_required/.test(latestFn('revoke_org_member(')), false)
eq('revoke_org_member: κρατά το δεύτερο βήμα', /mfa_satisfied/.test(latestFn('revoke_org_member(')), true)
{
  const body = latestFn('set_member_edit(')
  eq('set_member_edit: πύλη μόνο όταν δίνει δικαίωμα',
    /if coalesce\(p_can, false\) and public\.my_plan_rank\(\) < public\.plan_rank\('(\w+)'\) then\s*\n\s*raise exception 'plan_required'/.exec(body)?.[1],
    PROFESSIONAL_MIN_PLAN)
  eq('set_member_edit: το δεύτερο βήμα ρωτιέται πρώτο',
    body.indexOf('mfa_satisfied') > 0 && body.indexOf('mfa_satisfied') < body.indexOf('plan_required'), true)
}

// ── ΟΙ ΣΥΝΑΡΤΗΣΕΙΣ ΤΟΥ ΜΕΛΟΥΣ ΜΕΝΟΥΝ ΑΝΟΙΧΤΕΣ ─────────────────────────────
// Το πακέτο του μέλους δεν κρίνει την ομάδα κάποιου άλλου: η αποδοχή της
// πρόσκλησης τρέχει σε κάθε φόρτωση του πίνακα και το αίτημα για πακέτο δεν
// μπορεί να απαιτεί το πακέτο.
for (const fn of ['accept_org_invites_for_me()', 'request_member_edit()', 'request_org_upgrade()']) {
  eq(`${fn.replace(/\(.*$/, '')}: χωρίς πύλη πακέτου`, /plan_required/.test(latestFn(fn)), false)
}

console.log(fail ? `✗ planGateSql: ${fail} απέτυχαν από ${pass + fail}` : `✓ planGateSql: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
