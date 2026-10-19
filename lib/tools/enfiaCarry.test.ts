// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΦΙΑ ΤΟΥ ΥΠΟΛΟΓΙΣΤΗ ΦΤΑΝΕΙ ΣΤΟ ΠΡΩΤΟ ΑΚΙΝΗΤΟ ΙΔΙΟΣ — ΚΑΙ ΤΙΠΟΤΑ ΑΛΛΟ ΔΕΝ ΦΤΑΝΕΙ
// ─────────────────────────────────────────────────────────────────────────
// Δύο υποσχέσεις κρίνονται εδώ:
//   1. Ο επισκέπτης βλέπει στην Επισκόπηση του νέου ακινήτου ΤΟ ΙΔΙΟ ποσό με
//      αυτό που είδε στον δημόσιο υπολογιστή (ή τίποτα, ποτέ άλλο).
//   2. Η διεύθυνση που γράφει ο καθένας δεν ανοίγει δρόμο προς ξένο τόπο ούτε
//      περνά στον πίνακα κλειδί ή τιμή που δεν είναι του υπολογιστή.
//
// Τρέξε: npx tsx lib/tools/enfiaCarry.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import {
  enfiaInputs, enfiaPublicEstimate, enfiaCarryPath, enfiaSignupHref, readEnfiaCarry,
  enfiaCarrySettings, enfiaCarryWizard, ENFIA_KEYS, ENFIA_ACTION, type EnfiaValues,
} from './enfiaCarry'
import { SPEC } from './enfiaSpec'
import { SPEC as PAGE_SPEC } from '../../app/ypologismos-enfia/spec'
import { continuation } from '../auth/continuation'
import { HOME } from '../auth/redirect'
import { enfiaYear, ENFIA_DEFAULTS } from '../facts/enfia'
import { enfiaFloorKeyFromValue, ENFIA_FLOOR_COEF, ENFIA_AGE_BANDS } from '../billing/enfia'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

const P = (s: string) => new URLSearchParams(s)
const vals = (over: Partial<EnfiaValues> = {}): EnfiaValues => ({ ...SPEC, ...over })
const YEAR = 2026

// ── Η ΣΕΛΙΔΑ ΚΑΙ Η ΣΥΝΕΧΕΙΑ ΔΙΑΒΑΖΟΥΝ ΤΟ ΙΔΙΟ SPEC ─────────────────────────────
ok('η σελίδα και η συνέχεια έχουν το ίδιο SPEC', PAGE_SPEC === SPEC)
ok('τα κλειδιά της συνέχειας είναι τα κλειδιά του SPEC', ENFIA_KEYS.join() === Object.keys(SPEC).join())

// ── Η ΔΙΕΥΘΥΝΣΗ ΠΡΟΣ ΤΑ ΕΞΩ ─────────────────────────────────────────────────
{
  ok('προεπιλογές → μόνο το action', enfiaCarryPath(SPEC) === `${HOME}?action=${ENFIA_ACTION}`)
  const path = enfiaCarryPath(vals({ tm: '120', zoni: '2100', orofos: 'third', palaiotita: 'y10_14' }))
  ok('πάντα ο πίνακας, πάντα σχετική διαδρομή', path.startsWith(`${HOME}?action=${ENFIA_ACTION}&`))
  ok('γράφονται μόνο όσα άλλαξαν', path === `${HOME}?action=enfia&tm=120&zoni=2100&orofos=third&palaiotita=y10_14`)

  // Ό,τι κι αν έγραψε κάποιος στα πεδία, μένει ΤΙΜΗ: δεν γίνεται κλειδί, δεν
  // αλλάζει προορισμό.
  const evil = enfiaCarryPath(vals({ tm: '90&next=//kako.gr#x', zoni: 'javascript:alert(1)' }))
  const back = P(evil.slice(evil.indexOf('?')))
  ok('«&next=» μέσα σε πεδίο δεν γίνεται κλειδί', back.get('next') === null && back.get('tm') === '90&next=//kako.gr#x')
  ok('…και ο προορισμός μένει ο πίνακας', evil.startsWith(`${HOME}?`) && !evil.includes('#'))
  // Ξένα κλειδιά στις τιμές δεν γράφονται.
  const foreign = enfiaCarryPath({ ...SPEC, next: '//kako.gr', plan: 'pro' } as Record<string, string>)
  ok('ξένα κλειδιά δεν γράφονται στη διαδρομή', foreign === `${HOME}?action=enfia`)

  // Ο σύνδεσμος της εγγραφής και η πραγματική συνέχεια (lib/auth/continuation.ts).
  // ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΤΗΣ ΣΕΛΙΔΑΣ ΔΕΝ ΓΙΝΕΤΑΙ ΑΚΙΝΗΤΟ. Με τις προεπιλογές ο οδηγός
  // άνοιγε με 85 τ.μ. και 2ο όροφο που δεν έγραψε κανείς και η Επισκόπηση
  // έδειχνε τον ΕΝΦΙΑ του παραδείγματος σαν εκτίμηση του νέου ακινήτου.
  ok('προεπιλογές → σκέτη εγγραφή, χωρίς συνέχεια', enfiaSignupHref(SPEC) === '/signup')
  ok('…και με τις προεπιλογές γραμμένες ρητά', enfiaSignupHref({ ...SPEC }) === '/signup')
  for (const v of [vals({ tm: '64,5', zoni: '3.200', pososto: '50', voith: '8' }), vals({ tm: '90&next=//kako.gr' }), vals({ orofos: 'third' })]) {
    const href = enfiaSignupHref(v)
    const u = new URL(href, 'https://properwise.gr')
    ok(`ο σύνδεσμος πηγαίνει στην εγγραφή (${href})`, u.pathname === '/signup' && [...u.searchParams.keys()].join() === 'next')
    ok(`η συνέχεια φτάνει ακέραιη στον πίνακα (${href})`, continuation(u.search) === enfiaCarryPath(v))
  }
}

