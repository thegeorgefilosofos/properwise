#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΜΙΑ ΠΩΛΗΣΗ ΔΕΝ ΡΩΤΑ ΚΑΤΕΥΘΕΙΑΝ ΤΟΝ ΕΜΠΟΡΟ: ΠΕΡΝΑ ΑΠΟ ΤΟ checkoutIsLive
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (νομική αξιολόγηση 20/10/2026, ευρήματα 1 και 3).
// Στην παραγωγή υπήρχε ζωντανό κλειδί εμπόρου. Πέντε σημεία έκριναν «πουλάμε;»
// με `merchant().isLive(env)`: τα λόγια της χρέωσης, το μητρώο υπεργολάβων,
// το ταμείο, η αλλαγή πακέτου και, μέσω των λόγων, κάθε σελίδα. Κανένα δεν
// ρωτούσε αν ο αγοραστής μπορεί να μάθει από ποιον αγοράζει: τα στοιχεία του
// φορέα (lib/legal/identity.ts) ήταν όλα `null`. Τέσσερις συνδρομές
// πωλούνταν από ανώνυμο πωλητή, κόντρα στο GDPR 13§1 α΄, στο π.δ. 131/2003
// άρθ. 4 και στον ν. 2251/1994 άρθ. 3β§1.
//
// Η ΔΙΟΡΘΩΣΗ ΕΙΝΑΙ ΜΙΑ ΣΥΝΘΗΚΗ: lib/legal/checkout.ts, έμπορος ΚΑΙ ταυτότητα.
// Ο φύλακας κρατά τη συνθήκη μοναδική. Ελέγχει τρία πράγματα:
//
//   1. Καμία κλήση `.isLive(` σε κώδικα εκτός από τις θέσεις που ΔΕΝ πουλούν:
//      τον ίδιο τον ορισμό (lib/billing/merchant/), τη συνθήκη (lib/legal/
//      checkout.ts) και τη διαγραφή λογαριασμού, που ακυρώνει συνδρομή που
//      ΥΠΑΡΧΕΙ ήδη και δεν επιτρέπεται να κλείσει για δικό μας κενό. Οι
//      σουίτες εξαιρούνται: δοκιμάζουν τη θύρα του εμπόρου ως έχει.
//   2. Η συνθήκη ζητά πράγματι την ταυτότητα: το lib/legal/checkout.ts καλεί
//      το `sellerIdentityComplete`.
//   3. Οι διαδρομές που πουλούν (ταμείο, αλλαγή πακέτου), τα λόγια και το
//      μητρώο ρωτούν τη συνθήκη (`checkoutIsLive` ή `checkoutState`).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'

const GATE = 'lib/legal/checkout.ts'
/** Οι θέσεις που ρωτούν τον έμπορο χωρίς να πουλούν, με τον λόγο τους πάνω. */
const ALLOWED = [
  /^lib\/billing\/merchant\//,
  /^lib\/legal\/checkout\.ts$/,
  /^app\/api\/account\/delete\/route\.ts$/,
]
/** Οσοι πρέπει να ρωτούν τη συνθήκη. */
const MUST_ASK = [
  'app/api/billing/checkout/route.ts',
  'app/api/billing/plan/route.ts',
  'lib/legal/billingWords.ts',
  'lib/legal/subprocessors.ts',
]

const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.tsx' 'components/**/*.ts'")
const provlimata = []

for (const arxeio of files) {
  if (!existsSync(arxeio)) continue
  if (arxeio.includes('.test.') || ALLOWED.some(r => r.test(arxeio))) continue
  readFileSync(arxeio, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    if (/\.isLive\(/.test(line)) provlimata.push({ arxeio, grammi: i + 1, ti: t.slice(0, 90) })
  })
}

const gate = existsSync(GATE) ? readFileSync(GATE, 'utf8') : ''
if (!/sellerIdentityComplete\(/.test(gate)) {
  provlimata.push({ arxeio: GATE, grammi: 1, ti: 'η συνθήκη του ταμείου δεν ελέγχει την ταυτότητα του πωλητή (sellerIdentityComplete)' })
}
for (const arxeio of MUST_ASK) {
  const src = existsSync(arxeio) ? readFileSync(arxeio, 'utf8') : ''
  if (!/\bcheckout(IsLive|State)\(/.test(src)) {
    provlimata.push({ arxeio, grammi: 1, ti: 'δεν ρωτά τη συνθήκη του ταμείου (checkoutIsLive ή checkoutState)' })
  }
}

if (provlimata.length) {
  console.error(`\n✗ ${provlimata.length} αποφάσεις πώλησης εκτός της μίας συνθήκης:\n`)
  for (const p of provlimata.slice(0, 30)) console.error(`  ${p.arxeio}:${p.grammi}  «${p.ti}»`)
  if (provlimata.length > 30) console.error(`  … και ${provlimata.length - 30} ακόμη`)
  console.error(`
  ΤΙ ΝΑ ΚΑΝΕΙΣ: για «πουλάμε τώρα;» κάλεσε το checkoutIsLive() ή το
  checkoutState() του ${GATE}. Κρίνει τη ρύθμιση του εμπόρου ΚΑΙ την ταυτότητα
  του πωλητή που απαιτεί ο νόμος. Αν η θέση σου αφορά συνδρομή που ΥΠΑΡΧΕΙ ήδη
  (ακύρωση, παραστατικά), πρόσθεσέ τη στο ALLOWED του φύλακα με τον λόγο.
  (Ο ίδιος ο φύλακας: scripts/guard-checkout-gate.mjs)
`)
  process.exit(1)
}
console.log(`✓ ταμείο: μία συνθήκη πώλησης, με ταυτότητα πωλητή, σε ${files.length} αρχεία`)
