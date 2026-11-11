// npx tsx lib/inbound/priority.test.ts
//
// Η «Προτεραιότητα στο email» των Όρων, χωρίς να πλαστογραφείται και η
// ταξινόμηση των απαντήσεων του παρόχου που αποφασίζει τι γίνεται μετά.
import { readFileSync } from 'node:fs'
import {
  supportPriority, forwardSubject, forwardSupport, forwardKey, classifyResend,
  PRIORITY_FROM, FORWARD_ENV, OWN_DOMAIN_REASON, type ForwardResult,
} from './priority'
import { PLANS, PLAN_ORDER, PRIORITY_SUPPORT_LINE, firstPlanWith } from '../billing/plans'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error(`✗ ${name}`) } }
const kind = (r: ForwardResult) => r.ok ? 'sent' : `${r.kind}${r.uncertain ? '?' : ''}`

ok('η υποψία ξεκινά από το πακέτο του τιμοκαταλόγου', PRIORITY_FROM === firstPlanWith(PRIORITY_SUPPORT_LINE))
for (const [i, p] of PLAN_ORDER.entries()) {
  const want = i >= PLAN_ORDER.indexOf(PRIORITY_FROM)
  ok(`${p}: υποψία ${want}`, supportPriority(i).claimed === want && supportPriority(i).plan === p)
}
ok('η δοκιμή (επίπεδο «Ιδιοκτήτης+») δεν παίρνει προτεραιότητα υποστήριξης', !supportPriority(PLAN_ORDER.indexOf('owner')).claimed)
ok('άγνωστο ή άκυρο επίπεδο: όχι', !supportPriority(null).claimed && !supportPriority(-1).claimed && !supportPriority(99).claimed)

const top = supportPriority(PLAN_ORDER.indexOf(PRIORITY_FROM))
ok('email από έξω: «πιθανή, μη επαληθευμένη», ποτέ σκέτο «Προτεραιότητα»',
  forwardSubject('Βοήθεια', top) === `[Πιθανή προτεραιότητα, μη επαληθευμένη · ${PLANS[PRIORITY_FROM].name}] Βοήθεια`)
ok('φόρμα (επαληθευμένος): σκέτη «Προτεραιότητα»', forwardSubject('Βοήθεια', top, true) === `[Προτεραιότητα · ${PLANS[PRIORITY_FROM].name}] Βοήθεια`)
ok('χωρίς το πακέτο: καμία σήμανση', forwardSubject('Βοήθεια', supportPriority(0), true) === 'Βοήθεια')
ok('κενό θέμα', forwardSubject('  ', supportPriority(0)) === '(χωρίς θέμα)')
ok('το θέμα δεν κουβαλά αλλαγή γραμμής', !/[\r\n]/.test(forwardSubject('α\r\nBcc: x@y', top)))

// ── Χ1/Χ3: η ταξινόμηση των απαντήσεων ──────────────────────────────────────
const j = (name: string, message = '') => JSON.stringify({ name, message })
ok('2xx: έφυγε', kind(classifyResend(200, '{}')) === 'sent')
ok('401, 403: λάθος ρύθμισης', kind(classifyResend(401, '')) === 'config' && kind(classifyResend(403, '')) === 'config')
ok('422 για domain ή sender: λάθος ρύθμισης', kind(classifyResend(422, j('validation_error', 'The gmail.com domain is not verified'))) === 'config'
  && kind(classifyResend(422, j('invalid_from_address', 'Invalid `from` field'))) === 'config')
ok('422 για το ίδιο το μήνυμα: πρόβλημα μηνύματος', kind(classifyResend(422, j('validation_error', 'Invalid `to` field'))) === 'message')
ok('400, 404, 413: πρόβλημα μηνύματος', ['400', '404', '413'].every(s => kind(classifyResend(Number(s), '')) === 'message'))
ok('429: ξανά, σίγουρα δεν έφυγε', kind(classifyResend(429, '')) === 'retry')
ok('5xx: ξανά, ίσως έφυγε', kind(classifyResend(503, '')) === 'retry?')
ok('409 concurrent: ξανά με το ίδιο κλειδί', kind(classifyResend(409, j('concurrent_idempotent_requests'))) === 'retry?')
ok('409 invalid_idempotent_request: ΟΧΙ επιτυχία', kind(classifyResend(409, j('invalid_idempotent_request'))) === 'message?')
ok('μη JSON σώμα δεν σπάει την κρίση', kind(classifyResend(500, '<html>')) === 'retry?')
ok('κλειδί με γενιά', forwardKey('em_1') === 'support-forward/em_1/0' && forwardKey('em_1', 2) === 'support-forward/em_1/2')