// ── Η ΣΥΝΕΧΕΙΑ ΑΡΝΕΙΤΑΙ ΞΕΝΟ ΤΟΠΟ, ΟΣΟ ΚΙ ΑΝ ΜΟΙΑΖΕΙ ΜΕ ΤΗ ΔΙΚΗ ΜΑΣ ────────────
{
  const tail = '/dashboard?action=enfia&tm=90'
  for (const bad of [
    `//kako.gr${tail}`, `https://kako.gr${tail}`, `http:kako.gr${tail}`, `javascript:alert(1)//${tail}`,
    `JaVaScRiPt:alert(1)`, `/\\kako.gr${tail}`, `/%2F/kako.gr${tail}`, `%2F%2Fkako.gr${tail}`, `/.//kako.gr${tail}`,
    `data:text/html,${tail}`,
  ]) {
    ok(`ξένος τόπος → πίνακας: ${bad}`, continuation(`?next=${encodeURIComponent(bad)}`) === HOME)
  }
  // Και η κωδικοποιημένη μορφή ΜΕΣΑ στη συνέχεια (διπλή κωδικοποίηση).
  ok('διπλή κωδικοποίηση → πίνακας', continuation(`?next=${encodeURIComponent('%2F%2Fkako.gr' + tail)}`) === HOME)
}

