// npx tsx lib/legal/checkout.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΤΑΜΕΙΟ ΜΕ ΠΩΛΗΤΗ ΤΟΝ ΕΜΠΟΡΟ (απόφαση George 21/10/2026)
// ─────────────────────────────────────────────────────────────────────────
// Από 20/10/2026 το ταμείο ήταν κλειστό στην παραγωγή επειδή τα στοιχεία του
// φορέα (lib/legal/identity.ts) είναι `null`. Ο έμπορος όμως είναι merchant of
// record: πουλά στο δικό του όνομα. Τότε πωλητής απέναντι στον αγοραστή είναι
// εκείνος και το ταμείο ανοίγει όταν η ταυτότητά του είναι δηλωμένη. Για
// έμπορο που ΔΕΝ πουλά στο όνομά του ισχύει ο κανόνας της 20/10 αυτούσιος.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { checkoutState } from './checkout'
import { billingWords } from './billingWords'
import { IDENTITY, type LegalIdentity } from './identity'
import { MOR_SELLERS, morSellerDisclosed } from './merchant'
import { merchant, type MerchantPort } from '../billing/merchant'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const PRODUCTS = 'p1:solo:monthly,p2:solo:annual,p3:owner:monthly,p4:owner:annual,'
  + 'p5:agency:monthly,p6:agency:annual,p7:office:monthly,p8:office:annual'
const LIVE = { CREEM_API_KEY: 'κλειδί', CREEM_PRODUCTS: PRODUCTS, CREEM_WEBHOOK_SECRET: 'μυστικό' }
const DARK = {}

/** Ο φορέας όπως είναι σήμερα: χωρίς όνομα, διεύθυνση, ΑΦΜ, τηλέφωνο. */
const ANON: LegalIdentity = { ...IDENTITY, legalName: null, address: null, afm: null, phone: null, gemi: null }

const MOR = merchant(LIVE)
/** Ο ίδιος έμπορος, αλλά χωρίς να πουλά στο όνομά του. */
const NON_MOR: MerchantPort = { ...MOR, sellerOfRecord: null }

// ── Η ΣΥΝΘΗΚΗ ─────────────────────────────────────────────────────────────
ok('ο έμπορος της εφαρμογής είναι merchant of record με δηλωμένο πωλητή', morSellerDisclosed(MOR.sellerOfRecord))
{
  const s = checkoutState(LIVE, ANON, MOR)
  ok('MoR ζωντανός + ταυτότητα φορέα null → ανοιχτό', s.live === true && s.closedBy === null)
}
{
  const s = checkoutState(LIVE, ANON, NON_MOR)
  ok('όχι MoR + ταυτότητα φορέα null → κλειστό για την ταυτότητα', s.live === false && s.closedBy === 'identity')
}
{
  const a = checkoutState(DARK, ANON, merchant(DARK))
  const b = checkoutState(DARK, ANON, { ...merchant(DARK), sellerOfRecord: null })
  ok('έμπορος όχι ζωντανός → κλειστό (MoR)', a.live === false && a.closedBy === 'merchant')
  ok('έμπορος όχι ζωντανός → κλειστό (όχι MoR)', b.live === false && b.closedBy === 'merchant')
}
// ΤΙΠΟΤΑ ΑΛΛΟ ΔΕΝ ΧΑΛΑΡΩΝΕΙ: δοκιμαστικό κλειδί στην παραγωγή κλείνει και τον MoR.
ok('δοκιμαστικό κλειδί στην παραγωγή → κλειστό',
  checkoutState({ ...LIVE, CREEM_API_KEY: 'creem_test_x', VERCEL_ENV: 'production' }, ANON).closedBy === 'merchant')
ok('χωρίς χάρτη προϊόντων → κλειστό', checkoutState({ ...LIVE, CREEM_PRODUCTS: '' }, ANON).closedBy === 'merchant')
ok('πωλητής χωρίς σύνδεσμο όρων δεν μετρά ως δηλωμένος',
  checkoutState(LIVE, ANON, { ...MOR, sellerOfRecord: { name: MOR.name, buyerTermsUrl: '' } }).closedBy === 'identity')
ok('πωλητής με σύνδεσμο όχι https δεν μετρά',
  !morSellerDisclosed({ name: MOR.name, buyerTermsUrl: 'http://example.org/terms' }))
ok('το IDENTITY της εφαρμογής δεν αλλάζει', IDENTITY.legalName === null && IDENTITY.afm === null && IDENTITY.address === null)

// ── Η ΓΡΑΜΜΗ ΤΟΥ ΠΩΛΗΤΗ ───────────────────────────────────────────────────
{
  const w = billingWords(LIVE, ANON, MOR)
  const seller = MOR_SELLERS.creem!
  ok('ανοιχτό ταμείο με ανώνυμο φορέα: τα λόγια είναι τα ζωντανά', w.live === true)
  ok('η γραμμή ονομάζει τον πωλητή', !!w.seller && w.seller.line.startsWith(`Πωλητής: ${seller.name}`))
  ok('λέει merchant of record, απόδειξη, ΦΠΑ, επιστροφές',
    !!w.seller && ['merchant of record', 'απόδειξη', 'ΦΠΑ', 'επιστροφές'].every(x => w.seller!.line.includes(x)))
  ok('δείχνει στους όρους του για τον αγοραστή', !!w.seller && w.seller.termsUrl === seller.buyerTermsUrl)
  ok('καμία εξήγηση «γιατί κλειστό» όσο πουλάμε', w.saleClosedReason === null)
  ok('κανένα στοιχείο φορέα στη γραμμή', !!w.seller && !/ΑΦΜ|ΓΕΜΗ/.test(w.seller.line))
  ok('κλειστό ταμείο: καμία γραμμή πωλητή', billingWords(DARK, ANON).seller === null)
  ok('όχι MoR: καμία γραμμή πωλητή', billingWords(LIVE, ANON, NON_MOR).seller === null)
}

// ── ΚΑΙ ΦΑΙΝΕΤΑΙ ΕΚΕΙ ΠΟΥ ΑΓΟΡΑΖΕΙΣ ──────────────────────────────────────────
// Οι σελίδες φορτώνουν next/* και δεν τρέχουν σε Node· φυλάγεται η θέση.
{
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
  const landing = read('app/tameio/CheckoutLanding.tsx')
  const iPay = landing.indexOf('Πληρωμή {fe(')
  const iSeller = landing.indexOf('<SellerLine seller={seller} />')
  ok('το ταμείο δείχνει τον πωλητή στο βήμα της πληρωμής', iPay >= 0 && iSeller > iPay)
  ok('το ταμείο παίρνει τη γραμμή από τα λόγια', read('app/tameio/page.tsx').includes('seller={w.seller}'))
  ok('ο τιμοκατάλογος δείχνει τον πωλητή', /<SellerLine seller=\{seller\} \/>/.test(read('app/paketa/PaymentsBadge.tsx')))
  ok('οι Όροι τυπώνουν τη γραμμή και τον σύνδεσμο', /words\.seller\.line.*words\.seller\.termsUrl/.test(read('app/terms/page.tsx')))
  ok('η γραμμή αποδίδει και τον σύνδεσμο', read('app/paketa/SellerLine.tsx').includes('href={seller.termsUrl}'))
}

console.log(fail === 0 ? `✓ checkout: ${pass} έλεγχοι πέρασαν` : `✗ checkout: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
