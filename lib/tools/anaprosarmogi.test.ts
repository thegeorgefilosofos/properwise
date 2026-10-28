// npx tsx lib/tools/anaprosarmogi.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΑΝΑΠΡΟΣΑΡΜΟΓΗ ΕΝΟΙΚΙΟΥ: ΣΕΝΑΡΙΑ ΥΠΟΛΟΓΙΣΜΕΝΑ ΣΤΟ ΧΕΡΙ
// ─────────────────────────────────────────────────────────────────────────
// Τα αναμενόμενα ποσά γράφονται από την αριθμητική (μίσθωμα × (1 + ποσοστό),
// στρογγυλό στο λεπτό, έτος με έτος), όχι από τη συνάρτηση που ελέγχεται. Ο
// δείκτης διαβάζεται από τον πίνακα της ΕΛΣΤΑΤ (lib/market/cpi.ts) ώστε μια
// νέα γραμμή εκεί να μη σπάει τα σενάρια που δεν την αφορούν.
// ═══════════════════════════════════════════════════════════════════════════
import { adjustPlan, ymPlusYears, officialIndex, clampYears, YEARS_MAX, type AdjustPlanInput } from './anaprosarmogi'
import { RENT_INDEX } from '@/lib/market/cpi'
import { COMMERCIAL_RENT_CAP_2026 } from '@/lib/documents/rentAdjustment'

let passed = 0, failed = 0
function ok(name: string, cond: boolean) { if (cond) { passed++ } else { failed++; console.log('  ✗ ' + name) } }
const tos = (p: ReturnType<typeof adjustPlan>) => p.rows.map(r => r.to)
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

const BASE: AdjustPlanInput = {
  rent: 600, lease: 'residential', basis: 'percent', pct: 3, share75: false,
  startYm: '2026-03', years: 3, existingLease: true,
}

// ═══ Α. ΒΟΗΘΗΤΙΚΑ ════════════════════════════════════════════════════════════
ok('Α. 2026-07 + 2 έτη = 2028-07', ymPlusYears('2026-07', 2) === '2028-07')
ok('Α. 2026-12 + 1 έτος = 2027-12', ymPlusYears('2026-12', 1) === '2027-12')
ok('Α. έτη: 0 → 1', clampYears(0) === 1)
ok('Α. έτη: 2,7 → 2', clampYears(2.7) === 2)
ok(`Α. έτη: 99 → ${YEARS_MAX}`, clampYears(99) === YEARS_MAX)
ok('Α. έτη: NaN → 1', clampYears(NaN) === 1)
ok('Α. δείκτης ΕΛΣΤΑΤ για μήνα του πίνακα', officialIndex('2026-07') === RENT_INDEX['2026-07'])
ok('Α. μήνας χωρίς ανακοίνωση: null, δεν κληρονομεί', officialIndex('2031-07') === null)

// ═══ Β. ΚΑΤΟΙΚΙΑ, ΣΤΑΘΕΡΟ ΠΟΣΟΣΤΟ, ΣΥΝΘΕΤΗ ════════════════════════════════
// 600 × 1,03 = 618,00 · 618 × 1,03 = 636,54 · 636,54 × 1,03 = 655,6362 → 655,64
{
  const p = adjustPlan(BASE)
  ok('Β. 600€ με 3%, τρία έτη: 618,00 · 636,54 · 655,64', same(tos(p), [618, 636.54, 655.64]))
  ok('Β. κάθε έτος ξεκινά από το προηγούμενο', p.rows[1].from === 618 && p.rows[2].from === 636.54)
  ok('Β. αύξηση του τρίτου έτους 19,10', p.rows[2].increase === 19.1)
  ok('Β. τελικό = τελευταία γραμμή', p.final === 655.64)
  ok('Β. μήνες: 2026-03, 2027-03, 2028-03', p.rows.map(r => r.ym).join() === '2026-03,2027-03,2028-03')
  ok('Β. κατοικία: κανένα όριο, ούτε μέσα στο 2026', p.rows.every(r => r.capPct === null && !r.capped))
  ok('Β. σταθερό ποσοστό: χωρίς δείκτη, χωρίς υπόθεση', p.rows.every(r => r.index === null) && !p.assumed)
  // Σύνθετη, όχι απλή: 600 × (1 + 3 × 3%) = 654,00 θα ήταν λάθος.
  ok('Β. όχι απλός τόκος (654,00)', p.final !== 654)
}