// ── Η ΔΙΕΥΘΥΝΣΗ ΠΡΟΣ ΤΑ ΜΕΣΑ: ΜΟΝΟ ΤΑ ΚΛΕΙΔΙΑ ΤΟΥ SPEC, ΜΟΝΟ ΕΓΚΥΡΕΣ ΤΙΜΕΣ ──────
{
  ok('χωρίς πεδία → κανένα φορτίο (το παράδειγμα δεν είναι εκτίμηση)', readEnfiaCarry(P('')) === null)
  ok('…ούτε με κενά ή ξένα κλειδιά μόνο', readEnfiaCarry(P('tm=&zoni=%20&next=%2Fx&plan=pro')) === null)
  const d = readEnfiaCarry(P('tm=85'))
  ok('ένα πεδίο αρκεί, τα υπόλοιπα από τις προεπιλογές', !!d && JSON.stringify(d.values) === JSON.stringify(SPEC))

  const r = readEnfiaCarry(P('tm=120&zoni=2100&orofos=third&palaiotita=y10_14&pososto=50&voith=6'))
  ok('έγκυρα πεδία περνούν', !!r && r.values.tm === '120' && r.inputs.sqm === 120 && r.inputs.zone === '1501_2500' && r.inputs.own === 50 && r.inputs.aux === 6)

  // Ξένα κλειδιά: δεν φτάνουν στο φορτίο, ούτε ακυρώνουν τα δικά μας.
  const f = readEnfiaCarry(P('tm=90&next=//kako.gr&plan=pro&__proto__=x&constructor=y&evil=<script>'))
  ok('ξένα κλειδιά πετιούνται', !!f && Object.keys(f.values).join() === ENFIA_KEYS.join() && f.values.tm === '90')
  ok('…και δεν μολύνουν πρωτότυπο', ({} as Record<string, unknown>).x === undefined && !('evil' in (f?.values ?? {})))

  // Κωδικοποιημένο ΚΛΕΙΔΙ: το URLSearchParams το αποκωδικοποιεί, άρα είναι το ίδιο
  // κλειδί και κρίνεται η τιμή του όπως κάθε άλλη.
  ok('κωδικοποιημένο κλειδί = το ίδιο κλειδί, με έλεγχο τιμής', readEnfiaCarry(P('t%6D=95'))?.inputs.sqm === 95
     && readEnfiaCarry(P('t%6D=%2F%2Fkako.gr')) === null)

  // Άκυρες τιμές ακυρώνουν ΟΛΟ το φορτίο: μισή εκτίμηση είναι άλλη εκτίμηση.
  const BAD: [keyof typeof SPEC, string][] = [
    ['tm', '//kako.gr'], ['tm', 'https://kako.gr'], ['tm', 'javascript:alert(1)'], ['tm', '%2F%2Fkako.gr'],
    ['tm', '-80'], ['tm', '0'], ['tm', '1e9'], ['tm', '9'.repeat(400)], ['tm', '80 τ.μ.'],
    ['zoni', 'abc'], ['zoni', '0'], ['zoni', '-1400'],
    ['orofos', 'constructor'], ['orofos', '__proto__'], ['orofos', 'toString'], ['orofos', 'tenth'], ['orofos', 'SECOND'],
    ['palaiotita', 'toString'], ['palaiotita', '10_20x'], ['palaiotita', '<script>'],
    ['pososto', '150'], ['pososto', '100.01'], ['pososto', '-5'], ['pososto', 'μισό'],
    ['voith', 'x'], ['voith', '-3'],
  ]
  for (const [k, v] of BAD) {
    ok(`άκυρο ${k}=${v} → κανένα φορτίο`, readEnfiaCarry(P(new URLSearchParams({ [k]: v }).toString())) === null)
  }
  // Οι τιμές που ΔΕΧΕΤΑΙ ο υπολογιστής περνούν όλες.
  for (const k of Object.keys(ENFIA_FLOOR_COEF)) ok(`όροφος ${k} περνά`, readEnfiaCarry(P(`orofos=${k}`))?.values.orofos === k)
  for (const b of ENFIA_AGE_BANDS) ok(`παλαιότητα ${b.key} περνά`, readEnfiaCarry(P(`palaiotita=${b.key}`))?.values.palaiotita === b.key)
  ok('ελληνική γραφή ποσού περνά', readEnfiaCarry(P('zoni=1.400&tm=85,5'))?.inputs.price === 1400)
  ok('το άδειο ποσοστό («0» στη διεύθυνση) μετρά ολόκληρο', readEnfiaCarry(P('pososto=0'))?.inputs.own === 100)
}

// ── Ο ΙΔΙΟΣ ΑΡΙΘΜΟΣ: ΥΠΟΛΟΓΙΣΤΗΣ ↔ ΕΠΙΣΚΟΠΗΣΗ ΤΟΥ ΝΕΟΥ ΑΚΙΝΗΤΟΥ ─────────────────
// Η Επισκόπηση γράφει `enfiaYear(ρυθμίσεις, έτος, στοιχεία ακινήτου).annual`
// (app/dashboard/components/OverviewTab.tsx)· οι ρυθμίσεις διαβάζονται με τις
// προεπιλογές από κάτω (useBillsSettings). Εδώ ακριβώς αυτή η διαδρομή.
{
  let compared = 0
  for (const tm of ['38', '85', '120,5', '300'])
    for (const zoni of ['600', '1400', '2600', '3000', '4800', '7000'])
      for (const orofos of Object.keys(ENFIA_FLOOR_COEF))
        for (const palaiotita of ['y0_4', 'y15_19', 'y26_plus', 'pre1930', 'over100'])
          for (const pososto of ['100', '50', '33,33', '0']) {
            const v = vals({ tm, zoni, orofos, palaiotita, pososto })
            const i = enfiaInputs(v)!
            const pub = enfiaPublicEstimate(i)!.annual
            const s = enfiaCarrySettings(i, { sqm: i.sqm, ownership: i.own }, YEAR)
            if (!s) { ok(`γράφεται εκτίμηση για ${JSON.stringify(v)}`, false); continue }
            const dash = enfiaYear({ ...ENFIA_DEFAULTS, ...s }, YEAR, {
              sqm: i.sqm, ownershipPct: i.own, floor: enfiaCarryWizard(i).floor ?? null, postalCode: '10431',
            })
            compared++
            if (dash.annual !== pub) ok(`ίδιος ΕΝΦΙΑ ${JSON.stringify(v)}: υπολογιστής ${pub}, Επισκόπηση ${dash.annual}`, false)
            if (dash.inUse.source !== 'estimate' || dash.estimateFrom !== 'form') ok(`η Επισκόπηση διαβάζει τη φόρμα ${JSON.stringify(v)}`, false)
          }
  ok(`ίδιος ΕΝΦΙΑ σε ${compared} συνδυασμούς`, compared === 4 * 6 * Object.keys(ENFIA_FLOOR_COEF).length * 5 * 4)

  // Το παράδειγμα της σελίδας, με το ποσό του.
  const d = enfiaInputs(SPEC)!
  const s = enfiaCarrySettings(d, { sqm: 85, ownership: 100 }, YEAR)!
  ok('το παράδειγμα της σελίδας φτάνει ίδιο', enfiaYear({ ...ENFIA_DEFAULTS, ...s }, YEAR).annual === enfiaPublicEstimate(d)!.annual)
  ok('οι αξίες γράφονται χωρίς ουρές κινητής υποδιαστολής',
     enfiaCarrySettings(enfiaInputs(vals({ tm: '85', zoni: '1400', pososto: '33,33' }))!, { sqm: 85, ownership: 33.33 }, YEAR)?.enfiaTotalVal === '39662.7')
}

