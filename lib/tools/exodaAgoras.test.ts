// npx tsx lib/tools/exodaAgoras.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΕΞΟΔΑ ΑΓΟΡΑΣ: ΣΕΝΑΡΙΑ ΥΠΟΛΟΓΙΣΜΕΝΑ ΣΤΟ ΧΕΡΙ
// ─────────────────────────────────────────────────────────────────────────
// Τα αναμενόμενα γράφονται ως ευρώ, υπολογισμένα με το χέρι από τον νόμο:
//   φόρος μεταβίβασης 3% και 3% αυτού υπέρ Δήμων = 3,09% (άρθρο 27 ν.5219/2025)
//   επί της μεγαλύτερης από τίμημα και αντικειμενική (άρθρο 25 παρ. 1)
//   απαλλαγή πρώτης κατοικίας 200.000€ / 250.000€ / +25.000€ ανά τέκνο (άρθρο 41)
//   ΦΠΑ νεόδμητου 24% στο τίμημα (άρθρα 24 και 26 ν.5144/2024)
//   τέλη Κτηματολογίου: όπως τα γράφει ο χρήστης (το 5‰ δεν επαληθεύτηκε στο ΦΕΚ)
// Αν αλλάξει κάποιος συντελεστής στο transfer.ts, αυτά κοκκινίζουν επίτηδες:
// η αλλαγή θέλει πηγή· η πηγή γράφεται και εδώ.
// ═══════════════════════════════════════════════════════════════════════════
import { purchaseCosts, type PurchaseResult } from './exodaAgoras'
import { transferTaxOn, firstHomeExemption } from '@/lib/accounting/transfer'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }
const line = (r: PurchaseResult, k: string) => r.lines.find(l => l.key === k)?.amount

// ═══ Α. ΤΟ ΠΑΡΑΔΕΙΓΜΑ ΤΗΣ ΣΕΛΙΔΑΣ: 200.000€, ΔΑΝΕΙΟ 150.000€ ═══════════════
{
  const r = purchaseCosts({ price: 200000, kind: 'resale', loan: 150000 })
  ok('Α. φόρος μεταβίβασης 6.180€', line(r, 'transferTax') === 6180)
  ok('Α. κανένα τέλος Κτηματολογίου από μόνο του', line(r, 'cadastre') === undefined)
  ok('Α. σύνολο 6.180€', r.total === 6180)
  ok('Α. ίδια συμμετοχή 50.000€', r.downPayment === 50000)
  ok('Α. μετρητά εκτός δανείου 56.180€', r.cashNeeded === 56180)
  ok('Α. ποσοστό 3,09%', Math.abs(r.costShare - 0.0309) < 1e-9)
  ok('Α. κανένας ΦΠΑ νεόδμητου', line(r, 'vat') === undefined)
  ok('Α. Κτηματολόγιο, μεσίτης, συμβολαιογράφος, δικηγόρος λέγονται ως «δεν περιλαμβάνονται»',
    r.missing.join() === 'cadastre,agent,notary,lawyer')
}

// ═══ Β. Η ΑΝΤΙΚΕΙΜΕΝΙΚΗ ΠΑΝΩ ΑΠΟ ΤΟ ΤΙΜΗΜΑ ═══════════════════════════════════
{
  const r = purchaseCosts({ price: 200000, objective: 250000, kind: 'resale' })
  ok('Β. φόρος στη μεγαλύτερη αξία: 7.725€', line(r, 'transferTax') === 7725)
  ok('Β. η βάση είναι 250.000€', r.taxBase === 250000)
  // Αντικειμενική κάτω από το τίμημα: μετρά το τίμημα.
  const low = purchaseCosts({ price: 200000, objective: 150000, kind: 'resale' })
  ok('Β. αντικειμενική χαμηλότερα: φόρος στο τίμημα', line(low, 'transferTax') === 6180)
}

// ═══ Γ. ΠΡΩΤΗ ΚΑΤΟΙΚΙΑ: ΦΟΡΟΣ ΜΟΝΟ ΠΑΝΩ ΑΠΟ ΤΟ ΟΡΙΟ ═════════════════════════
{
  const single = purchaseCosts({ price: 220000, kind: 'resale', firstHome: true })
  ok('Γ. άγαμος 220.000€: φόρος στις 20.000€ πάνω από το όριο, 618€', line(single, 'transferTax') === 618)
  ok('Γ. η απαλλαγή που φαίνεται είναι 200.000€', single.exemption === 200000)
  const family = purchaseCosts({ price: 300000, kind: 'resale', firstHome: true, married: true, children: 2 })
  ok('Γ. έγγαμος με 2 τέκνα: όριο 300.000€, φόρος 0', line(family, 'transferTax') === 0 && family.exemption === 300000)
  const three = purchaseCosts({ price: 340000, kind: 'resale', firstHome: true, married: true, children: 3 })
  ok('Γ. τρίτο τέκνο +30.000€: όριο 330.000€, φόρος 309€', line(three, 'transferTax') === 309)
  // Η ίδια αριθμητική με το Δάνειο και τη Λογιστική, όχι αντίγραφο.
  ok('Γ. ίδιο ποσό με transferTaxOn του transfer.ts',
    line(single, 'transferTax') === transferTaxOn(220000, firstHomeExemption({ married: false })))
  const notFirst = purchaseCosts({ price: 220000, kind: 'resale', firstHome: false, married: true })
  ok('Γ. χωρίς πρώτη κατοικία η οικογενειακή κατάσταση δεν μετρά', line(notFirst, 'transferTax') === 6798)
}

