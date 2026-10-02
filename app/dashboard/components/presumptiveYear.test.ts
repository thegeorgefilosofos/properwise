// ═══════════════════════════════════════════════════════════════════════════
// Η ΤΕΚΜΑΡΤΗ ΕΚΠΤΩΣΗ ΑΚΟΛΟΥΘΕΙ ΤΗ ΧΡΗΣΗ, ΟΧΙ ΜΟΝΟ ΤΟΝ ΤΡΟΠΟ ΕΙΣΠΡΑΞΗΣ (02.10.2026).
//
// Πριν: η Φροντίδα μισθωτή (TabTenantCare) και ο υπολογιστής δανείου
// (TabLoanData `taxableRental`) έκοβαν το 5% σε ενοίκιο με μετρητά ήδη από τη
// χρήση 2026. Η προϋπόθεση της τράπεζας ισχύει για μισθώματα από 1.7.2027.
//
// Τρέξε: npx tsx app/dashboard/components/presumptiveYear.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { taxableRental } from './TabLoanData'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const eq = (n: string, a: unknown, b: unknown) => ok(`${n}: ${String(a)} = ${String(b)}`, Math.abs(Number(a) - Number(b)) < 1e-6)

// ── taxableRental: η χρήση μετράει ──────────────────────────────────────────
eq('2026 μέσω τράπεζας', taxableRental(20000, true, 2026), 19000)
eq('2026 με μετρητά: η έκπτωση δίνεται ακόμη', taxableRental(20000, false, 2026), 19000)
eq('2025 με μετρητά', taxableRental(20000, false, 2025), 19000)
eq('2027 με μετρητά: μισή χρονιά', taxableRental(20000, false, 2027), 19500)
eq('2028 με μετρητά: χωρίς έκπτωση', taxableRental(20000, false, 2028), 20000)
eq('2028 μέσω τράπεζας', taxableRental(20000, true, 2028), 19000)

// ── Η Φροντίδα μισθωτή περνά από τον ίδιο κανόνα ────────────────────────────
// Το component είναι React και δεν φορτώνεται εδώ· ελέγχεται η πηγή του, όπως
// το obligations.test.ts ελέγχει ότι καμία οθόνη δεν γράφει δική της προθεσμία.
const care = readFileSync(join(process.cwd(), 'app/dashboard/components/TabTenantCare.tsx'), 'utf8')
ok('TabTenantCare: κανένα «viaBank ? 5% : 0» χωρίς χρονιά', !/viaBank\s*\?\s*PRESUMPTIVE_DEDUCTION_RATE\s*:\s*0/.test(care))
ok('TabTenantCare: ο συντελεστής από τη χρήση', /presumptiveDeductionRateForYear\(\s*taxYear\s*,\s*viaBank\s*\)/.test(care))
ok('TabTenantCare: το κείμενο ξέρει αν μετράει ο τρόπος', /bankReceiptMatters\(\s*taxYear\s*\)/.test(care))
const data = readFileSync(join(process.cwd(), 'app/dashboard/components/TabLoanData.tsx'), 'utf8')
ok('TabLoanData: κανένας τυφλός συντελεστής', !/presumptiveDeductionRate\(rentsPaidViaBank\)/.test(data))

console.log(`\npresumptiveYear — ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
