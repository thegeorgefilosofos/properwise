#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Ο ΣΥΝΤΕΛΕΣΤΗΣ ΣΤΟ ΚΕΙΜΕΝΟ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗ ΣΤΑΘΕΡΑ ΠΟΥ ΥΠΟΛΟΓΙΖΕΙ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ (08/10/2026). Ο κανόνας του AGENTS.md λέει ότι
// «ψηφίο γραμμένο με το χέρι» σε αριθμό φόρου είναι εύρημα. Οι φύλακες
// guard-tax-rates και guard-presumptive-rate πιάνουν μόνο τον ΠΟΛΛΑΠΛΑΣΙΑΣΜΟ με
// γυμνό ποσοστό· το κείμενο το άφηναν ρητά ελεύθερο. Βρέθηκαν έτσι γραμμένα με
// το χέρι, δίπλα σε σταθερά που υπάρχει: «ΦΜΑ 3,09%» τρεις φορές στο Δάνειο,
// «Με συντελεστή 22%» στον σύμβουλο δανείου (με `* 0.22` μία γραμμή πιο πάνω),
// «22%» και «φόρος μερίσματος 5%» στη Λογιστική, «τεκμαρτή έκπτωση (5%)» στο
// PDF της Κατάστασης και «95% των ακαθάριστων» στην Τιμολόγηση. Αν άλλαζε ένας
// συντελεστής, ο υπολογισμός θα άλλαζε και το κείμενο δίπλα του όχι.
//
// ΤΙ ΕΛΕΓΧΕΤΑΙ, ΑΚΡΙΒΩΣ. Κάθε γραμμή του app/** και του lib/tools/** (όχι
// δοκιμές, όχι σχόλια) που γράφει το ποσοστό μιας σταθεράς του FIGURES ΚΑΙ στην
// ίδια γραμμή μιλά για το θέμα της. Το θέμα ελέγχεται χωρίς τόνους και πεζά:
// στα ελληνικά ο τόνος μετακινείται στην κλίση (μέρισμα → μερίσματος, έκπτωση
// → εκπτώσεις) και ένα /μέρισμ/ με τόνο άφηνε έξω πραγματικό «φόρος 5%».
//
// ΤΡΕΙΣ ΑΜΥΝΕΣ:
//   1. Αυτοέλεγχος. Ο φύλακας διαβάζει την τιμή κάθε σταθεράς από το αρχείο
//      της και απαιτεί να γράφεται όπως το `expect`. Αν άλλαξε ο νόμος και η
//      σταθερά, κοκκινίζει: «ο συντελεστής άλλαξε».
//   2. Το `was`. Τότε το παλιό `expect` πηγαίνει στο `was` και το νέο στο
//      `expect`. Κάθε γραμμή που γράφει ακόμη την παλιά τιμή με το θέμα της
//      είναι κόκκινη χωρίς καστάνια. Χωρίς αυτό η αλλαγή του νόμου θα έβγαζε
//      τις παλιές γραμμές από τη μέτρηση και η καστάνια θα ζητούσε να
//      ΚΑΤΕΒΕΙ, κρύβοντας ακριβώς το μπαγιάτικο κείμενο.
//   3. Καστάνια. Οσα μένουν μετριούνται στο scripts/tax-literals-baseline.json
//      και το όριο μόνο κατεβαίνει.
//
// ΤΙ ΔΕΝ ΚΑΝΕΙ, ΓΡΑΜΜΕΝΟ ΓΙΑ ΝΑ ΜΗΝ ΔΙΑΒΑΣΤΕΙ ΤΟ ΠΡΑΣΙΝΟ ΩΣ «ΟΛΑ ΚΑΛΑ»:
//   · Θέμα και ποσοστό στην ΙΔΙΑ γραμμή μόνο. Ένα «22%» μόνο του σε <span>
//     ξεφεύγει· το πλατύτερο παράθυρο ξαναφέρνει τα ποσοστά του CSS.
//   · Δεν σαρώνει το lib/** έξω από το lib/tools, το components/** και το
//     supabase/functions (π.χ. lib/accounting/advisory.ts, updates2026.ts, τα
//     email). Εκεί ζει ακόμη φορολογικό κείμενο.
//   · Η καστάνια μετρά σύνολο: ένα PR μπορεί να αλλάξει ένα γραμμένο ποσοστό
//     με άλλο, όπως και στο percent-baseline.json.
//   · Ο γενικός ΦΠΑ 24% (τηλεπικοινωνίες, Νόα) ΔΕΝ είναι το NEW_BUILD_VAT_RATE:
//     εκείνο είναι ΦΠΑ νεόδμητων σε αναστολή. Γι' αυτό το θέμα του είναι μόνο
//     το «νεόδμητ». Αν ποτέ μπει ο γενικός ΦΠΑ, πηγαίνει στο VAT_STANDARD του
//     lib/tax/placeOfSupply.ts, ποτέ σε αυτό.
//
// ΟΙ ΑΝΤΙΘΕΤΕΣ ΑΠΟΦΑΣΕΙΣ. Το guard-tax-rates και το guard-presumptive-rate
// γράφουν ότι το ποσοστό σε ετικέτα «πρέπει να γράφεται». Γράφεται· από τη
// σταθερά, με fpRate(ΣΤΑΘΕΡΑ*100) ή ratePct/rateScale του app/odigos/taxText.ts,
// που δίνουν το ίδιο κείμενο ψηφίο προς ψηφίο.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { projectFiles } from './lib/git-files.mjs'
import { tightened } from './lib/ratchet.mjs'

