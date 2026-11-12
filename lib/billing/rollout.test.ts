// npx tsx lib/billing/rollout.test.ts
//
// Η ΣΕΙΡΑ ΔΙΑΘΕΣΗΣ ΤΩΝ ΟΡΩΝ, ΜΕ ΑΡΙΘΜΟΥΣ. Ελέγχει ότι το μητρώο ανοίγει πρώτα
// το «Επαγγελματίας+», μετά τα πακέτα από FEATURE_MIN_PLAN.early_access και
// EARLY_ACCESS_DAYS αργότερα όλους· ότι η δοκιμή παίρνει τη σειρά του
// «Ιδιοκτήτης+», όπως λένε οι Όροι· ότι η βάση μετρά τις ίδιες ημέρες και τα
// ίδια πακέτα· και ότι η Νόα και η κάρτα λένε μόνο ό,τι κάνει ο κώδικας.
import { readFileSync, readdirSync } from 'node:fs'
import { stagedRelease, isAvailable, openEarlyFor, hasEarlyAccess, FIRST_IN_LINE, OFFICE_LEAD_DAYS, ROLLOUT } from './rollout'
import { EARLY_ACCESS_DAYS, FEATURE_MIN_PLAN, effectivePlan, planAtLeast } from './entitlements'
import { PLAN_ORDER } from './plans'

let pass = 0, fail = 0
/** Μια παρεμβολή όπως γράφεται στον κώδικα, ως κείμενο προς αναζήτηση. */
const src = (expr: string) => '$' + '{' + expr + '}'
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error(`✗ ${name}`) } }
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

const r = stagedRelease('2027-03-01')
ok('όλοι ανοίγουν την ημερομηνία που δόθηκε', r.free === '2027-03-01' && r.solo === '2027-03-01')
ok('το πρώτο της σειράς είναι το ανώτερο πακέτο', FIRST_IN_LINE === 'office')
for (const p of PLAN_ORDER) {
  if (p === FIRST_IN_LINE) continue
  if (planAtLeast(p, FEATURE_MIN_PLAN.early_access)) ok(`${p}: EARLY_ACCESS_DAYS νωρίτερα`, days(r[p], '2027-03-01') === EARLY_ACCESS_DAYS)
}
ok('Επαγγελματίας+ πρώτο, πριν από τα άλλα πακέτα προτεραιότητας', days(r.office, r.owner) === OFFICE_LEAD_DAYS && r.office < r.agency)
ok('καμία προτεραιότητα κάτω από το early_access', !hasEarlyAccess('solo') && !hasEarlyAccess('free') && hasEarlyAccess('owner'))

// Δοκιμαστική εγγραφή στο μητρώο, μόνο για τη λογική των ημερομηνιών.
const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
ROLLOUT.__test = { label: 'δοκιμή', opens: '2027-03-01' }
ok('office ανοίγει πρώτο', isAvailable('__test', 'office', day(r.office)) && !isAvailable('__test', 'agency', day(r.office)))
ok('owner πριν από free', isAvailable('__test', 'owner', day(r.owner)) && !isAvailable('__test', 'free', day(r.owner)))
ok('free την ημέρα όλων', isAvailable('__test', 'free', day('2027-03-01')) && !isAvailable('__test', 'free', day('2027-02-28')))
ok('η Νόα μαθαίνει τι έχει ήδη το πακέτο', openEarlyFor('owner', day(r.owner)).includes('δοκιμή') && openEarlyFor('owner', day('2027-03-01')).length === 0)
delete ROLLOUT.__test
ok('άγνωστη δυνατότητα: κλειστή', !isAvailable('δεν-υπάρχει', 'office'))

// ── Η ΔΟΚΙΜΗ ΠΑΙΡΝΕΙ ΤΗ ΣΕΙΡΑ ΤΟΥ «ΙΔΙΟΚΤΗΤΗΣ+» (Όροι, plans.ts) ────────────
const now = Date.parse('2026-11-10T10:00:00Z')
const fresh = { plan: 'free', createdAt: '2026-11-01T00:00:00Z', now }
ok('η δοκιμή έχει πρόωρη πρόσβαση στο επίπεδο του «Ιδιοκτήτης+»', effectivePlan(fresh) === 'owner' && hasEarlyAccess(effectivePlan(fresh)))
ok('η δοκιμή δεν είναι πρώτη στη σειρά', effectivePlan(fresh) !== FIRST_IN_LINE)
ok('ο Συνεργάτης έχει προτεραιότητα', hasEarlyAccess(effectivePlan({ plan: 'free', partner: true, now })))
const page = readFileSync('app/dashboard/page.tsx', 'utf8')
ok('η οθόνη δίνει το ενεργό πακέτο, με τη δοκιμή', page.includes('releaseFrom={effPlan}'))

