// ═══════════════════════════════════════════════════════════════════════════
// Η ΧΡΟΝΙΑ ΕΙΣΟΔΗΜΑΤΟΣ ΠΟΥ ΜΕΤΡΑ ΣΗΜΕΡΑ (02.10.2026).
//
// Πριν: ο υπολογιστής φόρου ενοικίων είχε καρφωμένα ['2025', '2026'] και
// διάβαζε το `etos` ως «2026 ή αλλιώς 2025» (το 2027 έπεφτε στην κλίμακα του
// 2025). Η Λογιστική άνοιγε πάντα στο τρέχον έτος, και τον Μάρτιο.
//
// Τρέξε: npx tsx lib/core/declarationYear.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { declarationYear, offeredIncomeYears, incomeYearFor, FILING_CLOSED_FROM_MONTH } from './declarationYear'
import { FIRST_YEAR_NEW_BRACKETS, rentalBracketsForYear } from '@/lib/billing/greekTax'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const eq = (n: string, a: unknown, b: unknown) => {
  const same = JSON.stringify(a) === JSON.stringify(b)
  ok(`${n}: ${JSON.stringify(a)} ${same ? '=' : '≠'} ${JSON.stringify(b)}`, same)
}

const FIRST = FIRST_YEAR_NEW_BRACKETS - 1

// ── Ο κανόνας του Αυγούστου ─────────────────────────────────────────────────
eq('ο μήνας κλεισίματος', FILING_CLOSED_FROM_MONTH, 8)
eq('2.10.2026: η τρέχουσα', declarationYear('2026-10-02'), 2026)
eq('15.3.2027: η περσινή', declarationYear('2027-03-15'), 2026)
eq('31.7.2027: ακόμη η περσινή', declarationYear('2027-07-31'), 2026)
eq('1.8.2027: η τρέχουσα', declarationYear('2027-08-01'), 2027)
eq('1.1.2027: η περσινή', declarationYear('2027-01-01'), 2026)

// ── Τα έτη του υπολογιστή ───────────────────────────────────────────────────
eq('2.10.2026', offeredIncomeYears('2026-10-02', FIRST), [2025, 2026])
eq('15.3.2027', offeredIncomeYears('2027-03-15', FIRST), [2026, 2027])
eq('2.10.2030', offeredIncomeYears('2030-10-02', FIRST), [2029, 2030])
eq('ποτέ πριν από την πρώτη τεκμηριωμένη κλίμακα', offeredIncomeYears('2025-03-01', FIRST), [2025])
ok('κάθε προσφερόμενο έτος έχει κλίμακα', ['2026-10-02', '2027-03-15', '2031-12-31'].every(d =>
  offeredIncomeYears(d, FIRST).every(y => rentalBracketsForYear(y).length > 0 && y >= FIRST)))

// ── Το etos της διεύθυνσης κλειδώνεται ──────────────────────────────────────
eq('etos=2027 το 2026 → 2026, όχι 2025', incomeYearFor('2027', '2026-10-02', FIRST), 2026)
eq('etos=2020 → 2025', incomeYearFor('2020', '2026-10-02', FIRST), 2025)
eq('etos=2025 μένει', incomeYearFor('2025', '2026-10-02', FIRST), 2025)
eq('etos=2027 το 2027 → 2027 (κλίμακα 2026 και μετά)', incomeYearFor('2027', '2027-03-15', FIRST), 2027)
ok('το 2027 παίρνει τη νέα κλίμακα', rentalBracketsForYear(incomeYearFor('2027', '2027-03-15', FIRST)) === rentalBracketsForYear(2026))

eq('incomeYearFor: etos=2027 το 2026', incomeYearFor('2027', '2026-10-02', FIRST), 2026)
eq('incomeYearFor: κενό το Μάρτιο του 2027', incomeYearFor('', '2027-03-15', FIRST), 2026)
eq('incomeYearFor: σκουπίδια τον Οκτώβριο του 2026', incomeYearFor('abc', '2026-10-02', FIRST), 2026)

// ── Οι δύο οθόνες περνούν από τον ίδιο κανόνα ───────────────────────────────
const calc = readFileSync(join(process.cwd(), 'app/ypologismos-forou-enoikion/RentTaxCalculator.tsx'), 'utf8')
ok('ο υπολογιστής δεν έχει καρφωμένα έτη', !/YEARS\s*=\s*\[\s*'2025'\s*,\s*'2026'\s*\]/.test(calc))
ok('ο υπολογιστής δεν διαβάζει «2026 ή αλλιώς 2025»', !/===\s*'2026'\s*\?\s*2026\s*:\s*2025/.test(calc))
ok('ο υπολογιστής κλειδώνει το etos', /incomeYearFor\(\s*v\.etos/.test(calc) && /offeredIncomeYears\(/.test(calc))
const acc = readFileSync(join(process.cwd(), 'app/dashboard/components/accounting/useAccounting.ts'), 'utf8')
ok('η Λογιστική ανοίγει στη χρήση της δήλωσης', /useState\(\s*\(\)\s*=>\s*declarationYear\(/.test(acc))

console.log(`\ndeclarationYear.ts — ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