const BASELINE_FILE = 'scripts/tax-literals-baseline.json'
const BASELINE = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))

// Οι σταθερές, το κείμενό τους σήμερα και το θέμα τους, χωρίς τόνους και πεζά.
// ΟΤΑΝ ΑΛΛΑΞΕΙ Ο ΝΟΜΟΣ: νέα τιμή στη σταθερά, το παλιό `expect` στο `was`,
// το νέο στο `expect`. Ποτέ σβήσιμο του παλιού.
const FIGURES = [
  { name: 'TRANSFER_TAX_RATE', file: 'lib/accounting/transfer.ts', expect: '3,09%', was: [],
    subject: /φμα|μεταβιβασ/u },
  { name: 'NEW_BUILD_VAT_RATE', file: 'lib/accounting/transfer.ts', expect: '24%', was: [],
    subject: /νεοδμητ/u },
  { name: 'COMMERCIAL_STAMP_DUTY', file: 'app/dashboard/components/TabTenantHelpers.tsx', expect: '3,6%', was: [],
    subject: /τελος συναλλαγης|χαρτοσημ/u },
  { name: 'MUNICIPAL_ACCOM_TAX_RATE', file: 'lib/billing/greekTax.ts', expect: '0,5%', was: [],
    subject: /παρεπιδημ/u },
  // Το «νομικ» δένεται στην αρχή λέξης: αλλιώς το «οικονομικά» (οικο-νομικ)
  // έκανε κάθε «22%» δίπλα του φόρο εταιρειών και ο φύλακας συμβούλευε να
  // γραφτεί μια πληρότητα από το CORPORATE_TAX_RATE_2026.
  { name: 'CORPORATE_TAX_RATE_2026', file: 'lib/billing/greekTax.ts', expect: '22%', was: [],
    subject: /εταιρ|(?<![\p{L}\p{N}])νομικ|(?<![\p{L}\p{N}])ικε(?![\p{L}\p{N}])/u,
    hits: ['Νομικό πρόσωπο (ΙΚΕ): σταθερός φόρος', 'η εταιρεία φορολογείται'],
    misses: ['Τα οικονομικά του μήνα: πληρότητα', 'οικονομική κατάσταση'] },
  { name: 'DIVIDEND_WITHHOLDING_RATE', file: 'lib/billing/greekTax.ts', expect: '5%', was: [],
    subject: /μερισμ/u },
  { name: 'PRESUMPTIVE_DEDUCTION_RATE', file: 'lib/billing/presumptive.ts', expect: '5%', was: [],
    subject: /εκπτωσ|τεκμαρτ/u },
  // Η βάση του φόρου μετά την τεκμαρτή έκπτωση: 1 − PRESUMPTIVE_DEDUCTION_RATE.
  { name: 'PRESUMPTIVE_DEDUCTION_RATE', derive: v => 1 - v, label: '1 − PRESUMPTIVE_DEDUCTION_RATE',
    file: 'lib/billing/presumptive.ts', expect: '95%', was: [], subject: /ακαθαριστ/u },
]

// Το ίδιο κείμενο με το fpRate του lib/core/format.ts.
const pct = v => `${(Math.round(v * 100 * 100) / 100).toLocaleString('el-GR', { maximumFractionDigits: 2 })}%`
const flat = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Το «5%» δεν είναι το «0,5%», το «15%» ή το «95%».
const literal = s => new RegExp(`(?<![\\d,.])${esc(s)}`, 'u')