// ── Η ΒΑΣΗ ΜΕΤΡΑ ΤΑ ΙΔΙΑ ────────────────────────────────────────────────────
const dir = 'supabase/migrations'
const sqlFiles = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse().map(f => readFileSync(`${dir}/${f}`, 'utf8'))
const latest = (head: string) => sqlFiles.find(s => s.includes(head)) ?? ''
const sqlConst = (fn: string) => Number(new RegExp(`function public\\.${fn}\\(\\)[\\s\\S]*?as \\$\\$ select (\\d+) \\$\\$`).exec(latest(`create or replace function public.${fn}()`))?.[1])
ok(`η βάση μετρά ${EARLY_ACCESS_DAYS} ημέρες (early_access_days)`, sqlConst('early_access_days') === EARLY_ACCESS_DAYS)
ok(`η βάση μετρά ${OFFICE_LEAD_DAYS} ημέρα προβάδισμα (office_lead_days)`, sqlConst('office_lead_days') === OFFICE_LEAD_DAYS)
const claim = /function public\.mobile_launch_claim[\s\S]*?\n\$\$;/.exec(latest('create or replace function public.mobile_launch_claim'))?.[0] ?? ''
ok('τα κύματα κρίνουν με την user_plan_rank (με τη δοκιμή)', claim.includes('public.user_plan_rank(w.user_id)') && !claim.includes('user_release_rank'))
ok(`το πρώτο κύμα είναι το «${FIRST_IN_LINE}»`, claim.includes(`p_wave = 'first' then\n    v_min := public.plan_rank('${FIRST_IN_LINE}')`))
ok(`το δεύτερο κύμα ξεκινά από το early_access («${FEATURE_MIN_PLAN.early_access}»), office_lead_days() μετά`,
  claim.includes(`v_min := public.plan_rank('${FEATURE_MIN_PLAN.early_access}'); v_prev := 'first'; v_gap := public.office_lead_days();`))
ok('το τρίτο κύμα, early_access_days() μετά το δεύτερο', claim.includes(`v_prev := 'priority'; v_gap := public.early_access_days();`))
ok('οι γραμμές δεσμεύονται πριν από την αποστολή', claim.includes('for update of w skip locked') && claim.includes('notifying_at = now()'))

const edge = readFileSync('supabase/functions/notify-mobile-launch/index.ts', 'utf8')
ok('η αποστολή περνά από τη δέσμευση και τη σημείωση της βάσης', edge.includes("rpc('mobile_launch_claim'") && edge.includes("rpc('mobile_launch_settle'") && !edge.includes(".from('mobile_waitlist')"))
ok('Χ4: μόνο 401, 403 και 422 για αποστολέα ή τομέα σταματούν το κύμα, χωρίς failed_at, done:false',
  edge.includes('if (res.status === 401 || res.status === 403) return { kind: \'config\', status: res.status }')
  && edge.includes("if (res.status === 422 && SENDER_PROBLEM.test(why)) return { kind: 'config', status: res.status }")
  && edge.includes("if (out.kind === 'config') { stop = out.status; release.push(id); continue }")
  && edge.includes('p_release: release') && /error: 'resend_config'[^\n]*done: false/.test(edge))
