// Τρέξε: npx tsx supabase/functions/_shared/emailCopy/truth.test.ts
//
// ΤΑ EMAIL ΛΕΝΕ ΜΟΝΟ Ο,ΤΙ ΙΣΧΥΕΙ (έλεγχος 10/11/2026).
//   1. Στον ενοικιαστή δεν φεύγει τίποτα: δεν υπάρχει κείμενο `tenant_welcome`
//      και η τελευταία lifecycle_enqueue δεν το βάζει στην ουρά.
//   2. Η αναβάθμιση δεν πουλά ως πληρωμένα όσα έχει ο «Ιδιοκτήτης» χωρίς
//      συνδρομή (`rent_collection: 'free'`: υπενθυμίσεις, αναφορές PDF).
//   3. Η λήξη μίσθωσης ελέγχει τον ενοικιαστή όπως τον γράφει η εφαρμογή:
//      status 'past' και move_out_date (lib/data/tenants.ts).
import { readFileSync, readdirSync } from 'node:fs'
import { UPSELL } from './upsell.ts'
import { RELATIONSHIP } from './relationship.ts'
import { PACKAGE_MAX_PROPERTIES, PACKAGE_NAME, planUpgradedEmail, type PackageId } from '../emailTemplates.ts'
import { FEATURE_MIN_PLAN } from '../../../../lib/billing/entitlements.ts'

let passed = 0, failed = 0
function ok(name: string, cond: boolean, got?: unknown) {
  if (cond) passed++; else { failed++; console.log(`  ✗ ${name}${got === undefined ? '' : `\n     πήρε ${JSON.stringify(got)}`}`) }
}
// ΤΟ ΟΡΑΤΟ ΚΕΙΜΕΝΟ ΧΩΡΙΣ «ΚΑΘΑΡΙΣΜΑ» ΜΕ REGEX. Ενα `.replace(/<[^>]+>/g, '')`
// είναι ελλιπής απολύμανση (CodeQL js/incomplete-multi-character-sanitization).
// Εδώ δεν απολυμαίνεται τίποτα: διαβάζεται χαρακτήρας χαρακτήρας και ό,τι είναι
// ανάμεσα σε `<` και `>` απλώς δεν κρατιέται. Η έξοδος χρησιμοποιείται μόνο για
// σύγκριση μέσα στη δοκιμή, ποτέ ως HTML.
function visible(html: string): string {
  let out = '', inTag = false
  for (const ch of html) {
    if (ch === '<') { inTag = true; out += ' '; continue }
    if (ch === '>' && inTag) { inTag = false; continue }
    if (!inTag) out += ch
  }
  return out.split(/\s+/).filter(Boolean).join(' ')
}
const text = (r: unknown) => visible((r as { html: string }).html)

// 1. Ενοικιαστής
ok('κανένα κείμενο tenant_welcome', !('tenant_welcome' in RELATIONSHIP))
const mig = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()
const lastEnqueue = [...mig].reverse().find(f => /create or replace function public\.lifecycle_enqueue\(\)/.test(readFileSync(`supabase/migrations/${f}`, 'utf8')))!
const body = readFileSync(`supabase/migrations/${lastEnqueue}`, 'utf8')
const fn = body.slice(body.indexOf('create or replace function public.lifecycle_enqueue()'), body.indexOf('$$;'))
ok('η τελευταία lifecycle_enqueue δεν βάζει tenant_welcome', !/select 'tenant_welcome'/.test(fn), lastEnqueue)
ok('η τελευταία lifecycle_enqueue δεν διαβάζει tenants.email', !/t\.email/.test(fn), lastEnqueue)

// 3. Λήξη μίσθωσης
ok('η λήξη μίσθωσης εξαιρεί status past', /coalesce\(t\.status, ''\) <> 'past'/.test(fn))
ok('η λήξη μίσθωσης εξαιρεί όποιον έφυγε', /t\.move_out_date is null/.test(fn))
ok('κανένα παλιό λεξιλόγιο ended/moved_out', !/'moved_out'/.test(fn))