type Sent = { headers: Record<string, string>; body: Record<string, unknown> }
let sent: Sent | null = null
const answer = (status: number, text = '{}') => (async (_u: string, init: RequestInit) => {
  sent = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) }
  return new Response(text, { status })
}) as unknown as typeof fetch
const base = {
  to: 'inbox@example.test', apiKey: 'k', key: forwardKey('em_1', 3),
  replyTo: 'Πελάτης <p@example.test>', subject: '[Πιθανή …] Θέμα', body: { text: 'κείμενο', html: null },
}

;(async () => {
  const r = await forwardSupport(base, answer(200))
  const s = sent as Sent | null
  ok('Χ3: στέλνει ΑΚΡΙΒΩΣ το reply_to, το θέμα και το κλειδί που δόθηκαν', r.ok && s?.body.reply_to === base.replyTo
    && s?.body.subject === base.subject && s?.headers['Idempotency-Key'] === 'support-forward/em_1/3')
  ok('χωρίς σπουδαιότητα 1 όταν δεν είναι εγγυημένη', !('headers' in (s?.body ?? {})))
  await forwardSupport({ ...base, urgent: true }, answer(200))
  ok('σπουδαιότητα 1 μόνο για εγγυημένη προτεραιότητα', ((sent as Sent | null)?.body.headers as Record<string, string> | undefined)?.['X-Priority'] === '1')
  ok('409 invalid_idempotent_request από τον πάροχο: όχι επιτυχία', !(await forwardSupport(base, answer(409, j('invalid_idempotent_request')))).ok)
  const rn = await forwardSupport(base, (async () => { throw new Error('x') }) as unknown as typeof fetch)
  ok('δίκτυο: ξανά, ίσως έφυγε', kind(rn) === 'retry?')
  ok('κενή ρύθμιση: λάθος ρύθμισης', kind(await forwardSupport({ ...base, to: '' }, answer(200))) === 'config'
    && kind(await forwardSupport({ ...base, apiKey: '' }, answer(200))) === 'config')
  const loop = await forwardSupport({ ...base, to: 'support@properwise.gr' }, answer(200), ['properwise.gr'])
  ok('δικός μας τομέας: λάθος ρύθμισης με εξήγηση για τον βρόχο', !loop.ok && loop.kind === 'config' && loop.reason === OWN_DOMAIN_REASON
    && /βρόχος/.test(OWN_DOMAIN_REASON) && /docs\/ops\/inbound-email\.md/.test(OWN_DOMAIN_REASON))
  ok('η τεκμηρίωση εξηγεί το SUPPORT_FORWARD_TO', /SUPPORT_FORWARD_TO[\s\S]*εξωτερικό inbox[\s\S]*βρόχος/.test(readFileSync('docs/ops/inbound-email.md', 'utf8')))

  // ── Χ2: η διαδρομή του inbound ────────────────────────────────────────────
  const route = readFileSync('app/api/inbound/route.ts', 'utf8')
  const branch = route.slice(route.indexOf('if (!token) {'), route.indexOf('const { row: box'))
  ok('η γραμμή γράφεται με το ακριβές θέμα και reply_to, πριν από κάθε προσπάθεια',
    branch.includes('forward_subject: forwardSubject(event.subject, priority), reply_to: event.from')
    && branch.indexOf("from('support_inbox').upsert") < branch.indexOf("rpc('support_forward_claim'"))
  ok('αποτυχία εγγραφής της γραμμής: 5xx', /if \(inboxError\) \{[\s\S]*?status: 500 \}\);/.test(branch))
  ok('αποτυχία δέσμευσης: 5xx', /if \(claimError\) \{[\s\S]*?status: 500 \}\);/.test(branch))
  ok('αποτυχία σημείωσης του αποτελέσματος: 5xx', /\} catch \{[\s\S]*?'support forward settle failed'[\s\S]*?status: 500 \}\);/.test(branch))
  ok('δέσμευση της ίδιας γραμμής πριν από την προσπάθεια', branch.includes("rpc('support_forward_claim', { p_limit: 1, p_provider_id: event.emailId })"))
  ok('η προσπάθεια περνά από την κοινή ρουτίνα', branch.includes('await forwardOne(rows[0], forwardDeps(db))') && !branch.includes('forwardSupport('))
  ok('ειδοποίηση με κωδικό για λάθος ρύθμισης και οριστική αποτυχία', branch.includes("{ status: 200, code: result.code }"))
  ok('η επιβεβαίωση δεν υπόσχεται προτεραιότητα', /handleReplyAck\(db, event\.from, process\.env\[KEY_ENV\], \{ kind \}\)/.test(branch)
    && !readFileSync('lib/email/ack.ts', 'utf8').includes('προτεραιότητα'))
  ok(`το ${FORWARD_ENV} διαβάζεται σε ένα σημείο`, readFileSync('lib/support/forwardDeps.ts', 'utf8').includes('to: process.env[FORWARD_ENV]'))

  console.log(`inbound/priority: ${pass} ✓ · ${fail} ✗`)
  if (fail) process.exit(1)
})()