// ═══ Γ. ΣΤΡΟΓΓΥΛΟΠΟΙΗΣΗ ΣΤΟ ΛΕΠΤΟ, ΜΙΣΟ ΠΡΟΣ ΤΑ ΠΑΝΩ ══════════════════════
// 10,10 × 1,05 = 10,605 (δυαδικά 10,6049999…) → 10,61
{
  const p = adjustPlan({ ...BASE, rent: 10.1, pct: 5, years: 1 })
  ok('Γ. 10,10 με 5% = 10,61', p.final === 10.61)
  // 333,33 × 1,015 = 338,32995 → 338,33
  const q = adjustPlan({ ...BASE, rent: 333.33, pct: 1.5, years: 1 })
  ok('Γ. 333,33 με 1,5% = 338,33', q.final === 338.33)
}

// ═══ Δ. ΕΠΑΓΓΕΛΜΑΤΙΚΗ: ΠΛΑΦΟΝ ΜΟΝΟ ΜΕΣΑ ΣΤΟ 2026 ══════════════════════════
// Όρος 5%, μίσθωμα 1.500€, υφιστάμενη μίσθωση, πρώτη αναπροσαρμογή 01/2026:
// 2026 → 1.500 × 1,03 = 1.545,00 (όριο) · 2027 → 1.545 × 1,05 = 1.622,25 ·
// 2028 → 1.622,25 × 1,05 = 1.703,3625 → 1.703,36
const CAP = COMMERCIAL_RENT_CAP_2026.pct
{
  const p = adjustPlan({ ...BASE, lease: 'commercial', rent: 1500, pct: 5, startYm: '2026-01' })
  ok('Δ. 1.500€, όρος 5%: 1.545,00 · 1.622,25 · 1.703,36', same(tos(p), [1545, 1622.25, 1703.36]))
  ok(`Δ. το 2026 κόβεται στο ${CAP}%`, p.rows[0].capped && p.rows[0].appliedPct === CAP && p.rows[0].uncapped === 1575)
  ok('Δ. το 2027 δεν έχει όριο', p.rows[1].capPct === null && !p.rows[1].capped && p.rows[1].appliedPct === 5)
  ok('Δ. σημαία ορίου', p.cappedAny)
  // Ο όρος της σελίδας του οδηγού: 1.500 με 5% → έως 1.545 (άρθρο 59 ν.5255/2025).
  const dec = adjustPlan({ ...BASE, lease: 'commercial', rent: 1500, pct: 5, startYm: '2026-12', years: 1 })
  ok('Δ. Δεκέμβριος 2026: ακόμη μέσα στο όριο', dec.final === 1545)
  const jan27 = adjustPlan({ ...BASE, lease: 'commercial', rent: 1500, pct: 5, startYm: '2027-01', years: 1 })
  ok('Δ. Ιανουάριος 2027: εκτός ορίου', jan27.final === 1575 && !jan27.cappedAny)
  const fresh = adjustPlan({ ...BASE, lease: 'commercial', rent: 1500, pct: 5, startYm: '2026-06', years: 1, existingLease: false })
  ok('Δ. νέα μίσθωση του 2026: χωρίς όριο', fresh.final === 1575 && !fresh.cappedAny)
  const low = adjustPlan({ ...BASE, lease: 'commercial', rent: 1500, pct: 2, startYm: '2026-06', years: 1 })
  ok('Δ. όρος κάτω από το όριο: ισχύει ο όρος (1.530,00)', low.final === 1530 && !low.cappedAny)
}