// ── 1. Αυτοέλεγχος ──────────────────────────────────────────────────────────
const changed = []
for (const f of FIGURES) {
  const m = readFileSync(f.file, 'utf8').match(new RegExp(`export const ${f.name}\\s*=\\s*([0-9.]+)`))
  const shown = m ? pct((f.derive ?? (v => v))(Number(m[1]))) : null
  if (shown !== f.expect) changed.push(`  ${f.label ?? f.name} (${f.file}) γράφεται ${shown ?? 'δεν βρέθηκε'}, το expect λέει ${f.expect}`)
}
// Το θέμα πιάνει ό,τι πρέπει και αφήνει ό,τι δεν είναι φόρος (`hits`/`misses`).
const subjectWrong = []
for (const f of FIGURES) {
  for (const h of f.hits ?? []) if (!f.subject.test(flat(h))) subjectWrong.push(`  ${f.name}: δεν πιάνει «${h}»`)
  for (const m of f.misses ?? []) if (f.subject.test(flat(m))) subjectWrong.push(`  ${f.name}: πιάνει «${m}», που δεν είναι φόρος`)
}
if (subjectWrong.length) {
  console.error('✗ το θέμα ενός συντελεστή διαβάζει λάθος κείμενο:\n')
  for (const w of subjectWrong) console.error(w)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: διόρθωσε το `subject` στο scripts/guard-tax-literals.mjs.')
  process.exit(1)
}
if (changed.length) {
  console.error('✗ ο συντελεστής άλλαξε ή η σταθερά μετακόμισε:\n')
  for (const c of changed) console.error(c)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: αν άλλαξε ο νόμος, βάλε το παλιό expect στο `was` και το νέο')
  console.error('  στο `expect` του scripts/guard-tax-literals.mjs. Αν μετακόμισε η σταθερά,')
  console.error('  διόρθωσε το `file`.')
  process.exit(1)
}

// ── 2 και 3. Σάρωση ─────────────────────────────────────────────────────────
const files = projectFiles("'app/**/*.ts' 'app/**/*.tsx' 'lib/tools/**/*.ts' 'lib/tools/**/*.tsx'")
  .filter(f => !f.includes('.test.'))
const stale = []
const found = []
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  let inBlock = false
  lines.forEach((line, i) => {
    const t = line.trim()
    // Σχόλια και σχόλια JSX: εκεί ζει συχνά το παράδειγμα του λάθους.
    if (inBlock) { if (t.includes('*/')) inBlock = false; return }
    if (t.startsWith('/*') || t.startsWith('{/*')) { if (!t.includes('*/')) inBlock = true; return }
    if (t.startsWith('//') || t.startsWith('*')) return
    if (!line.includes('%')) return
    const subj = flat(line)
    const seen = new Set()
    for (const f of FIGURES) {
      if (!f.subject.test(subj)) continue
      for (const old of f.was) {
        if (literal(old).test(line)) stale.push({ at: `${file}:${i + 1}`, lit: old, f })
      }
      // Μία γραμμή με «5%» και δύο θέματα μετρά μία φορά.
      if (!seen.has(f.expect) && literal(f.expect).test(line)) {
        seen.add(f.expect)
        found.push({ at: `${file}:${i + 1}`, lit: f.expect, f })
      }
    }
  })
}

const hint = f => `${f.label ? `fpRate((${f.label})*100)` : `fpRate(${f.name}*100)`} από ${f.file}`

if (stale.length) {
  console.error(`✗ ${stale.length} φορές παλιός συντελεστής στο κείμενο:\n`)
  for (const s of stale.slice(0, 30)) console.error(`  ${s.at}  «${s.lit}» → ${hint(s.f)}`)
  if (stale.length > 30) console.error(`  … και άλλες ${stale.length - 30}`)
  console.error('\n  Ο νόμος άλλαξε, η σταθερά άλλαξε, το κείμενο έμεινε. Χωρίς καστάνια.')
  process.exit(1)
}

if (found.length > BASELINE.max) {
  console.error(`✗ ${found.length} φορολογικά ποσοστά γραμμένα με το χέρι, πάνω από το όριο ${BASELINE.max}:\n`)
  for (const x of found.slice(0, 30)) console.error(`  ${x.at}  «${x.lit}» → ${hint(x.f)}`)
  if (found.length > 30) console.error(`  … και άλλα ${found.length - 30}`)
  console.error('\n  ΤΙ ΝΑ ΚΑΝΕΙΣ: γράψε το ποσοστό από τη σταθερά (fpRate του lib/core/format.ts,')
  console.error('  ή ratePct/rateScale του app/odigos/taxText.ts για κλίμακες). Αν ΔΕΝ είναι')
  console.error('  φορολογικός συντελεστής (π.χ. εμπορική έκπτωση), αναδιατύπωσε τη γραμμή ώστε')
  console.error('  να μη μοιάζει με αυτόν.')
  process.exit(1)
}
if (!tightened({ total: found.length, max: BASELINE.max, what: 'φορολογικά ποσοστά γραμμένα με το χέρι', file: BASELINE_FILE, key: 'max' })) process.exit(1)
