// npx tsx lib/i18n/paths.test.ts
//
// Ο ΧΑΡΤΗΣ ΤΩΝ ΓΛΩΣΣΩΝ: κάθε ζεύγος πηγαίνει και γυρίζει, ο επιλογέας δεν
// οδηγεί ποτέ σε 404 και οι ετικέτες hreflang είναι ίδιες και στις δύο πλευρές.
import { PAGE_PAIRS, enPathFor, elPathFor, pathIn, languageAlternates, localHref } from './paths'
import { isEnPath, localeOfPath, browserLacksGreek, isRecipientPath, recipientLocale } from './locale'
import { SITE } from '@/lib/core/site'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
const eq = (name: string, got: unknown, want: unknown) => ok(`${name} (πήρε ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))

// ── Κάθε ζεύγος: μονοσήμαντο, αγγλικό κάτω από το /en, ελληνικό έξω από αυτό ──
const els = PAGE_PAIRS.map(p => p[0]), ens = PAGE_PAIRS.map(p => p[1])
ok('καμία ελληνική διαδρομή δύο φορές', new Set(els).size === els.length)
ok('καμία αγγλική διαδρομή δύο φορές', new Set(ens).size === ens.length)
for (const [el, en] of PAGE_PAIRS) {
  ok(`${en}: κάτω από το /en`, isEnPath(en))
  ok(`${el}: έξω από το /en`, !isEnPath(el))
  ok(`${en}: πεζά λατινικά με παύλες`, /^\/en(\/[a-z0-9-]+)*$/.test(en))
  eq(`${el} → αγγλικά`, enPathFor(el), en)
  eq(`${en} → ελληνικά`, elPathFor(en), el)
  eq(`${el}: πάει και γυρίζει`, pathIn(pathIn(el, 'en'), 'el'), el)
  const alt = languageAlternates(el)
  ok(`${el}: hreflang ίδιο και από τις δύο πλευρές`, !!alt && JSON.stringify(alt) === JSON.stringify(languageAlternates(en)))
  eq(`${el}: x-default στα ελληνικά`, alt?.['x-default'], alt?.el)
}

// ── Ο επιλογέας ──────────────────────────────────────────────────────────────
eq('αρχική → /en', pathIn('/', 'en'), '/en')
eq('/en → αρχική', pathIn('/en', 'el'), '/')
eq('σελίδα χωρίς ζεύγος → αγγλική αρχική, όχι 404', pathIn('/dashboard', 'en'), '/en')
eq('ίδια γλώσσα → ίδια σελίδα', pathIn('/paketa', 'el'), '/paketa')
eq('τελική κάθετος και ερώτημα δεν μετρούν', pathIn('/paketa/?plan=owner#x', 'en'), '/en/pricing')

// ── Σύνδεσμοι στη γλώσσα της σελίδας ────────────────────────────────────────
eq('el: αυτούσιος', localHref('el', '/paketa?x=1'), '/paketa?x=1')
eq('en: διαδρομή με ερώτημα και άγκυρα', localHref('en', '/paketa?plan=owner#top'), '/en/pricing?plan=owner#top')
eq('en: άγκυρα στη ρίζα', localHref('en', '/#faq'), '/en#faq')
eq('en: χωρίς ζεύγος μένει η ελληνική, όχι 404', localHref('en', '/dashboard'), '/dashboard')

// ── Υπολογιστές και οδηγοί: ζεύγη με ερώτημα ────────────────────────────────
eq('υπολογιστής με ερώτημα', localHref('en', '/ypologismos-stegastikou-daneiou?poso=150000'), '/en/mortgage-calculator?poso=150000')
eq('οδηγός → αγγλικός οδηγός', enPathFor('/odigos/pos-ypologizetai-o-enfia'), '/en/guides/how-enfia-is-calculated')
eq('αγγλικός οδηγός → ελληνικός', elPathFor('/en/guides/net-rental-yield'), '/odigos/kathari-apodosi-akinitou')
eq('σελίδα χωρίς αγγλική μένει ελληνική', localHref('en', '/prothesmies/2026-11'), '/prothesmies/2026-11')
eq('ο οδηγός «Σπίτι μου ΙΙΙ» έχει πια αγγλική σελίδα', localHref('en', '/odigos/spiti-mou-3-ti-allazei'), '/en/guides/spiti-mou-3-greek-home-loan-program')
eq('ο οδηγός Airbnb έχει πια αγγλική σελίδα', localHref('en', '/odigos/airbnb-takk-2026'), '/en/guides/airbnb-tax-greece-2026')
eq('η υπαναχώρηση έχει αγγλική σελίδα', enPathFor('/ypanaxorisi'), '/en/withdrawal')

// ── hreflang ─────────────────────────────────────────────────────────────────
eq('αρχική: απόλυτες διευθύνσεις, χωρίς κάθετο στη ρίζα', languageAlternates('/'), { el: SITE, en: `${SITE}/en`, 'x-default': SITE })
eq('χωρίς ζεύγος, χωρίς hreflang', languageAlternates('/dashboard'), null)

// ── Η γλώσσα βγαίνει από τη διαδρομή ─────────────────────────────────────────
eq('/en', localeOfPath('/en'), 'en')
eq('/en/pricing', localeOfPath('/en/pricing'), 'en')
eq('/energeia δεν είναι αγγλική', localeOfPath('/energeia'), 'el')
eq('κενό', localeOfPath(null), 'el')

// ── Η πρόταση «View in English»: μόνο σε περιηγητή χωρίς ελληνικά ─────────────
ok('en-US: προτείνεται', browserLacksGreek('en-US,en;q=0.9'))
ok('el-GR: όχι', !browserLacksGreek('el-GR,el;q=0.9,en;q=0.8'))
ok('αγγλικά πρώτα, ελληνικά δεύτερα: όχι', !browserLacksGreek('en-US,el;q=0.5'))
ok('χωρίς κεφαλίδα (μηχανή αναζήτησης): όχι', !browserLacksGreek(null) && !browserLacksGreek(''))
ok('μόνο «*»: όχι', !browserLacksGreek('*'))

// ── Οι σελίδες παραλήπτη: ίδια διεύθυνση, γλώσσα από τον άνθρωπο ─────────────
for (const p of ['/portal/abc', '/checkin/abc', '/plirosa/abc', '/unsubscribe/abc', '/epivevaiosi-email/abc', '/verify', '/verify/PO-1', '/offline']) {
  ok(`${p}: σελίδα παραλήπτη`, isRecipientPath(p))
}
for (const p of ['/', '/odigos', '/portal', '/verifyx', '/en/verify', '/dashboard']) ok(`${p}: όχι σελίδα παραλήπτη`, !isRecipientPath(p))
eq('επιλογή en κερδίζει τον περιηγητή', recipientLocale('en', 'el-GR,el;q=0.9'), 'en')
eq('επιλογή el κερδίζει τον περιηγητή', recipientLocale('el', 'en-GB,en;q=0.9'), 'el')
eq('χωρίς επιλογή, περιηγητής χωρίς ελληνικά', recipientLocale(undefined, 'en-GB,en;q=0.9'), 'en')
eq('χωρίς επιλογή, περιηγητής με ελληνικά', recipientLocale(undefined, 'en-GB,el;q=0.5'), 'el')
eq('χωρίς επιλογή και κεφαλίδα', recipientLocale(undefined, null), 'el')
eq('άκυρη τιμή cookie', recipientLocale('de', null), 'el')

console.log(fail === 0 ? `✓ i18n paths: ${pass} έλεγχοι πέρασαν` : `✗ i18n paths: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