ok('Χ4: κάθε άλλο 4xx (και 422 για τη διεύθυνση) χρεώνεται στον παραλήπτη και το κύμα συνεχίζει',
  /if \(res\.status === 422 && SENDER_PROBLEM[^\n]*\n\s*return \{ kind: 'failed' \}/.test(edge) && !edge.includes('ADDRESS_PROBLEM'))
const joinFn = /function public\.join_mobile_waitlist\(\)[\s\S]*?end; \$\$;/.exec(latest('create or replace function public.join_mobile_waitlist()'))?.[0] ?? ''
ok('όποιος ξαναμπαίνει στη λίστα ξεκινά χωρίς παλιές αποτυχίες', /failed_at = null, fail_count = 0, notifying_at = null/.test(joinFn))
ok('μία αποστολή ανά παραλήπτη (Idempotency-Key)', edge.includes("'Idempotency-Key': `mobile-launch/" + src('userId') + "`"))
ok('χωρίς κύμα: μόνο το πρώτο', /let wave: [^=]+= 'first'/.test(edge))

// ── Η ΝΟΑ ΚΑΙ Η ΚΑΡΤΑ ΛΕΝΕ ΜΟΝΟ Ο,ΤΙ ΚΑΝΕΙ Ο ΚΩΔΙΚΑΣ ──────────────────────────
// Κάθε αριθμός έρχεται από ${…}· ψηφίο έξω από αυτό σημαίνει ότι κάποιος έγραψε «15».
const persona = readFileSync('app/dashboard/components/assistantPersona.ts', 'utf8').split('\n')
const rolloutLines = persona.filter(l => /• (ΕΦΑΡΜΟΓΗ ΚΙΝΗΤΟΥ|ΠΡΟΩΡΗ ΠΡΟΣΒΑΣΗ ΚΑΙ ΥΠΟΣΤΗΡΙΞΗ):/.test(l))
ok('η Νόα έχει τις δύο γραμμές της σειράς διάθεσης', rolloutLines.length === 2)
for (const l of rolloutLines) {
  const bare = l.replace(/\$\{[^}]*\}/g, '')
  ok(`Νόα: κανένας αριθμός με το χέρι («${l.trim().slice(2, 30)}…»)`, !/\d/.test(bare) && l.includes(src('EARLY_ACCESS_DAYS')))
  ok(`Νόα: καμία δήλωση για τη δοκιμή εκτός billingWords («${l.trim().slice(2, 30)}…»)`, !/δοκιμ/i.test(l))
}
const both = rolloutLines.join(' ')
ok('Νόα: η σειρά και η υποστήριξη λέγονται', both.includes(src('PLANS[FIRST_IN_LINE].name')) && both.includes(src('OFFICE_LEAD_TEXT'))
  && both.includes('Μην υποσχεθείς ποτέ χρόνο απάντησης'))
ok('Νόα: η εφαρμογή κινητού θα ανοίξει πρώτα για…, χωρίς ημερομηνία', both.includes('η εφαρμογή κινητού θα ανοίξει πρώτα για') && both.includes('μην πεις ποτέ ημερομηνία'))
ok('Νόα: η εγγυημένη προτεραιότητα περνά από τη φόρμα, ο πιο γρήγορος και σίγουρος δρόμος',
  both.includes('εγγυημένη για τα μηνύματα από τη φόρμα «Υποστήριξη»') && both.includes('Ο πιο γρήγορος και σίγουρος δρόμος είναι αυτή η φόρμα'))
ok('Νόα: δεν λέει ότι το email «δεν παίρνει» προτεραιότητα', !/δεν (παίρνουν|παίρνει|έχουν|έχει) προτεραιότητα|δεν επαληθεύονται/.test(both))
ok('Νόα: καμία υπόσχεση μηχανισμού της εφαρμογής που δεν υπάρχει', !/εφαρμογή ελέγχει|ελέγχει το πακέτο/.test(both))
const roadmap = readFileSync('app/dashboard/components/SettingsRoadmap.tsx', 'utf8')
ok('η κάρτα: θα ανοίξει πρώτα για…, χωρίς ημερομηνία', roadmap.includes('Θα ανοίξει πρώτα για το') && !/\d{1,2}\/\d{1,2}\/\d{4}/.test(roadmap))

// ── Η ΕΦΑΡΜΟΓΗ ΚΙΝΗΤΟΥ ΚΛΕΙΔΩΝΕΤΑΙ ΣΤΟΝ SERVER ────────────────────────────
ok('το μητρώο: το mobile_app έχει πύλη την mobile_access, σε εκκρεμότητα ώσπου να την καλεί κώδικας',
  ROLLOUT.mobile_app?.gate === 'mobile_access' && ROLLOUT.mobile_app.opens === null && ROLLOUT.mobile_app.pending === true)
ok('οθόνες: η εκκρεμής εγγραφή δεν δείχνεται ως ενεργή', !isAvailable('mobile_app', 'office') && !roadmap.includes("isAvailable('mobile_app'"))
const access = /function public\.mobile_access\(\)[\s\S]*?\n\$\$;/.exec(latest('create or replace function public.mobile_access()'))?.[0] ?? ''
ok('η mobile_access κρίνει με τη συνεδρία και τα κύματα της βάσης',
  access.includes('v_uid uuid := auth.uid();') && access.includes('public.user_plan_rank(v_uid)') && access.includes('from release_waves rw'))
ok('η mobile_access βάζει τα ίδια πακέτα στα ίδια κύματα',
  access.includes(`v_rank >= public.plan_rank('${FIRST_IN_LINE}') then\n    v_wave := 'first'`)
  && access.includes(`v_rank >= public.plan_rank('${FEATURE_MIN_PLAN.early_access}') then\n    v_wave := 'priority'`))
ok('πριν ανοίξει: η νωρίτερη μέρα, ή null', access.includes("'opens_at', case when v_prev_started is null then null"))

console.log(`rollout: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
