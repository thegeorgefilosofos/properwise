// npx tsx lib/seo/organization.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΜΙΑ ΟΝΤΟΤΗΤΑ, ΟΙ ΓΡΑΦΕΣ ΤΗΣ ΚΑΙ ΟΧΙ ΤΑ ΛΑΘΗ ΤΗΣ
// ─────────────────────────────────────────────────────────────────────────
// (α) Τα εναλλακτικά ονόματα είναι γραφές του PROPERWISE, όχι λάθη
// πληκτρολόγησης: λίστα λαθών μέσα στο σχήμα είναι keyword stuffing.
// (β) Ο ιστότοπος και ο οργανισμός δηλώνουν τις ίδιες γραφές.
// (γ) Η εφαρμογή έχει ένα `@id` και μία διεύθυνση, από όποια γλώσσα κι αν
// δηλωθεί· η αρχική και το /en έγραφαν δύο εφαρμογές χωρίς `@id`.
// (δ) Η πρόταση ταυτότητας δεν γράφει αριθμό στο χέρι και δεν υπόσχεται έδρα
// που δεν έχει δημοσιευθεί.
// ═══════════════════════════════════════════════════════════════════════════
import { APP_ID, BRAND_ABOUT, BRAND_ALT_NAMES, ORG_REF, WEBSITE_ID, appNode, organizationNode, websiteNode } from './organization'
import { ORG_ID, SITE } from '../core/site'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }

// (α)
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '')
for (const n of BRAND_ALT_NAMES) {
  const latin = /^[A-Za-z ]+$/.test(n)
  ok(`«${n}»: λατινική γραφή του properwise ή ελληνική γραφή`, latin ? squash(n) === 'properwise' : /^Προπερ(γ)?ουάιζ$/.test(n))
}
ok('καμία γραφή δύο φορές', new Set(BRAND_ALT_NAMES).size === BRAND_ALT_NAMES.length)
ok('χωρίς το κύριο όνομα ανάμεσα στα εναλλακτικά', !BRAND_ALT_NAMES.includes('PROPERWISE' as never))

// (β)
const org = organizationNode()
const site = websiteNode()
ok('ο οργανισμός δηλώνει όλες τις γραφές', JSON.stringify(org.alternateName) === JSON.stringify(BRAND_ALT_NAMES))
ok('ο ιστότοπος δηλώνει τις ίδιες', JSON.stringify(site.alternateName) === JSON.stringify(BRAND_ALT_NAMES))
ok('ο ιστότοπος έχει @id και διεύθυνση την αρχική', site['@id'] === WEBSITE_ID && site.url === SITE)
ok('ο εκδότης του ιστότοπου είναι ο οργανισμός', site.publisher === ORG_REF && ORG_REF['@id'] === ORG_ID)
ok('χωρίς SearchAction: ο ιστότοπος δεν έχει αναζήτηση', !('potentialAction' in site))

// (γ)
const el = appNode('α'), en = appNode('b')
ok('ένα @id για την εφαρμογή σε κάθε γλώσσα', el['@id'] === APP_ID && en['@id'] === APP_ID)
ok('μία διεύθυνση, η αρχική', el.url === SITE && en.url === SITE)
ok('μόνο «Web»', el.operatingSystem === 'Web')
ok('χωρίς αξιολογήσεις ή τιμή', !('aggregateRating' in el) && !('offers' in el))

// (δ)
for (const [lang, text] of Object.entries(BRAND_ABOUT)) {
  ok(`η πρόταση (${lang}) λέει το όνομα`, text.includes('PROPERWISE'))
  // Το «Ε2» είναι όνομα εντύπου, όχι ποσό.
  ok(`η πρόταση (${lang}) χωρίς ποσό ή ποσοστό`, !/\d/.test(text.replace(/[ΕE]2\b/g, '')))
  ok(`η πρόταση (${lang}) χωρίς κόμμα πριν από «και»`, !/,\s*(και|κι)(?!\p{L})/u.test(text))
}
ok('το description του οργανισμού είναι η ελληνική πρόταση', org.description === BRAND_ABOUT.el)

console.log(fail ? `✗ organization: ${fail} απέτυχαν από ${pass + fail}` : `✓ organization: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
