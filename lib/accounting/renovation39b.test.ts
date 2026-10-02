// Τεστ για την έκπτωση φόρου ανακαίνισης (lib/accounting/renovation39b.ts).
// Ο κανόνας του ν.5073/2023 και της ΚΥΑ Α.1153/2025: μείωση ίση με τη δαπάνη,
// έως 16.000€ συνολικά, ισόποσα σε πέντε έτη. ΟΧΙ 40% με μέγιστο 6.400€.
import {
  renovationCredit, RENO_39B_CAP, RENO_39B_YEARS, RENO_39B_PER_YEAR, RENO_39B_FROM, RENO_39B_TO,
} from './renovation39b'
import { REGULATORY_UPDATES_2026 } from './updates2026'
import { YIELD_LEVERS } from '@/lib/market/greekMarket'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }

// ── Οι σταθερές ────────────────────────────────────────────────────────────
ok('όριο 16.000', RENO_39B_CAP === 16000)
ok('πέντε έτη', RENO_39B_YEARS === 5)
ok('3.200 τον χρόνο', RENO_39B_PER_YEAR === 3200)
ok('παράθυρο 01.01.2024 έως 31.12.2026', RENO_39B_FROM === '01.01.2024' && RENO_39B_TO === '31.12.2026')

// ── Τα παραδείγματα του οδηγού ─────────────────────────────────────────────
const a = renovationCredit({ services: 12000, materials: 4000 })
ok('12.000 + 4.000: υλικά μετρούν ολόκληρα', a.materialsCounted === 4000)
ok('12.000 + 4.000: επιλέξιμη 16.000', a.eligible === 16000)
ok('12.000 + 4.000: μείωση 16.000, όχι 6.400', a.total === 16000)
ok('12.000 + 4.000: 3.200 τον χρόνο', a.perYear === 3200)

const b = renovationCredit({ services: 9000, materials: 5000 })
ok('9.000 + 5.000: μετρούν 3.000 υλικά', b.materialsCounted === 3000)
ok('9.000 + 5.000: επιλέξιμη 12.000', b.eligible === 12000)
ok('9.000 + 5.000: μείωση 12.000, όχι 4.800', b.total === 12000)
ok('9.000 + 5.000: 2.400 τον χρόνο', b.perYear === 2400)

const c = renovationCredit({ services: 20000, materials: 5000 })
ok('25.000 επιλέξιμη: η μείωση κόβεται στα 16.000', c.eligible === 25000 && c.total === 16000 && c.perYear === 3200)

const z = renovationCredit({ services: NaN, materials: -5 })
ok('άκυρη είσοδος δίνει μηδέν', z.total === 0 && z.perYear === 0)

// ── Κανένα κείμενο δεν λέει πια τον κανόνα του 2020 ──────────────────────────
const OLD = /6\.400|40%/
const reno = REGULATORY_UPDATES_2026.find(u => /39Β/.test(u.summary))
ok('βάση γνώσης: υπάρχει εγγραφή 39Β', !!reno)
ok('βάση γνώσης: χωρίς 40% ή 6.400', !!reno && !OLD.test(reno.title + reno.summary))
ok('βάση γνώσης: λέει 16.000€ και 3.200€', !!reno && reno.summary.includes('16.000€') && reno.summary.includes('3.200€'))

const lever = YIELD_LEVERS.find(l => l.key === 'renovation_credit')
ok('μοχλός αγοράς: χωρίς 40% ή 6.400', !!lever && !OLD.test(lever.title + lever.gain + lever.impact + lever.detail))

console.log(`renovation39b.ts — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
if (failed > 0) { process.exit(1) }
console.log('όλα πέρασαν')