// ═══ Ε. ΔΤΚ ΤΗΣ ΕΛΣΤΑΤ, ΜΕ ΥΠΟΘΕΣΗ ΟΠΟΥ ΔΕΝ ΕΧΕΙ ΑΝΑΚΟΙΝΩΘΕΙ ═════════════
{
  const jul = RENT_INDEX['2026-07']
  const p = adjustPlan({ ...BASE, rent: 800, basis: 'cpi', pct: 2, startYm: '2026-07', years: 2 })
  const y1 = Math.round(800 * (1 + jul / 100) * 100) / 100
  ok(`Ε. 2026-07: ο δείκτης της ΕΛΣΤΑΤ (${jul}%) → ${y1}`, p.rows[0].to === y1 && p.rows[0].index?.official === true && p.rows[0].index.pct === jul)
  // Δεύτερο έτος: 2027-07, χωρίς ανακοίνωση → η υπόθεση 2%.
  const y2 = Math.round(y1 * 1.02 * 100) / 100
  ok(`Ε. 2027-07: η υπόθεση 2% → ${y2}`, p.rows[1].to === y2 && p.rows[1].index?.official === false && p.rows[1].index.pct === 2)
  ok('Ε. σημαία υπόθεσης', p.assumed)
  ok('Ε. ολόκληρη η μεταβολή: όρος = δείκτης', p.rows[0].clausePct === jul)
}
// 75% και στρογγυλοποίηση στο δέκατο, όπως το δελτίο: 3,8 × 0,75 = 2,85 → 2,9.
{
  const p = adjustPlan({ ...BASE, rent: 1000, basis: 'cpi', pct: 0, share75: true, startYm: '2026-09', years: 1 })
  ok('Ε. 75% του 3,8% = 2,9% (όχι 2,85)', RENT_INDEX['2026-09'] !== 3.8 || p.rows[0].clausePct === 2.9)
  ok('Ε. 1.000€ με 2,9% = 1.029,00', RENT_INDEX['2026-09'] !== 3.8 || p.final === 1029)
}
// Επαγγελματική με ΔΤΚ: ο δείκτης περνά πρώτα από το 75% και μετά από το όριο.
{
  const jul = RENT_INDEX['2026-07']
  const p = adjustPlan({ ...BASE, lease: 'commercial', rent: 1000, basis: 'cpi', pct: 0, share75: true, startYm: '2026-07', years: 1 })
  const clause = Math.round(jul * 0.75 * 10) / 10
  const expect = clause > CAP ? 1000 * (1 + CAP / 100) : Math.round(1000 * (1 + clause / 100) * 100) / 100
  ok(`Ε. 1.000€, 75% του ${jul}% = ${clause}%, όριο ${CAP}% → ${expect}`, p.rows[0].clausePct === clause && p.final === expect)
}

// ═══ Ζ. ΑΚΡΑΙΑ ══════════════════════════════════════════════════════════════
ok('Ζ. χωρίς μίσθωμα: κενός πίνακας', adjustPlan({ ...BASE, rent: 0 }).rows.length === 0)
ok('Ζ. άκυρος μήνας: κενός πίνακας', adjustPlan({ ...BASE, startYm: '2026-13' }).rows.length === 0)
ok('Ζ. μηδέν τοις εκατό: ίδιο μίσθωμα', adjustPlan({ ...BASE, pct: 0 }).final === 600)
ok(`Ζ. 50 έτη: ${YEARS_MAX} γραμμές`, adjustPlan({ ...BASE, years: 50 }).rows.length === YEARS_MAX)

console.log(failed === 0 ? `✓ anaprosarmogi: ${passed} έλεγχοι πέρασαν` : `✗ anaprosarmogi: ${failed} απέτυχαν από ${passed + failed}`)
if (failed > 0) process.exit(1)