// ═══ Δ. ΝΕΟΔΜΗΤΟ: ΑΝΑΣΤΟΛΗ Ή ΦΠΑ ════════════════════════════════════════════
{
  const susp = purchaseCosts({ price: 200000, kind: 'newSuspended' })
  ok('Δ. σε αναστολή: φόρος μεταβίβασης όπως στο μεταχειρισμένο', line(susp, 'transferTax') === 6180 && line(susp, 'vat') === undefined)
  const vat = purchaseCosts({ price: 200000, objective: 250000, kind: 'newVat', firstHome: true })
  ok('Δ. με ΦΠΑ: 24% στο τίμημα, 48.000€ (όχι στην αντικειμενική)', line(vat, 'vat') === 48000)
  ok('Δ. με ΦΠΑ: κανένας φόρος μεταβίβασης', line(vat, 'transferTax') === undefined && !vat.transferTaxApplies)
  ok('Δ. με ΦΠΑ: η απαλλαγή πρώτης κατοικίας δεν εφαρμόζεται', vat.exemption === 0)
  ok('Δ. με ΦΠΑ: σύνολο μόνο ο ΦΠΑ', vat.total === 48000)
}

// ═══ Ε. ΟΣΑ ΣΥΜΦΩΝΕΙ Ο ΑΓΟΡΑΣΤΗΣ, ΜΕ ΦΠΑ 24% ═════════════════════════════════
{
  const r = purchaseCosts({
    price: 200000, kind: 'resale', cadastre: 1000, agentPct: 2, notaryNet: 1500, lawyerNet: 1000, other: 500, loan: 150000,
  })
  ok('Ε. Κτηματολόγιο όπως γράφτηκε, χωρίς ΦΠΑ', line(r, 'cadastre') === 1000)
  ok('Ε. μεσίτης 2% = 4.000€ συν ΦΠΑ = 4.960€', line(r, 'agent') === 4960)
  ok('Ε. συμβολαιογράφος 1.500€ συν ΦΠΑ = 1.860€', line(r, 'notary') === 1860)
  ok('Ε. δικηγόρος 1.000€ συν ΦΠΑ = 1.240€', line(r, 'lawyer') === 1240)
  ok('Ε. λοιπά όπως γράφτηκαν, χωρίς ΦΠΑ από πάνω', line(r, 'other') === 500)
  ok('Ε. σύνολο 15.740€', r.total === 15740)
  ok('Ε. τίποτα δεν λείπει', r.missing.length === 0)
  ok('Ε. μετρητά 65.740€', r.cashNeeded === 65740)
  ok('Ε. ο μεσίτης κρατά το καθαρό του', r.lines.find(l => l.key === 'agent')?.net === 4000)
  // «2,5» ως ποσοστό, όχι ως 0,025.
  const dec = purchaseCosts({ price: 200000, kind: 'resale', agentPct: 2.5 })
  ok('Ε. μεσίτης 2,5%: 5.000€ συν ΦΠΑ = 6.200€', line(dec, 'agent') === 6200)
}

// ═══ ΣΤ. ΔΑΝΕΙΟ ΚΑΙ ΑΚΡΑΙΕΣ ΤΙΜΕΣ ═══════════════════════════════════════════
{
  const over = purchaseCosts({ price: 100000, kind: 'resale', loan: 120000 })
  ok('ΣΤ. δάνειο πάνω από το τίμημα: μετρά έως το τίμημα', over.loan === 100000 && over.downPayment === 0)
  ok('ΣΤ. τότε τα μετρητά είναι μόνο τα έξοδα', over.cashNeeded === over.total)
  const none = purchaseCosts({ price: 100000, kind: 'resale' })
  ok('ΣΤ. χωρίς δάνειο: μετρητά = τίμημα + έξοδα', none.cashNeeded === 100000 + none.total)
  const bad = purchaseCosts({ price: NaN, objective: -5, kind: 'resale', agentPct: -2, notaryNet: NaN, children: -3, firstHome: true })
  ok('ΣΤ. σκουπίδια: μηδέν παντού, όχι NaN', bad.total === 0 && bad.cashNeeded === 0 && bad.costShare === 0)
  ok('ΣΤ. αρνητικά τέκνα: το βασικό όριο', bad.exemption === 200000)
}

console.log(failed === 0 ? `✓ exodaAgoras: ${passed} έλεγχοι πέρασαν` : `✗ exodaAgoras: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