// ── ΠΟΤΕ ΔΕΝ ΓΡΑΦΕΤΑΙ ΤΙΠΟΤΑ ──────────────────────────────────────────────────
{
  const i = enfiaInputs(vals({ tm: '90', zoni: '1800' }))!
  ok('άλλαξε τα τετραγωνικά στον οδηγό → τίποτα', enfiaCarrySettings(i, { sqm: 95, ownership: 100 }, YEAR) === null)
  ok('άλλαξε το ποσοστό στον οδηγό → τίποτα', enfiaCarrySettings(i, { sqm: 90, ownership: 50 }, YEAR) === null)
  ok('έσβησε τα τετραγωνικά → τίποτα', enfiaCarrySettings(i, { sqm: null, ownership: 100 }, YEAR) === null)
  ok('ποσοστό που δεν αποθηκεύτηκε = 100', enfiaCarrySettings(i, { sqm: 90, ownership: null }, YEAR) !== null)
  ok('τετραγωνικά ως κείμενο από τη βάση', enfiaCarrySettings(i, { sqm: '90', ownership: '100' }, YEAR) !== null)
  // Βοηθητικοί χώροι: η φόρμα του πίνακα δεν έχει πεδίο, το ποσό θα έβγαινε μικρότερο.
  const aux = enfiaInputs(vals({ tm: '90', zoni: '1800', voith: '12' }))!
  ok('με βοηθητικούς χώρους → τίποτα (αλλιώς άλλο ποσό)', enfiaCarrySettings(aux, { sqm: 90, ownership: 100 }, YEAR) === null)
  ok('…και πράγματι το ποσό θα διέφερε',
     enfiaYear({ ...ENFIA_DEFAULTS, ...enfiaCarrySettings(i, { sqm: 90, ownership: 100 }, YEAR)! }, YEAR).annual !== enfiaPublicEstimate(aux)!.annual)
}

// ── Ο ΟΔΗΓΟΣ ──────────────────────────────────────────────────────────────────
{
  for (const k of Object.keys(ENFIA_FLOOR_COEF)) {
    const w = enfiaCarryWizard(enfiaInputs(vals({ orofos: k }))!)
    if (w.floor) ok(`ο όροφος του οδηγού ξαναδιαβάζεται στο ίδιο κλειδί (${k} → ${w.floor})`, enfiaFloorKeyFromValue(w.floor) === k)
  }
  ok('«4ος και 5ος» δεν μαντεύεται', enfiaCarryWizard(enfiaInputs(vals({ orofos: 'fourth' }))!).floor === undefined)
  ok('«6ος και άνω» δεν μαντεύεται', enfiaCarryWizard(enfiaInputs(vals({ orofos: 'fifth_plus' }))!).floor === undefined)
  const w = enfiaCarryWizard(enfiaInputs(vals({ tm: '72,5', pososto: '50', voith: '9' }))!)
  ok('τετραγωνικά, ποσοστό και αποθήκη περνούν', w.sqm === '72.5' && w.ownership === '50' && w.storageSqm === '9')
  ok('χωρίς βοηθητικούς δεν γράφεται αποθήκη', enfiaCarryWizard(enfiaInputs(SPEC)!).storageSqm === undefined)
}

console.log(`\nlib/tools/enfiaCarry.test.ts: ${passed} passed, ${failed} failed`)
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1) }