// 2. Αναβάθμιση
ok('οι υπενθυμίσεις είναι χωρίς συνδρομή (προϋπόθεση του ελέγχου)', FEATURE_MIN_PLAN.rent_collection === 'free')
const ctx = { name: 'Νίκος', appUrl: 'https://properwise.gr', properties: 2, trialDaysLeft: 14 }
for (const id of ['upsell_to_individual', 'winback_downgrade', 'trial_started'] as const) {
  const t = text(UPSELL[id](ctx as never))
  ok(`${id}: δεν πουλά «αυτόματες υπενθυμίσεις»`, !/αυτόματες υπενθυμίσεις/i.test(t), t)
  ok(`${id}: δεν πουλά «επίσημες αναφορές»`, !/επίσημες αναφορές/i.test(t), t)
  ok(`${id}: δεν πουλά «απεριόριστες καταστάσεις»`, !/απεριόριστες καταστάσεις/i.test(t), t)
}
const up = text(UPSELL.upsell_to_individual(ctx as never))
ok('upsell: λέει το όριο ακινήτων από τη σταθερά', up.includes(`έως ${PACKAGE_MAX_PROPERTIES.owner} σε αυτό το πακέτο`), up)
ok('upsell: λέει ότι τα βασικά μένουν χωρίς συνδρομή', up.includes('μένουν όπως τις έχεις, χωρίς συνδρομή'), up)
ok('upsell: δεν λέει «Έως N ακίνητα» σαν να είναι κέρδος για όποιον έχει περισσότερα', !/Έως \d+ ακίνητα/.test(up), up)

const down = text(UPSELL.winback_downgrade(ctx as never))
ok('winback_downgrade: δεν υποθέτει ότι το νέο πακέτο δεν έχει Νόα', !/Νόα/.test(down), down)

// ── ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ ΑΝΑΒΑΘΜΙΣΗΣ ΔΕΝ ΞΑΝΑΠΟΥΛΑ ΟΣΑ ΕΙΝΑΙ ΧΩΡΙΣ ΣΥΝΔΡΟΜΗ ──────
// Οι υπενθυμίσεις, οι καταστάσεις, οι βεβαιώσεις και τα PDF με QR είναι
// `rent_collection: 'free'`. Ελέγχονται: (α) οι κουκκίδες «τι προσθέτει», που
// ΔΕΝ πρέπει να τα αναφέρουν καθόλου. (β) όλο το κείμενο για φράσεις
// πώλησης. Ενα νέο κείμενο στο UPSELL μπαίνει αυτόματα στον έλεγχο.
const FREE_THING = /PDF|QR|υπενθυμίσ|καταστάσ|βεβαιώσ/i
const SELLS_FREE = /αυτόματες υπενθυμίσεις|επίσημες αναφορές|απεριόριστες καταστάσεις|έρχονται[^.]*(υπενθυμίσ|αναφορές PDF|καταστάσ)/i
// Κάθε κουκκίδα ζει σε <td class="tx"> (emailTemplates.ts, `bullets`).
const bulletsOf = (html: string) => html.split('<td class="tx"').slice(1).map(cell => visible(cell.slice(cell.indexOf('>') + 1, cell.indexOf('</td>'))))
const full = { ...ctx, collected: 1200, discountPct: 20, offerCode: 'X', offerExpires: '30/11/2026', plan: 'individual' }
const sources: Array<[string, { html: string } | null]> = [
  ...Object.entries(UPSELL).map(([id, fn]) => [id, fn(full as never)] as [string, { html: string } | null]),
  ...(Object.keys(PACKAGE_NAME) as PackageId[]).map(pkg => [`planUpgradedEmail(${pkg})`, planUpgradedEmail({ ...full, plan: pkg } as never)] as [string, { html: string } | null]),
]
ok('ο έλεγχος βλέπει όλα τα κείμενα αναβάθμισης', sources.filter(([, r]) => r).length >= Object.keys(UPSELL).length, sources.length)
for (const [id, r] of sources) {
  if (!r) continue
  const sold = bulletsOf(r.html).filter(b => FREE_THING.test(b))
  ok(`${id}: οι κουκκίδες «τι προσθέτει» δεν πουλούν PDF, υπενθυμίσεις ή καταστάσεις`, sold.length === 0, sold)
  ok(`${id}: καμία φράση που πουλά τα χωρίς συνδρομή`, !SELLS_FREE.test(text(r)), text(r).match(SELLS_FREE)?.[0])
}

console.log(failed ? `✗ emailCopy αλήθεια: ${failed} απέτυχαν από ${passed + failed}` : `✓ emailCopy αλήθεια: ${passed} έλεγχοι πέρασαν`)
if (failed) process.exit(1)
